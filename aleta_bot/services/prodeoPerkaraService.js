"use strict";

/**
 * ============================================================================
 * PENANDA PRODEO - SATU SUMBER (26 Okt 2026)
 * ============================================================================
 *
 * Laporan: perkara prodeo (664/Pdt.G/2026/PA.Dgl) tidak terdeteksi di Jadwal
 * Sidang dan Status Perkara. Jadwal Sidang membaca perkara.prodeo sendiri
 * (penandaPerkaraPihakService), sedangkan Status Perkara (sippTahapanService.
 * penandaPerkara) TIDAK PERNAH membawa ruas prodeo - jadi lencananya tak mungkin
 * muncul di sana. Berkas ini menyatukan keduanya.
 *
 * Diukur di SIPP produksi (sipp_donggala, 26 Okt 2026, hanya SELECT):
 *   - perkara.prodeo = 1 pada 124 dari 10.273 perkara. 664/Pdt.G/2026 (perkara_id
 *     10234) bernilai 1; disetujui di e-Court 13 Okt 14.32 (ecourt_prodeo.status 1).
 *   - ecourt_prodeo: 36 baris; yang status 1 dan tertaut ke perkara (lewat
 *     perkara_efiling_id.efiling_id) 35, SEMUANYA perkara.prodeo = 1. Satu baris
 *     status 0 belum bertaut. Jadi sumber kedua ini tidak menambah perkara hari ini;
 *     ia menutup jeda bila e-Court sudah menyetujui tetapi kolom perkara.prodeo
 *     belum (atau tidak) dinyalakan petugas.
 *   - perkara_biaya.id_pembiayaan = 2 (DIPA) TIDAK dipakai: 118 perkara prodeo
 *     bernilai 2, tetapi 47/Pdt.P/2021 bernilai 2 dengan panjar Rp385.000 dan
 *     bukan prodeo (biaya ditanggung DIPA bukan berarti prodeo).
 *
 * Sumber:
 *   flag-sipp     perkara.prodeo = 1 (kolom yang sama dengan kueri bot lama).
 *   ecourt        ecourt_prodeo.status = 1 untuk pendaftaran e-Court perkara itu.
 *
 * Aturan gagal: sumber UTAMA (flag-sipp) gagal dibaca = galat dilempar, supaya
 * pemanggil menandai "tidak terbaca" (bukan menuduh perkara tidak prodeo). Sumber
 * kedua gagal = diabaikan; hasil sumber utama tetap dipakai.
 * SIPP hanya DIBACA.
 */

let dbCadangan = null;
function runQueryBawaan(sql, params = []) {
  if (!dbCadangan) dbCadangan = require("../db_config");
  return new Promise((resolve, reject) => {
    dbCadangan.query(sql, params, (error, rows) => (error ? reject(error) : resolve(Array.isArray(rows) ? rows : [])));
  });
}

function idBersih(daftar = []) {
  return [...new Set((daftar || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))].slice(0, 500);
}

/** Sebutan sumber untuk keterangan lencana (tanpa istilah teknis). */
const SEBUTAN_SUMBER = Object.freeze({
  "flag-sipp": "ditandai prodeo di SIPP",
  ecourt: "persetujuan prodeo dari e-Court",
});

function kalimatSumber(sumber = []) {
  const daftar = (sumber || []).map((x) => SEBUTAN_SUMBER[x]).filter(Boolean);
  return daftar.length > 0 ? daftar.join("; ") : "";
}

/**
 * Perkara berprodeo beserta sumbernya, untuk sekumpulan perkara.
 *
 * @returns {Promise<Record<string, string[]>>} kunci perkara_id -> daftar sumber
 *   ("flag-sipp", "ecourt"); hanya perkara prodeo yang berkunci.
 */
async function sumberProdeoBanyakPerkara(daftarPerkaraId, deps = {}) {
  const id = idBersih(daftarPerkaraId);
  const hasil = {};
  if (id.length === 0) return hasil;
  const kueri = deps.kueri || runQueryBawaan;
  const skema = deps.skema || require("./sippSkemaService");
  const isian = id.map(() => "?").join(", ");

  // Pemasangan SIPP yang belum punya kolomnya: tidak ada yang bisa ditandai lewat
  // sumber utama, dan itu BUKAN galat (tidak ada yang dituduh).
  if (await skema.kolomAda("perkara", "prodeo")) {
    const rows = await kueri(
      `SELECT perkara_id AS perkaraId FROM perkara WHERE prodeo = 1 AND perkara_id IN (${isian})`,
      id
    );
    for (const baris of Array.isArray(rows) ? rows : []) {
      const kunci = String(baris.perkaraId);
      if (!hasil[kunci]) hasil[kunci] = [];
      hasil[kunci].push("flag-sipp");
    }
  }

  // Sumber kedua. Fungsi skema yang tidak tersedia (penyuntikan uji) = dilewati.
  let adaTabelEcourt = false;
  try {
    adaTabelEcourt =
      typeof skema.tabelAda === "function" &&
      (await skema.tabelAda("ecourt_prodeo")) &&
      (await skema.tabelAda("perkara_efiling_id"));
  } catch {
    adaTabelEcourt = false;
  }
  if (adaTabelEcourt) {
    try {
      const rows = await kueri(
        `SELECT DISTINCT k.perkara_id AS perkaraId
           FROM ecourt_prodeo e
           JOIN perkara_efiling_id k ON k.efiling_id = e.efiling_id
          WHERE e.status = 1 AND k.perkara_id IN (${isian})`,
        id
      );
      for (const baris of Array.isArray(rows) ? rows : []) {
        const kunci = String(baris.perkaraId);
        if (!hasil[kunci]) hasil[kunci] = [];
        if (!hasil[kunci].includes("ecourt")) hasil[kunci].push("ecourt");
      }
    } catch {
      /* sumber pelengkap: diabaikan */
    }
  }
  return hasil;
}

/**
 * Perkara berprodeo: kunci perkara_id -> true. Bentuk yang dipakai Jadwal Sidang.
 * Melempar bila sumber utama tidak terbaca.
 */
async function prodeoBanyakPerkara(daftarPerkaraId, deps = {}) {
  const sumber = await sumberProdeoBanyakPerkara(daftarPerkaraId, deps);
  const hasil = {};
  for (const kunci of Object.keys(sumber)) hasil[kunci] = true;
  return hasil;
}

/**
 * Satu perkara, untuk Status Perkara dan panel ekstensi.
 *
 * @returns {Promise<{prodeo: boolean|null, sumberProdeo: string[]}>}
 *   prodeo null = tidak terbaca (jangan menyimpulkan apa pun).
 */
async function penandaProdeoPerkara(perkaraId, deps = {}) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { prodeo: null, sumberProdeo: [] };
  try {
    const peta = await sumberProdeoBanyakPerkara([id], deps);
    const sumber = peta[String(id)] || [];
    return { prodeo: sumber.length > 0, sumberProdeo: sumber };
  } catch {
    return { prodeo: null, sumberProdeo: [] };
  }
}

module.exports = {
  SEBUTAN_SUMBER,
  kalimatSumber,
  sumberProdeoBanyakPerkara,
  prodeoBanyakPerkara,
  penandaProdeoPerkara,
};
