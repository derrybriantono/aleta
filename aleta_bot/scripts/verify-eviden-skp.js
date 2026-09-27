"use strict";

/**
 * ============================================================================
 * EVIDEN SKP - DIHITUNG ATAS SIPP TIRUAN YANG SUNGGUH MENYARING
 * ============================================================================
 *
 * db_config diganti tiruan sebelum layanannya dimuat. Tiruan ini menyimpan
 * tabel kecil dan MENJALANKAN saringan tiap kueri atas parameternya - hakim_id,
 * id mediator, rentang tanggal, dan daftar IN (...) yang dikirim layanan itulah
 * yang menentukan baris mana yang pulang. Layanan yang menyaring lewat nama,
 * salah menaruh tanggal periode, atau melupakan jalan masuk mediator tanpa
 * mediator_id mendapat baris yang keliru dan pemeriksaannya patah di sini.
 *
 * Yang dijaga:
 *   - aturan periode keempat jalan masuk (majelis pemeriksa, upaya hukum,
 *     majelis ikrar, mediator) termasuk batasnya tepat pada hari pertama dan
 *     terakhir periode;
 *   - hubungan dari majelisPemeriksaService: yang diganti sebelum putusan
 *     tidak dihitung dan DISEBUT; orang bernama sama dengan id lain tidak ikut;
 *   - tiap ruas dari sumbernya: musyawarah (agenda dan sidang sesudah sidang
 *     yang ditunda untuk musyawarah), sidang keliling (tanda, ruangan, atribut),
 *     itsbat terpadu (jenis 360 + ruang terpadu; ruangan_id yang dipakai ulang
 *     tidak dipercaya), ghaib, prodeo, e-Court, e-Summons, salinan dan
 *     anonimisasi beserta tanggalnya, alamat Direktori Putusan, banding/
 *     kasasi/PK beserta tanggal input pemberitahuannya, ikrar, mediasi, nama
 *     status lewat JOIN (status_putusan_nama sengaja kosong);
 *   - Ketua dari sys_config: HANYA nama konfigurasi yang diminta dibaca (sandi
 *     tiruan di sana tidak pernah pulang), NIP 17 angka dilengkapi hanya bila
 *     tepat satu hakim bernama sama;
 *   - ruas yang tidak terbaca menjadi null dan disebut di galat; bacaan inti
 *     yang gagal menggagalkan seluruhnya (502); id tak dikenal 404; masukan
 *     salah 400; periode yang belum dimulai ditolak;
 *   - singgahan: hitungan kedua tidak menyentuh SIPP, yang bergalat tidak
 *     disinggahkan;
 *   - rute bot /sipp/eviden-skp lewat HTTP sungguhan: token, parameter, kode.
 *
 * Tidak ada basis data yang disentuh. Nama orang dan nomor perkara karangan.
 */

const pathx = require("path");
const Module = require("module");
const http = require("http");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan !== undefined ? ` - ${JSON.stringify(keterangan)}` : ""}`);
  }
}

const HARI_INI = "2026-09-27";
const TW2 = { peran: "hakim", id: "31", tahun: "2026", periode: "tw2" };

// ============================================================================
// SIPP TIRUAN
// ============================================================================

// jenis_perkara_nama pada tabel perkara sengaja SALINAN lama untuk 1005
// ("Istbat Nikah") - nama tampilnya harus dari rujukan jenis_perkara.
const PERKARA = {
  1001: { nomor: "1001/Pdt.G/2026/PA.Ctt", daftar: "2026-02-10", jenisId: 364, jenisNama: "Kewarisan", alurId: 15, prodeo: 0 },
  1002: { nomor: "1002/Pdt.G/2026/PA.Ctt", daftar: "2026-06-20", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 1 },
  1003: { nomor: "1003/Pdt.G/2026/PA.Ctt", daftar: "2026-01-05", jenisId: 364, jenisNama: "Kewarisan", alurId: 15, prodeo: 0 },
  1004: { nomor: "1004/Pdt.G/2026/PA.Ctt", daftar: "2026-07-02", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1005: { nomor: "1005/Pdt.P/2026/PA.Ctt", daftar: "2026-05-02", jenisId: 360, jenisNama: "Istbat Nikah", alurId: 16, prodeo: 0 },
  1006: { nomor: "1006/Pdt.G/2026/PA.Ctt", daftar: "2026-03-01", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1007: { nomor: "1007/Pdt.G/2026/PA.Ctt", daftar: "2025-12-01", jenisId: 346, jenisNama: "Cerai Talak", alurId: 15, prodeo: 0 },
  1008: { nomor: "1008/Pdt.G/2026/PA.Ctt", daftar: "2026-01-15", jenisId: 346, jenisNama: "Cerai Talak", alurId: 15, prodeo: 0 },
  1009: { nomor: "1009/Pdt.G/2025/PA.Ctt", daftar: "2025-09-01", jenisId: 346, jenisNama: "Cerai Talak", alurId: 15, prodeo: 0 },
  1010: { nomor: "1010/Pdt.G/2026/PA.Ctt", daftar: "2026-03-20", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1011: { nomor: "1011/Pdt.G/2026/PA.Ctt", daftar: "2026-06-10", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1012: { nomor: "1012/Pdt.G/2017/PA.Ctt", daftar: "2017-02-01", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1013: { nomor: "1013/Pdt.G/2026/PA.Ctt", daftar: "2026-01-02", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1014: { nomor: "1014/Pdt.G/2026/PA.Ctt", daftar: "2026-04-05", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1015: { nomor: "1015/Pdt.G/2026/PA.Ctt", daftar: "2026-04-10", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1017: { nomor: "1017/Pdt.G/2026/PA.Ctt", daftar: "2026-04-12", jenisId: 346, jenisNama: "Cerai Talak", alurId: 15, prodeo: 0 },
  // Batas: diputus TEPAT pada hari pertama periode, didaftarkan TEPAT pada hari terakhirnya.
  1018: { nomor: "1018/Pdt.G/2026/PA.Ctt", daftar: "2026-02-02", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1019: { nomor: "1019/Pdt.G/2026/PA.Ctt", daftar: "2026-06-30", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  // Majelis ikrar HANYA tercatat pada borang ikrar (tanpa penunjukan tahapan 18).
  1020: { nomor: "1020/Pdt.G/2026/PA.Ctt", daftar: "2026-01-20", jenisId: 346, jenisNama: "Cerai Talak", alurId: 15, prodeo: 0 },
  // Borang ikrar yang id dan namanya tidak dapat dipasangkan (tiga id, dua nama).
  1021: { nomor: "1021/Pdt.G/2026/PA.Ctt", daftar: "2026-01-21", jenisId: 346, jenisNama: "Cerai Talak", alurId: 15, prodeo: 0 },
  // Triwulan III yang BELUM berakhir (hari ini 27 September): jadwal sesudah
  // hari ini belum terjadi.
  1022: { nomor: "1022/Pdt.G/2026/PA.Ctt", daftar: "2026-08-01", jenisId: 347, jenisNama: "Cerai Gugat", alurId: 15, prodeo: 0 },
  1023: { nomor: "1023/Pdt.G/2026/PA.Ctt", daftar: "2026-05-01", jenisId: 346, jenisNama: "Cerai Talak", alurId: 15, prodeo: 0 },
};
const JENIS = { 346: "Cerai Talak", 347: "Cerai Gugat", 360: "Pengesahan Perkawinan/Istbat Nikah", 364: "Kewarisan" };
const STATUS = { 62: "Dikabulkan", 67: "Dicabut" };

// status_putusan_nama KOSONG seperti di SIPP satker - nama hanya lewat JOIN.
const PUTUSAN = {
  1001: { putus: "2026-04-15", statusId: 62, verstek: "T", minutasi: "2026-04-15", bht: "2026-04-29", dok: "doc/1001.rtf", anonim: "anonimisasi/1001.rtf" },
  1003: { putus: "2026-03-20", statusId: 62, verstek: "Y", minutasi: "2026-03-20", bht: null, dok: "doc/1003.rtf", anonim: "" },
  1005: { putus: "2026-05-08", statusId: 62, verstek: "T", minutasi: "2026-05-08", bht: "2026-05-08", dok: "doc/1005.pdf", anonim: null },
  1006: { putus: "2026-05-20", statusId: 62, verstek: "T", minutasi: "2026-05-20", bht: "2026-06-03", dok: "", anonim: "" },
  1007: { putus: "2026-02-01", statusId: 62, verstek: "T", minutasi: "2026-02-01", bht: "2026-02-15", dok: "d", anonim: "a" },
  1008: { putus: "2026-03-01", statusId: 62, verstek: "T", minutasi: "2026-03-01", bht: "2026-03-15", dok: "d", anonim: "a" },
  1009: { putus: "2025-10-01", statusId: 62, verstek: "T", minutasi: "2025-10-01", bht: "2025-10-15", dok: "d", anonim: "a" },
  1020: { putus: "2026-03-10", statusId: 62, verstek: "T", minutasi: "2026-03-10", bht: "2026-03-24", dok: "d", anonim: "a" },
  1023: { putus: "2026-08-10", statusId: 62, verstek: "T", minutasi: "2026-08-10", bht: "2026-08-24", dok: "d", anonim: "a" },
  1021: { putus: "2026-03-11", statusId: 62, verstek: "T", minutasi: "2026-03-11", bht: "2026-03-25", dok: "d", anonim: "a" },
  1012: { putus: "2017-05-01", statusId: 62, verstek: "T", minutasi: "2017-05-01", bht: "2017-05-15", dok: "d", anonim: "a" },
  1013: { putus: "2026-02-20", statusId: 67, verstek: "T", minutasi: "2026-02-20", bht: "2026-02-20", dok: "d", anonim: "a" },
  1018: { putus: "2026-04-01", statusId: 67, verstek: "T", minutasi: "2026-04-01", bht: "2026-04-01", dok: "d", anonim: "a" },
};

const HAKIM_PN = {
  29: { nama: "Hakim Ketua Contoh", namaGelar: "Hakim Ketua Contoh, S.H.I.", nip: "197710132007041001", jabatan: "0", pangkat: "0" },
  31: { nama: "Hakim Tiga Satu", namaGelar: "Hakim Tiga Satu, S.H.", nip: "199401022017121003", jabatan: "0", pangkat: "0" },
  32: { nama: "Ketua Contoh", namaGelar: "Ketua Contoh, S.H.I., M.H.", nip: "198208312007041001", jabatan: "0", pangkat: "0" },
  33: { nama: "Hakim Tiga Tiga", namaGelar: "Hakim Tiga Tiga, S.H.", nip: "197910092007041001", jabatan: "0", pangkat: "0" },
  // Bernama SAMA dengan 31 - orang lain.
  34: { nama: "Hakim Tiga Satu", namaGelar: "Hakim Tiga Satu, S.H.", nip: "198001012005011001", jabatan: "0", pangkat: "0" },
};

let SYS_CONFIG = {};
function konfigBawaan() {
  return {
    NamaPN: "PENGADILAN AGAMA CONTOH",
    KetuaPNNama: "Ketua Contoh, S.H.I., M.H.",
    KetuaPNNIP: "19820831200704100",
    PltKetua: "",
    PlhKetua: "",
    // Sandi tiruan - TIDAK boleh pernah terbaca layanan.
    pwd_dirput: "sandi-rahasia-tiruan",
    Index_perkara: "kunci-rahasia-tiruan",
  };
}

let idBaris = 0;
function tunjuk(perkara, orang, { tahapan = 10, urutan = 1, jabatan = 2, aktif = "Y", tidakAktif = null, penetapan = "2026-01-01", nama = "" } = {}) {
  idBaris += 1;
  return { id: idBaris, perkara, orang, tahapan, urutan, jabatan, aktif, tidakAktif, penetapan, nama: nama || (HAKIM_PN[orang] || {}).nama || `Orang ${orang}` };
}
const HAKIM_PERKARA = [
  // 1001: 31 anggota 2 - majelis diputus dalam periode.
  tunjuk(1001, 29, { urutan: 1, jabatan: 1, penetapan: "2026-02-10" }),
  tunjuk(1001, 33, { urutan: 2, jabatan: 2, penetapan: "2026-02-10" }),
  tunjuk(1001, 31, { urutan: 3, jabatan: 2, penetapan: "2026-02-10" }),
  // 1002: 31 ketua, belum putus.
  tunjuk(1002, 31, { urutan: 1, jabatan: 1, penetapan: "2026-06-20" }),
  tunjuk(1002, 33, { urutan: 2, jabatan: 2, penetapan: "2026-06-20" }),
  // 1003: diputus SEBELUM periode - masuk hanya lewat upaya hukum.
  tunjuk(1003, 29, { urutan: 1, jabatan: 1, penetapan: "2026-01-05" }),
  tunjuk(1003, 31, { urutan: 2, jabatan: 2, penetapan: "2026-01-05" }),
  // 1004: didaftarkan SESUDAH periode.
  tunjuk(1004, 31, { urutan: 1, jabatan: 1, penetapan: "2026-07-02" }),
  // 1005: hakim tunggal itsbat terpadu.
  tunjuk(1005, 31, { urutan: 1, jabatan: 3, penetapan: "2026-05-02" }),
  // 1006: 31 DIGANTI sebelum putusan oleh 33.
  tunjuk(1006, 29, { urutan: 1, jabatan: 1, penetapan: "2026-03-01" }),
  tunjuk(1006, 31, { urutan: 2, jabatan: 2, aktif: "T", tidakAktif: "2026-04-10", penetapan: "2026-03-01" }),
  tunjuk(1006, 33, { urutan: 2, jabatan: 2, penetapan: "2026-04-10" }),
  // 1007: 31 hanya majelis ikrar; ikrar dalam periode.
  tunjuk(1007, 29, { urutan: 1, jabatan: 1, aktif: "T", penetapan: "2025-12-01" }),
  tunjuk(1007, 33, { urutan: 2, jabatan: 2, aktif: "T", penetapan: "2025-12-01" }),
  tunjuk(1007, 29, { tahapan: 18, urutan: 1, jabatan: 1, penetapan: "2026-03-20" }),
  tunjuk(1007, 31, { tahapan: 18, urutan: 2, jabatan: 2, penetapan: "2026-03-20" }),
  // 1008: majelis ikrar; ikrar sesudah periode, tetapi SIDANG ikrarnya dalam periode.
  tunjuk(1008, 29, { tahapan: 18, urutan: 1, jabatan: 1, penetapan: "2026-05-01" }),
  tunjuk(1008, 31, { tahapan: 18, urutan: 2, jabatan: 2, penetapan: "2026-05-01" }),
  // 1009: majelis ikrar; ikrar dan sidangnya sebelum periode.
  tunjuk(1009, 31, { tahapan: 18, urutan: 1, jabatan: 1, penetapan: "2025-10-20" }),
  // 1014: hakim 34 BERNAMA SAMA dengan 31.
  tunjuk(1014, 34, { urutan: 1, jabatan: 1, penetapan: "2026-04-05" }),
  // 1015: 31 anggota, sidang keliling hanya dari atribut perkara.
  tunjuk(1015, 29, { urutan: 1, jabatan: 1, penetapan: "2026-04-10" }),
  tunjuk(1015, 31, { urutan: 2, jabatan: 2, penetapan: "2026-04-10" }),
  // 1017: 31 anggota, sidang keliling bertanda tanpa ruangan.
  tunjuk(1017, 29, { urutan: 1, jabatan: 1, penetapan: "2026-04-12" }),
  tunjuk(1017, 31, { urutan: 2, jabatan: 2, penetapan: "2026-04-12" }),
  // 1018 dan 1019: batas periode.
  tunjuk(1018, 31, { urutan: 1, jabatan: 1, penetapan: "2026-02-02" }),
  tunjuk(1019, 31, { urutan: 1, jabatan: 1, penetapan: "2026-06-30" }),
  // 1022: 31 ketua, belum putus - jadwal sesudah hari ini.
  tunjuk(1022, 31, { urutan: 1, jabatan: 1, penetapan: "2026-08-01" }),
  // 1023: 31 majelis ikrar; sidang ikrarnya baru dijadwalkan sesudah hari ini.
  tunjuk(1023, 29, { tahapan: 18, urutan: 1, jabatan: 1, penetapan: "2026-09-10" }),
  tunjuk(1023, 31, { tahapan: 18, urutan: 2, jabatan: 2, penetapan: "2026-09-10" }),
];
const PANITERA_PERKARA = [tunjuk(1001, 5, { nama: "Panitera Lima, S.H." }), tunjuk(1002, 6, { nama: "Panitera Enam" })];
const JURUSITA_PERKARA = [
  tunjuk(1001, 9, { nama: "Jurusita Sembilan" }),
  // Juru sita yang sama aktif juga pada tahapan kasasi - namanya sekali saja.
  tunjuk(1001, 9, { tahapan: 30, nama: "Jurusita Sembilan" }),
];

const MEDIATOR = { 40: { hakimId: 31 }, 41: { hakimId: null }, 42: { hakimId: 34 } };
const MEDIASI = [
  { id: 1, perkara: 1001, mediatorId: "41", teks: "Mediator Luar", hasil: "T", penetapan: "2026-03-01", mulai: "2026-03-01", keputusan: "2026-03-10", laporan: "2026-03-10" },
  { id: 2, perkara: 1010, mediatorId: "40,41", teks: "Hakim Tiga Satu", hasil: "Y1", penetapan: "2026-03-25", mulai: "2026-03-25", keputusan: "2026-04-05", laporan: "2026-04-05" },
  { id: 3, perkara: 1011, mediatorId: "", teks: "Hakim Tiga Satu", hasil: null, penetapan: "2026-06-20", mulai: "2026-06-20", keputusan: null, laporan: null },
  { id: 4, perkara: 1012, mediatorId: "40", teks: "Hakim Tiga Satu", hasil: null, penetapan: "2017-03-01", mulai: "2017-03-01", keputusan: null, laporan: null },
  { id: 5, perkara: 1013, mediatorId: "40", teks: "Hakim Tiga Satu", hasil: "D", penetapan: "2026-01-10", mulai: "2026-01-10", keputusan: "2026-02-01", laporan: "2026-02-01" },
  // Mediator 42 milik hakim 34 yang BERNAMA SAMA - tidak boleh ikut.
  { id: 6, perkara: 1014, mediatorId: "42", teks: "Hakim Tiga Satu", hasil: "Y2", penetapan: "2026-04-06", mulai: "2026-04-06", keputusan: "2026-04-20", laporan: "2026-04-20" },
];
// [perkara, mediator_id, aktif]
const PERKARA_MEDIATOR = [[1011, 40, "Y"]];

// [perkara, urutan, nama] - pihak2 dengan penanda ghaib
const PIHAK1 = [[1001, 1, "Penggugat Satu"], [1005, 1, "Pemohon Satu"], [1005, 2, "Pemohon Dua"], [1002, 1, "Penggugat Dua"]];
const PIHAK2 = [[1001, 2, "Tergugat Kedua", 0], [1001, 1, "Tergugat Pertama", 0], [1002, 1, "Tergugat Ghaib", 1]];
const PIHAK4 = [[1001, 1, "Kepala Desa Contoh"]];

// Borang penetapan ikrar talak: majelis_hakim_id ber-koma, teks ber-</br>.
const IKRAR = {
  1007: {
    ikrar: "2026-04-20",
    phs: "2026-04-01",
    majelisId: "29,31",
    majelisTeks: "Hakim Ketua: Hakim Ketua Contoh</br>Hakim Anggota 1: Hakim Tiga Satu",
    paniteraId: "5",
    paniteraTeks: "Panitera Pengganti: Panitera Lima, S.H.",
  },
  1008: { ikrar: "2026-08-01", phs: "2026-06-01" },
  1009: { ikrar: "2026-01-10", phs: "2025-12-20" },
  1020: {
    ikrar: "2026-05-05",
    phs: "2026-04-20",
    majelisId: "29,31",
    majelisTeks: "Hakim Ketua: Hakim Ketua Contoh</br>Hakim Anggota 1: Hakim Tiga Satu",
  },
  1021: {
    ikrar: "2026-05-06",
    phs: "2026-04-21",
    majelisId: "29,31,33",
    majelisTeks: "Majelis Hakim : Hakim Ketua Contoh<br>Hakim Tiga Satu",
  },
};
const BANDING = {
  1003: { permohonan: "2026-03-25", putus: "2026-05-10", pemberitahuan: null, pembanding: "2026-05-12", terbanding: "2026-05-15", status: "Menguatkan" },
};
const KASASI = {};
const PK = {};
// [perkara, proses_id, diinput]
const PROSES = [[1003, 400, "2026-05-18 10:00:00"], [1003, 301, "2026-03-26 09:00:00"]];

// [perkara, id, urutan, tanggal, agenda, alasan_ditunda, ruangan, sidang_keliling, ikrar_talak, ruangan_id]
const JADWAL = [
  [1001, 1, 1, "2026-03-01", "Sidang Pertama", "Mediasi", "Ruang Sidang 1", "T", "T", 1],
  [1001, 2, 2, "2026-03-20", "Kesimpulan", "Musyawarah Majelis", "Ruang Sidang 1", "T", "T", 1],
  [1001, 3, 3, "2026-04-15", "Pembacaan Putusan", "", "Ruang Sidang 1", "T", "T", 1],
  [1002, 4, 1, "2026-06-25", "Sidang Pertama", "Pembuktian", "Sidang Keliling Sigi Biromaru", "Y", "T", 3],
  // Musyawarah SESUDAH akhir periode - tidak boleh terbaca pada Triwulan II.
  [1002, 5, 2, "2026-07-05", "Musyawarah Majelis", "", "Ruang Sidang 1", "T", "T", 1],
  [1005, 6, 1, "2026-05-08", "Sidang Terpadu", "", "Terpadu Sindue", "T", "T", 11],
  // ruangan_id 7 DULU ruang terpadu, kini Ruang Sidang Elektronik - yang dipercaya salinan namanya.
  [1015, 7, 1, "2026-04-20", "Sidang Pertama", "", "Ruang Sidang Elektronik 1", "T", "T", 7],
  [1017, 8, 1, "2026-04-25", "Sidang Pertama", "", null, "Y", "T", null],
  [1008, 9, 1, "2026-06-10", "Sidang Ikrar Talak", "Panggil Pemohon", "Ruang Sidang 1", "T", "Y", 1],
  [1009, 10, 1, "2026-01-10", "Sidang Ikrar Talak", "", "Ruang Sidang 1", "T", "Y", 1],
  // 1022: ditunda untuk musyawarah 20 September; musyawarahnya 29 September -
  // SESUDAH hari ini (27 September). Sidang keliling 30 September juga belum terjadi.
  [1022, 11, 1, "2026-09-20", "Pembuktian", "Musyawarah Majelis", "Ruang Sidang 1", "T", "T", 1],
  [1022, 12, 2, "2026-09-29", "Pembacaan Putusan", "", "Ruang Sidang 1", "T", "T", 1],
  [1022, 13, 3, "2026-09-30", "Sidang Setempat", "", "Sidang Keliling Sirenja", "Y", "T", 4],
  // 1023: sidang ikrar dijadwalkan 29 September - belum terjadi.
  [1023, 14, 1, "2026-09-29", "Sidang Ikrar Talak", "", "Ruang Sidang 1", "T", "Y", 1],
];
const ATRIBUT_KELILING = new Set([1015]);
const EFILING = new Set([1001, 1002, 1005]);
// [perkara, ket_temu, tanggal_relaas]
const RELAAS = [[1001, "E", "2026-02-20"], [1001, "S", "2026-02-21"], [1002, "E", "2026-07-10"], [1005, "Y", "2026-05-03"]];
// [id, perkara, dokumen_ref_id, filename, created, link, pengajuan]
const DIRPUT = [
  [1, 1001, 89, "PA.Ctt_2026_Pdt.G_1001_putusan_akhir.pdf", "2026-04-15", "http://putusan.mahkamahagung.go.id/putusan/zaf1001", 1],
  [2, 1001, 79, "PA.Ctt_2026_Pdt.G_1001_putusan_anonimisasi.pdf", "2026-04-16", "http://putusan.mahkamahagung.go.id/putusan/zaf1001", 1],
  [3, 1001, 113, "surat_pengantar_kasasi.pdf", "2026-06-01", null, 3],
  // Tanpa rujukan: dikenali lewat akhiran nama berkas.
  [4, 1005, 999, "PA.Ctt_2026_Pdt.P_1005_putusan_akhir.pdf", "2026-07-02", null, 1],
];
const DIRPUT_REF = { 79: 100, 89: 99, 113: 5 };
// [perkara, status, last_tried]
const ANTRIAN = [[1001, 1, "2026-04-17 09:00:00"], [1001, -1, "2026-04-15 09:00:00"]];

let KOLOM = {};
function kolomBawaan() {
  return {
    perkara: ["perkara_id", "nomor_perkara", "tanggal_pendaftaran", "jenis_perkara_id", "prodeo"],
    perkara_putusan: ["perkara_id", "tanggal_putusan", "status_putusan_id", "status_putusan_nama"],
    status_putusan: ["id", "nama"],
    perkara_hakim_pn: ["perkara_id", "hakim_id"],
    perkara_panitera_pn: ["perkara_id"],
    perkara_jurusita: ["perkara_id"],
    hakim_pn: ["id", "nip"],
    mediator: ["id", "hakim_id"],
    perkara_mediasi: ["perkara_id", "mediator_id"],
    perkara_mediator: ["perkara_id", "mediator_id"],
    perkara_ikrar_talak: [
      "perkara_id",
      "tgl_ikrar_talak",
      "majelis_hakim_id",
      "majelis_hakim_text",
      "panitera_pengganti_id",
      "panitera_pengganti_text",
      "jurusita_id",
      "jurusita_text",
    ],
    perkara_efiling_id: ["perkara_id"],
    perkara_pelaksanaan_relaas: ["perkara_id", "ket_temu"],
    dirput_dokumen: ["perkara_id", "link_dirput"],
    dirput_dokumen_ref: ["dokumen_ref_id", "urutan"],
    dirput_antrian: ["perkara_id", "status"],
    perkara_atribut: ["perkara_id", "sidang_keliling"],
    jenis_perkara: ["id", "nama"],
    perkara_pihak1: ["perkara_id"],
    perkara_pihak2: ["perkara_id", "ghaib"],
    perkara_pihak4: ["perkara_id"],
    perkara_proses: ["perkara_id", "proses_id"],
    perkara_jadwal_sidang: ["perkara_id", "ruangan"],
    perkara_banding: [
      "perkara_id",
      "permohonan_banding",
      "putusan_banding",
      "status_putusan_banding_text",
      "pemberitahuan_putusan_banding",
      "pemberitahuan_putusan_banding_pembanding",
      "pemberitahuan_putusan_banding_terbanding",
    ],
    perkara_kasasi: ["perkara_id", "permohonan_kasasi", "putusan_kasasi", "status_putusan_kasasi_text", "pemberitahuan_putusan_kasasi"],
    perkara_pk: ["perkara_id", "permohonan_pk", "putusan_pk", "status_putusan_pk_text", "pemberitahuan_putusan_pk"],
  };
}

/** perkara_id pada IN (...) - daftar IN selalu parameter TERAKHIR kueri rincian. */
function idDiminta(teks, params) {
  const cocok = teks.match(/perkara_id IN \(([?, ]+)\)/);
  if (!cocok) return [];
  const jumlah = (cocok[1].match(/\?/g) || []).length;
  return params.slice(params.length - jumlah).map(Number);
}

function antara(t, a, b) {
  return Boolean(t) && t >= a && t <= b;
}

let gagalkan = null;
const kueri = [];

function jawab(sql, params) {
  const teks = String(sql).replace(/\s+/g, " ");
  if (gagalkan && gagalkan.test(teks)) throw new Error("kueri tiruan sengaja digagalkan");

  if (/information_schema/i.test(teks)) {
    const hasil = [];
    for (const [tabel, daftar] of Object.entries(KOLOM)) for (const kolom of daftar) hasil.push({ tabel, kolom });
    return hasil;
  }

  // ---- identitas dan Ketua ----
  if (/FROM hakim_pn h WHERE h\.id = \?/.test(teks)) {
    const h = HAKIM_PN[params[0]];
    return h ? [{ id: params[0], nama: h.nama, namaGelar: h.namaGelar, nip: h.nip, jabatan: h.jabatan, pangkat: h.pangkat }] : [];
  }
  if (/FROM perkara_hakim_pn hk WHERE hk\.hakim_id = \? ORDER BY hk\.id DESC LIMIT 1/.test(teks)) {
    const baris = HAKIM_PERKARA.filter((x) => x.orang === params[0]);
    return baris.length ? [{ nama: baris[baris.length - 1].nama }] : [];
  }
  if (/FROM sys_config c WHERE c\.name IN \(/.test(teks)) {
    // HANYA nama yang tertulis di kueri yang pulang - sandi tiruan di
    // SYS_CONFIG tidak boleh pernah terbaca.
    const diminta = [...teks.matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]);
    return diminta.filter((n) => n in SYS_CONFIG).map((n) => ({ nama: n, nilai: SYS_CONFIG[n] }));
  }
  if (/FROM hakim_pn h WHERE h\.nip LIKE \?/.test(teks)) {
    const awal = String(params[0]).replace(/%$/, "");
    return Object.entries(HAKIM_PN)
      .filter(([, h]) => h.nip.startsWith(awal))
      .map(([id, h]) => ({ id: Number(id), nip: h.nip, nama: h.nama, namaGelar: h.namaGelar }));
  }

  // ---- jalan masuk ----
  if (/FROM perkara_hakim_pn h WHERE h\.hakim_id = \? GROUP BY/.test(teks)) {
    const lihat = new Set();
    const hasil = [];
    for (const x of HAKIM_PERKARA.filter((y) => y.orang === params[0])) {
      const kunci = `${x.perkara}:${x.tahapan}`;
      if (lihat.has(kunci)) continue;
      lihat.add(kunci);
      hasil.push({ perkaraId: x.perkara, tahapan: x.tahapan });
    }
    return hasil;
  }
  if (/FROM mediator md WHERE md\.hakim_id = \?/.test(teks)) {
    return Object.entries(MEDIATOR)
      .filter(([, m]) => m.hakimId === params[0])
      .map(([id]) => ({ id: Number(id) }));
  }
  if (/FROM perkara p (FORCE INDEX \(tanggal_pendaftaran\) )?WHERE p\.perkara_id IN/.test(teks) && /AS daftar FROM/.test(teks)) {
    return idDiminta(teks, params)
      .filter((id) => PERKARA[id])
      .map((id) => ({ perkaraId: id, daftar: PERKARA[id].daftar }));
  }
  if (/FROM perkara_putusan pu WHERE pu\.perkara_id IN \([?, ]+\) GROUP BY pu\.perkara_id/.test(teks)) {
    return idDiminta(teks, params)
      .filter((id) => PUTUSAN[id])
      .map((id) => ({ perkaraId: id, putus: PUTUSAN[id].putus }));
  }
  {
    const cocok = teks.match(/FROM (perkara_banding|perkara_kasasi|perkara_pk) u WHERE \((.+?)\) AND u\.perkara_id IN/);
    if (cocok && /SELECT DISTINCT/.test(teks)) {
      const sumber = { perkara_banding: BANDING, perkara_kasasi: KASASI, perkara_pk: PK }[cocok[1]];
      const kolom = [...cocok[2].matchAll(/u\.([a-z_]+) BETWEEN \? AND \?/g)].map((m) => m[1]);
      const peta = {
        permohonan_banding: "permohonan",
        putusan_banding: "putus",
        pemberitahuan_putusan_banding: "pemberitahuan",
        pemberitahuan_putusan_banding_pembanding: "pembanding",
        pemberitahuan_putusan_banding_terbanding: "terbanding",
      };
      const ids = idDiminta(teks, params);
      return ids
        .filter((id) => sumber[id])
        .filter((id) =>
          kolom.some((k, i) => antara(sumber[id][peta[k] || k], params[i * 2], params[i * 2 + 1]))
        )
        .map((id) => ({ perkaraId: id }));
    }
  }
  if (/FROM perkara_ikrar_talak t WHERE FIND_IN_SET\(\?, REPLACE\(t\.majelis_hakim_id/.test(teks)) {
    return Object.entries(IKRAR)
      .filter(([, it]) => String(it.majelisId || "").split(",").map((x) => Number(x.trim())).includes(Number(params[0])))
      .map(([pid]) => ({ perkaraId: Number(pid) }));
  }
  if (/FROM perkara_ikrar_talak t WHERE t\.perkara_id IN/.test(teks)) {
    // Borang ikrar untuk majelisPemeriksaService.
    return idDiminta(teks, params)
      .filter((id) => IKRAR[id] && (IKRAR[id].majelisTeks || IKRAR[id].paniteraTeks))
      .map((id) => ({
        perkaraId: id,
        majelisId: IKRAR[id].majelisId || null,
        majelisTeks: IKRAR[id].majelisTeks || null,
        paniteraId: IKRAR[id].paniteraId || null,
        paniteraTeks: IKRAR[id].paniteraTeks || null,
        jurusitaId: null,
        jurusitaTeks: null,
      }));
  }
  if (/FROM perkara_ikrar_talak it WHERE it\.tgl_ikrar_talak BETWEEN \? AND \?/.test(teks)) {
    return idDiminta(teks, params)
      .filter((id) => IKRAR[id] && antara(IKRAR[id].ikrar, params[0], params[1]))
      .map((id) => ({ perkaraId: id }));
  }
  if (/FROM perkara_jadwal_sidang j WHERE j\.ikrar_talak = 'Y' AND j\.tanggal_sidang BETWEEN \? AND \?/.test(teks)) {
    const ids = idDiminta(teks, params);
    return [...new Set(JADWAL.filter((j) => ids.includes(j[0]) && j[8] === "Y" && antara(j[3], params[0], params[1])).map((j) => j[0]))].map(
      (id) => ({ perkaraId: id })
    );
  }
  if (/FROM perkara_mediasi m WHERE \(FIND_IN_SET/.test(teks)) {
    // Parameter: id mediator (FIND_IN_SET), id mediator (EXISTS cadangan), akhir periode.
    const jumlahFind = (teks.match(/FIND_IN_SET\(\?/g) || []).length;
    const ids = params.slice(0, jumlahFind).map(Number);
    const pakaiCadangan = /EXISTS \(SELECT 1 FROM perkara_mediator/.test(teks);
    const akhir = params[params.length - 1];
    return MEDIASI.filter((m) => {
      const daftar = String(m.mediatorId || "").split(",").map((x) => Number(x.trim())).filter(Boolean);
      let milik = daftar.some((x) => ids.includes(x));
      if (!milik && pakaiCadangan && !m.mediatorId) {
        milik = PERKARA_MEDIATOR.some(([pid, mid, aktif]) => pid === m.perkara && aktif === "Y" && ids.includes(mid));
      }
      return milik && m.penetapan <= akhir;
    }).map((m) => ({ perkaraId: m.perkara, penetapan: m.penetapan, laporan: m.laporan }));
  }

  // ---- penunjukan untuk majelisPemeriksaService ----
  const penunjukan = (daftar) => {
    const ids = idDiminta(teks, params);
    return daftar
      .filter((x) => ids.includes(x.perkara))
      .map((x) => ({
        perkaraId: x.perkara,
        tahapan: x.tahapan,
        urutan: x.urutan,
        orang: x.orang,
        nama: x.nama,
        jabatan: x.jabatan,
        jabatanNama: "",
        aktif: x.aktif,
        tidakAktif: x.tidakAktif,
        penetapan: x.penetapan,
        id: x.id,
      }));
  };
  if (/FROM perkara_hakim_pn h WHERE h\.perkara_id IN/.test(teks)) return penunjukan(HAKIM_PERKARA);
  if (/FROM perkara_panitera_pn h WHERE h\.perkara_id IN/.test(teks)) return penunjukan(PANITERA_PERKARA);
  if (/FROM perkara_jurusita h WHERE h\.perkara_id IN/.test(teks)) return penunjukan(JURUSITA_PERKARA);

  // ---- rincian ----
  if (/FROM perkara p WHERE p\.perkara_id IN/.test(teks) && /AS nomor/.test(teks)) {
    return idDiminta(teks, params)
      .filter((id) => PERKARA[id])
      .map((id) => {
        const p = PERKARA[id];
        return { perkaraId: id, nomor: p.nomor, jenisId: p.jenisId, jenisNama: p.jenisNama, alurId: p.alurId, daftar: p.daftar, prodeo: p.prodeo };
      });
  }
  if (/FROM jenis_perkara jp/.test(teks)) return Object.entries(JENIS).map(([id, nama]) => ({ id: Number(id), nama }));
  if (/FROM perkara_pihak(\d) ph WHERE ph\.ghaib = 1/.test(teks)) {
    const ids = idDiminta(teks, params);
    return [...new Set(PIHAK2.filter((x) => ids.includes(x[0]) && x[3] === 1).map((x) => x[0]))].map((id) => ({ perkaraId: id }));
  }
  {
    const cocok = teks.match(/FROM perkara_pihak(\d) ph WHERE ph\.perkara_id IN/);
    if (cocok) {
      const sumber = { 1: PIHAK1, 2: PIHAK2, 4: PIHAK4 }[cocok[1]] || [];
      const ids = idDiminta(teks, params);
      return sumber.filter((x) => ids.includes(x[0])).map((x, i) => ({ perkaraId: x[0], urutan: x[1], nama: x[2], id: i + 1 }));
    }
  }
  if (/FROM perkara_putusan pu (LEFT JOIN status_putusan sp ON sp\.id = pu\.status_putusan_id )?WHERE pu\.perkara_id IN/.test(teks)) {
    const pakaiJoin = /LEFT JOIN status_putusan/.test(teks);
    return idDiminta(teks, params)
      .filter((id) => PUTUSAN[id])
      .map((id) => {
        const p = PUTUSAN[id];
        return {
          perkaraId: id,
          putus: p.putus,
          status: pakaiJoin ? STATUS[p.statusId] || null : null,
          verstek: p.verstek,
          minutasi: p.minutasi,
          bht: p.bht,
          adaDok: p.dok && String(p.dok).trim() ? 1 : 0,
          adaAnonim: p.anonim && String(p.anonim).trim() ? 1 : 0,
        };
      });
  }
  if (/FROM perkara_mediasi m WHERE m\.perkara_id IN/.test(teks)) {
    const ids = idDiminta(teks, params);
    return MEDIASI.filter((m) => ids.includes(m.perkara)).map((m) => ({
      id: m.id,
      perkaraId: m.perkara,
      mediatorId: m.mediatorId,
      mediatorTeks: m.teks,
      hasil: m.hasil,
      penetapan: m.penetapan,
      mulai: m.mulai,
      keputusan: m.keputusan,
      laporan: m.laporan,
    }));
  }
  if (/FROM perkara_mediator pm WHERE pm\.aktif = 'Y' AND pm\.perkara_id IN/.test(teks)) {
    const ids = idDiminta(teks, params);
    return PERKARA_MEDIATOR.filter(([pid, , aktif]) => ids.includes(pid) && aktif === "Y").map(([pid, mid]) => ({ perkaraId: pid, mediatorId: mid }));
  }
  if (/FROM perkara_ikrar_talak it WHERE it\.perkara_id IN/.test(teks)) {
    return idDiminta(teks, params)
      .filter((id) => IKRAR[id])
      .map((id) => ({ perkaraId: id, ikrar: IKRAR[id].ikrar, phs: IKRAR[id].phs }));
  }
  {
    const cocok = teks.match(/FROM (perkara_banding|perkara_kasasi|perkara_pk) u WHERE u\.perkara_id IN/);
    if (cocok) {
      const sumber = { perkara_banding: BANDING, perkara_kasasi: KASASI, perkara_pk: PK }[cocok[1]];
      return idDiminta(teks, params)
        .filter((id) => sumber[id])
        .map((id) => {
          const u = sumber[id];
          return {
            perkaraId: id,
            permohonan: u.permohonan,
            putus: u.putus,
            pemberitahuan: u.pemberitahuan,
            pemberitahuanPihak1: /pemberitahuanPihak1/.test(teks) && !/NULL AS pemberitahuanPihak1/.test(teks) ? u.pembanding : null,
            pemberitahuanPihak2: /pemberitahuanPihak2/.test(teks) && !/NULL AS pemberitahuanPihak2/.test(teks) ? u.terbanding : null,
            status: u.status,
          };
        });
    }
  }
  if (/FROM perkara_proses pr WHERE pr\.proses_id IN \(400, 500, 571, 580, 590\)/.test(teks)) {
    const ids = idDiminta(teks, params);
    return PROSES.filter(([pid, proses]) => ids.includes(pid) && [400, 500, 571, 580, 590].includes(proses)).map(([pid, proses, diinput]) => ({
      perkaraId: pid,
      prosesId: proses,
      diinput: diinput.slice(0, 10),
    }));
  }
  if (/FROM perkara_jadwal_sidang j WHERE j\.perkara_id IN/.test(teks)) {
    const ids = idDiminta(teks, params);
    return JADWAL.filter((j) => ids.includes(j[0])).map((j) => ({
      perkaraId: j[0],
      id: j[1],
      urutan: j[2],
      tanggal: j[3],
      agenda: j[4],
      alasanDitunda: j[5],
      ruangan: j[6],
      keliling: j[7],
    }));
  }
  if (/FROM perkara_atribut a WHERE a\.sidang_keliling = 1/.test(teks)) {
    const ids = idDiminta(teks, params);
    return ids.filter((id) => ATRIBUT_KELILING.has(id)).map((id) => ({ perkaraId: id }));
  }
  if (/FROM perkara_efiling_id e WHERE e\.perkara_id IN/.test(teks)) {
    const ids = idDiminta(teks, params);
    return ids.filter((id) => EFILING.has(id)).map((id) => ({ perkaraId: id }));
  }
  if (/FROM perkara_pelaksanaan_relaas r WHERE r\.ket_temu = 'E'/.test(teks)) {
    const ids = idDiminta(teks, params);
    const peta = new Map();
    for (const [pid, sandi, tanggal] of RELAAS) {
      if (!ids.includes(pid) || sandi !== "E") continue;
      const lama = peta.get(pid);
      peta.set(pid, { perkaraId: pid, pertama: !lama || tanggal < lama.pertama ? tanggal : lama.pertama, jumlah: (lama ? lama.jumlah : 0) + 1 });
    }
    return [...peta.values()];
  }
  if (/FROM dirput_dokumen d/.test(teks)) {
    const ids = idDiminta(teks, params);
    const pakaiRef = /LEFT JOIN dirput_dokumen_ref r/.test(teks);
    return DIRPUT.filter((d) => ids.includes(d[1])).map((d) => ({
      id: d[0],
      perkaraId: d[1],
      berkas: d[3],
      urutan: pakaiRef ? DIRPUT_REF[d[2]] || null : null,
      dibuat: d[4],
      tautan: d[5],
      pengajuan: d[6],
    }));
  }
  if (/FROM dirput_antrian a WHERE a\.status = 1/.test(teks)) {
    const ids = idDiminta(teks, params);
    const peta = new Map();
    for (const [pid, status, waktu] of ANTRIAN) {
      if (!ids.includes(pid) || status !== 1) continue;
      const lama = peta.get(pid);
      if (!lama || waktu < lama) peta.set(pid, waktu);
    }
    return [...peta.entries()].map(([pid, waktu]) => ({ perkaraId: pid, berhasil: waktu.slice(0, 10) }));
  }

  throw new Error(`kueri tiruan tidak dikenal: ${teks.slice(0, 160)}`);
}

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = new Module(dbPath, null);
require.cache[dbPath].filename = dbPath;
require.cache[dbPath].loaded = true;
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = [];
    }
    kueri.push({ sql: String(sql), params: params || [] });
    try {
      callback(null, jawab(sql, params || []));
    } catch (galat) {
      callback(galat);
    }
  },
};

// Log peringatan bot ditangkap: galat MySQL mentah harus sampai ke LOG, bukan
// ke kalimat untuk petugas.
const logPeringatan = [];
console.warn = (...isi) => logPeringatan.push(isi.map(String).join(" "));

const layanan = require("../services/evidenSkpService");
const skema = require("../services/sippSkemaService");

function siapkan(ubah) {
  KOLOM = kolomBawaan();
  SYS_CONFIG = konfigBawaan();
  if (ubah) ubah();
  skema.lupakan();
  layanan.kosongkanSinggahan();
  gagalkan = null;
  kueri.length = 0;
}

async function hitung(masukan = TW2, opsi = {}) {
  return layanan.evidenSkp(masukan, { hariIni: HARI_INI, sekarang: Date.UTC(2026, 8, 27, 2, 0, 0), ...opsi });
}

const barisOf = (data, id) => (data.baris || []).find((b) => b.perkaraId === String(id));

async function utama() {
  console.log("");
  console.log("== Aturan murni ==");
  {
    const tw1 = layanan.susunPeriode("tw1", 2026);
    const tw4 = layanan.susunPeriode("tw4", 2026);
    const tahun = layanan.susunPeriode("tahun", 2026);
    periksa("Triwulan I 1 Januari - 31 Maret, 3 bulan", tw1.mulai === "2026-01-01" && tw1.selesai === "2026-03-31" && tw1.bulan === 3 && tw1.labelPanjang === "Triwulan I Tahun 2026", tw1);
    periksa("Triwulan IV berakhir 31 Desember", tw4.mulai === "2026-10-01" && tw4.selesai === "2026-12-31" && tw4.label === "Triwulan IV", tw4);
    periksa("Tahunan 12 bulan", tahun.mulai === "2026-01-01" && tahun.selesai === "2026-12-31" && tahun.bulan === 12 && tahun.labelPanjang === "Tahun 2026", tahun);

    const tolak = (m) => layanan.periksaMasukan(m, HARI_INI);
    periksa("peran selain hakim ditolak 400", tolak({ ...TW2, peran: "panitera" }).status === 400);
    periksa("id bukan bilangan bulat ditolak", tolak({ ...TW2, id: "31abc" }).alasan === "id_tidak_sah");
    periksa("tahun lima angka ditolak", tolak({ ...TW2, tahun: "20266" }).alasan === "tahun_tidak_sah");
    periksa("periode tak dikenal ditolak, tidak diganti bawaan", tolak({ ...TW2, periode: "tw5" }).alasan === "periode_tidak_dikenal");
    periksa("periode yang belum dimulai ditolak", tolak({ ...TW2, periode: "tw4" }).alasan === "periode_belum_mulai");
    periksa("periode berjalan diterima", tolak({ ...TW2, periode: "tw3" }).ok === true);

    const jadwal = [
      { tanggal: "2026-02-01", urutan: 1, id: 1, agenda: "Kesimpulan", alasanDitunda: "Musyawarah Majelis" },
      { tanggal: "2026-02-24", urutan: 2, id: 2, agenda: "Penyampaian Salinan Putusan", alasanDitunda: "0" },
      { tanggal: "2026-03-17", urutan: 3, id: 3, agenda: "Musyawarah Majelis", alasanDitunda: "" },
    ];
    const m1 = layanan.musyawarahDariJadwal(jadwal, "2026-02-28");
    periksa("musyawarah dari sidang SESUDAH sidang yang ditunda untuk musyawarah", m1 && m1.tanggal === "2026-02-24" && /ditunda/.test(m1.sumber), m1);
    const m2 = layanan.musyawarahDariJadwal(jadwal, "2026-03-31");
    periksa("musyawarah terakhir sampai akhir periode: agenda", m2 && m2.tanggal === "2026-03-17" && /Agenda sidang/.test(m2.sumber), m2);
    periksa("musyawarah sesudah akhir periode tidak terbaca", layanan.musyawarahDariJadwal(jadwal, "2026-02-10") === null);

    const luar = layanan.sidangLuarGedungDariJadwal(
      [
        { tanggal: "2026-05-08", ruangan: "Terpadu Sindue", keliling: "T" },
        { tanggal: "2026-05-09", ruangan: "Sidang Keliling Rio Pakava", keliling: "Y" },
        { tanggal: "2026-05-10", ruangan: "Ruang Sidang Elektronik 1", keliling: "T" },
        { tanggal: "2026-05-11", ruangan: null, keliling: "Y" },
        { tanggal: "2026-05-12", ruangan: "Terpadu Kecamatan Baru", keliling: "T" },
        { tanggal: "2026-07-01", ruangan: "Sidang Keliling Sirenja", keliling: "Y" },
      ],
      "2026-06-30"
    );
    periksa("ruang terpadu terbaca terpadu", luar.some((s) => s.tanggal === "2026-05-08" && s.terpadu === true), luar);
    periksa("ruang sidang keliling terbaca keliling", luar.some((s) => s.tanggal === "2026-05-09" && s.terpadu === false), luar);
    periksa("ruang sidang elektronik BUKAN luar gedung", !luar.some((s) => s.tanggal === "2026-05-10"), luar);
    periksa("tanda sidang keliling tanpa ruangan tetap diakui", luar.some((s) => s.tanggal === "2026-05-11" && /tidak tercatat/.test(s.tempat)), luar);
    periksa("ejaan terpadu yang belum dipetakan dikenali dari namanya", luar.some((s) => s.tanggal === "2026-05-12" && s.terpadu), luar);
    periksa("sidang sesudah akhir periode tidak ikut", !luar.some((s) => s.tanggal === "2026-07-01"), luar);

    periksa("kedudukan Hakim Anggota 2 -> hakim-anggota", layanan.hubunganDariKedudukan("Hakim Anggota 2") === "hakim-anggota");
    periksa("kedudukan tak dikenal -> null, bukan ditebak", layanan.hubunganDariKedudukan("Hakim") === null);
    periksa("dirput urutan 99 = putusan, 100 = anonimisasi", layanan.jenisDirput({ urutan: 99 }) === "putusan" && layanan.jenisDirput({ urutan: 100 }) === "anonimisasi");
    periksa("dirput tanpa rujukan dikenali dari akhiran berkas", layanan.jenisDirput({ urutan: null, berkas: "PA.X_2026_Pdt.G_1_putusan_anonimisasi.pdf" }) === "anonimisasi");
    periksa("nama instansi huruf judul", layanan.hurufJudul("PENGADILAN AGAMA DONGGALA") === "Pengadilan Agama Donggala");
  }

  console.log("");
  console.log("== Aturan periode dan hubungan (Triwulan II 2026) ==");
  siapkan();
  const d = await hitung();
  periksa("jawaban ok", d.ok === true, d);
  const ids = (d.baris || []).map((b) => Number(b.perkaraId)).sort((a, b) => a - b);
  periksa(
    "perkara terpilih PERSIS",
    JSON.stringify(ids) === JSON.stringify([1001, 1002, 1003, 1005, 1007, 1008, 1010, 1011, 1015, 1017, 1018, 1019, 1020]),
    ids
  );
  periksa("1020 majelis ikrar dari BORANG ikrar (tanpa penunjukan tahapan 18)", JSON.stringify(barisOf(d, 1020).hubungan) === '["majelis-ikrar"]');
  periksa(
    "majelis ikrar 1020 dari borang beserta id",
    JSON.stringify(barisOf(d, 1020).majelisIkrar) ===
      JSON.stringify([
        { kedudukan: "Hakim Ketua", nama: "Hakim Ketua Contoh", hakimId: "29" },
        { kedudukan: "Hakim Anggota 1", nama: "Hakim Tiga Satu", hakimId: "31" },
      ]),
    barisOf(d, 1020).majelisIkrar
  );
  periksa(
    "sumber borang DISEBUT untuk petugas, TIDAK di catatan dokumen",
    (d.catatanOperator || []).some((c) => /^Majelis ikrar talak pada 1 perkara dibaca dari borang/.test(c)) &&
      !d.catatan.some((c) => /borang/.test(c)),
    [d.catatanOperator, d.catatan]
  );
  periksa("1021 borang tak terpasangkan: tidak dihitung, tidak ditebak", !barisOf(d, 1021));
  periksa("yang tak terpasangkan DISEBUT untuk petugas", (d.catatanOperator || []).some((c) => /^1 perkara memuat ID hakim ini pada borang ikrar talak/.test(c)), d.catatanOperator);
  periksa("1007 majelis ikrar dari penunjukan tahapan 18", barisOf(d, 1007).majelisIkrar.map((h) => h.hakimId).join(",") === "29,31");
  periksa("1001 diputus dalam periode: hakim-anggota", JSON.stringify(barisOf(d, 1001).hubungan) === '["hakim-anggota"]', barisOf(d, 1001).hubungan);
  periksa("1002 belum putus: hakim-ketua", JSON.stringify(barisOf(d, 1002).hubungan) === '["hakim-ketua"]');
  periksa("1003 diputus sebelum periode masuk lewat banding yang diberitahukan dalam periode", JSON.stringify(barisOf(d, 1003).hubungan) === '["hakim-anggota"]');
  periksa("1004 didaftarkan sesudah periode tidak ikut", !barisOf(d, 1004));
  periksa("1005 hakim tunggal", JSON.stringify(barisOf(d, 1005).hubungan) === '["hakim-tunggal"]');
  periksa("1006 diganti sebelum putusan tidak dihitung", !barisOf(d, 1006));
  periksa("yang diganti DISEBUT untuk petugas", (d.catatanOperator || []).some((c) => /^1 perkara dalam periode ini pernah memuat hakim ini/.test(c)), d.catatanOperator);
  periksa("catatan dokumen dari bot kosong - catatan dokumen disusun katalog", Array.isArray(d.catatan) && d.catatan.length === 0, d.catatan);
  periksa("1007 majelis ikrar, ikrar dalam periode", JSON.stringify(barisOf(d, 1007).hubungan) === '["majelis-ikrar"]');
  periksa("1008 majelis ikrar lewat SIDANG ikrar dalam periode", JSON.stringify(barisOf(d, 1008).hubungan) === '["majelis-ikrar"]');
  periksa("1009 ikrar sebelum periode tidak ikut", !barisOf(d, 1009));
  periksa("1010 mediator lewat daftar ber-koma", JSON.stringify(barisOf(d, 1010).hubungan) === '["mediator"]');
  periksa("1011 mediator lewat perkara_mediator, belum ada laporan", JSON.stringify(barisOf(d, 1011).hubungan) === '["mediator"]');
  periksa("1012 mediasi tanpa laporan pada perkara putus 2017 tidak ikut", !barisOf(d, 1012));
  periksa("1013 mediasi dilaporkan sebelum periode tidak ikut", !barisOf(d, 1013));
  periksa("1014 hakim BERNAMA SAMA dengan id lain tidak ikut", !barisOf(d, 1014));
  periksa("1018 diputus TEPAT hari pertama periode ikut", Boolean(barisOf(d, 1018)));
  periksa("1019 didaftarkan TEPAT hari terakhir periode ikut", Boolean(barisOf(d, 1019)));
  periksa("urut menurut tanggal pendaftaran", d.baris[0].perkaraId === "1007" && d.baris[d.baris.length - 1].perkaraId === "1019", d.baris.map((b) => b.perkaraId));
  periksa("1020 (daftar 20 Januari) sesudah 1003 (5 Januari)", d.baris.findIndex((b) => b.perkaraId === "1020") > d.baris.findIndex((b) => b.perkaraId === "1003"));
  periksa("kalimat aturan periode menyebut tanggalnya", /1 April 2026 s\.d\. 30 Juni 2026/.test(d.aturanPeriode) && /hari putusan/.test(d.aturanPeriode));
  periksa("tanpa galat", d.galat.length === 0, d.galat);

  console.log("");
  console.log("== Ruas per perkara ==");
  const a = barisOf(d, 1001);
  periksa("jenis dari rujukan jenis_perkara", a.jenisPerkara === "Kewarisan" && barisOf(d, 1005).jenisPerkara === "Pengesahan Perkawinan/Istbat Nikah");
  periksa("sebutan pihak dari alur: Penggugat/Tergugat, Turut Tergugat", a.pihak.satu.sebutan === "Penggugat" && a.pihak.dua.sebutan === "Tergugat" && a.pihak.turut && a.pihak.turut.sebutan === "Turut Tergugat", a.pihak);
  periksa("nama pihak urut menurut urutan SIPP", JSON.stringify(a.pihak.dua.nama) === '["Tergugat Pertama","Tergugat Kedua"]', a.pihak.dua);
  periksa("itsbat (alur 16): Pemohon", barisOf(d, 1005).pihak.satu.sebutan === "Pemohon" && barisOf(d, 1005).pihak.turut === null);
  periksa(
    "majelis pemeriksa dari modul bersama beserta id",
    JSON.stringify(a.majelis) ===
      JSON.stringify([
        { kedudukan: "Hakim Ketua", nama: "Hakim Ketua Contoh", hakimId: "29" },
        { kedudukan: "Hakim Anggota 1", nama: "Hakim Tiga Tiga", hakimId: "33" },
        { kedudukan: "Hakim Anggota 2", nama: "Hakim Tiga Satu", hakimId: "31" },
      ]),
    a.majelis
  );
  periksa("panitera dan juru sita - nama yang sama sekali saja", JSON.stringify(a.panitera) === '["Panitera Lima, S.H."]' && JSON.stringify(a.jurusita) === '["Jurusita Sembilan"]', [a.panitera, a.jurusita]);
  periksa("musyawarah dari sidang sesudah penundaan", a.musyawarah && a.musyawarah.tanggal === "2026-04-15", a.musyawarah);
  periksa("musyawarah sesudah akhir periode tidak terbaca (1002)", barisOf(d, 1002).musyawarah === null, barisOf(d, 1002).musyawarah);
  periksa("status putusan lewat JOIN status_putusan", a.statusPutusan === "Dikabulkan" && barisOf(d, 1018).statusPutusan === "Dicabut");
  periksa("verstek T -> false, Y -> true", a.verstek === false && barisOf(d, 1003).verstek === true);
  periksa("belum putus: verstek dan status null", barisOf(d, 1002).verstek === null && barisOf(d, 1002).statusPutusan === null);
  periksa("minutasi dan BHT", a.tanggalMinutasi === "2026-04-15" && a.tanggalBht === "2026-04-29");
  periksa("mediasi majelis: mediator lain, tidak berhasil", a.mediasi && a.mediasi.olehOrangIni === false && a.mediasi.hasil === "Tidak berhasil" && a.mediasi.berhasil === false, a.mediasi);
  periksa("rentang mediasi mentah untuk durasi", JSON.stringify(a.rentangMediasi) === '[{"mulai":"2026-03-01","selesai":"2026-03-10"}]', a.rentangMediasi);
  const med = barisOf(d, 1010).mediasi;
  periksa("mediasi oleh orang ini: Y1 berhasil", med && med.olehOrangIni === true && med.hasil === "Berhasil dengan kesepakatan" && med.berhasil === true, med);
  periksa("mediasi cadangan perkara_mediator: oleh orang ini, belum ada hasil", barisOf(d, 1011).mediasi.olehOrangIni === true && barisOf(d, 1011).mediasi.berhasil === null);
  periksa("tanpa mediasi: null dan rentang kosong", barisOf(d, 1002).mediasi === null && JSON.stringify(barisOf(d, 1002).rentangMediasi) === "[]");
  periksa("ikrar talak beserta PHS", JSON.stringify(barisOf(d, 1007).ikrar) === '{"tanggalIkrar":"2026-04-20","tanggalPhsIkrar":"2026-04-01"}');
  const bd = barisOf(d, 1003).banding;
  periksa(
    "banding: pemberitahuan = yang TERAKHIR dari kolom per pihak, input dari perkara_proses 400",
    bd &&
      bd.tanggalPermohonan === "2026-03-25" &&
      bd.tanggalPutusan === "2026-05-10" &&
      bd.tanggalPemberitahuan === "2026-05-15" &&
      bd.tanggalInputPemberitahuan === "2026-05-18" &&
      bd.putusan === "Menguatkan",
    bd
  );
  periksa("tanpa kasasi/PK: null", barisOf(d, 1003).kasasi === null && barisOf(d, 1003).pk === null);
  periksa("sidang keliling dari ruangan bertanda", barisOf(d, 1002).sidangKeliling === true && barisOf(d, 1002).sidangLuarGedung.length === 1);
  periksa("sidang keliling dari atribut perkara saja", barisOf(d, 1015).sidangKeliling === true && barisOf(d, 1015).sidangLuarGedung.length === 0);
  periksa("ruangan_id yang dipakai ulang tidak membuat 1015 terpadu", barisOf(d, 1015).itsbatTerpadu === false);
  periksa("tanda sidang keliling tanpa ruangan (1017)", barisOf(d, 1017).sidangKeliling === true);
  periksa("itsbat terpadu: jenis 360 di ruang terpadu, bukan sidang keliling", barisOf(d, 1005).itsbatTerpadu === true && barisOf(d, 1005).sidangKeliling === false);
  periksa("bukan itsbat: itsbatTerpadu false", a.itsbatTerpadu === false);
  periksa("ghaib dari perkara_pihak2.ghaib", barisOf(d, 1002).ghaib === true && a.ghaib === false);
  periksa("prodeo 1 -> true, 0 -> false", barisOf(d, 1002).prodeo === true && a.prodeo === false);
  periksa("e-Court dari perkara_efiling_id", a.ecourt === true && barisOf(d, 1003).ecourt === false);
  periksa("e-Summons: relaas E paling lambat akhir periode", a.eSummons === true);
  periksa("e-Summons sesudah akhir periode tidak dihitung (1002)", barisOf(d, 1002).eSummons === false);
  periksa("salinan terunggah beserta tanggal dirput urutan 99", JSON.stringify(a.unggahPutusan) === '{"ada":true,"tanggal":"2026-04-15"}', a.unggahPutusan);
  periksa("anonimisasi beserta tanggal dirput urutan 100", JSON.stringify(a.anonimisasi) === '{"ada":true,"tanggal":"2026-04-16"}', a.anonimisasi);
  periksa(
    "direktori: alamat dari link_dirput, tanggal dari antrean yang berhasil",
    JSON.stringify(a.direktori) === '{"url":"http://putusan.mahkamahagung.go.id/putusan/zaf1001","tanggal":"2026-04-17"}',
    a.direktori
  );
  periksa("dok kosong -> tidak terunggah; anonim null -> tidak", barisOf(d, 1003).anonimisasi.ada === false && barisOf(d, 1005).anonimisasi.ada === false);
  periksa("dirput tanpa alamat: url null", barisOf(d, 1005).direktori.url === null);

  console.log("");
  console.log("== Identitas dan Ketua ==");
  periksa("nama bergelar dan NIP dari hakim_pn", d.orang.nama === "Hakim Tiga Satu, S.H." && d.orang.nip === "199401022017121003" && d.orang.id === "31");
  periksa("jabatan '0' -> Hakim, pangkat '0' -> null", d.orang.jabatan === "Hakim" && d.orang.pangkatGolongan === null);
  periksa(
    "keduanya disebut untuk petugas, tidak di dokumen",
    (d.catatanOperator || []).some((c) => /hakim_pn\.jabatan/.test(c)) &&
      (d.catatanOperator || []).some((c) => /hakim_pn\.pangkat/.test(c)) &&
      !d.catatan.some((c) => /hakim_pn/.test(c))
  );
  periksa(
    "Ketua dari sys_config; NIP 17 angka dilengkapi dari hakim bernama sama",
    d.ketua && d.ketua.nama === "Ketua Contoh, S.H.I., M.H." && d.ketua.nip === "198208312007041001" && d.ketua.jabatan === "Ketua Pengadilan Agama Contoh" && /hakim_pn id 32/.test(d.ketua.sumber),
    d.ketua
  );
  periksa(
    "pelengkapan NIP disebut untuk petugas, tidak di dokumen",
    (d.catatanOperator || []).some((c) => /hanya 17 angka/.test(c)) && !d.catatan.some((c) => /17 angka|KetuaPNNIP/.test(c))
  );
  const kueriKonfig = kueri.filter((q) => /sys_config/.test(q.sql));
  periksa("sys_config dibaca SEKALI dan hanya nama yang disebut", kueriKonfig.length === 1 && !/pwd|Index_perkara|\*/.test(kueriKonfig[0].sql), kueriKonfig.map((q) => q.sql));
  periksa("sandi tiruan tidak pernah sampai ke jawaban", !JSON.stringify(d).includes("rahasia"));

  siapkan(() => {
    HAKIM_PN[35] = { nama: "Ketua Contoh", namaGelar: "Ketua Contoh, S.H.I., M.H.", nip: "198208312007041002", jabatan: "0", pangkat: "0" };
  });
  const dua = await hitung();
  delete HAKIM_PN[35];
  periksa(
    "dua calon NIP: tidak dilengkapi, disebut untuk petugas",
    dua.ketua.nip === "19820831200704100" && (dua.catatanOperator || []).some((g) => /tidak dapat dilengkapi/.test(g)) && dua.galat.length === 0,
    [dua.ketua, dua.catatanOperator, dua.galat]
  );

  siapkan(() => {
    SYS_CONFIG.KetuaPNNama = "";
  });
  const tanpaKetua = await hitung();
  periksa("Ketua kosong: null dan disebut untuk petugas", tanpaKetua.ketua === null && (tanpaKetua.catatanOperator || []).some((g) => /KetuaPNNama/.test(g)));

  siapkan(() => {
    SYS_CONFIG.PltKetua = "Plt Contoh, S.H.";
  });
  const plt = await hitung();
  periksa(
    "Plt. Ketua tercatat: disebut untuk petugas, tanda tangan tetap Ketua",
    plt.ketua.nama === "Ketua Contoh, S.H.I., M.H." && (plt.catatanOperator || []).some((c) => /Plt\. Ketua/.test(c))
  );

  console.log("");
  console.log("== Yang tidak terbaca, yang gagal, dan yang ditolak ==");
  siapkan();
  gagalkan = /FROM dirput_dokumen d/;
  logPeringatan.length = 0;
  const tanpaDirput = await hitung();
  const t1 = barisOf(tanpaDirput, 1001);
  periksa("Direktori tak terbaca: direktori null, BUKAN url null", t1.direktori === null);
  periksa("unggahan tetap dari e-Doc, tanggalnya null", JSON.stringify(t1.unggahPutusan) === '{"ada":true,"tanggal":null}', t1.unggahPutusan);
  periksa(
    "disebut di galat dengan kalimat ramah",
    JSON.stringify(tanpaDirput.galat) === '["Direktori Putusan (alamat dan tanggal unggah putusan)"]',
    tanpaDirput.galat
  );
  periksa("galat MySQL mentah TIDAK sampai ke jawaban", !JSON.stringify(tanpaDirput).includes("sengaja digagalkan"));
  periksa("galat mentah tercatat di log bot", logPeringatan.some((l) => /\[evidenSkp\]/.test(l) && /sengaja digagalkan/.test(l)), logPeringatan);

  siapkan();
  gagalkan = /FROM perkara_jadwal_sidang j WHERE j\.perkara_id IN/;
  const tanpaJadwal = await hitung();
  const t2 = barisOf(tanpaJadwal, 1002);
  periksa("jadwal tak terbaca: musyawarah, keliling, terpadu null", t2.musyawarah === null && t2.sidangKeliling === null && t2.itsbatTerpadu === null && t2.sidangLuarGedung === undefined, t2);
  periksa(
    "disebut di galat dengan kalimat ramah",
    tanpaJadwal.galat.some((g) => /^Jadwal sidang \(musyawarah majelis, sidang keliling, itsbat terpadu\)$/.test(g)),
    tanpaJadwal.galat
  );

  siapkan(() => {
    delete KOLOM.perkara_ikrar_talak;
  });
  const tanpaIkrar = await hitung();
  periksa("tabel ikrar tidak ada: ikrar null, sidang ikrar dari jadwal tetap masuk", barisOf(tanpaIkrar, 1007) === undefined && barisOf(tanpaIkrar, 1008) && barisOf(tanpaIkrar, 1008).ikrar === null);
  periksa(
    "yang tidak ada: kalimat pembaca di galat, nama tabel hanya untuk petugas",
    tanpaIkrar.galat.includes("Data ikrar talak (tidak tersedia di SIPP ini)") &&
      !tanpaIkrar.galat.some((g) => /perkara_ikrar_talak/.test(g)) &&
      (tanpaIkrar.catatanOperator || []).some((c) => /perkara_ikrar_talak/.test(c)),
    [tanpaIkrar.galat, tanpaIkrar.catatanOperator]
  );

  siapkan(() => {
    KOLOM.perkara_ikrar_talak = ["perkara_id", "tgl_ikrar_talak"];
  });
  const tanpaBorang = await hitung();
  periksa(
    "kolom borang ikrar tidak ada: yang hanya di borang tidak ikut, penunjukan tahapan 18 tetap",
    !barisOf(tanpaBorang, 1020) && Boolean(barisOf(tanpaBorang, 1007)),
    (tanpaBorang.baris || []).map((b) => b.perkaraId)
  );

  siapkan(() => {
    KOLOM.perkara_pihak2 = ["perkara_id"];
  });
  const tanpaGhaib = await hitung();
  periksa(
    "kolom ghaib tidak ada: ghaib null, bukan false",
    barisOf(tanpaGhaib, 1002).ghaib === null && tanpaGhaib.galat.includes("Penanda ghaib (tidak tersedia di SIPP ini)"),
    tanpaGhaib.galat
  );

  siapkan();
  gagalkan = /FROM perkara_hakim_pn h WHERE h\.hakim_id = \? GROUP BY/;
  logPeringatan.length = 0;
  const inti = await hitung();
  periksa("penunjukan inti gagal: 502, bukan eviden nol perkara", inti.ok === false && inti.status === 502 && /penunjukan majelis/i.test(inti.error), inti);
  periksa(
    "kalimat 502 ramah: tanpa galat MySQL mentah, menunjuk log bot",
    !/sengaja digagalkan/.test(inti.error) && /log ALETA Bot/.test(inti.error) && logPeringatan.some((l) => /sengaja digagalkan/.test(l)),
    [inti.error, logPeringatan]
  );

  siapkan();
  gagalkan = /FROM perkara p WHERE p\.perkara_id IN/;
  const perkaraGagal = await hitung();
  periksa("rincian perkara gagal: 502", perkaraGagal.ok === false && perkaraGagal.status === 502, perkaraGagal);

  siapkan();
  gagalkan = /LEFT JOIN status_putusan sp/;
  const putusanGagal = await hitung();
  periksa("rincian putusan gagal: 502, bukan seluruh perkara 'belum putus'", putusanGagal.ok === false && putusanGagal.status === 502, putusanGagal);

  siapkan();
  const takDikenal = await hitung({ ...TW2, id: "999" });
  periksa("id tak dikenal: 404 dengan kalimatnya", takDikenal.ok === false && takDikenal.status === 404 && takDikenal.error === "Tidak ada hakim dengan ID SIPP 999.", takDikenal);
  kueri.length = 0;
  const salah = await hitung({ ...TW2, periode: "semester1" });
  periksa("masukan salah: 400 tanpa satu kueri pun", salah.ok === false && salah.status === 400 && kueri.length === 0, [salah, kueri.length]);

  console.log("");
  console.log("== Singgahan ==");
  siapkan();
  await hitung();
  const sesudahPertama = kueri.length;
  await hitung();
  periksa("hitungan kedua tidak menyentuh SIPP", kueri.length === sesudahPertama && sesudahPertama > 10, [sesudahPertama, kueri.length]);
  await hitung({ ...TW2, periode: "tw1" });
  periksa("periode lain dihitung sendiri", kueri.length > sesudahPertama);
  siapkan();
  gagalkan = /FROM dirput_antrian a/;
  await hitung();
  const sesudahGagal = kueri.length;
  gagalkan = null;
  const pulih = await hitung();
  periksa("yang bergalat tidak disinggahkan", kueri.length > sesudahGagal && pulih.galat.length === 0);

  console.log("");
  console.log("== Triwulan I: keadaan sampai 31 Maret ==");
  siapkan();
  const tw1 = await hitung({ ...TW2, periode: "tw1" });
  periksa("1003 diputus dalam Triwulan I: hakim-anggota lewat aturan pemeriksa", barisOf(tw1, 1003) && JSON.stringify(barisOf(tw1, 1003).hubungan) === '["hakim-anggota"]');
  periksa("1013 mediasi dilaporkan dalam Triwulan I: mediator", barisOf(tw1, 1013) && barisOf(tw1, 1013).hubungan.includes("mediator"));
  periksa("musyawarah 1001 belum terjadi per 31 Maret (sidang musyawarah 15 April)", barisOf(tw1, 1001).musyawarah === null, barisOf(tw1, 1001).musyawarah);
  periksa("1009 ikrar 10 Januari: majelis ikrar Triwulan I", barisOf(tw1, 1009) && barisOf(tw1, 1009).hubungan.includes("majelis-ikrar"));

  console.log("");
  console.log("== Triwulan III BERJALAN: dibaca sampai hari ini (27 September), bukan 30 September ==");
  siapkan();
  const tw3 = await hitung({ ...TW2, periode: "tw3" });
  const b1022 = barisOf(tw3, 1022);
  periksa("1022 (belum putus, didaftarkan 1 Agustus) masuk", Boolean(b1022), (tw3.baris || []).map((b) => b.perkaraId));
  periksa("musyawarah 29 September BELUM terjadi per hari ini", b1022 && b1022.musyawarah === null, b1022 && b1022.musyawarah);
  periksa(
    "sidang keliling 30 September BELUM terjadi per hari ini",
    b1022 && b1022.sidangKeliling === false && b1022.sidangLuarGedung.length === 0,
    b1022 && b1022.sidangLuarGedung
  );
  periksa("sidang ikrar yang baru dijadwalkan sesudah hari ini tidak menjadikan majelis ikrar (1023)", !barisOf(tw3, 1023));
  periksa("e-Summons dibaca sampai hari ini: relaas E 10 Juli terhitung (1002)", barisOf(tw3, 1002) && barisOf(tw3, 1002).eSummons === true);

  console.log("");
  console.log("== Rute bot /sipp/eviden-skp lewat HTTP ==");
  await ujiRute();

  console.log("");
  console.log(`Lulus: ${lulus}, Gagal: ${gagal}`);
  process.exit(gagal === 0 ? 0 : 1);
}

/**
 * Rute sungguhan (internalGatewayRoutes) atas layanan yang ditiru di
 * require.cache - yang diperiksa pintunya: token, parameter yang diteruskan,
 * dan kode HTTP menurut jawaban layanan.
 */
async function ujiRute() {
  process.env.NODE_ENV = "test";
  process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-uji-eviden";
  const panggilan = [];
  const jalurLayanan = require.resolve("../services/evidenSkpService");
  const asli = require.cache[jalurLayanan].exports;
  require.cache[jalurLayanan].exports = {
    ...asli,
    evidenSkp: async (masukan) => {
      panggilan.push(masukan);
      if (masukan.id === "999") return { ok: false, status: 404, alasan: "petugas_tidak_ditemukan", error: "Tidak ada hakim dengan ID SIPP 999." };
      if (masukan.periode === "tw9") return { ok: false, status: 400, alasan: "periode_tidak_dikenal", error: "Periode harus tw1, tw2, tw3, tw4, atau tahun." };
      if (masukan.id === "500") throw new Error("meledak");
      return { ok: true, peran: masukan.peran, baris: [] };
    },
  };
  const express = require("express");
  const router = require("../routes/internalGatewayRoutes");
  const app = express();
  app.use("/internal/aleta-bot", router);
  const server = await new Promise((selesai) => {
    const s = app.listen(0, "127.0.0.1", () => selesai(s));
  });
  const port = server.address().port;
  const minta = (jalur, token = "token-uji-eviden") =>
    new Promise((selesai, gagalkanJanji) => {
      const req = http.request(
        { host: "127.0.0.1", port, path: jalur, method: "GET", headers: token ? { "x-aleta-internal-token": token } : {} },
        (res) => {
          let isi = "";
          res.on("data", (c) => (isi += c));
          res.on("end", () => {
            try {
              selesai({ status: res.statusCode, isi: JSON.parse(isi) });
            } catch (e) {
              gagalkanJanji(new Error(`bukan JSON (HTTP ${res.statusCode}): ${isi.slice(0, 120)}`));
            }
          });
        }
      );
      req.on("error", gagalkanJanji);
      req.end();
    });

  try {
    const tanpaToken = await minta("/internal/aleta-bot/sipp/eviden-skp?peran=hakim&id=31&tahun=2026&periode=tw2", "");
    periksa("tanpa token: ditolak, layanan tidak dipanggil", tanpaToken.status >= 400 && panggilan.length === 0, tanpaToken);
    const sah = await minta("/internal/aleta-bot/sipp/eviden-skp?peran=hakim&id=31&tahun=2026&periode=tw2&liar=1");
    periksa("sah: 200", sah.status === 200 && sah.isi.ok === true, sah);
    periksa(
      "parameter diteruskan sebagai teks, yang liar tidak",
      JSON.stringify(panggilan[0]) === JSON.stringify({ peran: "hakim", id: "31", tahun: "2026", periode: "tw2" }),
      panggilan[0]
    );
    const tidakAda = await minta("/internal/aleta-bot/sipp/eviden-skp?peran=hakim&id=999&tahun=2026&periode=tw2");
    periksa("id tak dikenal: 404 beserta kalimatnya", tidakAda.status === 404 && tidakAda.isi.error === "Tidak ada hakim dengan ID SIPP 999.", tidakAda);
    const salah = await minta("/internal/aleta-bot/sipp/eviden-skp?peran=hakim&id=31&tahun=2026&periode=tw9");
    periksa("periode salah: 400", salah.status === 400, salah);
    const meledak = await minta("/internal/aleta-bot/sipp/eviden-skp?peran=hakim&id=500&tahun=2026&periode=tw2");
    periksa("layanan melempar: 500 dengan pesannya", meledak.status === 500 && meledak.isi.ok === false && /meledak/.test(meledak.isi.error), meledak);
  } finally {
    server.close();
    require.cache[jalurLayanan].exports = asli;
  }
}

utama().catch((galat) => {
  console.error("GALAT", galat);
  process.exit(1);
});
