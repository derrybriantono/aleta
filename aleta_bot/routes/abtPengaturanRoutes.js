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
 *
 *   17 Okt 2026 - identitas satker & logo kop:
 *   GET  /satker                identitas satker SIPP + variabel 9270-9276/#1154# dan nilainya
 *   POST /satker/simpan         {noVar 9271-9274, lama:{sql_query}, baru:{sql_query}, pulihkan?}
 *   GET  /nomor-sk              variabel nomor (#9550#) dan tanggal (#9551#) SK penunjukan: ada/tidak + isi sekarang
 *   POST /nomor-sk/simpan       {noVar 9550|9551, lama:{nomor}, baru:{nomor}, pulihkan?} - kueri SELECT '<nomor>' AS data disusun di bot
 *   GET  /logo/pindai           gambar di blangko Derry per isi (md5) + tebakan logo - baca saja
 *   GET  /logo/gambar?md5=      bita satu gambar PNG/JPG (pratinjau)
 *   POST /logo/paket            {md5:[...], logoBase64, oleh} - paket ganti logo ke folder runtime
 *                               (blangko TIDAK ditulis; dipasang petugas server)
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const { layanan, kalimatAwam } = require("../services/abtPengaturanService");
const penjagaTandaSipp = require("../services/penjagaTandaSipp");

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

/**
 * PENJAGA BATAS (17 Okt 2026): isian ketikan admin yang akan tertulis di basis data
 * ABT (server SIPP) tidak boleh memuat kata ALETA. Ditahan SEBELUM layanan
 * menyentuh basis data, dengan kalimat awam yang menunjuk isiannya. Penyimpanan
 * di ALETA (cadangan nilai & riwayat di portal) tidak dibatasi.
 */
function pagarTanda(req, res, next) {
  if (req.method !== "POST") return next();
  const hasil = penjagaTandaSipp.periksaPengaturanAbt(req.path, req.body);
  if (hasil.ok) return next();
  return res.status(400).json({ ok: false, kode: hasil.alasan, kolom: hasil.kolom, message: hasil.pesan });
}
router.use(pagarTanda);

/** Jawaban galat: penolakan (prasyarat/validasi) = 409/400 dengan kode; lainnya 500. */
function kirimGalat(res, galat) {
  const mentah = String((galat && galat.message) || galat || "galat");
  // Rincian teknis (ER_*, SQL) hanya di log; layar mendapat kalimat awam.
  if (!(galat && galat.ditolak)) console.error("[abtPengaturan] galat:", mentah);
  const pesan = kalimatAwam(mentah).slice(0, 500);
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
router.get("/satker", bungkus(() => layanan().bacaSatker()));
router.post("/satker/simpan", bungkus((req) => layanan().simpanKueriSatker(req.body || {})));
router.get("/nomor-sk", bungkus(() => layanan().bacaNomorSk()));
router.post("/nomor-sk/simpan", bungkus((req) => layanan().simpanNomorSk(req.body || {})));
router.get("/logo/pindai", bungkus(() => layanan().pindaiLogo()));
router.get("/logo/gambar", async (req, res) => {
  try {
    const g = await layanan().gambarLogo(req.query.md5);
    res.setHeader("Content-Type", g.jenis === "jpg" ? "image/jpeg" : "image/png");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.end(g.isi);
  } catch (galat) {
    kirimGalat(res, galat);
  }
});
router.post("/logo/paket", bungkus((req) => layanan().paketLogo(req.body || {})));

module.exports = router;
module.exports.pagarTanda = pagarTanda;
