"use strict";

/**
 * Rute gerbang internal PENYATU SIPP-ABT-ALETA (tahap M2, 16 Okt 2026).
 * Dipasang di app.js pada /internal/aleta-bot, token sama dengan rute lain.
 *
 *   GET /penyatu/perkara?nomor=&perkaraId=   fakta tiga sumber satu perkara (BACA SAJA)
 *
 * Yang memanggil hanya portal (penyatu.ts), sesudah memeriksa sesi dan
 * kemampuan "panel" penggunanya. Isian tangan ABT ikut terkirim ke portal
 * (bukan ke peramban): portal hanya meneruskan selisihnya.
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const layanan = require("../services/penyatuPerkaraService");

const router = express.Router();

function tokenTersetel() {
  const rc = readRuntimeConfig() || {};
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || rc.internalApiToken || "";
}

function samaAman(a, b) {
  if (!a || !b) return false;
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function wajibToken(req, res, next) {
  const tersetel = tokenTersetel();
  const diminta = req.headers["x-aleta-internal-token"] || req.headers["x-aleta-bot-token"] || "";
  if (!tersetel) {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ ok: false, error: "token_not_configured" });
    }
    return next();
  }
  if (!samaAman(diminta, tersetel)) return res.status(401).json({ ok: false, error: "unauthorized" });
  return next();
}

router.get("/penyatu/perkara", wajibToken, async (req, res) => {
  try {
    const hasil = await layanan.ringkas({
      perkaraId: String(req.query.perkaraId || ""),
      nomorPerkara: String(req.query.nomor || ""),
    });
    res.status(hasil.ok ? 200 : hasil.alasan === "perkara_tidak_ditemukan" ? 404 : 502).json(hasil);
  } catch (galat) {
    res.status(500).json({ ok: false, alasan: "galat_bot", sebab: String((galat && galat.message) || galat).slice(0, 200) });
  }
});

module.exports = router;
