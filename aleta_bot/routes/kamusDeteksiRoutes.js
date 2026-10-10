"use strict";

/**
 * Rute internal kamus deteksi & kalimat (10 Okt 2026, paket deteksi lengkap).
 * Dipasang di /internal/aleta-bot/kamus-deteksi oleh app.js. Hanya portal
 * yang memanggilnya, dengan token internal yang sama (pola sumberDayaRoutes).
 *
 *   GET  /        benih per kelompok + keadaan lapis database yang terpasang
 *   PUT  /lapis   portal mendorong lapis database (aktif + nonaktif; draf tidak)
 *   POST /uji     uji pola atas sampel data nyata SIPP/ABT (baca-saja)
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const lapisService = require("../services/kamusDeteksiLapis");
const sampelService = require("../services/kamusDeteksiSampel");

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

// Lapis bisa memuat ratusan pola beserta contohnya - lebih dari batas 1 MB bawaan.
const jsonBesar = express.json({ limit: "8mb" });

router.get("/", wajibToken, (req, res) => {
  res.set("Cache-Control", "no-store");
  const k = lapisService.keadaanLapis();
  return res.json({
    ok: true,
    benih: lapisService.benihSemua(),
    lapis: { jumlahPola: k.jumlahPola, jumlahTemplat: k.jumlahTemplat, sidik: k.sidik, diterimaPada: k.diterimaPada, ditolak: k.ditolak },
  });
});

router.put("/lapis", wajibToken, jsonBesar, (req, res) => {
  try {
    return res.json(lapisService.terimaLapis(req.body || {}));
  } catch (galat) {
    return res.status(500).json({ ok: false, error: "lapis_gagal", message: String((galat && galat.message) || galat) });
  }
});

router.post("/uji", wajibToken, async (req, res) => {
  try {
    const hasil = await sampelService.ujiSampel(req.body || {});
    return res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    return res.status(500).json({ ok: false, error: "uji_gagal", message: String((galat && galat.message) || galat) });
  }
});

module.exports = router;
