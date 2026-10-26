"use strict";

/**
 * Rute internal gerbang isian (D1 Ketepatan isian, 25 Okt 2026).
 * Dipasang di /internal/aleta-bot/gerbang-isian oleh app.js. Hanya portal yang memanggilnya (token internal yang sama
 * dengan rute internal lain).
 *
 *   GET  /          status bawaan berkas gerbang-isian.json (kode -> asal -> status) dan keputusan lapangan yang berlaku
 *   POST /sinkron   {aktif, versi, entri:[{kode, pengisi, jenis, status:"otomatis"|"saran", n, presisi}]} - dikirim portal
 *                   tiap kali Super Admin memutuskan atau saklar berubah. aktif:false atau entri kosong = melepas semua
 *                   keputusan (gerbang kembali memakai berkas JSON saja).
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const gerbang = require("../services/gerbangIsian");

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
router.use(express.json({ limit: "512kb" }));

router.get("/", (req, res) => {
  res.json({ ok: true, statik: gerbang.statusStatik(), disetujui: gerbang.bacaDisetujui() });
});

router.post("/sinkron", (req, res) => {
  try {
    res.json({ ok: true, disetujui: gerbang.terimaDisetujui(req.body || {}) });
  } catch (galat) {
    res.status(galat && galat.ditolak ? 400 : 500).json({ ok: false, kode: "ditolak", message: String((galat && galat.message) || "Gagal menerima keputusan gerbang isian.") });
  }
});

module.exports = router;
