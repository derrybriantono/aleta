"use strict";

/**
 * Rute internal Jadwal Sidang - perbaikan 1 Oktober 2026 (butir J1, J2, J7).
 *
 * Dipasang di /internal/aleta-bot/jadwal-sidang oleh app.js - di berkas
 * sendiri, tidak menambah internalGatewayRoutes.js yang sudah 6.000 baris
 * (pola yang sama dengan sinkronRoutes). Hanya portal yang memanggilnya,
 * dengan token internal yang sama.
 *
 *   GET  /selesai?dari&sampai     peta sidang selesai (ALETA + antrian SIPP
 *                                 + mesin ruang tunggu bila disetel)
 *   POST /selesai                 tandai / batalkan selesai (kering bawaan)
 *   GET  /selesai/diagnosa        nilai disidang yang hidup hari ini
 *   GET  /mediasi?perkaraId       proses mediasi + daftar mediator + akun
 *   POST /mediator                penetapan mediator ke SIPP (kering bawaan)
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const sidangSelesaiService = require("../services/sidangSelesaiService");
const mediatorTulisService = require("../services/mediatorTulisService");

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

/** Selalu menuntut token - rute ini menulis ke SIPP dan ke aplikasi antrian. */
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
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(dariPortal) && dariPortal.length <= 15) return dariPortal;
  return String(req.ip || (req.socket && req.socket.remoteAddress) || "").replace(/^::ffff:/, "");
}

function galat500(res, galat) {
  res.status(500).json({ ok: false, error: String((galat && galat.message) || galat).slice(0, 300) });
}

router.get("/selesai", wajibToken, async (req, res) => {
  try {
    const hasil = await sidangSelesaiService.petaSelesai({ dari: req.query.dari, sampai: req.query.sampai });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/selesai/diagnosa", wajibToken, async (req, res) => {
  try {
    res.json(await sidangSelesaiService.diagnosaRuangTunggu());
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post("/selesai", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const hasil = await sidangSelesaiService.setelSelesai({
      perkaraId: badan.perkaraId,
      tanggalSidang: badan.tanggalSidang,
      nomorPerkara: badan.nomorPerkara,
      ruangId: badan.ruangId,
      selesai: badan.selesai !== false,
      oleh: operator,
      // Kering kecuali disebut tegas sebaliknya - sama dengan penundaan.
      kering: badan.kering !== false,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/mediasi", wajibToken, async (req, res) => {
  try {
    const perkaraId = req.query.perkaraId;
    const [proses, mediator, akun] = await Promise.all([
      mediatorTulisService.prosesMediasi(perkaraId),
      mediatorTulisService.daftarMediator(perkaraId).catch(() => []),
      mediatorTulisService.akunPerkara(perkaraId).catch(() => ({ hakim: null, panitera: null })),
    ]);
    res.status(proses.ok ? 200 : 400).json({
      ...proses,
      daftarMediator: mediator,
      akun,
      jenisPenetapan: mediatorTulisService.JENIS_PENETAPAN,
    });
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post("/mediator", wajibToken, async (req, res) => {
  let jejak = null;
  try {
    jejak = require("../services/jejakAletaService");
  } catch {
    jejak = null;
  }
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const kering = badan.kering !== false;
    const rencana = await mediatorTulisService.susunRencanaMediator({
      perkaraId: badan.perkaraId,
      mediatorId: badan.mediatorId,
      tanggalPenetapan: badan.tanggalPenetapan,
      nomorSk: badan.nomorSk,
      jenisPenetapan: badan.jenisPenetapan,
      atasNama: badan.atasNama,
      operator,
      ip: alamatAudit(req),
    });

    if (!rencana.ok) {
      if (jejak) {
        void jejak.catat({
          aksi: "tulis",
          jenis: "mediator",
          perkaraId: badan.perkaraId,
          operator,
          ip: alamatAudit(req),
          berhasil: false,
          kering,
          alasan: String(rencana.alasan || "ditolak"),
          langkah: [],
        });
      }
      res.status(400).json(rencana);
      return;
    }

    const hasil = await mediatorTulisService.jalankanRencanaMediator(rencana, { kering });
    if (jejak) {
      void jejak.catat({
        aksi: "tulis",
        jenis: "mediator",
        perkaraId: rencana.perkara.perkaraId,
        nomorPerkara: rencana.perkara.nomorPerkara,
        tanggalPenetapan: rencana.penetapan.tanggal,
        akunSipp: rencana.atasNama.username,
        namaPejabat: rencana.atasNama.namaLengkap,
        operator,
        ip: alamatAudit(req),
        berhasil: hasil.ok === true,
        kering,
        alasan: hasil.ok ? "" : String(hasil.alasan || "gagal"),
        langkah: rencana.langkah,
      });
    }

    res.status(hasil.ok ? 200 : 409).json({
      ...hasil,
      perkara: rencana.perkara,
      mediator: rencana.mediator,
      penetapan: rencana.penetapan,
      atasNama: rencana.atasNama,
      rencana: kering
        ? rencana.langkah.map((x) => ({
            tabel: x.tabel,
            aksi: x.aksi,
            keterangan: x.keterangan,
            sql: String(x.sql).replace(/\s+/g, " ").trim(),
            nilai: x.params,
          }))
        : undefined,
    });
  } catch (galat) {
    galat500(res, galat);
  }
});

module.exports = router;
