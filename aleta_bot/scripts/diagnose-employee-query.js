#!/usr/bin/env node
// =============================================================================
// DIAGNOSIS: kenapa sumber data pegawai mengembalikan 0 baris.
//
//   docker compose exec aleta_bot node scripts/diagnose-employee-query.js
//
// Skrip ini HANYA MEMBACA (tidak mengirim pesan, tidak menulis ke SIPP).
// Ia menjawab pertanyaan yang tidak bisa dijawab dari kode saja:
//
//   1. Apakah kode di server sudah versi yang menjalankan query per-pegawai?
//   2. Menurut MySQL, hari ini tanggal berapa?
//   3. Apakah SIPP memang punya sidang hari ini?
//   4. Nama pegawai APA PERSISNYA yang tersimpan di SIPP untuk sidang hari ini?
//   5. Apakah nama itu cocok dengan nama di Manajemen Akun (setelah gelar dipangkas)?
//
// Poin 4 dan 5 adalah kuncinya: query menyaring dengan LIKE '%nama%', jadi bila
// penulisan nama berbeda, hasilnya selalu 0 baris walau sidangnya ada.
// =============================================================================
const externalDbService = require("../services/externalDbService");
const { normalizeLegacyEmployeeName } = require("../services/employeeNameUtil");
const { readRuntimeConfig } = require("../config/runtime-config");
const ms = require("../services/manualSendService");

const KONEKSI = process.env.ALETA_DIAG_CONNECTION_KEY || "sipp_primary";

function judul(teks) {
  console.log(`\n${"=".repeat(70)}\n${teks}\n${"=".repeat(70)}`);
}

async function aman(label, fn) {
  try {
    return await fn();
  } catch (error) {
    console.log(`  [!] ${label} gagal: ${error.message}`);
    return null;
  }
}

(async () => {
  judul("1. VERSI KODE DI SERVER");
  // Deteksi dari keberadaan fungsi, bukan dari .length (parameter dengan nilai
  // bawaan tidak dihitung oleh .length sehingga selalu 0 dan menyesatkan).
  const punyaNormalisasiNama = typeof normalizeLegacyEmployeeName === "function";
  const punyaDefaultTanggal = typeof ms.applyDefaultDateParams === "function";
  const kodeSumber = require("fs").readFileSync(require.resolve("../services/manualSendService.js"), "utf8");
  const punyaPreviewPerPegawai = kodeSumber.includes("previewEmployeeManualSend");
  const dukungPerPegawai = punyaPreviewPerPegawai && punyaNormalisasiNama;

  console.log(`  Preview per-pegawai (v1.5.2)        : ${punyaPreviewPerPegawai ? "ADA" : "TIDAK ADA"}`);
  console.log(`  Normalisasi nama bergelar (v1.5.3)  : ${punyaNormalisasiNama ? "ADA" : "TIDAK ADA"}`);
  console.log(`  Tanggal opsional (v1.5.8)           : ${punyaDefaultTanggal ? "ADA" : "TIDAK ADA"}`);
  if (!dukungPerPegawai) {
    console.log("\n  >> Kode di server masih versi lama. Pasang paket terbaru dulu,");
    console.log("     karena versi lama menjalankan query TANPA nama pegawai sehingga selalu 0 baris.");
  }

  judul("2. TANGGAL MENURUT DATABASE SIPP");
  const tanggal = await aman("SELECT CURDATE()", () =>
    externalDbService.query(KONEKSI, "SELECT CURDATE() AS hari_ini, NOW() AS waktu_server", [])
  );
  if (tanggal && tanggal[0]) {
    console.log(`  CURDATE() : ${tanggal[0].hari_ini}`);
    console.log(`  NOW()     : ${tanggal[0].waktu_server}`);
    console.log("  (Query memakai CURDATE(), jadi tanggal inilah yang dipakai menyaring.)");
  }

  judul("3. APAKAH ADA SIDANG HARI INI DI SIPP?");
  const jumlah = await aman("hitung sidang hari ini", () =>
    externalDbService.query(
      KONEKSI,
      "SELECT COUNT(*) AS jumlah FROM perkara_jadwal_sidang WHERE tanggal_sidang = CURDATE()",
      []
    )
  );
  if (jumlah && jumlah[0]) {
    console.log(`  Jumlah baris jadwal sidang hari ini : ${jumlah[0].jumlah}`);
    if (Number(jumlah[0].jumlah) === 0) {
      console.log("  >> Memang tidak ada sidang hari ini. Hasil 0 baris sudah BENAR.");
    }
  }

  // Query hakim memakai jadwal sidang TERAKHIR tiap perkara, lalu disaring = CURDATE().
  // Perkara yang tanggal sidang berikutnya sudah diisi petugas TIDAK akan muncul.
  const efektif = await aman("hitung perkara dengan sidang terakhir = hari ini", () =>
    externalDbService.query(
      KONEKSI,
      `SELECT COUNT(*) AS jumlah
       FROM perkara a
       JOIN (SELECT perkara_id, MAX(tanggal_sidang) AS terakhir
             FROM perkara_jadwal_sidang GROUP BY perkara_id) subq
         ON subq.perkara_id = a.perkara_id
       WHERE subq.terakhir = CURDATE()
         AND a.alur_perkara_id IN (15, 16, 17)`,
      []
    )
  );
  if (efektif && efektif[0]) {
    console.log(`  Perkara yang SIDANG TERAKHIRnya hari ini    : ${efektif[0].jumlah}`);
    console.log("  (Query memakai MAX(tanggal_sidang). Perkara yang tanggal sidang");
    console.log("   berikutnya sudah terlanjur diinput TIDAK ikut terhitung.)");
  }

  judul("4. NAMA PEGAWAI DI SIPP UNTUK SIDANG HARI INI");
  const namaSipp = {};
  const peran = [
    ["Hakim", "perkara_hakim_pn", "hakim_nama"],
    ["Panitera", "perkara_panitera_pn", "panitera_nama"],
    ["Jurusita", "perkara_jurusita", "jurusita_nama"],
  ];
  for (const [label, tabel, kolom] of peran) {
    const baris = await aman(`nama ${label}`, () =>
      externalDbService.query(
        KONEKSI,
        `SELECT DISTINCT t.${kolom} AS nama
         FROM perkara a
         JOIN (SELECT perkara_id, MAX(tanggal_sidang) AS terakhir
               FROM perkara_jadwal_sidang GROUP BY perkara_id) subq
           ON subq.perkara_id = a.perkara_id
         JOIN ${tabel} t ON t.perkara_id = a.perkara_id AND t.aktif = 'Y'
         WHERE subq.terakhir = CURDATE()
           AND a.alur_perkara_id IN (15, 16, 17)
           AND t.${kolom} IS NOT NULL AND t.${kolom} <> ''
         ORDER BY nama`,
        []
      )
    );
    namaSipp[label] = (baris || []).map((r) => String(r.nama || "").trim()).filter(Boolean);
    console.log(`\n  ${label} (${namaSipp[label].length} nama):`);
    namaSipp[label].forEach((n) => console.log(`     "${n}"`));
    if (namaSipp[label].length === 0) console.log("     (tidak ada)");
  }

  judul("5. COCOKKAN NAMA MANAJEMEN AKUN <-> SIPP");
  const config = readRuntimeConfig();
  const pegawai = Array.isArray(config.employeeRecipients) ? config.employeeRecipients : [];
  console.log(`  Pegawai dari portal (punya WhatsApp valid): ${pegawai.length}\n`);

  if (pegawai.length === 0) {
    console.log("  [!] Daftar pegawai KOSONG di runtime config bot.");
    console.log("      Buka Pengaturan ALETA Bot lalu Sinkronkan Konfigurasi dari portal.");
  }

  const semuaNamaSipp = [...new Set(Object.values(namaSipp).flat())];
  let cocokTotal = 0;
  for (const p of pegawai) {
    const asli = String(p.name || p.username || "").trim();
    if (!asli) continue;
    const dicari = normalizeLegacyEmployeeName(asli);
    const cocok = semuaNamaSipp.filter((n) => n.toLowerCase().includes(dicari.toLowerCase()));
    if (cocok.length > 0) cocokTotal += 1;
    const tanda = cocok.length > 0 ? "COCOK  " : "TIDAK  ";
    console.log(`  ${tanda} "${asli}"`);
    console.log(`          dicari sebagai: "${dicari}"`);
    if (cocok.length > 0) {
      cocok.forEach((n) => console.log(`          -> ketemu di SIPP: "${n}"`));
    }
  }

  judul("KESIMPULAN");
  const adaSidang = efektif && efektif[0] && Number(efektif[0].jumlah) > 0;
  if (!dukungPerPegawai) {
    console.log("  Kode server masih versi lama -> pasang paket terbaru.");
  } else if (!adaSidang) {
    console.log("  Tidak ada perkara yang sidang TERAKHIRnya hari ini.");
    console.log("  Hasil 0 baris memang benar, bukan kesalahan aplikasi.");
    console.log("  Catatan: perkara yang tanggal sidang berikutnya sudah diinput petugas");
    console.log("  tidak dianggap 'sidang hari ini' oleh query bawaan SIPP ini.");
  } else if (cocokTotal === 0) {
    console.log("  Ada sidang hari ini, TETAPI tidak satu pun nama pegawai portal cocok");
    console.log("  dengan nama di SIPP. Samakan penulisan nama di Manajemen Akun dengan");
    console.log("  daftar nama SIPP pada bagian 4 di atas.");
  } else {
    console.log(`  ${cocokTotal} pegawai cocok dengan nama di SIPP. Sumber data seharusnya berisi.`);
    console.log("  Bila di layar masih 0, kirimkan keluaran skrip ini untuk ditelusuri lebih lanjut.");
  }

  process.exit(0);
})().catch((error) => {
  console.error("\nDiagnosis gagal:", error.message);
  console.error("Bila error koneksi, coba: ALETA_DIAG_CONNECTION_KEY=<key> node scripts/diagnose-employee-query.js");
  process.exit(2);
});
