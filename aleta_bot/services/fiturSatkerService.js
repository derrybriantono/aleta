"use strict";

/**
 * Status fitur per satker, sisi bot (banyak satker, Tahap 0).
 *
 * Portal yang menyimpan dan memutuskan (manajemen_surat/src/lib/fitur-satker.ts);
 * bot hanya MENERIMA ringkasan kode -> status efektif lewat
 * POST /internal/aleta-bot/fitur-satker/sinkron dan menjawab fiturMenyala(kode).
 *
 * GAGAL KE SISI MENYALA: belum pernah menerima, berkas rusak, kode tidak dikenal,
 * atau status tidak sah = menyala. Fitur lama tidak boleh berkurang karena
 * bot lupa atau salah baca. Hanya status "mati" yang benar-benar diterima yang
 * mematikan; "uji-coba" menyala (portal sudah menyaring saluran).
 *
 * Disimpan di berkas data/fitur-satker.json (sekadar agar bot yang dinyalakan
 * ulang ingat) - tanpa basis data, tanpa menyentuh SIPP/ABT.
 */

const fs = require("fs");
const path = require("path");

const STATUS_SAH = new Set(["stabil", "uji-coba", "mati"]);
const SALURAN_SAH = new Set(["stabil", "uji-coba"]);
const BATAS_BUTIR = 300;

let berkas = path.join(__dirname, "..", "data", "fitur-satker.json");
let keadaan = null; // { saluran, fitur, diterimaPada }
let sudahMemuat = false;

function bersihkan(masuk) {
  if (!masuk || typeof masuk !== "object" || Array.isArray(masuk)) return null;
  const fitur = {};
  const sumber = masuk.fitur && typeof masuk.fitur === "object" && !Array.isArray(masuk.fitur) ? masuk.fitur : null;
  if (!sumber) return null;
  for (const [kode, status] of Object.entries(sumber).slice(0, BATAS_BUTIR)) {
    if (/^[a-z0-9][a-z0-9-]{0,60}$/.test(kode) && STATUS_SAH.has(status)) fitur[kode] = status;
  }
  return { saluran: SALURAN_SAH.has(masuk.saluran) ? masuk.saluran : "stabil", fitur };
}

function muatSekali() {
  if (sudahMemuat) return;
  sudahMemuat = true;
  try {
    const dibaca = bersihkan(JSON.parse(fs.readFileSync(berkas, "utf8")));
    if (dibaca) keadaan = { ...dibaca, diterimaPada: "" };
  } catch {
    keadaan = null;
  }
}

/** Terima ringkasan dari portal. Mengembalikan keadaan yang berlaku. */
function terima(masuk) {
  const bersih = bersihkan(masuk);
  if (!bersih) {
    const galat = new Error("Ringkasan fitur satker tidak sah.");
    galat.ditolak = true;
    throw galat;
  }
  sudahMemuat = true;
  keadaan = { ...bersih, diterimaPada: new Date().toISOString() };
  try {
    fs.mkdirSync(path.dirname(berkas), { recursive: true });
    fs.writeFileSync(berkas, JSON.stringify(bersih), "utf8");
  } catch {
    /* tidak tersimpan di disk: tetap berlaku di memori */
  }
  return baca();
}

function baca() {
  muatSekali();
  return keadaan
    ? { diterima: true, saluran: keadaan.saluran, fitur: { ...keadaan.fitur }, diterimaPada: keadaan.diterimaPada }
    : { diterima: false, saluran: "stabil", fitur: {}, diterimaPada: "" };
}

function statusFitur(kode) {
  muatSekali();
  const status = keadaan && keadaan.fitur[String(kode || "")];
  return STATUS_SAH.has(status) ? status : "stabil";
}

/** true kecuali status "mati" yang benar-benar diterima. */
function fiturMenyala(kode) {
  return statusFitur(kode) !== "mati";
}

/** Hanya untuk uji. */
function aturBerkasUji(lokasi) {
  berkas = lokasi;
  keadaan = null;
  sudahMemuat = false;
}

module.exports = { terima, baca, statusFitur, fiturMenyala, bersihkan, aturBerkasUji };
