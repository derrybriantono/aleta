"use strict";

/**
 * Rute internal Cermin Perkara (C0, 25 Okt 2026) - dipasang di
 * /internal/aleta-bot/cermin oleh app.js. Hanya portal yang memanggilnya,
 * dengan token internal yang sama; SEMUA rute GET dan hanya membaca SIPP
 * (lihat services/cerminService.js).
 *
 *   GET /ringkasan                     jumlah/rentang perkara + rentang tanggal sidang
 *   GET /perkara?setelahId&batas       satu kelompok perkara (perkara_id > setelahId)
 *   GET /sidang?dari&sampai            sidang pada satu jendela tanggal (baris
 *                                      persis seperti layar Jadwal Sidang)
 *   GET /perkara-id?id=1,2,3           perkara menurut id (paling banyak 500)
 *   GET /perubahan?sejak&batas         perkara yang tersentuh sejak waktu SIPP T
 *                                      (pembaruan berkala) + tanggal sidangnya
 *   GET /id-perkara?setelahId&batas    daftar ringan id + waktu (pencocokan mingguan)
 *   GET /id-sidang?dari&sampai         daftar ringan sidang satu jendela (idem)
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const cerminService = require("../services/cerminService");
const cerminPembaruanService = require("../services/cerminPembaruanService");

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

function galat(res, error) {
  res.status(500).json({ ok: false, error: String((error && error.message) || error).slice(0, 300) });
}

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

router.get("/ringkasan", wajibToken, async (_req, res) => {
  try {
    res.json({ ok: true, ...(await cerminService.ringkasanSumber()) });
  } catch (error) {
    galat(res, error);
  }
});

router.get("/perkara", wajibToken, async (req, res) => {
  try {
    res.json({
      ok: true,
      ...(await cerminService.kelompokPerkara({
        setelahId: Number(req.query.setelahId) || 0,
        batas: Number(req.query.batas) || 300,
      })),
    });
  } catch (error) {
    galat(res, error);
  }
});

router.get("/sidang", wajibToken, async (req, res) => {
  try {
    const dari = String(req.query.dari || "");
    const sampai = String(req.query.sampai || "") || dari;
    if (!TANGGAL.test(dari) || !TANGGAL.test(sampai) || sampai < dari) {
      res.status(400).json({ ok: false, error: "tanggal_tidak_sah", message: "dari/sampai harus YYYY-MM-DD dan dari <= sampai." });
      return;
    }
    res.json({ ok: true, ...(await cerminService.sidangJendela({ dari, sampai })) });
  } catch (error) {
    galat(res, error);
  }
});

router.get("/perkara-id", wajibToken, async (req, res) => {
  try {
    const id = String(req.query.id || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    res.json({ ok: true, ...(await cerminService.perkaraDenganId(id)) });
  } catch (error) {
    galat(res, error);
  }
});

router.get("/perubahan", wajibToken, async (req, res) => {
  try {
    const hasil = await cerminPembaruanService.perubahanSejak({
      sejak: String(req.query.sejak || ""),
      batas: Number(req.query.batas) || undefined,
    });
    if (hasil.ok === false) {
      res.status(400).json(hasil);
      return;
    }
    res.json(hasil);
  } catch (error) {
    galat(res, error);
  }
});

router.get("/id-perkara", wajibToken, async (req, res) => {
  try {
    res.json({
      ok: true,
      ...(await cerminPembaruanService.idPerkara({
        setelahId: Number(req.query.setelahId) || 0,
        batas: Number(req.query.batas) || undefined,
      })),
    });
  } catch (error) {
    galat(res, error);
  }
});

router.get("/id-sidang", wajibToken, async (req, res) => {
  try {
    const dari = String(req.query.dari || "");
    const sampai = String(req.query.sampai || "") || dari;
    if (!TANGGAL.test(dari) || !TANGGAL.test(sampai) || sampai < dari) {
      res.status(400).json({ ok: false, error: "tanggal_tidak_sah", message: "dari/sampai harus YYYY-MM-DD dan dari <= sampai." });
      return;
    }
    res.json({ ok: true, ...(await cerminPembaruanService.idSidang({ dari, sampai })) });
  } catch (error) {
    galat(res, error);
  }
});

module.exports = router;
