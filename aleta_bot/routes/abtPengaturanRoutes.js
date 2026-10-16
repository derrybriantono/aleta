"use strict";

/**
 * Rute internal Pengaturan SIPP & ABT (16 Okt 2026, Tahap H).
 * Dipasang di /internal/aleta-bot/abt-pengaturan oleh app.js. Hanya portal
 * yang memanggilnya (token internal yang sama, pola kamusDeteksiRoutes).
 * Peran (Super Admin/Admin) dijaga PORTAL; jejak siapa-mengubah-apa dan
 * cadangan nilai lama juga di portal (aleta_abt_suntingan).
 *
 *   GET  /menu                  folder Blangko Derry + peran/tahapan/jenis SIPP + abt_config
 *   POST /menu/simpan           {ubah:[{id,lama,baru}], config:[{name,lama,baru}]}
 *   GET  /variabel              variabel yang dipakai RTF Blangko Derry
 *   GET  /variabel/:noVar       definisi satu variabel
 *   POST /variabel/uji          {noVar, perkaraId, sidangKe, sql_query?, default_data?} - tidak menulis
 *   POST /variabel/simpan       {noVar, lama, baru, perkaraId, sidangKe}
 *   GET  /templat               kumpulan template tanya jawab
 *   GET  /templat/isi?kode=     isi satu kumpulan
 *   POST /templat/simpan        {kode, lama:[{tanya,jawab}], baru:[...], bolehKosong?}
 *   GET  /perkara?nomor=        perkara contoh untuk uji
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const { layanan } = require("../services/abtPengaturanService");

const router = express.Router();

function tokenTerpasang() {
  let dariBerkas = "";
  try {
    dariBerkas = readRuntimeConfig().internalApiToken || "";
  } catch {
    dariBerkas = "";
  }
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || dariBerkas || "";
}

function samaAman(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function wajibToken(req, res, next) {
  const terpasang = tokenTerpasang();
  const diminta = req.headers["x-aleta-internal-token"] || "";
  if (!terpasang) {
    return res.status(403).json({ ok: false, error: "token_not_configured", message: "Token internal ALETA belum dikonfigurasi." });
  }
  if (!diminta || !samaAman(diminta, terpasang)) {
    return res.status(401).json({ ok: false, error: "invalid_token", message: "Token internal tidak valid." });
  }
  return next();
}

router.use(wajibToken);

/** Jawaban galat: penolakan (prasyarat/validasi) = 409/400 dengan kode; lainnya 500. */
function kirimGalat(res, galat) {
  const pesan = String((galat && galat.message) || galat || "galat").slice(0, 500);
  if (galat && galat.ditolak) {
    const status = galat.kode === "berubah" ? 409 : galat.kode === "tidak_ada" ? 404 : 400;
    return res.status(status).json({ ok: false, kode: galat.kode || "ditolak", message: pesan, uji: galat.uji || undefined });
  }
  return res.status(500).json({
    ok: false,
    kode: "galat",
    message: `Gagal di server: ${pesan}`,
    dipulihkan: galat && galat.dipulihkan === true,
  });
}

const bungkus = (fn) => async (req, res) => {
  try {
    res.json({ ok: true, ...(await fn(req)) });
  } catch (galat) {
    kirimGalat(res, galat);
  }
};

router.get("/menu", bungkus(() => layanan().bacaMenu()));
router.post("/menu/simpan", bungkus((req) => layanan().simpanMenu(req.body || {})));
router.get("/variabel", bungkus(() => layanan().daftarVariabel()));
router.get("/variabel/:noVar", bungkus(async (req) => ({ variabel: await layanan().bacaVariabel(req.params.noVar) })));
router.post("/variabel/uji", bungkus(async (req) => ({ uji: await layanan().ujiVariabel(req.body || {}) })));
router.post("/variabel/simpan", bungkus((req) => layanan().simpanVariabel(req.body || {})));
router.get("/templat", bungkus(() => layanan().daftarTemplat()));
router.get("/templat/isi", bungkus(async (req) => ({ templat: await layanan().bacaTemplat(req.query.kode) })));
router.post("/templat/simpan", bungkus((req) => layanan().simpanTemplat(req.body || {})));
router.get("/perkara", bungkus(async (req) => ({ perkara: await layanan().cariPerkara(req.query.nomor) })));

module.exports = router;
