"use strict";

/**
 * Rute internal sinkron & cadangan (butir 29, 30 September 2026).
 *
 * Dipasang di /internal/aleta-bot/sinkron oleh app.js - sengaja di berkas
 * sendiri, tidak menambah internalGatewayRoutes.js yang sudah 6.000 baris.
 * Hanya portal yang memanggilnya, dengan token internal yang sama.
 *
 *   GET /sumber   sumber yang dapat di-dump, nama basis datanya, terjangkau?
 *   GET /dump     ?sumber=sipp|abt|antrian|aleta_bot -> aliran gzip SQL
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const sinkronDumpService = require("../services/sinkronDumpService");

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

/**
 * Selalu menuntut token - juga di luar produksi. Dump berisi SELURUH data
 * perkara; tidak ada keadaan di mana rute ini pantas terbuka tanpa token.
 */
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

router.get("/sumber", wajibToken, async (req, res) => {
  try {
    res.json({ ok: true, ...(await sinkronDumpService.periksaSumber()) });
  } catch (galat) {
    res.status(500).json({ ok: false, error: "periksa_gagal", message: String((galat && galat.message) || galat).slice(0, 200) });
  }
});

router.get("/dump", wajibToken, (req, res) => {
  sinkronDumpService.jawabDump(req, res).catch((galat) => {
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: "dump_gagal", message: String((galat && galat.message) || galat).slice(0, 200) });
    }
  });
});

module.exports = router;
