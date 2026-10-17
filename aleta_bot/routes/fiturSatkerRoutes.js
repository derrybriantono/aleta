"use strict";

/**
 * Rute internal status fitur per satker (banyak satker, Tahap 0).
 * Dipasang di /internal/aleta-bot/fitur-satker oleh app.js. Hanya portal yang
 * memanggilnya (token internal yang sama dengan rute internal lain).
 *
 *   GET  /            status fitur yang sedang berlaku di bot (diterima: false = belum pernah dikirim, semua menyala)
 *   POST /sinkron     {saluran, fitur:{kode: "stabil"|"uji-coba"|"mati"}} - dikirim portal tiap kali disimpan
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const layanan = require("../services/fiturSatkerService");

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
router.use(express.json({ limit: "64kb" }));

router.get("/", (req, res) => {
  res.json({ ok: true, ...layanan.baca() });
});

router.post("/sinkron", (req, res) => {
  try {
    res.json({ ok: true, ...layanan.terima(req.body || {}) });
  } catch (galat) {
    res.status(galat && galat.ditolak ? 400 : 500).json({ ok: false, kode: "ditolak", message: String((galat && galat.message) || "Gagal menerima status fitur.") });
  }
});

module.exports = router;
module.exports.wajibToken = wajibToken;
