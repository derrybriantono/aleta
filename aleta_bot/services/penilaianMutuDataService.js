"use strict";

/**
 * ============================================================================
 * BAB 2 - PENGAWASAN MUTU DAN INTEGRITAS DATA
 * ============================================================================
 *
 * Bab ini dikerjakan lebih dahulu daripada bab lain karena SELURUH bab lain
 * bertumpu padanya. Nilai ketaatan yang dihitung dari tanggal yang belum dapat
 * dipercaya adalah nilai yang belum dapat dipercaya pula, dan itu berlaku
 * seterusnya ke hilir.
 *
 * ============================================================================
 * KETIGANYA SENGAJA DIPILIH KARENA CAKUPANNYA BERBEDA JAUH
 * ============================================================================
 *
 * Ketiga penilaian di berkas ini mengukur hal yang sejenis - kelengkapan
 * dokumen - tetapi cakupannya jauh berbeda, dan itu disengaja. Ia menjadi
 * bukti hidup bahwa penanda cakupan (D10) bukan hiasan:
 *
 *   berita acara sidang   ruasnya terisi pada sebagian besar sidang
 *   amar putusan          terisi pada hampir seluruh putusan
 *   pertimbangan hukum    terisi pada seperlima putusan saja
 *
 * Menjajarkan ketiganya tanpa penanda akan membuat yang ketiga dibaca sebagai
 * keadaan seluruh pengadilan, padahal ia menggambarkan seperlima.
 *
 * ============================================================================
 * KOSONG BUKAN NOL
 * ============================================================================
 *
 * Ruas yang kosong berarti "belum diisi", bukan "isinya nol". Ketiga penilaian
 * di sini menghitung baris yang RUASNYA TERISI sebagai memenuhi, dan yang
 * kosong sebagai tidak memenuhi - tetapi baris yang seharusnya tidak ada sama
 * sekali (sidang yang belum dilaksanakan, perkara yang belum diputus) DIBUANG
 * dari penyebut. Menghitungnya sebagai tidak memenuhi berarti menuduh
 * pengadilan lalai atas pekerjaan yang waktunya memang belum tiba.
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

/** Apakah sebuah ruas dokumen benar-benar terisi? */
function terisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  // Ruas yang berisi tanda hubung, titik, atau "-" saja adalah ruas kosong
  // yang diisi supaya tidak tampak kosong. Menghitungnya sebagai terisi
  // membuat penilaian ini dapat dikelabui dengan satu ketukan papan ketik.
  if (/^[-.\s_]+$/.test(t)) return false;
  return true;
}

/* ==========================================================================
 * IN01 - Kelengkapan berita acara sidang
 * ========================================================================== */

async function barisBeritaAcara(rentang) {
  const baris = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            j.id AS sidangId,
            j.tanggal_sidang AS tanggalSidang,
            j.agenda AS agenda,
            j.edoc_bas AS berkas
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
      WHERE j.tanggal_sidang >= ? AND j.tanggal_sidang <= ?
        AND j.tanggal_sidang IS NOT NULL
      ORDER BY j.tanggal_sidang ASC, j.id ASC
      LIMIT 20000`,
    [rentang.mulai, rentang.selesai]
  );

  return baris.map((r) => ({
    kunci: `${teks(r.nomorPerkara)}#${teks(r.sidangId)}`,
    nomorPerkara: teks(r.nomorPerkara),
    tanggalSidang: teks(r.tanggalSidang).slice(0, 10),
    agenda: teks(r.agenda),
    memenuhi: terisi(r.berkas),
  }));
}

/* ==========================================================================
 * IN02 - Kelengkapan amar putusan
 * ========================================================================== */

async function barisAmarPutusan(rentang) {
  const baris = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            pu.perkara_id AS perkaraId,
            pu.tanggal_putusan AS tanggalPutusan,
            pu.amar_putusan AS amar
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
      WHERE pu.tanggal_putusan >= ? AND pu.tanggal_putusan <= ?
        AND pu.tanggal_putusan IS NOT NULL
      ORDER BY pu.tanggal_putusan ASC, pu.perkara_id ASC
      LIMIT 20000`,
    [rentang.mulai, rentang.selesai]
  );

  return baris.map((r) => ({
    kunci: teks(r.nomorPerkara),
    nomorPerkara: teks(r.nomorPerkara),
    tanggalPutusan: teks(r.tanggalPutusan).slice(0, 10),
    memenuhi: terisi(r.amar),
  }));
}

/* ==========================================================================
 * IN03 - Kelengkapan pertimbangan hukum
 * ========================================================================== */

async function barisPertimbanganHukum(rentang) {
  const baris = await runQuery(
    `SELECT p.nomor_perkara AS nomorPerkara,
            pu.perkara_id AS perkaraId,
            pu.tanggal_putusan AS tanggalPutusan,
            ph.perkara_id AS adaPertimbangan
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
       LEFT JOIN perkara_pertimbangan_hukum ph ON ph.perkara_id = pu.perkara_id
      WHERE pu.tanggal_putusan >= ? AND pu.tanggal_putusan <= ?
        AND pu.tanggal_putusan IS NOT NULL
      GROUP BY p.nomor_perkara, pu.perkara_id, pu.tanggal_putusan, ph.perkara_id
      ORDER BY pu.tanggal_putusan ASC, pu.perkara_id ASC
      LIMIT 20000`,
    [rentang.mulai, rentang.selesai]
  );

  return baris.map((r) => ({
    kunci: teks(r.nomorPerkara),
    nomorPerkara: teks(r.nomorPerkara),
    tanggalPutusan: teks(r.tanggalPutusan).slice(0, 10),
    memenuhi: r.adaPertimbangan !== null && r.adaPertimbangan !== undefined,
  }));
}

/* ==========================================================================
 * Pendaftaran
 * ========================================================================== */

const DEFINISI = [
  {
    kunci: "kelengkapanBeritaAcaraSidang",
    judul: "Kelengkapan Berita Acara Sidang",
    keterangan:
      "Setiap sidang yang telah dilaksanakan memiliki berita acara yang terunggah pada SIPP.",
    lantai: "harian",
    versiRumus: "v1",
    ambangDipakai: [],
    caraHitung: {
      pembilang: "Sidang yang ruas berkas berita acaranya terisi",
      penyebut: "Seluruh sidang yang tanggalnya jatuh pada rentang ini",
      dikecualikan:
        "Sidang yang tanggalnya kosong. Ruas yang hanya berisi tanda hubung atau titik dihitung KOSONG, bukan terisi",
      tabelSumber: "perkara_jadwal_sidang, perkara",
      ruasSumber: "tanggal_sidang, edoc_bas, agenda",
    },
    baris: barisBeritaAcara,
  },
  {
    kunci: "kelengkapanAmarPutusan",
    judul: "Kelengkapan Amar Putusan",
    keterangan: "Setiap putusan memiliki amar yang tertulis pada SIPP, bukan ruas kosong.",
    lantai: "bulanan",
    versiRumus: "v1",
    ambangDipakai: [],
    caraHitung: {
      pembilang: "Putusan yang ruas amarnya terisi",
      penyebut: "Seluruh putusan yang tanggal putusnya jatuh pada rentang ini",
      dikecualikan:
        "Putusan yang tanggalnya kosong. Amar yang hanya berisi tanda hubung dihitung KOSONG",
      tabelSumber: "perkara_putusan, perkara",
      ruasSumber: "tanggal_putusan, amar_putusan",
    },
    baris: barisAmarPutusan,
  },
  {
    kunci: "kelengkapanPertimbanganHukum",
    judul: "Kelengkapan Pertimbangan Hukum",
    keterangan:
      "Setiap putusan memiliki pertimbangan hukum yang tercatat. Cakupannya rendah, dan itu justru temuannya.",
    lantai: "bulanan",
    versiRumus: "v1",
    ambangDipakai: [],
    caraHitung: {
      pembilang: "Putusan yang punya baris pertimbangan hukum",
      penyebut: "Seluruh putusan yang tanggal putusnya jatuh pada rentang ini",
      dikecualikan: "Putusan yang tanggalnya kosong",
      tabelSumber: "perkara_putusan, perkara, perkara_pertimbangan_hukum",
      ruasSumber: "tanggal_putusan, perkara_id",
    },
    baris: barisPertimbanganHukum,
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
  daftarkanSemua,
  lupakan,
  terisi,
  barisBeritaAcara,
  barisAmarPutusan,
  barisPertimbanganHukum,
};
