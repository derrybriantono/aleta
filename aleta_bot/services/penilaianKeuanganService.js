"use strict";

/**
 * ============================================================================
 * BAB 8 - KEUANGAN PERKARA
 * ============================================================================
 *
 * Dua penilaian yang sengaja dipilih karena keduanya berdiri di atas ruas
 * BERKODE dan ANGKA saja - tidak satu pun menyentuh ruas teks bebas.
 *
 * Uraian transaksi pada `perkara_biaya.uraian` adalah teks bebas yang diketik
 * kasir, dan sampai tahap 2 selesai ia belum dapat dikelompokkan. Penilaian
 * yang dibangun di atasnya akan menghitung ejaan, bukan jenis transaksi.
 * Karena itu kedua penilaian di sini hanya memakai `jenis_transaksi` (berkode),
 * `jumlah`, `sisa`, dan tanggalnya.
 *
 * ============================================================================
 * SATU HAL YANG DIWARISI DARI KODE LAMA, DAN DIPERIKSA ULANG
 * ============================================================================
 *
 * Analisis lama menyatakan: "jenis_transaksi 1 penerimaan (panjar), selain itu
 * pengeluaran". Aturan itu dipakai apa adanya di sini, DAN ditulis terbuka pada
 * cara hitungnya - supaya bila kelak ternyata ada kode ketiga yang juga
 * penerimaan, yang salah terlihat pada keterangannya, bukan tersembunyi di
 * dalam perbandingan angka.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");

function runQuery(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => {
      if (galat) gagal(galat);
      else selesai(Array.isArray(hasil) ? hasil : []);
    });
  });
}

function teks(x) {
  return String(x === undefined || x === null ? "" : x).trim();
}

/** Bilangan, atau null bila memang tidak ada - lihat cakupanDataService. */
function angka(x) {
  if (x === null || x === undefined || x === "" || typeof x === "boolean") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

const KODE_PENERIMAAN = 1;

/* ==========================================================================
 * KU01 - Setiap perkara punya catatan panjar
 * ========================================================================== */

async function barisPanjarTercatat(rentang) {
  const baris = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            p.perkara_id AS perkaraId,
            p.tanggal_pendaftaran AS tanggalDaftar,
            SUM(CASE WHEN b.jenis_transaksi = 1 THEN 1 ELSE 0 END) AS jumlahPenerimaan,
            SUM(CASE WHEN b.jenis_transaksi = 1 THEN b.jumlah ELSE 0 END) AS totalPenerimaan
       FROM perkara p
       LEFT JOIN perkara_biaya b ON b.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND p.tanggal_pendaftaran IS NOT NULL
      GROUP BY p.nomor_perkara, p.perkara_id, p.tanggal_pendaftaran
      ORDER BY p.tanggal_pendaftaran ASC, p.perkara_id ASC
      LIMIT 20000`,
    [rentang.mulai, rentang.selesai]
  );

  return baris.map((r) => {
    const jumlah = angka(r.jumlahPenerimaan) || 0;
    return {
      kunci: teks(r.nomorPerkara),
      nomorPerkara: teks(r.nomorPerkara),
      tanggalDaftar: teks(r.tanggalDaftar).slice(0, 10),
      jumlahPenerimaan: jumlah,
      totalPenerimaan: angka(r.totalPenerimaan) || 0,
      memenuhi: jumlah > 0,
    };
  });
}

/* ==========================================================================
 * KU02 - Pengeluaran tidak melebihi penerimaan
 * ========================================================================== */

async function barisJurnalTidakMinus(rentang) {
  const baris = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            b.perkara_id AS perkaraId,
            SUM(CASE WHEN b.jenis_transaksi = 1 THEN b.jumlah ELSE 0 END) AS masuk,
            SUM(CASE WHEN b.jenis_transaksi <> 1 THEN b.jumlah ELSE 0 END) AS keluar,
            MAX(b.tanggal_transaksi) AS transaksiTerakhir
       FROM perkara_biaya b
       JOIN perkara p ON p.perkara_id = b.perkara_id
      WHERE b.tanggal_transaksi >= ? AND b.tanggal_transaksi <= ?
        AND b.tanggal_transaksi IS NOT NULL
      GROUP BY p.nomor_perkara, b.perkara_id
      ORDER BY MAX(b.tanggal_transaksi) ASC, b.perkara_id ASC
      LIMIT 20000`,
    [rentang.mulai, rentang.selesai]
  );

  return baris.map((r) => {
    const masuk = angka(r.masuk) || 0;
    const keluar = angka(r.keluar) || 0;
    return {
      kunci: teks(r.nomorPerkara),
      nomorPerkara: teks(r.nomorPerkara),
      transaksiTerakhir: teks(r.transaksiTerakhir).slice(0, 10),
      masuk,
      keluar,
      sisa: masuk - keluar,
      // Pengeluaran yang melebihi penerimaan berarti panjar minus - keadaan
      // yang tidak boleh ada, dan bila ada, ia temuan keuangan.
      memenuhi: keluar <= masuk,
    };
  });
}

const DEFINISI = [
  {
    kunci: "panjarTercatatSetiapPerkara",
    judul: "Panjar Tercatat pada Setiap Perkara",
    keterangan:
      "Setiap perkara yang didaftarkan memiliki sekurangnya satu transaksi penerimaan panjar pada buku jurnal.",
    lantai: "harian",
    versiRumus: "v1",
    ambangDipakai: [],
    caraHitung: {
      pembilang: "Perkara yang punya sekurangnya satu transaksi berjenis penerimaan",
      penyebut: "Seluruh perkara yang tanggal pendaftarannya jatuh pada rentang ini",
      dikecualikan:
        "Perkara yang tanggal pendaftarannya kosong. Perkara prodeo tidak dikecualikan di sini dan akan tampak sebagai tidak memenuhi - itu keadaan yang harus ditelaah, bukan disembunyikan",
      tabelSumber: "perkara, perkara_biaya",
      ruasSumber: "tanggal_pendaftaran, jenis_transaksi, jumlah",
    },
    baris: barisPanjarTercatat,
  },
  {
    kunci: "pengeluaranTidakMelebihiPenerimaan",
    judul: "Pengeluaran Tidak Melebihi Penerimaan",
    keterangan:
      "Jumlah pengeluaran sebuah perkara tidak boleh melebihi penerimaannya; panjar minus adalah temuan keuangan.",
    lantai: "harian",
    versiRumus: "v1",
    ambangDipakai: [],
    caraHitung: {
      pembilang: "Perkara yang jumlah pengeluarannya tidak melebihi jumlah penerimaannya",
      penyebut: "Seluruh perkara yang punya transaksi pada rentang ini",
      dikecualikan:
        "Transaksi yang tanggalnya kosong. Jenis transaksi 1 dihitung penerimaan, selain itu pengeluaran - aturan yang diwarisi kode lama dan ditulis terbuka di sini supaya kekeliruannya terlihat bila ada kode penerimaan lain",
      tabelSumber: "perkara_biaya, perkara",
      ruasSumber: "tanggal_transaksi, jenis_transaksi, jumlah",
    },
    baris: barisJurnalTidakMinus,
  },
];

let sudahDidaftar = false;

function daftarkanSemua() {
  if (sudahDidaftar) return DEFINISI.map((d) => d.kunci);
  DEFINISI.forEach((d) => {
    if (!kerangka.ambil(d.kunci)) kerangka.daftarkan(d);
  });
  sudahDidaftar = true;
  return DEFINISI.map((d) => d.kunci);
}

function lupakan() {
  sudahDidaftar = false;
}

module.exports = {
  DEFINISI,
  KODE_PENERIMAAN,
  daftarkanSemua,
  lupakan,
  barisPanjarTercatat,
  barisJurnalTidakMinus,
};
