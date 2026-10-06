"use strict";

/**
 * Rute internal pemantau sumber daya server - butir 3 (6 Oktober 2026).
 *
 * Dipasang di /internal/aleta-bot/sumber-daya oleh app.js, di berkas sendiri
 * (pola panggilRoutes.js). Hanya portal yang memanggilnya, dengan token
 * internal yang sama.
 *
 *   GET /   RAM, disk, GPU untuk ALETA saja dan seluruh server, beserta
 *           rincian per container / layanan / partisi. Bersinggah 3 detik;
 *           hanya MEMBACA (lihat services/sumberDayaService.js).
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const sumberDayaService = require("../services/sumberDayaService");

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

/** Selalu menuntut token - isinya peta layanan host. */
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

router.get("/", wajibToken, async (req, res) => {
  try {
    const hasil = await sumberDayaService.bacaSumberDaya();
    res.set("Cache-Control", "no-store");
    return res.json(hasil);
  } catch (galat) {
    return res.status(500).json({ ok: false, error: "gagal_mengukur", message: String((galat && galat.message) || galat) });
  }
});

module.exports = router;
