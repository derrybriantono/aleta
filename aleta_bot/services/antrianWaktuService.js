"use strict";

/**
 * Buku waktu antrian sidang milik ALETA.
 *
 * ============================================================================
 * YANG HILANG DARI APLIKASI ANTRIAN - DAN SEBABNYA
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026: "buatkan database waktunya serta
 * antrian di aleta jadwal sidang karena di aplikasi antrian sidang tidak
 * tersimpan waktu antrian dan waktunya".
 *
 * Tabel sipp_turunan_antrian.antrian_sidang adalah tabel KERJA. Tiga hal
 * membuatnya tidak dapat menjadi catatan:
 *
 *   1. jam_sidang DITIMPA NOW() setiap kali perkara dipanggil (lihat
 *      panggilanAntrianService). Jam jadwal aslinya hilang pada panggilan
 *      pertama, dan jam panggil pertama hilang pada panggilan kedua.
 *   2. Tidak ada kolom "dipanggil pada" maupun "selesai" - satu-satunya jejak
 *      panggilan adalah jam_sidang yang ditimpa itu.
 *   3. Ia tidak dimaksudkan sebagai riwayat: yang dibaca layar dan WhatsApp
 *      hanya hari berjalan, dan barisnya tidak menjamin apa pun sesudah
 *      harinya lewat.
 *
 * Berkas ini MENGAMATI tabel itu berkala dan menyalin yang akan hilang ke
 * aleta_bot_antrian_waktu - satu baris per (tanggal sidang, perkara). Tidak
 * ada satu pun tulisan ke aplikasi antrian: yang diamati tidak disentuh.
 *
 * ============================================================================
 * BASIS WAKTUNYA JAM APLIKASI ANTRIAN, BUKAN UTC - BERBEDA DARI TABEL LAIN
 * ============================================================================
 *
 * Seluruh kolom waktu di tabel ini adalah jam dinding server antrian (NOW()
 * lokalnya, WITA) - persis yang ditulis aplikasi antrian, disalin sebagai
 * teks yang diformat DI SQL. Termasuk terlihat_pertama/terlihat_terakhir,
 * yang diambil dari NOW() basis data antrian, BUKAN dari jam Node.
 *
 * Itu kebalikan dari tabel ALETA lain yang menyimpan UTC (toMysqlDate), dan
 * disengaja: tiga jarak waktu sidang dihitung dengan MENGURANGKAN waktu-waktu
 * di tabel ini satu sama lain. Satu kolom yang basisnya lain menghasilkan
 * selisih delapan jam tanpa satu pun galat - peringatannya sudah tertulis di
 * kehadiranAntrianService. Karena itu toMysqlDate/fromMysqlDate TIDAK dipakai
 * di berkas ini.
 *
 * ============================================================================
 * YANG TIDAK PERNAH DITIMPA SESUDAH TERISI
 * ============================================================================
 *
 *   ambil_pihak1/2, ambil_saksi  waktu PERTAMA yang teramati. Mesin kios dapat
 *                                menulis ulang kolomnya saat orang kedua dari
 *                                sisi yang sama mengambil; yang dicatat tetap
 *                                kedatangan pertama.
 *   jam_jadwal                   jam_sidang yang terlihat SEBELUM perkara
 *                                pernah teramati dipanggil. Sesudah itu
 *                                jam_sidang adalah jam panggil, bukan jadwal.
 *   panggil_pertama              panggilan pertama yang TERAMATI.
 *   terlihat_pertama             kapan baris ini pertama kali terlihat.
 *
 * panggil_terakhir selalu mengikuti jam panggil terbaru, dan jumlah_panggil
 * bertambah tiap kali jam panggilnya berubah. Aturan itu dijaga DUA kali: di
 * gabungWaktu (murni, teruji) dan di SQL tulisnya (COALESCE), supaya penulis
 * lain - atau versi yang kelak lupa aturannya - tetap tidak dapat menghapusnya.
 *
 * ============================================================================
 * "TERAMATI" - BATAS YANG HARUS DIKATAKAN
 * ============================================================================
 *
 * Pencatat membaca tiap 30 detik. Perkara yang dipanggil dua kali dalam
 * selang itu tercatat sekali, dan pencatat yang baru menyala pukul 10:00 tidak
 * pernah melihat jadwal perkara yang sudah dipanggil pukul 09:30. Jam
 * panggilnya sendiri TETAP tepat sampai detiknya - ia datang dari jam_sidang,
 * bukan dari jam pengamatan.
 */

const botDb = require("./botDbService");
const externalDbService = require("./externalDbService");
const antrianSidangService = require("./antrianSidangService");
const logService = require("./logService");
const { angkaDisidang, keadaanDisidang } = require("./antrianDisidang");
const { cleanText } = require("./ecourtTextService");

/** Sambungan yang sama dengan pembaca antrian. */
const KUNCI_KONEKSI = "antrian_sidang";

/** Bawaan selang pengamatan. Dapat disetel ALETA_ANTRIAN_WAKTU_JEDA_MS. */
const JEDA_BAWAAN_MS = 30 * 1000;

/**
 * Baris yang tidak berubah tetap ditulis ulang sekali per lima menit, hanya
 * untuk memajukan terlihat_terakhir. Menulisnya tiap 30 detik berarti puluhan
 * ribu tulisan sehari yang tidak menambah keterangan apa pun.
 */
const SEGARKAN_TERLIHAT_MS = 5 * 60 * 1000;

/** Galat yang sama tidak dicatat ulang lebih sering dari ini. */
const JEDA_LOG_GALAT_MS = 30 * 60 * 1000;

const SQL_JAM = `
  SELECT
    DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS sekarang,
    DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hariIni`;

/**
 * Baris antrian HARI INI, dengan seluruh waktunya diformat di SQL.
 *
 * DATE_FORMAT, bukan kolom mentah: kolam koneksi ke mesin antrian dibuat tanpa
 * pilihan zona waktu, sehingga DATETIME mentah menjadi Date Node yang dapat
 * bergeser berjam-jam - catatan yang sama ada di antrianOnlineService.
 *
 * jam_sidang dibaca lewat CAST AS CHAR, bukan DATE_FORMAT: jenis kolomnya
 * tidak dijamin sama di tiap pengadilan (TIME di satu tempat, DATETIME di
 * tempat lain), dan CAST memulangkan teksnya apa adanya pada keduanya.
 *
 * Disaring tanggal_sidang = CURDATE() - tabel itu tidak dibersihkan saat
 * berganti hari (lihat antrianOnlineService), dan CURDATE() dinilai jam yang
 * sama dengan yang menulis NOW() ke kolom-kolomnya.
 */
const SQL_HARI_INI = `
  SELECT
    a.perkara_id AS perkaraId,
    DATE_FORMAT(a.tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
    a.majelis_hakim_kode AS majelisKode,
    a.ruangan_id AS ruanganId,
    a.no_ruang AS noRuang,
    CAST(a.jam_sidang AS CHAR) AS jamSidang,
    a.nama_petugas AS namaPetugas,
    a.disidang AS disidang,
    a.online AS online,
    DATE_FORMAT(a.pihak_1, '%Y-%m-%d %H:%i:%s') AS pihak1,
    DATE_FORMAT(a.pihak_2, '%Y-%m-%d %H:%i:%s') AS pihak2,
    DATE_FORMAT(a.saksi, '%Y-%m-%d %H:%i:%s') AS saksi
  FROM sipp_turunan_antrian.antrian_sidang a
  WHERE a.tanggal_sidang = CURDATE()`;

const SQL_SKEMA = `
  CREATE TABLE IF NOT EXISTS aleta_bot_antrian_waktu (
    tanggal_sidang DATE NOT NULL,
    perkara_id VARCHAR(32) NOT NULL,
    nomor_antrian INT NULL,
    no_ruang INT NULL,
    ruangan_id INT NULL,
    majelis_kode VARCHAR(64) NOT NULL DEFAULT '',
    online TINYINT(1) NULL,
    nama_petugas VARCHAR(191) NOT NULL DEFAULT '',
    ambil_pihak1 DATETIME NULL,
    ambil_pihak2 DATETIME NULL,
    ambil_saksi DATETIME NULL,
    ambil_terawal DATETIME NULL,
    jam_jadwal VARCHAR(8) NOT NULL DEFAULT '',
    panggil_pertama DATETIME NULL,
    panggil_terakhir DATETIME NULL,
    jumlah_panggil INT NOT NULL DEFAULT 0,
    terlihat_pertama DATETIME NOT NULL,
    terlihat_terakhir DATETIME NOT NULL,
    PRIMARY KEY (tanggal_sidang, perkara_id),
    INDEX idx_antrian_waktu_ruang (tanggal_sidang, no_ruang, panggil_terakhir)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

/**
 * Dibaca kembali sebagai TEKS, diformat di SQL - sama seperti saat diamati.
 * DATETIME mentah akan dibaca driver sebagai Date lokal Node dan kehilangan
 * satu-satunya sifat yang membuatnya berguna: sebasis dengan jam antrian.
 */
const SQL_BACA_REKAMAN = `
  SELECT
    DATE_FORMAT(tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
    perkara_id AS perkaraId,
    nomor_antrian AS nomorAntrian,
    no_ruang AS noRuang,
    ruangan_id AS ruanganId,
    majelis_kode AS majelisKode,
    online,
    nama_petugas AS namaPetugas,
    DATE_FORMAT(ambil_pihak1, '%Y-%m-%d %H:%i:%s') AS ambilPihak1,
    DATE_FORMAT(ambil_pihak2, '%Y-%m-%d %H:%i:%s') AS ambilPihak2,
    DATE_FORMAT(ambil_saksi, '%Y-%m-%d %H:%i:%s') AS ambilSaksi,
    DATE_FORMAT(ambil_terawal, '%Y-%m-%d %H:%i:%s') AS ambilTerawal,
    jam_jadwal AS jamJadwal,
    DATE_FORMAT(panggil_pertama, '%Y-%m-%d %H:%i:%s') AS panggilPertama,
    DATE_FORMAT(panggil_terakhir, '%Y-%m-%d %H:%i:%s') AS panggilTerakhir,
    jumlah_panggil AS jumlahPanggil,
    DATE_FORMAT(terlihat_pertama, '%Y-%m-%d %H:%i:%s') AS terlihatPertama,
    DATE_FORMAT(terlihat_terakhir, '%Y-%m-%d %H:%i:%s') AS terlihatTerakhir
  FROM aleta_bot_antrian_waktu
  WHERE tanggal_sidang IN (__DAFTAR__)`;

/**
 * Tulisan satu baris. Aturan "tidak ditimpa" diulang di sini dengan sengaja -
 * lihat kepala berkas. Tidak ada ruas pada SET yang membaca ruas lain yang
 * sudah diubah lebih dulu di pernyataan yang sama: MySQL menilai SET dari kiri
 * ke kanan, dan ruas yang membaca tetangganya akan membaca nilai BARU.
 */
const SQL_TULIS = `
  INSERT INTO aleta_bot_antrian_waktu
    (tanggal_sidang, perkara_id, nomor_antrian, no_ruang, ruangan_id, majelis_kode, online,
     nama_petugas, ambil_pihak1, ambil_pihak2, ambil_saksi, ambil_terawal, jam_jadwal,
     panggil_pertama, panggil_terakhir, jumlah_panggil, terlihat_pertama, terlihat_terakhir)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    nomor_antrian = COALESCE(VALUES(nomor_antrian), nomor_antrian),
    no_ruang = COALESCE(VALUES(no_ruang), no_ruang),
    ruangan_id = COALESCE(VALUES(ruangan_id), ruangan_id),
    majelis_kode = IF(VALUES(majelis_kode) = '', majelis_kode, VALUES(majelis_kode)),
    online = COALESCE(VALUES(online), online),
    nama_petugas = IF(VALUES(nama_petugas) = '', nama_petugas, VALUES(nama_petugas)),
    ambil_pihak1 = COALESCE(ambil_pihak1, VALUES(ambil_pihak1)),
    ambil_pihak2 = COALESCE(ambil_pihak2, VALUES(ambil_pihak2)),
    ambil_saksi = COALESCE(ambil_saksi, VALUES(ambil_saksi)),
    ambil_terawal = CASE
      WHEN ambil_terawal IS NULL THEN VALUES(ambil_terawal)
      WHEN VALUES(ambil_terawal) IS NULL THEN ambil_terawal
      ELSE LEAST(ambil_terawal, VALUES(ambil_terawal))
    END,
    jam_jadwal = IF(jam_jadwal = '', VALUES(jam_jadwal), jam_jadwal),
    panggil_pertama = COALESCE(panggil_pertama, VALUES(panggil_pertama)),
    panggil_terakhir = COALESCE(VALUES(panggil_terakhir), panggil_terakhir),
    jumlah_panggil = GREATEST(jumlah_panggil, VALUES(jumlah_panggil)),
    terlihat_terakhir = VALUES(terlihat_terakhir)`;

// ============================================================================
// BENTUK DAN PEMBACAAN NILAI
// ============================================================================

function tanggalSah(nilai) {
  const teks = String(nilai || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) && !teks.startsWith("0000") ? teks : "";
}

/** "YYYY-MM-DD HH:MM:SS" atau kosong. Tanggal nol MySQL dianggap kosong. */
function waktuSah(nilai) {
  const cocok = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(nilai || "").trim());
  if (!cocok || cocok[1].startsWith("0000")) return "";
  return `${cocok[1]} ${cocok[2]}:${cocok[3]}:${cocok[4] || "00"}`;
}

function angkaAtauNull(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

function duaDigit(n) {
  return String(n).padStart(2, "0");
}

/**
 * Jam "HH:MM:SS" dari jam_sidang - baik ia TIME ("09:41:19") maupun
 * DATETIME ("2026-09-01 09:41:19"). "00:00:00" dianggap kosong: jam nol
 * adalah nilai bawaan kolom, bukan jadwal sidang tengah malam.
 */
function jamDariJamSidang(nilai) {
  const teks = String(nilai || "").trim();
  const penuh = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(teks);
  const hanyaJam = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(teks);
  const bagian = penuh ? [penuh[2], penuh[3], penuh[4]] : hanyaJam ? [hanyaJam[1], hanyaJam[2], hanyaJam[3]] : null;
  if (!bagian) return "";
  const jam = Number(bagian[0]);
  const menit = Number(bagian[1]);
  const detik = Number(bagian[2] || 0);
  if (jam > 23 || menit > 59 || detik > 59) return "";
  const hasil = `${duaDigit(jam)}:${duaDigit(menit)}:${duaDigit(detik)}`;
  return hasil === "00:00:00" ? "" : hasil;
}

/**
 * Waktu panggil lengkap dari jam_sidang yang sedang bertanda dipanggil.
 *
 * Bila kolomnya DATETIME, tanggalnya sendiri yang dipakai; bila TIME, ia
 * dilekatkan pada tanggal sidang barisnya - yang memang hari ini, sebab
 * pembacaannya disaring CURDATE().
 */
function waktuPanggilDari(jamSidang, tanggalSidang) {
  const teks = String(jamSidang || "").trim();
  const jam = jamDariJamSidang(teks);
  if (!jam) return "";
  const penuh = /^(\d{4}-\d{2}-\d{2})[ T]/.exec(teks);
  const tanggal = penuh ? tanggalSah(penuh[1]) : tanggalSah(tanggalSidang);
  return tanggal ? `${tanggal} ${jam}` : "";
}

/** Yang terawal di antara dua waktu berbentuk tetap - perbandingan teks cukup. */
function terawal(a, b) {
  if (a && b) return a <= b ? a : b;
  return a || b || "";
}

/** Milidetik dari "YYYY-MM-DD HH:MM:SS", dibaca UTC supaya sebasis satu sama lain. */
function msDari(teks) {
  const cocok = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(teks || ""));
  if (!cocok) return null;
  return Date.UTC(+cocok[1], +cocok[2] - 1, +cocok[3], +cocok[4], +cocok[5], +cocok[6]);
}

/** Satu baris pembacaan langsung, dirapikan. */
function rapikanLangsung(row) {
  return {
    tanggalSidang: tanggalSah(row.tanggalSidang),
    perkaraId: String(row.perkaraId ?? "").trim(),
    majelisKode: cleanText(row.majelisKode),
    ruanganId: angkaAtauNull(row.ruanganId),
    noRuang: angkaAtauNull(row.noRuang),
    jamSidang: String(row.jamSidang ?? "").trim(),
    namaPetugas: cleanText(row.namaPetugas),
    disidang: angkaAtauNull(row.disidang),
    online: row.online === null || row.online === undefined ? null : Number(row.online) === 1,
    pihak1: waktuSah(row.pihak1),
    pihak2: waktuSah(row.pihak2),
    saksi: waktuSah(row.saksi),
  };
}

/** Satu baris rekaman, dirapikan. */
function rapikanRekaman(row) {
  return {
    tanggalSidang: tanggalSah(row.tanggalSidang),
    perkaraId: String(row.perkaraId ?? "").trim(),
    nomorAntrian: angkaAtauNull(row.nomorAntrian),
    noRuang: angkaAtauNull(row.noRuang),
    ruanganId: angkaAtauNull(row.ruanganId),
    majelisKode: cleanText(row.majelisKode),
    online: row.online === null || row.online === undefined ? null : Number(row.online) === 1,
    namaPetugas: cleanText(row.namaPetugas),
    ambilPihak1: waktuSah(row.ambilPihak1),
    ambilPihak2: waktuSah(row.ambilPihak2),
    ambilSaksi: waktuSah(row.ambilSaksi),
    ambilTerawal: waktuSah(row.ambilTerawal),
    jamJadwal: jamDariJamSidang(row.jamJadwal),
    panggilPertama: waktuSah(row.panggilPertama),
    panggilTerakhir: waktuSah(row.panggilTerakhir),
    jumlahPanggil: Math.max(0, Number(row.jumlahPanggil) || 0),
    terlihatPertama: waktuSah(row.terlihatPertama),
    terlihatTerakhir: waktuSah(row.terlihatTerakhir),
  };
}

function kunci(baris) {
  return `${baris.tanggalSidang}|${baris.perkaraId}`;
}

/** Ruas yang perubahannya layak ditulis. terlihat_* sengaja tidak ikut. */
const RUAS_BANDING = [
  "nomorAntrian",
  "noRuang",
  "ruanganId",
  "majelisKode",
  "online",
  "namaPetugas",
  "ambilPihak1",
  "ambilPihak2",
  "ambilSaksi",
  "ambilTerawal",
  "jamJadwal",
  "panggilPertama",
  "panggilTerakhir",
  "jumlahPanggil",
];

/**
 * ============================================================================
 * MENYATUKAN YANG SUDAH TERCATAT DENGAN YANG BARU TERLIHAT
 * ============================================================================
 *
 * Fungsi murni - tidak menyentuh basis data mana pun - dan dipakai DUA jalan:
 * pencatat berkala (hasilnya ditulis) dan pembaca jadwal sidang (hasilnya
 * hanya ditampilkan, untuk hari ini). Keduanya karena itu tidak pernah
 * berselisih tentang apa arti satu pengamatan.
 *
 * @param lama     baris tersimpan, atau null
 * @param kini     pengamatan langsung (rapikanLangsung) + nomorAntrian
 * @param sekarang NOW() basis antrian, "YYYY-MM-DD HH:MM:SS"
 * @returns {{baris: object, berubah: boolean}}
 */
function gabungWaktu(lama, kini, sekarang) {
  const dulu = lama || {};
  const baru = kini || {};

  const baris = {
    tanggalSidang: tanggalSah(baru.tanggalSidang) || tanggalSah(dulu.tanggalSidang),
    perkaraId: String(baru.perkaraId || dulu.perkaraId || "").trim(),
    // Keterangan yang berubah wajar sepanjang hari: yang terakhir terlihat
    // dipakai, dan kekosongan sesaat tidak menghapus yang sudah ada.
    nomorAntrian: angkaAtauNull(baru.nomorAntrian) ?? angkaAtauNull(dulu.nomorAntrian),
    noRuang: angkaAtauNull(baru.noRuang) ?? angkaAtauNull(dulu.noRuang),
    ruanganId: angkaAtauNull(baru.ruanganId) ?? angkaAtauNull(dulu.ruanganId),
    majelisKode: cleanText(baru.majelisKode) || cleanText(dulu.majelisKode),
    online: baru.online === true || baru.online === false ? baru.online : dulu.online ?? null,
    namaPetugas: cleanText(baru.namaPetugas) || cleanText(dulu.namaPetugas),
    // Waktu ambil: yang PERTAMA teramati, tidak pernah ditimpa.
    ambilPihak1: waktuSah(dulu.ambilPihak1) || waktuSah(baru.pihak1),
    ambilPihak2: waktuSah(dulu.ambilPihak2) || waktuSah(baru.pihak2),
    ambilSaksi: waktuSah(dulu.ambilSaksi) || waktuSah(baru.saksi),
  };
  // Nomor antrian lahir dari waktu ambil TERAWAL di antara kedua pihak -
  // saksi tidak ikut, sama dengan rumus antrianSidangService.
  baris.ambilTerawal = terawal(baris.ambilPihak1, baris.ambilPihak2);

  // ==========================================================================
  // "DIPANGGIL" = MASUK RUANG (disidang 1..9), BUKAN 10
  // ==========================================================================
  //
  // Aplikasi antrian menulis disidang = nomor ruang DAN jam_sidang = now() saat
  // perkara masuk ruang; 10 berarti SELESAI dan TIDAK menyentuh jam_sidang
  // (lihat antrianDisidang.js). Sampai 1.183.0 yang dihitung panggilan justru
  // 10, sehingga jam masuk ruang baru tercatat sesudah sidangnya selesai -
  // dan sidang yang sedang berjalan tidak pernah punya jam mulai.
  //
  // Baris 10 yang masuk-ruangnya TIDAK teramati (selang 30 detik terlewati,
  // atau pencatat baru menyala): jam_sidang-nya masih jam masuk ruang - kecuali
  // perkaranya langsung ditunda tanpa PROSES, yang meninggalkan jam jadwal.
  // Karena itu jamnya dipakai hanya bila jam jadwalnya sudah tercatat dan
  // berbeda darinya; tanpa jam jadwal tidak ada yang dapat membedakan
  // keduanya, dan jam itu tidak dicatat sebagai panggilan.
  const keadaanKini = keadaanDisidang(baru.disidang);
  const jamKini = jamDariJamSidang(baru.jamSidang);
  const jadwalLama = jamDariJamSidang(dulu.jamJadwal);
  const masukRuangKini = keadaanKini === "disidang";
  const masukTerlewat = keadaanKini === "selesai" && Boolean(jamKini) && Boolean(jadwalLama) && jamKini !== jadwalLama;
  const waktuPanggil =
    masukRuangKini || masukTerlewat ? waktuPanggilDari(baru.jamSidang, baris.tanggalSidang) : "";
  const pernahDipanggil = Boolean(waktuSah(dulu.panggilPertama) || waktuSah(dulu.panggilTerakhir));

  // Jam jadwal hanya dari baris yang masih MENUNGGU dan BELUM PERNAH teramati
  // dipanggil. Sesudah masuk ruang jam_sidang berisi jam masuk - menyalinnya
  // sebagai jadwal berarti mencatat jadwal yang tidak pernah ada. Baris 10 pun
  // tidak: jam_sidang-nya mungkin jam masuk yang tidak teramati.
  baris.jamJadwal =
    jadwalLama || (keadaanKini === "menunggu" && !pernahDipanggil ? jamKini : "");

  const terakhirLama = waktuSah(dulu.panggilTerakhir);
  baris.panggilPertama = waktuSah(dulu.panggilPertama) || waktuPanggil;
  baris.panggilTerakhir = waktuPanggil || terakhirLama;
  const jumlahLama = Math.max(0, Number(dulu.jumlahPanggil) || 0);
  baris.jumlahPanggil = waktuPanggil && waktuPanggil !== terakhirLama ? jumlahLama + 1 : jumlahLama;

  const kini_ = waktuSah(sekarang);
  baris.terlihatPertama = waktuSah(dulu.terlihatPertama) || kini_;
  baris.terlihatTerakhir = kini_ || waktuSah(dulu.terlihatTerakhir);

  let berubah = !lama;
  if (!berubah) {
    berubah = RUAS_BANDING.some((ruas) => (baris[ruas] ?? null) !== (dulu[ruas] ?? null));
  }
  if (!berubah) {
    const a = msDari(waktuSah(dulu.terlihatTerakhir));
    const b = msDari(kini_);
    berubah = a === null || (b !== null && b - a >= SEGARKAN_TERLIHAT_MS);
  }

  return { baris, berubah };
}

/** Nomor antrian resmi untuk satu baris, dari peta antrianSidangService. */
function nomorDariPeta(peta, baris) {
  const punya = peta && peta[String(baris.perkaraId)];
  if (!punya || !punya.tanggalSidang || punya.tanggalSidang !== baris.tanggalSidang) return null;
  return typeof punya.nomor === "number" ? punya.nomor : null;
}

// ============================================================================
// BASIS DATA
// ============================================================================

let skemaSiap = false;

async function ensureSchema() {
  if (skemaSiap) return true;
  await botDb.query(SQL_SKEMA);
  skemaSiap = true;
  return true;
}

/** Dipakai pengujian supaya skema tidak dianggap sudah terpasang. */
function lupakan() {
  skemaSiap = false;
}

async function bacaJamAntrian() {
  const rows = await externalDbService.query(KUNCI_KONEKSI, SQL_JAM, []);
  const baris = Array.isArray(rows) ? rows[0] : null;
  const sekarang = waktuSah(baris && baris.sekarang);
  const hariIni = tanggalSah(baris && baris.hariIni);
  if (!sekarang || !hariIni) throw new Error("jam basis data antrian tidak terbaca");
  return { sekarang, hariIni };
}

async function bacaLangsungHariIni() {
  const rows = await externalDbService.query(KUNCI_KONEKSI, SQL_HARI_INI, []);
  return (Array.isArray(rows) ? rows : [])
    .map(rapikanLangsung)
    .filter((b) => b.perkaraId && b.tanggalSidang);
}

async function bacaRekaman(daftarTanggal) {
  const hari = [...new Set((daftarTanggal || []).map(tanggalSah).filter(Boolean))];
  if (hari.length === 0) return [];
  const sql = SQL_BACA_REKAMAN.replace("__DAFTAR__", hari.map(() => "?").join(", "));
  const rows = await botDb.query(sql, hari);
  return (Array.isArray(rows) ? rows : []).map(rapikanRekaman).filter((b) => b.perkaraId && b.tanggalSidang);
}

async function tulis(baris) {
  const kosongJadiNull = (nilai) => (nilai ? nilai : null);
  await botDb.query(SQL_TULIS, [
    baris.tanggalSidang,
    baris.perkaraId.slice(0, 32),
    baris.nomorAntrian,
    baris.noRuang,
    baris.ruanganId,
    String(baris.majelisKode || "").slice(0, 64),
    baris.online === null || baris.online === undefined ? null : baris.online ? 1 : 0,
    String(baris.namaPetugas || "").slice(0, 191),
    kosongJadiNull(baris.ambilPihak1),
    kosongJadiNull(baris.ambilPihak2),
    kosongJadiNull(baris.ambilSaksi),
    kosongJadiNull(baris.ambilTerawal),
    baris.jamJadwal || "",
    kosongJadiNull(baris.panggilPertama),
    kosongJadiNull(baris.panggilTerakhir),
    baris.jumlahPanggil || 0,
    baris.terlihatPertama,
    baris.terlihatTerakhir,
  ]);
}

// ============================================================================
// PENCATAT BERKALA
// ============================================================================

const keadaan = {
  aktif: false,
  sedangJalan: false,
  jedaMs: JEDA_BAWAAN_MS,
  terakhirJalan: "",
  terakhirHasil: null,
  terakhirGalat: "",
  galatBeruntun: 0,
  terakhirLogGalatMs: 0,
  terakhirLogGalatPesan: "",
};

let pewaktu = null;

function jedaDariLingkungan() {
  const n = Number(process.env.ALETA_ANTRIAN_WAKTU_JEDA_MS);
  // Di bawah lima detik tidak ada gunanya - aplikasi antrian sendiri tidak
  // berubah secepat itu - dan hanya menambah beban pada basis datanya.
  return Number.isFinite(n) && n >= 5000 ? n : JEDA_BAWAAN_MS;
}

function jamKerja() {
  const mulai = Number(process.env.ALETA_ANTRIAN_WAKTU_JAM_MULAI);
  const selesai = Number(process.env.ALETA_ANTRIAN_WAKTU_JAM_SELESAI);
  return {
    mulai: Number.isFinite(mulai) && mulai >= 0 && mulai <= 23 ? mulai : 7,
    selesai: Number.isFinite(selesai) && selesai >= 1 && selesai <= 24 ? selesai : 18,
  };
}

/**
 * Hari kerja dan jam kantor menurut WITA, bukan menurut jam server.
 *
 * Peladen boleh berjalan dalam UTC; "pukul tujuh" yang dimaksud tetap pukul
 * tujuh di Donggala. Zonanya sama dengan seluruh penjadwal bot
 * (ALETA_BOT_CRON_TIMEZONE, bawaan Asia/Makassar).
 */
function dalamJamKerja(tanggal = new Date()) {
  const zona = String(process.env.ALETA_BOT_CRON_TIMEZONE || "Asia/Makassar").trim() || "Asia/Makassar";
  let hari = "";
  let jam = -1;
  try {
    const bagian = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(tanggal);
    hari = (bagian.find((b) => b.type === "weekday") || {}).value || "";
    jam = Number((bagian.find((b) => b.type === "hour") || {}).value);
  } catch {
    return false;
  }
  if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(hari)) return false;
  const { mulai, selesai } = jamKerja();
  return jam >= mulai && jam < selesai;
}

/**
 * Galat dicatat sekali, lalu diam sampai pesannya berubah atau setengah jam
 * berlalu. Sambungan antrian yang putus seharian - atau yang memang tidak ada,
 * seperti di mesin pengembang - tidak boleh menulis dua ribu baris log yang
 * isinya sama.
 */
function catatGalat(galat) {
  const pesan = externalDbService.sanitizeError
    ? String(externalDbService.sanitizeError(galat)).slice(0, 200)
    : String((galat && galat.message) || galat).slice(0, 200);
  keadaan.terakhirGalat = pesan;
  keadaan.galatBeruntun += 1;
  const kiniMs = Date.now();
  if (pesan === keadaan.terakhirLogGalatPesan && kiniMs - keadaan.terakhirLogGalatMs < JEDA_LOG_GALAT_MS) {
    return pesan;
  }
  keadaan.terakhirLogGalatPesan = pesan;
  keadaan.terakhirLogGalatMs = kiniMs;
  console.warn(`[ALETA Bot] Pencatat waktu antrian belum dapat membaca: ${pesan}`);
  void Promise.resolve(
    logService.logSystemEvent({
      eventType: "antrian_waktu_gagal",
      severity: "warning",
      message: "Pencatat waktu antrian gagal membaca; akan dicoba lagi pada putaran berikutnya.",
      metadata: { errorMessage: pesan, galatBeruntun: keadaan.galatBeruntun },
    })
  ).catch(() => {});
  return pesan;
}

function catatPulih() {
  if (keadaan.galatBeruntun === 0) return;
  const beruntun = keadaan.galatBeruntun;
  keadaan.galatBeruntun = 0;
  keadaan.terakhirGalat = "";
  keadaan.terakhirLogGalatPesan = "";
  void Promise.resolve(
    logService.logSystemEvent({
      eventType: "antrian_waktu_pulih",
      severity: "info",
      message: `Pencatat waktu antrian kembali membaca sesudah ${beruntun} putaran gagal.`,
      metadata: { galatBeruntun: beruntun },
    })
  ).catch(() => {});
}

/**
 * Satu putaran pengamatan.
 *
 * @param {{paksa?: boolean}} opsi paksa melewati pemeriksaan jam kerja -
 *   hanya untuk pengujian dan pemicuan tangan.
 */
async function catatSekali({ paksa = false } = {}) {
  if (keadaan.sedangJalan) return { ok: false, alasan: "sedang_berjalan" };
  if (!paksa && !dalamJamKerja()) return { ok: true, dilewati: "di_luar_jam_kerja", ditulis: 0 };

  keadaan.sedangJalan = true;
  try {
    const jam = await bacaJamAntrian();
    const langsung = (await bacaLangsungHariIni()).filter((b) => b.tanggalSidang === jam.hariIni);

    // Hari tanpa baris antrian tidak menulis apa pun - termasuk tidak
    // membuat tabelnya. Pencatat di mesin tanpa aplikasi antrian tidak
    // meninggalkan jejak di basis data ALETA.
    if (langsung.length === 0) {
      catatPulih();
      keadaan.terakhirJalan = jam.sekarang;
      keadaan.terakhirHasil = { dibaca: 0, ditulis: 0, hariIni: jam.hariIni };
      return { ok: true, dibaca: 0, ditulis: 0, hariIni: jam.hariIni };
    }

    // Nomor antrian dari rumus RESMI - yang sama dengan layar dan WhatsApp -
    // bukan dihitung ulang di sini. Gagalnya tidak menggagalkan putaran:
    // nomornya saja yang tidak diperbarui.
    const petaNomor = await antrianSidangService.petaAntrian().catch(() => ({ terbaca: false, peta: {} }));
    const peta = petaNomor && petaNomor.terbaca ? petaNomor.peta : null;

    await ensureSchema();
    const tersimpan = new Map((await bacaRekaman([jam.hariIni])).map((b) => [kunci(b), b]));

    let ditulis = 0;
    for (const kini of langsung) {
      const { baris, berubah } = gabungWaktu(
        tersimpan.get(kunci(kini)) || null,
        { ...kini, nomorAntrian: nomorDariPeta(peta, kini) },
        jam.sekarang
      );
      if (!berubah) continue;
      await tulis(baris);
      ditulis += 1;
    }

    catatPulih();
    keadaan.terakhirJalan = jam.sekarang;
    keadaan.terakhirHasil = { dibaca: langsung.length, ditulis, hariIni: jam.hariIni };
    return { ok: true, dibaca: langsung.length, ditulis, hariIni: jam.hariIni };
  } catch (galat) {
    return { ok: false, alasan: catatGalat(galat) };
  } finally {
    keadaan.sedangJalan = false;
  }
}

/**
 * Menyalakan pencatat.
 *
 * Tidak bergantung pada WhatsApp: yang diamati aplikasi antrian, dan
 * catatannya diperlukan justru pada hari WhatsApp sedang tidak tersambung.
 * Dimatikan dengan ALETA_ANTRIAN_WAKTU_AKTIF=0.
 */
function mulai() {
  if (pewaktu) return false;
  if (String(process.env.ALETA_ANTRIAN_WAKTU_AKTIF || "1").trim() === "0") {
    keadaan.aktif = false;
    return false;
  }
  keadaan.aktif = true;
  keadaan.jedaMs = jedaDariLingkungan();
  const detak = () => {
    catatSekali().catch(() => {});
  };
  pewaktu = setInterval(detak, keadaan.jedaMs);
  if (pewaktu.unref) pewaktu.unref();
  // Putaran pertama ditunda sebentar: bot yang baru menyala sedang menyambung
  // ke banyak hal sekaligus.
  const awal = setTimeout(detak, 20 * 1000);
  if (awal.unref) awal.unref();
  return true;
}

function hentikan() {
  if (pewaktu) clearInterval(pewaktu);
  pewaktu = null;
  keadaan.aktif = false;
}

function status() {
  return {
    aktif: keadaan.aktif,
    sedangJalan: keadaan.sedangJalan,
    jedaMs: keadaan.jedaMs,
    jamKerja: jamKerja(),
    dalamJamKerja: dalamJamKerja(),
    terakhirJalan: keadaan.terakhirJalan,
    terakhirHasil: keadaan.terakhirHasil,
    terakhirGalat: keadaan.terakhirGalat,
    galatBeruntun: keadaan.galatBeruntun,
  };
}

// ============================================================================
// PEMBACA UNTUK JADWAL SIDANG
// ============================================================================

/**
 * @param disidang nilai disidang LANGSUNG dari aplikasi antrian (hanya baris
 *   hari ini yang terbaca langsung); undefined = tidak diketahui (rekaman saja),
 *   dan kuncinya lalu tidak dikirim - portal memakai tebakan panggilan terakhir.
 */
function keluaran(baris, sumber, disidang) {
  const isiDisidang = disidang === undefined ? {} : { disidang: angkaDisidang(disidang) };
  return {
    ...isiDisidang,
    tanggalSidang: baris.tanggalSidang,
    perkaraId: baris.perkaraId,
    nomorAntrian: baris.nomorAntrian ?? null,
    noRuang: baris.noRuang ?? null,
    ruanganId: baris.ruanganId ?? null,
    majelisKode: baris.majelisKode || "",
    ambilPihak1: baris.ambilPihak1 || "",
    ambilPihak2: baris.ambilPihak2 || "",
    ambilSaksi: baris.ambilSaksi || "",
    ambilTerawal: baris.ambilTerawal || "",
    jamJadwal: baris.jamJadwal || "",
    panggilPertama: baris.panggilPertama || "",
    panggilTerakhir: baris.panggilTerakhir || "",
    jumlahPanggil: baris.jumlahPanggil || 0,
    online: baris.online === true || baris.online === false ? baris.online : null,
    namaPetugas: baris.namaPetugas || "",
    sumber,
  };
}

/**
 * Waktu antrian untuk tanggal-tanggal yang sedang dibuka jadwal sidang.
 *
 * SELURUH baris tiap tanggal, bukan hanya perkara yang tampil: jarak antar
 * sidang dihitung per ruang atas semua perkara hari itu, dan perkara yang
 * tersaring tetap menjadi tetangga perkara yang tampil.
 *
 * Hari ini dibaca LANGSUNG dari aplikasi antrian lalu disatukan dengan
 * rekaman lewat gabungWaktu yang sama dengan pencatat - sehingga layar tetap
 * seketika walau pencatatnya mati atau tertinggal satu putaran, dan panggilan
 * pertama yang sudah tertimpa di aplikasi antrian tetap terbaca dari rekaman.
 *
 * Tiap sumber gagal sendiri-sendiri; kegagalannya disebutkan di `alasan`.
 *
 * @param {{tanggal?: string[], petaNomor?: Record<string, object>|null}} opsi
 */
async function waktuUntukJadwal({ tanggal = [], petaNomor = null } = {}) {
  const hari = [...new Set((tanggal || []).map(tanggalSah).filter(Boolean))].sort().slice(0, 62);
  const hasil = {
    terbaca: false,
    alasan: "",
    sekarang: "",
    hariIni: "",
    langsungTerbaca: false,
    rekamanTerbaca: false,
    baris: [],
  };
  const alasan = [];
  const sebut = (galat) =>
    externalDbService.sanitizeError
      ? String(externalDbService.sanitizeError(galat)).slice(0, 160)
      : String((galat && galat.message) || galat).slice(0, 160);

  let jam = null;
  try {
    jam = await bacaJamAntrian();
    hasil.sekarang = jam.sekarang;
    hasil.hariIni = jam.hariIni;
    hasil.langsungTerbaca = true;
  } catch (galat) {
    alasan.push(`aplikasi antrian tidak terbaca: ${sebut(galat)}`);
  }

  const perKunci = new Map();
  if (hari.length > 0) {
    try {
      await ensureSchema();
      for (const baris of await bacaRekaman(hari)) perKunci.set(kunci(baris), { baris, sumber: "rekaman" });
      hasil.rekamanTerbaca = true;
    } catch (galat) {
      alasan.push(`rekaman waktu antrian tidak terbaca: ${sebut(galat)}`);
    }
  }

  if (jam && hari.includes(jam.hariIni)) {
    try {
      for (const kini of await bacaLangsungHariIni()) {
        if (kini.tanggalSidang !== jam.hariIni) continue;
        const k = kunci(kini);
        const ada = perKunci.get(k);
        const { baris } = gabungWaktu(
          ada ? ada.baris : null,
          { ...kini, nomorAntrian: nomorDariPeta(petaNomor, kini) },
          jam.sekarang
        );
        perKunci.set(k, { baris, sumber: ada ? "gabungan" : "langsung", disidang: kini.disidang });
      }
    } catch (galat) {
      hasil.langsungTerbaca = false;
      alasan.push(`antrian hari ini tidak terbaca: ${sebut(galat)}`);
    }
  }

  hasil.terbaca = hasil.rekamanTerbaca || hasil.langsungTerbaca;
  hasil.alasan = alasan.join("; ");
  hasil.baris = [...perKunci.values()]
    .map(({ baris, sumber, disidang }) => keluaran(baris, sumber, disidang))
    .sort((a, b) => a.tanggalSidang.localeCompare(b.tanggalSidang) || a.perkaraId.localeCompare(b.perkaraId));
  return hasil;
}

module.exports = {
  JEDA_BAWAAN_MS,
  KUNCI_KONEKSI,
  SEGARKAN_TERLIHAT_MS,
  SQL_BACA_REKAMAN,
  SQL_HARI_INI,
  SQL_JAM,
  SQL_SKEMA,
  SQL_TULIS,
  catatSekali,
  dalamJamKerja,
  ensureSchema,
  gabungWaktu,
  hentikan,
  jamDariJamSidang,
  lupakan,
  mulai,
  status,
  waktuPanggilDari,
  waktuUntukJadwal,
};
