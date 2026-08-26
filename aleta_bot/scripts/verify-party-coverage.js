#!/usr/bin/env node
// =============================================================================
// Verifikasi CAKUPAN PIHAK pada sumber data notifikasi, tanpa database.
//
//   node scripts/verify-party-coverage.js
//
// Notifikasi pihak wajib menjangkau SELURUH pihak berperkara, bukan hanya
// penggugat:
//   pihak_ke = 1 -> Penggugat/Pemohon
//   pihak_ke = 2 -> Tergugat/Termohon
//   pihak_ke = 3 -> Intervensi
//   pihak_ke = 4 -> Turut Tergugat
//   perkara_pengacara -> Kuasa Hukum (nomor diambil dari pihak.pengacara_id)
//
// Query legacy (notifikasi.js) sudah memakai enam sub-query. Query SQL baru
// sempat hanya memuat pihak_ke IN (1, 2) sehingga turut tergugat, intervensi,
// dan kuasa hukum tidak pernah dikirimi pesan.
// =============================================================================
const fs = require("fs");
const path = require("path");
const { validateQuery } = require("../services/queryValidatorService");
const ms = require("../services/manualSendService");

const SERVICE_TS = path.resolve(__dirname, "..", "..", "manajemen_surat", "src", "server", "modules", "aleta-bot", "service.ts");

let gagal = 0;
function periksa(label, aktual, harapan) {
  const ok = String(aktual) === String(harapan);
  if (!ok) gagal += 1;
  console.log(`  ${ok ? "OK   " : "GAGAL"}  ${label.padEnd(46)} -> ${aktual}${ok ? "" : ` (harap ${harapan})`}`);
}

function ambilSql(isi, queryId) {
  const penanda = `id: "${queryId}"`;
  const mulai = isi.indexOf(penanda);
  if (mulai < 0) return null;
  const kunci = isi.indexOf("sqlText: `", mulai);
  if (kunci < 0) return null;
  const awal = kunci + "sqlText: `".length;
  const akhir = isi.indexOf("`,", awal);
  return isi.slice(awal, akhir);
}

const isi = fs.readFileSync(SERVICE_TS, "utf8");
const kolom = [
  "nama_pihak",
  "telepon",
  "nomor_perkara",
  "jenis_perkara_nama",
  "peran_pihak",
  "tanggal_sidang",
  "hari_sidang",
  "agenda",
  "ruangan",
  "ringkasan",
  "petitum_dok",
];

for (const queryId of ["sipp-pihak-sebelum-sidang-h1", "sipp-pihak-sidang-per-tanggal"]) {
  console.log(`\n=== ${queryId} ===`);
  const sql = ambilSql(isi, queryId);
  if (!sql) {
    console.log("  GAGAL  sumber data tidak ditemukan di service.ts");
    gagal += 1;
    continue;
  }

  console.log("  -- cakupan pihak --");
  periksa("mencakup pihak_ke 1,2,3,4", /pihak_ke IN \(1, 2, 3, 4\)/.test(sql), true);
  periksa("mencakup kuasa hukum", sql.includes("perkara_pengacara"), true);
  periksa("kuasa memakai pengacara_id", sql.includes("b.id = a.pengacara_id"), true);
  periksa("menandai peran tiap penerima", sql.includes("peran_pihak"), true);
  periksa("ikut membawa dokumen gugatan", sql.includes("petitum_dok"), true);

  console.log("  -- parameter & keamanan --");
  const params = ms.extractQueryParameters(sql);
  const bound = ms.bindQueryParameters(sql, { tanggal_sidang: "2026-07-28" });
  const jumlahTanda = (bound.boundSql.match(/\?/g) || []).length;
  periksa("tidak ada placeholder tersisa", /\{\{/.test(bound.boundSql), false);
  periksa("jumlah ? = jumlah nilai", jumlahTanda === bound.values.length, true);
  if (params.length > 0) {
    periksa("parameter kosong terdeteksi", ms.bindQueryParameters(sql, {}).missing.length > 0, true);
  }

  const hasil = validateQuery(bound.boundSql, {
    category: "party",
    recipientColumn: "telepon",
    outputColumns: kolom,
  });
  periksa("lolos validator read-only", hasil.valid, true);
  if (!hasil.valid) console.log("         errors:", JSON.stringify(hasil.errors));
}

// -----------------------------------------------------------------------------
// Parameter tanggal bersifat OPSIONAL: dikosongkan berarti hari ini, diisi
// berarti mengikuti tanggal pilihan operator.
// -----------------------------------------------------------------------------
console.log("\n=== parameter tanggal opsional ===");
const sqlTanggal = ambilSql(isi, "sipp-pihak-sidang-per-tanggal");
const hariIni = ms.todayInCourtTimezone();
console.log(`  hari ini (zona pengadilan): ${hariIni}`);

const kosong = ms.applyDefaultDateParams(sqlTanggal, {});
periksa("kosong -> hari ini", kosong.tanggal_sidang, hariIni);
periksa("spasi saja -> hari ini", ms.applyDefaultDateParams(sqlTanggal, { tanggal_sidang: "   " }).tanggal_sidang, hariIni);
periksa(
  "diisi -> mengikuti pilihan",
  ms.applyDefaultDateParams(sqlTanggal, { tanggal_sidang: "2026-08-15" }).tanggal_sidang,
  "2026-08-15"
);

const bindKosong = ms.bindQueryParameters(sqlTanggal, kosong);
periksa("kosong tidak dianggap parameter hilang", bindKosong.missing.length, 0);
periksa("semua nilai ter-bind = hari ini", bindKosong.values.every((v) => v === hariIni), true);

const bindIsi = ms.bindQueryParameters(sqlTanggal, ms.applyDefaultDateParams(sqlTanggal, { tanggal_sidang: "2026-08-15" }));
periksa("semua nilai ter-bind = tanggal pilihan", bindIsi.values.every((v) => v === "2026-08-15"), true);

periksa(
  "parameter non-tanggal tidak diisi otomatis",
  ms.applyDefaultDateParams("SELECT 1 WHERE x = {{jenis_perkara}}", {}).jenis_perkara,
  undefined
);

// -----------------------------------------------------------------------------
// Tanggal acuan berlaku untuk SEMUA sumber data SQL, bukan hanya yang punya
// parameter tanggal: CURDATE()/CURRENT_DATE di dalam SQL digantikan tanggal
// pilihan operator sebagai nilai terikat.
// -----------------------------------------------------------------------------
console.log("\n=== tanggal acuan untuk semua sumber data SQL ===");
periksa("SQL ber-CURDATE() didukung", ms.supportsReferenceDate("SELECT 1 WHERE t = CURDATE()"), true);
periksa("SQL ber-CURRENT_DATE didukung", ms.supportsReferenceDate("SELECT 1 WHERE t = CURRENT_DATE"), true);
periksa("SQL berparameter tanggal didukung", ms.supportsReferenceDate("SELECT 1 WHERE t = {{tanggal_sidang}}"), true);
periksa("SQL tanpa tanggal tidak didukung", ms.supportsReferenceDate("SELECT 1 WHERE x = 2"), false);
// Sejak CURDATE() jalur lama ikut digantikan saat eksekusi (lihat
// services/legacyDateContext.js), jalur lama JUGA mendukung tanggal acuan.
periksa(
  "jalur lama kini ikut didukung",
  ms.supportsReferenceDate("legacy:notifikasi.getDataJadwalSidangPerdataHakim"),
  true
);
periksa(
  "pseudo-query portal:/runtime: tetap tidak didukung",
  ms.supportsReferenceDate("runtime:antrianOnline.registerOnlineQueue"),
  false
);

const sqlRelatif = "SELECT * FROM j WHERE a = CURDATE() AND b = DATE_ADD(CURDATE(), INTERVAL 3 DAY)";
const tanpaPilihan = ms.bindQueryParameters(sqlRelatif, {}, "");
periksa("tanpa pilihan: CURDATE() dibiarkan apa adanya", /CURDATE\(\)/.test(tanpaPilihan.boundSql), true);
periksa("tanpa pilihan: tidak ada nilai terikat", tanpaPilihan.values.length, 0);

const denganPilihan = ms.bindQueryParameters(sqlRelatif, {}, "2026-08-15");
periksa("dengan pilihan: CURDATE() tergantikan", /CURDATE\(\)/.test(denganPilihan.boundSql), false);
periksa("dengan pilihan: semua nilai = tanggal pilihan", denganPilihan.values.every((v) => v === "2026-08-15"), true);

// Kasus paling rawan: placeholder dan CURDATE() bercampur. Urutan nilai harus
// sejajar dengan urutan tanda tanya, kalau tidak parameter bisa tertukar.
const sqlCampur = "SELECT * FROM t WHERE a={{jenis}} AND b=CURDATE() AND c={{kode}} AND d=CURDATE()";
const campur = ms.bindQueryParameters(sqlCampur, { jenis: "CERAI", kode: "K9" }, "2026-08-15");
periksa(
  "urutan nilai sejajar posisi tanda tanya",
  campur.values.join("|"),
  ["CERAI", "2026-08-15", "K9", "2026-08-15"].join("|")
);
periksa("jumlah tanda tanya = jumlah nilai", (campur.boundSql.match(/\?/g) || []).length, campur.values.length);
periksa("tidak ada penanda tersisa", /\{\{|CURDATE/.test(campur.boundSql), false);

const validasiCampur = validateQuery(campur.boundSql, { category: "party", recipientColumn: "telepon", outputColumns: kolom });
periksa("hasil substitusi lolos validator read-only", validasiCampur.valid, true);

console.log(gagal === 0 ? "\nSEMUA PERIKSAAN LULUS" : `\n${gagal} PERIKSAAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
