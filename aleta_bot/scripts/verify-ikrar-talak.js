"use strict";

/**
 * Verifikasi form "Penetapan Ikrar Talak" otomatis (ikrarTalakService, 18 Okt 2026).
 * Tanpa basis data sungguhan: db_config dipalsukan lewat require.cache, jadi aman
 * dijalankan di mana pun dan tidak pernah menulis ke SIPP.
 */

const path = require("path");

const dbPath = require.resolve(path.join(__dirname, "..", "db_config.js"));
let keadaan;
const dasar = () => ({
  jadwalId: 500,
  perkaraId: 9988,
  tanggalSidang: new Date(2026, 9, 7),
  ikrarTalak: "Y",
  ditunda: "T",
  alasanDitunda: "telah ikrar talak",
  keterangan: null,
  nomorPerkara: "474/Pdt.G/2026/PA.Dgl",
  pihak1: "Fadhil bin Muh. Azrul",
  pihak2: "Nismawati binti Suhufi",
  tanggalPutusan: new Date(2026, 8, 1),
  tanggalBht: new Date(2026, 8, 15),
  adaBarisIkrar: 9988,
  tglIkrar: null,
  statusIkrar: null,
  amarIkrar: null,
  tanggalPenetapanSidang: new Date(2026, 8, 22),
  penetapanJurusita: new Date(2026, 8, 22),
  penetapanPp: new Date(2026, 8, 22),
  penetapanMajelis: new Date(2026, 8, 22),
  adaAkta: 9988,
  keadaanIstri: null,
});
const tulis = [];
const akunKetua = { userid: 1, username: "fahri", fullname: "Fahri", block: 0, kedaluwarsa: null };
const palsu = {
  query(sql, params, cb) {
    if (typeof params === "function") {
      cb = params;
      params = [];
    }
    const s = String(sql);
    if (/^\s*(INSERT|UPDATE|DELETE|CALL)/i.test(s)) tulis.push(s);
    if (/FROM perkara_jadwal_sidang j/.test(s) && /perkara_ikrar_talak it/.test(s)) return cb(null, [keadaan]);
    if (/FROM perkara WHERE nomor_perkara/.test(s)) return cb(null, [{ id: 9988 }]);
    if (/FROM perkara_jadwal_sidang WHERE perkara_id = \? AND ikrar_talak = 'Y'/.test(s)) return cb(null, [{ id: 500 }]);
    if (/FROM perkara_hakim_pn/.test(s)) return cb(null, [{ hakimId: 32, jabatanId: 1 }, { hakimId: 26, jabatanId: 2 }]);
    if (/user_hakim/.test(s) && /sys_users/.test(s)) return cb(null, [akunKetua]);
    if (/FROM sys_users/.test(s)) return cb(null, [akunKetua]);
    if (/UNION ALL SELECT 'panitera'/.test(s)) return cb(null, [{ jabatan: "hakim", id: 32 }]);
    if (/NOW\(\)|UTC_TIMESTAMP|DATE_FORMAT/i.test(s)) {
      return cb(null, [{ sekarang: "2026-10-18 08:00:00", waktu: "2026-10-18 08:00:00", w: "2026-10-18 08:00:00", utc: "2026-10-18 00:00:00" }]);
    }
    return cb(null, []);
  },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: palsu };

// Bridge SIPP baca-saja dipalsukan: biaya ikrar dari variabel ABT 1101/2050 (tanpa basis data sungguhan).
let nilaiBiaya = { 1101: { status: "terisi", teks: "14.500" }, 2050: { status: "terisi", teks: "empat belas ribu lima ratus" } };
const jembatanPath = require.resolve(path.join(__dirname, "..", "services", "sippReadOnlyBridgeService.js"));
require.cache[jembatanPath] = {
  id: jembatanPath,
  filename: jembatanPath,
  loaded: true,
  exports: { handleBridgeOperation: async () => ({ ok: true, nilai: nilaiBiaya }) },
};

const ik = require("../services/ikrarTalakService");
const penetapan = require("../services/penetapanTulisService");

let lulus = 0;
let gagal = 0;
function periksa(nama, kondisi, rinci = "") {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${rinci ? ` - ${rinci}` : ""}`);
  }
}

(async () => {
  console.log("== Bahasa keterangan sidang ==");
  periksa("'Ikrar Telah Dilaksanakan' dianggap terlaksana", ik.ikrarTerlaksanaMenurutTeks("Ikrar Telah Dilaksanakan"));
  periksa("'telah ikrar talak' (ejaan SIPP) terlaksana", ik.ikrarTerlaksanaMenurutTeks("telah ikrar talak"));
  periksa("'Belum Ikrar' bukan terlaksana", !ik.ikrarTerlaksanaMenurutTeks("Belum Ikrar"));
  periksa("'Pemohon tidak hadir ikrar' bukan terlaksana", !ik.ikrarTerlaksanaMenurutTeks("Pemohon tidak hadir ikrar"));
  periksa("kosong / '0' bukan terlaksana", !ik.ikrarTerlaksanaMenurutTeks("") && !ik.ikrarTerlaksanaMenurutTeks("0"));

  console.log("== Batas 6 bulan ==");
  periksa("31 Agustus + 6 bulan = 28 Februari", ik.batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2026-08-31" }) === "2027-02-28");
  periksa("tanpa penetapan hari sidang: dari BHT", ik.batasEnamBulanIkrar({ tanggalBht: "2026-09-15" }) === "2027-03-15");
  periksa("tanpa dasar: kosong", ik.batasEnamBulanIkrar({}) === "");

  console.log("== Rencana pengisian form ikrar ==");
  keadaan = dasar();
  const r = await ik.susunRencanaIsiIkrar({ jadwalId: 500, ip: "192.168.1.5" });
  periksa("rencana ok", r.ok === true, r.alasan);
  periksa("tanggal ikrar = tanggal sidang ikrar", r.tanggalIkrar === "2026-10-07");
  periksa("atas nama ketua majelis ikrar", r.atasNama && r.atasNama.username === "fahri");
  const tabel = (r.langkah || []).map((l) => `${l.aksi} ${l.tabel}`);
  periksa(
    "langkah: keadaan istri, ikrar, audit, riwayat, status",
    tabel.join("|") === "UPDATE perkara_akta_cerai|UPDATE perkara_ikrar_talak|INSERT sys_audittrail|CALL perkara_proses|CALL perkara",
    tabel.join("|")
  );
  const ikrar = (r.langkah || []).find((l) => l.tabel === "perkara_ikrar_talak");
  periksa("status penetapan = 1 (diikrarkan)", ikrar && ikrar.params[1] === 1);
  periksa("amar >= 50 huruf (syarat SIPP)", ikrar && String(ikrar.params[2]).length >= 50);
  const audit = (r.langkah || []).find((l) => l.tabel === "sys_audittrail");
  periksa("audit: halaman PENETAPAN IKRAR TALAK, formname SIPP", audit && /PENETAPAN IKRAR TALAK<\/b> dengan Primary Key \[perkara_id=9988\]/.test(audit.params[6]) && audit.params[4] === "add/edit ikrar talak/akta cerai");
  const proses = (r.langkah || []).find((l) => l.tabel === "perkara_proses");
  periksa("riwayat: tahapan 18 proses 295 'Penetapan Ikrar Talak'", proses && proses.params[1] === "18" && proses.params[3] === "295" && proses.params[4] === "Penetapan Ikrar Talak");
  periksa("riwayat bertanggal sidang ikrar, akun ketua", proses && proses.params[5] === "2026-10-07" && proses.params[7] === "fahri");

  const kering = await penetapan.jalankanRencana(r, { kering: true });
  periksa("lolos penjaga tanda & daftar tabel (kering)", kering.ok === true, kering.alasan);
  periksa("rencana tidak menulis apa pun ke basis data", tulis.length === 0);
  periksa("tanpa kata aleta di isian", !/aleta/i.test(JSON.stringify((r.langkah || []).map((l) => l.params))));

  console.log("== Biaya amar dari variabel ABT biaya ikrar (#1101# / #2050#) ==");
  periksa("amar memuat biaya + terbilang dari ABT", /sebesar Rp14\.500,- \(empat belas ribu lima ratus rupiah\);/.test(String(ikrar.params[2])), String(ikrar.params[2]));
  periksa("andaian menyebut biaya diambil dari biaya perkara", (r.andaian || []).some((x) => /Rp14\.500,- diambil dari biaya perkara/.test(x)));
  periksa("bacaBiayaIkrar: angka berbentuk ribuan diterima", ik.bacaBiayaIkrar({ 1101: { status: "terisi", teks: "29.500" }, 2050: { status: "terisi", teks: "dua puluh sembilan ribu lima ratus" } }).jumlah === 29500);
  periksa("bacaBiayaIkrar: #1101# kosong -> null (tidak dikarang)", ik.bacaBiayaIkrar({ 1101: { status: "kosong", teks: "..." } }) === null);
  periksa("bacaBiayaIkrar: bukan angka / nol -> null", ik.bacaBiayaIkrar({ 1101: { status: "terisi", teks: "abc" } }) === null && ik.bacaBiayaIkrar({ 1101: { status: "terisi", teks: "0" } }) === null);
  periksa("bacaBiayaIkrar: tanpa terbilang tetap memuat angka", ik.bacaBiayaIkrar({ 1101: { status: "terisi", teks: "14.500" } }).terbilang === "");
  nilaiBiaya = { 1101: { status: "kosong", teks: "..." } };
  const tanpa = await ik.susunRencanaIsiIkrar({ jadwalId: 500, ip: "192.168.1.5" });
  const ikrarTanpa = (tanpa.langkah || []).find((l) => l.tabel === "perkara_ikrar_talak");
  periksa("biaya tak terbaca: amar tanpa angka + andaian periksa di SIPP", ikrarTanpa && !/Rp\d/.test(String(ikrarTanpa.params[2])) && (tanpa.andaian || []).some((x) => /tidak disebut/.test(x)));
  periksa("biaya tak terbaca: amar tetap >= 50 huruf", ikrarTanpa && String(ikrarTanpa.params[2]).length >= 50);
  nilaiBiaya = { 1101: { status: "terisi", teks: "14.500" }, 2050: { status: "terisi", teks: "empat belas ribu lima ratus" } };
  keadaan = { ...dasar(), amarIkrar: "<ol><li>Menyatakan perkawinan putus karena perceraian dengan talak satu raj'i;</li><li>Biaya Rp 29.500,-</li></ol>" };
  const adaAmar = await ik.susunRencanaIsiIkrar({ jadwalId: 500 });
  const ikrarAda = (adaAmar.langkah || []).find((l) => l.tabel === "perkara_ikrar_talak");
  periksa("amar yang sudah diketik petugas tidak ditimpa", ikrarAda && /Rp 29\.500/.test(String(ikrarAda.params[2])));
  keadaan = dasar();

  console.log("== Isian borang untuk ekstensi (butir 31: terisi otomatis saat halaman perkara dibuka) ==");
  {
    const tulisSebelum = tulis.length;
    const b = await ik.susunIsianBorangIkrar({ nomorPerkara: "474/Pdt.G/2026/PA.Dgl" });
    periksa("borang: ok untuk sidang ikrar terlaksana, form kosong", b.ok === true, b.alasan);
    periksa("borang: tgl_ikrar dd/mm/yyyy = tanggal sidang", b.nilai && b.nilai.tgl_ikrar === "07/10/2026");
    periksa("borang: status 1 (Diikrarkan), keadaan istri 4 (tidak diketahui) karena belum tercatat", b.nilai && b.nilai.status_penetapan === "1" && b.nilai.keadaan_istri === "4");
    periksa("borang: amar memuat biaya dari ABT dan >= 50 huruf", b.nilai && /Rp14\.500,-/.test(b.nilai.amar) && b.nilai.amar.length >= 50);
    periksa("borang: atas nama ketua majelis ikrar (informasi, bukan penulis)", b.atasNama && b.atasNama.username === "fahri");
    periksa("borang: MEMBACA saja - tidak satu pun tulisan ke basis data", tulis.length === tulisSebelum);
    periksa("borang: medan sesuai nama medan form SIPP", Object.keys(b.nilai).sort().join(",") === "amar,keadaan_istri,status_penetapan,tgl_ikrar");

    keadaan = { ...dasar(), keadaanIstri: 2 };
    const suci = await ik.susunIsianBorangIkrar({ perkaraId: 9988 });
    periksa("borang: keadaan istri yang sudah tercatat dipakai (tidak ditimpa)", suci.ok && suci.nilai.keadaan_istri === "2");

    keadaan = { ...dasar(), tglIkrar: new Date(2026, 9, 7), statusIkrar: 1, amarIkrar: "<ol><li>Menyatakan perkawinan putus karena talak satu raj'i;</li><li>Biaya Rp14.500,-</li></ol>" };
    const sudah = await ik.susunIsianBorangIkrar({ perkaraId: 9988 });
    periksa("borang: form sudah terisi -> tidak diisi lagi", sudah.ok === false && sudah.alasan === "form_ikrar_sudah_terisi");

    keadaan = { ...dasar(), alasanDitunda: "Pemohon tidak hadir ikrar" };
    periksa("borang: ikrar belum terlaksana -> diam", (await ik.susunIsianBorangIkrar({ perkaraId: 9988 })).alasan === "ikrar_belum_dinyatakan_terlaksana");
    keadaan = { ...dasar(), tanggalSidang: new Date(2026, 9, 10) };
    periksa("borang: sidang Sabtu -> diam seperti SIPP", (await ik.susunIsianBorangIkrar({ perkaraId: 9988 })).alasan === "tanggal_ikrar_akhir_pekan");
    keadaan = dasar();
    periksa("borang: tanpa nomor/perkara -> perkara_tidak_ketemu", (await ik.susunIsianBorangIkrar({})).alasan === "perkara_tidak_ketemu");
  }

  console.log("== Penolakan ==");
  keadaan = { ...dasar(), alasanDitunda: "Pemohon tidak hadir ikrar" };
  periksa("keterangan belum terlaksana -> ditolak", (await ik.susunRencanaIsiIkrar({ jadwalId: 500 })).alasan === "ikrar_belum_dinyatakan_terlaksana");
  keadaan = { ...dasar(), alasanDitunda: "0", keterangan: "Ikrar Telah Dilaksanakan" };
  periksa("keterangan 'Ikrar Telah Dilaksanakan' (diisi di SIPP) -> diterima", (await ik.susunRencanaIsiIkrar({ jadwalId: 500 })).ok === true);
  keadaan = { ...dasar(), tanggalSidang: new Date(2026, 9, 10) };
  periksa("sidang Sabtu -> ditolak seperti SIPP", (await ik.susunRencanaIsiIkrar({ jadwalId: 500 })).alasan === "tanggal_ikrar_akhir_pekan");
  keadaan = { ...dasar(), tanggalSidang: new Date(2026, 10, 3) };
  periksa("sidang di masa depan -> ditolak", (await ik.susunRencanaIsiIkrar({ jadwalId: 500 })).alasan === "tanggal_ikrar_masa_depan");
  keadaan = { ...dasar(), tanggalPutusan: new Date(2026, 9, 8) };
  periksa("tanggal ikrar mendahului putusan -> ditolak", /mendahului_putusan/.test((await ik.susunRencanaIsiIkrar({ jadwalId: 500 })).alasan));
  keadaan = { ...dasar(), ikrarTalak: "T" };
  periksa("bukan sidang ikrar -> ditolak", (await ik.susunRencanaIsiIkrar({ jadwalId: 500 })).alasan === "bukan_sidang_ikrar");
  keadaan = { ...dasar(), tglIkrar: new Date(2026, 9, 1) };
  periksa("tanggal ikrar lain sudah tercatat -> tidak ditimpa", (await ik.susunRencanaIsiIkrar({ jadwalId: 500 })).alasan === "tanggal_ikrar_lain_sudah_tercatat");
  keadaan = { ...dasar(), pihak1: "Budi (Aleta)" };
  periksa("nama yang menyebut aleta ditahan penjaga", (await ik.susunRencanaIsiIkrar({ jadwalId: 500 })).alasan === "teks_menyebut_aleta");

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch((e) => {
  console.error("GALAT", e);
  process.exit(1);
});
