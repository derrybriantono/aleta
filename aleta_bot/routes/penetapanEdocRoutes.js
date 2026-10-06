"use strict";

/**
 * Rute gerbang internal EDOC PENETAPAN (perbaikan 2 Okt 2026, butir 17, K6).
 * Dipasang di app.js pada /internal/aleta-bot, token sama dengan rute lain.
 *
 *   GET  /penetapan-edoc/peta?nomor=&perkaraId=   jenis mana yang tersedia
 *   POST /penetapan-edoc/unggah                   ambil ABT/manual, ttd+cap, ke SIPP
 *
 * Badan /unggah dapat memuat PASSPHRASE TTE: tidak pernah dicatat, dibuang
 * dari badan sesudah dipakai, dan pesan galat mentah tidak diteruskan.
 * penggunaId, operator, olehUsername, dan ip SELALU dari portal yang sudah
 * mengautentikasi penggunanya.
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const layanan = require("../services/penetapanEdocService");

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

function bita(nilai) {
  const teks = String(nilai || "");
  if (!teks) return null;
  try {
    const b = Buffer.from(teks, "base64");
    return b.length ? b : null;
  } catch {
    return null;
  }
}

router.get("/penetapan-edoc/peta", wajibToken, async (req, res) => {
  try {
    const hasil = await layanan.peta({
      perkaraId: String(req.query.perkaraId || ""),
      nomorPerkara: String(req.query.nomor || ""),
    });
    res.status(hasil.ok ? 200 : 404).json(hasil);
  } catch (galat) {
    res.status(500).json({ ok: false, alasan: String((galat && galat.message) || galat).slice(0, 200) });
  }
});

router.post("/penetapan-edoc/unggah", wajibToken, async (req, res) => {
  const badan = req.body || {};
  const passphrase = typeof badan.passphrase === "string" ? badan.passphrase : "";
  badan.passphrase = "";
  try {
    const cap = {};
    for (const [jenis, c] of Object.entries(badan.cap || {})) {
      const isi = bita(c && c.isiBase64);
      if (isi) cap[String(jenis).toLowerCase()] = { isi, jenis: String((c && c.jenis) || ""), id: String((c && c.id) || ""), nama: String((c && c.nama) || "") };
    }
    const hasil = await layanan.unggah({
      perkaraId: String(badan.perkaraId || ""),
      nomorPerkara: String(badan.nomorPerkara || ""),
      jenis: Array.isArray(badan.jenis) ? badan.jenis.map(String) : [],
      manual: (Array.isArray(badan.manual) ? badan.manual : []).map((m) => ({
        jenis: String((m && m.jenis) || ""),
        isi: bita(m && m.isiBase64),
      })),
      // RTF blangko ABT yang dicetak ekstensi (butir 17, 6 Okt) - bukan
      // berkas pilihan petugas, jadi tidak masuk manual[].
      abt: (Array.isArray(badan.abt) ? badan.abt : []).map((m) => ({
        jenis: String((m && m.jenis) || ""),
        isi: bita(m && m.isiBase64),
        berkas: String((m && m.berkas) || ""),
      })),
      // Pengaturan peta penetapan per jenis (butir 19-20), disaring lagi di
      // layanan (aturBerlaku) - nilai yang tidak dikenal dibuang.
      atur: badan.atur && typeof badan.atur === "object" ? badan.atur : {},
      otomatis: badan.otomatis === true,
      cap,
      penggunaId: String(badan.penggunaId || ""),
      operator: String(badan.operator || ""),
      olehUsername: String(badan.olehUsername || ""),
      ip: String(badan.ip || ""),
      passphrase,
      nik: String(badan.nik || ""),
      kering: badan.kering !== false,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch {
    // Galat sengaja tidak diteruskan: badan permintaan dapat memuat passphrase.
    res.status(500).json({ ok: false, alasan: "unggah_edoc_penetapan_gagal_diproses" });
  }
});

module.exports = router;
