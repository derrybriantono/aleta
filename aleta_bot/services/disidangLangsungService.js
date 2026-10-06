"use strict";

/**
 * ============================================================================
 * KEADAAN `disidang` HARI INI - BACAAN RINGAN UNTUK "SEDANG BERJALAN" (6 Okt 2026)
 * ============================================================================
 *
 * Keluhan pengguna: perkara sudah di-PROSES di aplikasi antrian sidang, tetapi
 * Jadwal Sidang ALETA baru berubah puluhan detik kemudian. Sebabnya: keadaan
 * `disidang` hanya ikut terbaca bersama MUAT ULANG JADWAL PENUH tiap 45 detik
 * (rata-rata 22,5 detik, paling lama 45 detik + lama muat), lalu peta
 * selesai/berjalan baru diminta SESUDAH jadwal itu tiba.
 *
 * Bacaan ini hanya SATU kueri kecil ke aplikasi antrian - baris hari ini saja
 * (diukur 6 Okt 2026: 17 baris, 4-14 ms) - dan jam basis datanya pada kueri
 * yang SAMA (LEFT JOIN dari satu baris jam, sehingga hari tanpa antrian tetap
 * menyebut hari ininya). Portal menanyakannya tiap 5 detik, hanya untuk hari
 * ini dan hanya saat tabnya terlihat.
 *
 * Banyak tab terbuka tidak berarti banyak kueri: jawabannya disimpan SEBENTAR
 * (JEDA_SIMPAN_MS) dan permintaan yang datang bersamaan menunggu kueri yang
 * sama - paling banyak satu kueri per jeda itu, berapa pun tabnya.
 *
 * HANYA SELECT. Arti nilainya di antrianDisidang.js (NULL menunggu, 1..9
 * sedang disidang di ruang itu, 10 selesai).
 */

const { angkaDisidang } = require("./antrianDisidang");

const KUNCI_KONEKSI = "antrian_sidang";

/** Jawaban dipakai bersama selama ini - jauh di bawah selang tanya portal (5 detik). */
const JEDA_SIMPAN_MS = 1500;

const SQL_DISIDANG_HARI_INI = `
  SELECT j.sekarang, j.hariIni,
         a.perkara_id AS perkaraId,
         DATE_FORMAT(a.tanggal_sidang, '%Y-%m-%d') AS tanggalSidang,
         a.disidang AS disidang,
         a.ruangan_id AS ruanganId,
         CAST(a.jam_sidang AS CHAR) AS jamSidang
    FROM (SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS sekarang,
                 DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hariIni) j
    LEFT JOIN sipp_turunan_antrian.antrian_sidang a ON a.tanggal_sidang = CURDATE()`;

function rapi(nilai) {
  return nilai === null || nilai === undefined ? "" : String(nilai).trim();
}

/** Baris mentah -> jawaban. Diekspor untuk pengujian. */
function susun(rows) {
  const daftar = Array.isArray(rows) ? rows : [];
  const pertama = daftar[0] || {};
  const hasil = { terbaca: true, alasan: "", sekarang: rapi(pertama.sekarang), hariIni: rapi(pertama.hariIni), baris: [] };
  for (const r of daftar) {
    const perkaraId = rapi(r.perkaraId);
    if (!perkaraId) continue; // baris jam saja (hari tanpa antrian)
    const ruang = Number(r.ruanganId);
    hasil.baris.push({
      perkaraId,
      tanggalSidang: rapi(r.tanggalSidang) || hasil.hariIni,
      disidang: angkaDisidang(r.disidang),
      ruanganId: Number.isFinite(ruang) && ruang > 0 ? ruang : null,
      jamSidang: rapi(r.jamSidang),
    });
  }
  return hasil;
}

function buatLayanan(deps = {}) {
  const kueri =
    deps.kueri || ((sql, params = []) => require("./externalDbService").query(KUNCI_KONEKSI, sql, params));
  const kini = deps.kini || (() => Date.now());
  let simpan = null; // { pada, janji }

  async function bacaSekarang() {
    try {
      return susun(await kueri(SQL_DISIDANG_HARI_INI, []));
    } catch (galat) {
      return { terbaca: false, alasan: rapi(galat && galat.message).slice(0, 160), sekarang: "", hariIni: "", baris: [] };
    }
  }

  /** Keadaan disidang hari ini - satu kueri per JEDA_SIMPAN_MS, dibagi seluruh peminta. */
  function disidangHariIni() {
    const t = kini();
    if (simpan && t - simpan.pada < JEDA_SIMPAN_MS) return simpan.janji;
    const janji = bacaSekarang();
    simpan = { pada: t, janji };
    return janji;
  }

  return { disidangHariIni };
}

let bawaan = null;
function layananBawaan() {
  if (!bawaan) bawaan = buatLayanan();
  return bawaan;
}

module.exports = {
  JEDA_SIMPAN_MS,
  SQL_DISIDANG_HARI_INI,
  buatLayanan,
  susun,
  disidangHariIni: () => layananBawaan().disidangHariIni(),
};
