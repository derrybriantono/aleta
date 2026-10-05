"use strict";

/**
 * Rute internal panggil petugas/pihak dan status pertemuan mediasi - butir
 * 33-36 (5 Oktober 2026).
 *
 * Dipasang di /internal/aleta-bot/panggil oleh app.js - di berkas sendiri,
 * tidak menambah jadwalSidangRoutes.js / internalGatewayRoutes.js yang sedang
 * disunting tangan lain. Hanya portal yang memanggilnya, dengan token internal
 * yang sama.
 *
 *   GET  /sasaran?perkaraId&tanggal   petugas + pihak perkara dari SIPP (SELECT)
 *                                     beserta nomor pihak dan verifikasinya
 *   POST /catat                       catat satu panggilan (menolak bila baru
 *                                     saja dipanggil lewat saluran yang sama)
 *   POST /perbarui                    isi hasil akhir panggilan
 *   GET  /pengumuman?sejakId          pengumuman suara untuk layar antrian
 *   GET  /riwayat?perkaraId&tanggal   riwayat panggilan satu perkara
 *   GET  /mediasi-status?dari&sampai  peta "sedang berjalan"/"selesai" mediasi
 *   POST /mediasi-status              tandai / batalkan (kering bawaan)
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const panggilPetugasService = require("../services/panggilPetugasService");
const mediasiStatusService = require("../services/mediasiStatusService");

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

/** Selalu menuntut token - rute ini membaca nomor telepon pihak. */
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

function alamatAudit(req) {
  const dariPortal = String((req.body && req.body.ip) || "").trim();
  if (/^[0-9a-fA-F:.]{3,45}$/.test(dariPortal)) return dariPortal;
  return String(req.ip || (req.socket && req.socket.remoteAddress) || "").replace(/^::ffff:/, "");
}

function galat500(res, galat) {
  res.status(500).json({ ok: false, error: String((galat && galat.message) || galat).slice(0, 300) });
}

router.get("/sasaran", wajibToken, async (req, res) => {
  try {
    const hasil = await panggilPetugasService.sasaran({ perkaraId: req.query.perkaraId, tanggal: req.query.tanggal });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post("/catat", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    if (!String(badan.oleh || "").trim()) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const hasil = await panggilPetugasService.catat({ ...badan, ip: alamatAudit(req) });
    res.status(hasil.ok ? 200 : 409).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post("/perbarui", wajibToken, async (req, res) => {
  try {
    const hasil = await panggilPetugasService.perbarui(req.body || {});
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/pengumuman", wajibToken, async (req, res) => {
  try {
    res.json(await panggilPetugasService.pengumuman({ sejakId: req.query.sejakId }));
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/riwayat", wajibToken, async (req, res) => {
  try {
    const hasil = await panggilPetugasService.riwayat({ perkaraId: req.query.perkaraId, tanggal: req.query.tanggal });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/mediasi-status", wajibToken, async (req, res) => {
  try {
    const hasil = await mediasiStatusService.petaStatus({ dari: req.query.dari, sampai: req.query.sampai });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post("/mediasi-status", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const hasil = await mediasiStatusService.setelStatus({
      mediasiId: badan.mediasiId,
      perkaraId: badan.perkaraId,
      tanggal: badan.tanggal,
      nomorPerkara: badan.nomorPerkara,
      tempat: badan.tempat,
      keadaan: badan.keadaan,
      batal: badan.batal === true,
      oleh: operator,
      ip: alamatAudit(req),
      kering: badan.kering !== false,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

module.exports = router;
