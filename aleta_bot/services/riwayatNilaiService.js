"use strict";

/**
 * ============================================================================
 * MS03 - RIWAYAT NILAI TERSIMPAN BESERTA AMBANG YANG BERLAKU SAAT ITU
 * ============================================================================
 *
 * Nilai TIDAK dihitung ulang setiap layar dibuka. Ia dihitung sekali per
 * periode lalu disimpan, bersama kumpulan ambang yang berlaku pada saat itu.
 *
 * Sebabnya bukan kecepatan.
 *
 * Nilai yang selalu dihitung ulang akan BERUBAH ketika data lampaunya
 * disunting, ketika ambangnya diganti, atau ketika rumusnya diperbaiki - dan
 * berubahnya tanpa suara. Laporan bulan lalu yang sudah ditandatangani ketua
 * mendadak tidak dapat direproduksi, dan tidak seorang pun dapat menunjukkan
 * kapan angkanya bergeser.
 *
 * Dengan riwayat tersimpan, ketiga perubahan itu justru menjadi TEMUAN:
 * hitung ulang dibandingkan dengan yang tersimpan, dan selisihnya dilaporkan
 * beserta dugaan sebabnya.
 *
 * ============================================================================
 * TIGA SEBAB SELISIH, DAN KETIGANYA BERBEDA ARTINYA
 * ============================================================================
 *
 *   ambang berubah   - sah. Nilai lama dihitung dengan aturan lama; itu
 *                      memang yang seharusnya. Sidik ambangnya berbeda, dan
 *                      itulah buktinya.
 *   data disunting   - perlu ditelaah. Data perkara lampau berubah sesudah
 *                      periodenya ditutup.
 *   rumus berubah    - perlu ditelaah. Angka lama dan baru tidak sebanding,
 *                      dan seluruh riwayat perlu dihitung ulang dengan sadar.
 *
 * Menyamakan ketiganya menjadi "ada selisih" membuang seluruh keterangan yang
 * membuat temuan itu dapat ditindaklanjuti.
 */

const botDb = require("./botDbService");
const ambangPenilaian = require("./ambangPenilaianService");

const TABEL = "aleta_bot_nilai_riwayat";

let tabelSiap = false;
let janjiTabel = null;

/**
 * Kunci barisnya (penilaian, jenis periode, satuan) - unik.
 *
 * Menghitung ulang periode yang sama MEMPERBARUI barisnya, bukan menambah
 * baris kedua. Dua baris untuk periode yang sama akan membuat "nilai bulan
 * Agustus" punya dua jawaban, dan yang terbaca tergantung urutan pembacaan.
 */
async function pastikanTabel() {
  if (tabelSiap) return true;
  if (janjiTabel) return janjiTabel;

  janjiTabel = (async () => {
    await botDb.query(`
      CREATE TABLE IF NOT EXISTS ${TABEL} (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        penilaian VARCHAR(64) NOT NULL,
        periode_jenis VARCHAR(24) NOT NULL,
        unit_kunci VARCHAR(32) NOT NULL,
        unit_label VARCHAR(191) NOT NULL DEFAULT '',
        mulai DATE NULL,
        selesai DATE NULL,
        terpenuhi BIGINT NULL,
        penyebut BIGINT NULL,
        nilai DECIMAL(6,2) NULL,
        cukup TINYINT NOT NULL DEFAULT 0,
        sebab_tidak_cukup VARCHAR(191) NOT NULL DEFAULT '',
        cakupan_terpakai BIGINT NULL,
        cakupan_semestinya BIGINT NULL,
        sidik_ambang VARCHAR(512) NOT NULL DEFAULT '',
        ambang_json MEDIUMTEXT NULL,
        versi_rumus VARCHAR(64) NOT NULL DEFAULT '',
        dihitung_pada DATETIME NOT NULL,
        UNIQUE KEY uniq_nilai_periode (penilaian, periode_jenis, unit_kunci),
        KEY idx_nilai_penilaian (penilaian, periode_jenis),
        KEY idx_nilai_waktu (dihitung_pada)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tabelSiap = true;
    return true;
  })();

  try {
    return await janjiTabel;
  } catch (galat) {
    janjiTabel = null;
    throw galat;
  }
}

function lupakanTabel() {
  tabelSiap = false;
  janjiTabel = null;
}

function angkaAtauNull(x) {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Menyimpan satu nilai periode.
 *
 * Kumpulan ambangnya diambil dari TANGGAL AKHIR periodenya, bukan dari hari
 * ini. Periode Agustus dinilai dengan aturan yang berlaku pada Agustus - itu
 * satu-satunya cara nilai lampau tetap dapat direproduksi.
 */
async function simpanNilai(butir) {
  await pastikanTabel();

  const {
    penilaian,
    periodeJenis,
    unitKunci,
    unitLabel = "",
    mulai = null,
    selesai = null,
    terpenuhi = null,
    penyebut = null,
    nilai = null,
    cukup = false,
    sebabTidakCukup = "",
    cakupanTerpakai = null,
    cakupanSemestinya = null,
    versiRumus = "",
    dihitungPada = new Date(),
  } = butir || {};

  if (!penilaian || !periodeJenis || !unitKunci) {
    throw new Error("simpanNilai menuntut penilaian, periodeJenis, dan unitKunci");
  }

  const tanggalAmbang = selesai || mulai || null;
  const sidik = tanggalAmbang ? ambangPenilaian.sidikAmbang(tanggalAmbang) : "";
  const kumpulan = tanggalAmbang ? ambangPenilaian.kumpulanAmbang(tanggalAmbang) : {};

  await botDb.query(
    `INSERT INTO ${TABEL}
      (penilaian, periode_jenis, unit_kunci, unit_label, mulai, selesai,
       terpenuhi, penyebut, nilai, cukup, sebab_tidak_cukup,
       cakupan_terpakai, cakupan_semestinya, sidik_ambang, ambang_json,
       versi_rumus, dihitung_pada)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       unit_label = VALUES(unit_label),
       mulai = VALUES(mulai),
       selesai = VALUES(selesai),
       terpenuhi = VALUES(terpenuhi),
       penyebut = VALUES(penyebut),
       nilai = VALUES(nilai),
       cukup = VALUES(cukup),
       sebab_tidak_cukup = VALUES(sebab_tidak_cukup),
       cakupan_terpakai = VALUES(cakupan_terpakai),
       cakupan_semestinya = VALUES(cakupan_semestinya),
       sidik_ambang = VALUES(sidik_ambang),
       ambang_json = VALUES(ambang_json),
       versi_rumus = VALUES(versi_rumus),
       dihitung_pada = VALUES(dihitung_pada)`,
    [
      String(penilaian),
      String(periodeJenis),
      String(unitKunci),
      String(unitLabel).slice(0, 191),
      mulai,
      selesai,
      angkaAtauNull(terpenuhi),
      angkaAtauNull(penyebut),
      angkaAtauNull(nilai),
      cukup ? 1 : 0,
      String(sebabTidakCukup).slice(0, 191),
      angkaAtauNull(cakupanTerpakai),
      angkaAtauNull(cakupanSemestinya),
      sidik.slice(0, 512),
      JSON.stringify(kumpulan),
      String(versiRumus).slice(0, 64),
      botDb.toMysqlDate ? botDb.toMysqlDate(dihitungPada) : dihitungPada,
    ]
  );

  return { penilaian, periodeJenis, unitKunci, sidikAmbang: sidik };
}

/** Membaca riwayat satu penilaian pada satu jendela periode. */
async function bacaRiwayat(penilaian, periodeJenis, batas = 60) {
  await pastikanTabel();
  const baris = await botDb.query(
    `SELECT penilaian, periode_jenis AS periodeJenis, unit_kunci AS unitKunci,
            unit_label AS unitLabel, mulai, selesai, terpenuhi, penyebut, nilai,
            cukup, sebab_tidak_cukup AS sebabTidakCukup,
            cakupan_terpakai AS cakupanTerpakai, cakupan_semestinya AS cakupanSemestinya,
            sidik_ambang AS sidikAmbang, versi_rumus AS versiRumus,
            dihitung_pada AS dihitungPada
       FROM ${TABEL}
      WHERE penilaian = ? AND periode_jenis = ?
      ORDER BY unit_kunci ASC
      LIMIT ?`,
    [String(penilaian), String(periodeJenis), Number(batas) || 60]
  );
  return Array.isArray(baris) ? baris : [];
}

/** Satu nilai tersimpan, atau null bila belum pernah dihitung. */
async function bacaSatu(penilaian, periodeJenis, unitKunci) {
  await pastikanTabel();
  const baris = await botDb.query(
    `SELECT penilaian, periode_jenis AS periodeJenis, unit_kunci AS unitKunci,
            terpenuhi, penyebut, nilai, cukup, sidik_ambang AS sidikAmbang,
            versi_rumus AS versiRumus, dihitung_pada AS dihitungPada
       FROM ${TABEL}
      WHERE penilaian = ? AND periode_jenis = ? AND unit_kunci = ?
      LIMIT 1`,
    [String(penilaian), String(periodeJenis), String(unitKunci)]
  );
  return (Array.isArray(baris) && baris[0]) || null;
}

/** Pembanding angka yang memperlakukan null sebagai nilai tersendiri. */
function samaAngka(a, b) {
  const x = angkaAtauNull(a);
  const y = angkaAtauNull(b);
  if (x === null && y === null) return true;
  if (x === null || y === null) return false;
  return Math.abs(x - y) < 0.005;
}

/**
 * Membandingkan hitungan baru dengan yang tersimpan, lalu MENYEBUT DUGAAN
 * SEBABNYA - bukan sekadar mengatakan ada selisih.
 *
 * @param tersimpan baris dari bacaSatu()
 * @param baru      { terpenuhi, penyebut, nilai, versiRumus }
 * @param tanggalAmbangSekarang tanggal yang dipakai menghitung ulang
 */
function bandingkanHitungUlang(tersimpan, baru, tanggalAmbangSekarang) {
  if (!tersimpan) {
    return { keadaan: "belum-pernah", sama: false, sebab: "belum pernah dihitung dan disimpan" };
  }

  const sidikSekarang = tanggalAmbangSekarang ? ambangPenilaian.sidikAmbang(tanggalAmbangSekarang) : "";
  const ambangBerubah = Boolean(tersimpan.sidikAmbang) && Boolean(sidikSekarang) && tersimpan.sidikAmbang !== sidikSekarang;
  const rumusBerubah =
    Boolean(baru && baru.versiRumus) &&
    Boolean(tersimpan.versiRumus) &&
    String(baru.versiRumus) !== String(tersimpan.versiRumus);

  const nilaiSama = samaAngka(tersimpan.nilai, baru && baru.nilai);
  const penyusunSama =
    samaAngka(tersimpan.terpenuhi, baru && baru.terpenuhi) &&
    samaAngka(tersimpan.penyebut, baru && baru.penyebut);

  if (nilaiSama && penyusunSama) {
    return { keadaan: "sama", sama: true, ambangBerubah, rumusBerubah };
  }

  // Urutan dugaannya disengaja. Ambang yang berubah adalah sebab yang SAH dan
  // paling sering; menyebutnya lebih dahulu mencegah telaah yang tidak perlu.
  // Rumus yang berubah menuntut seluruh riwayat dihitung ulang dengan sadar.
  // Yang tersisa - keduanya tidak berubah tetapi angkanya berbeda - berarti
  // data lampaunya yang berubah, dan itu justru temuan pengawasan.
  let dugaan;
  if (ambangBerubah && rumusBerubah) {
    // Keduanya berubah sekaligus. Menyebut ambangnya saja - sebagaimana urutan
    // di bawah - akan menutupi tuntutan yang lebih berat: rumus yang berubah
    // membuat angka lama dan baru TIDAK SEBANDING, dan itu tidak boleh hilang
    // hanya karena ada sebab lain yang lebih ringan ikut berubah.
    dugaan =
      "ambang DAN rumusnya sama-sama berubah sesudah nilai ini disimpan - " +
      "angka lama dan baru tidak sebanding, seluruh riwayat perlu dihitung ulang dengan sadar";
  } else if (ambangBerubah) {
    dugaan = "ambang berubah sesudah nilai ini disimpan - selisihnya sah, dan nilai lama tetap benar untuk aturan yang berlaku saat itu";
  } else if (rumusBerubah) {
    dugaan = "rumusnya berubah - angka lama dan baru tidak sebanding, seluruh riwayat perlu dihitung ulang dengan sadar";
  } else {
    dugaan = "ambang dan rumusnya sama, tetapi angkanya berbeda - data periode lampau berubah sesudah periodenya ditutup";
  }

  return {
    keadaan: "berselisih",
    sama: false,
    ambangBerubah,
    rumusBerubah,
    dugaan,
    tersimpan: { terpenuhi: tersimpan.terpenuhi, penyebut: tersimpan.penyebut, nilai: tersimpan.nilai },
    baru: baru ? { terpenuhi: baru.terpenuhi, penyebut: baru.penyebut, nilai: baru.nilai } : null,
  };
}

module.exports = {
  TABEL,
  pastikanTabel,
  lupakanTabel,
  simpanNilai,
  bacaRiwayat,
  bacaSatu,
  bandingkanHitungUlang,
  // Diekspor untuk diuji satuan.
  samaAngka,
};
