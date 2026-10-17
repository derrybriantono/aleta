"use strict";

/**
 * Rute internal MODE KEMBARAN - dipasang di /internal/aleta-bot/kembaran oleh app.js.
 * Hanya portal yang memanggilnya (token internal yang sama dengan rute sinkron),
 * dan portal sendiri membatasi tindakan ubah pada Super Admin.
 *
 *   GET  /status            mode, pita, cap tarik, hitungan antrean
 *   GET  /antrean           baris antrean (?status=&kelompok=&sumber=&batas=)
 *   GET  /uji               uji sambungan ke MySQL server dan ssh (tanpa menulis)
 *   POST /periksa           { ids? }        bandingkan dengan nilai TERKINI di server
 *   POST /setujui           { ids?, kelompok?, oleh }
 *   POST /tolak             { ids?, kelompok?, oleh, alasan? }
 *   POST /kirim             { oleh }        kirim semua yang disetujui (diperiksa ulang)
 *
 * Semua tindakan ubah menjawab 409 "bukan_mode_kembaran" bila bot tidak sedang di
 * mode kembaran: bot di server TIDAK PERNAH mendorong apa pun lewat rute ini.
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const kembaranMode = require("../services/kembaranMode");
const antrean = require("../services/kembaranAntrean");

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
  if (!terpasang) return res.status(403).json({ ok: false, error: "token_not_configured", message: "Token internal ALETA belum dikonfigurasi." });
  if (!diminta || !samaAman(diminta, terpasang)) return res.status(401).json({ ok: false, error: "invalid_token", message: "Token internal tidak valid." });
  return next();
}

function wajibKembaran(req, res, next) {
  if (!kembaranMode.aktif()) {
    return res.status(409).json({ ok: false, error: "bukan_mode_kembaran", message: "Bot ini tidak berjalan di mode kembaran; tidak ada antrean sinkron." });
  }
  return next();
}

function galat(res, kode, g) {
  return res.status(kode).json({ ok: false, error: "kembaran_gagal", message: String((g && g.message) || g).slice(0, 300) });
}

/** Baris untuk layar: SQL dipendekkan, cuplikan diringkas ke kolom yang akan diubah. */
function untukLayar(b) {
  const u = b.uraian || {};
  const baris = (b.cuplikan && b.cuplikan.baris) || [];
  let nilai = [];
  if (b.jenis === "UPDATE" && Array.isArray(u.assignments)) {
    nilai = u.assignments.map((a) => ({
      kolom: a.kolom,
      lama: baris.slice(0, 3).map((r) => {
        const kunci = Object.keys(r).find((k) => k.toLowerCase() === String(a.kolom).toLowerCase());
        return kunci ? r[kunci] : null;
      }),
      baru: a.nilai && a.nilai.tipe !== "kompleks" ? a.nilai.nilai : a.ekspresi,
    }));
  }
  return {
    id: b.id,
    kelompok: b.kelompok,
    urutan: b.urutan,
    dicatatPada: b.dicatatPada,
    sumber: b.sumber,
    jenis: b.jenis,
    tabel: b.tabel,
    status: b.status,
    hasil: b.hasil,
    aktor: b.aktor || null,
    operasi: b.operasi || null,
    sql: String(b.sql || "").slice(0, 800),
    sqlTerpotong: String(b.sql || "").length > 800,
    terdampak: b.jenis === "UPDATE" || b.jenis === "DELETE" ? baris.length : u.baris ? u.baris.length : null,
    cuplikanStatus: (b.cuplikan && b.cuplikan.status) || null,
    nilai,
    periksa: b.periksa || null,
    berkas: b.berkas ? { relatif: b.berkas.relatif || null, dari: b.berkas.dariRelatif || null, ke: b.berkas.keRelatif || null, ukuran: b.berkas.ukuran || null } : null,
    disetujuiOleh: b.disetujuiOleh || null,
    disetujuiPada: b.disetujuiPada || null,
    dikirimPada: b.dikirimPada || null,
    dikirimOleh: b.dikirimOleh || null,
    ditolakOleh: b.ditolakOleh || null,
    alasanTolak: b.alasanTolak || null,
    galat: b.galat || null,
    catatan: b.catatan || null,
  };
}

router.get("/status", wajibToken, async (req, res) => {
  const dasar = kembaranMode.ringkasan();
  if (!dasar.aktif) return res.json({ ok: true, ...dasar, hitung: [] });
  try {
    const hitung = await antrean.dapatkan().hitung();
    return res.json({ ok: true, ...dasar, penjaga: require("../services/penjagaKembaran").ringkasan(), hitung });
  } catch (g) {
    return res.json({ ok: true, ...dasar, hitung: [], antreanGalat: String((g && g.message) || g).slice(0, 200) });
  }
});

router.get("/antrean", wajibToken, wajibKembaran, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status).split(",").filter(Boolean) : undefined;
    const batas = Math.max(1, Math.min(2000, Number(req.query.batas) || 500));
    const baris = await antrean.dapatkan().daftar({
      status,
      kelompok: req.query.kelompok ? String(req.query.kelompok) : undefined,
      sumber: req.query.sumber ? String(req.query.sumber) : undefined,
      batas,
    });
    return res.json({ ok: true, baris: baris.map(untukLayar) });
  } catch (g) {
    return galat(res, 500, g);
  }
});

router.get("/uji", wajibToken, wajibKembaran, async (req, res) => {
  try {
    const { server } = require("../services/kembaranDorong").dorongBawaan();
    return res.json({ ok: true, hasil: await server.uji() });
  } catch (g) {
    return galat(res, 500, g);
  }
});

function idsDari(badan) {
  return Array.isArray(badan && badan.ids) ? badan.ids.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 5000) : [];
}

router.post("/periksa", wajibToken, wajibKembaran, async (req, res) => {
  try {
    const { dorong } = require("../services/kembaranDorong").dorongBawaan();
    return res.json({ ok: true, ...(await dorong.periksa({ ids: idsDari(req.body) })) });
  } catch (g) {
    return galat(res, 500, g);
  }
});

router.post("/setujui", wajibToken, wajibKembaran, async (req, res) => {
  try {
    const oleh = String((req.body && req.body.oleh) || "").trim();
    if (!oleh) return res.status(400).json({ ok: false, error: "oleh_wajib", message: "Nama penyetuju wajib." });
    const { dorong } = require("../services/kembaranDorong").dorongBawaan();
    return res.json({ ok: true, ...(await dorong.setujui({ ids: idsDari(req.body), kelompok: (req.body && req.body.kelompok) || null, oleh })) });
  } catch (g) {
    return galat(res, 500, g);
  }
});

router.post("/tolak", wajibToken, wajibKembaran, async (req, res) => {
  try {
    const oleh = String((req.body && req.body.oleh) || "").trim();
    if (!oleh) return res.status(400).json({ ok: false, error: "oleh_wajib", message: "Nama pelaku wajib." });
    const { dorong } = require("../services/kembaranDorong").dorongBawaan();
    return res.json({ ok: true, ...(await dorong.tolak({ ids: idsDari(req.body), kelompok: (req.body && req.body.kelompok) || null, oleh, alasan: (req.body && req.body.alasan) || "" })) });
  } catch (g) {
    return galat(res, 500, g);
  }
});

router.post("/kirim", wajibToken, wajibKembaran, async (req, res) => {
  try {
    const oleh = String((req.body && req.body.oleh) || "").trim();
    if (!oleh) return res.status(400).json({ ok: false, error: "oleh_wajib", message: "Nama pengirim wajib." });
    const { dorong } = require("../services/kembaranDorong").dorongBawaan();
    return res.json({ ok: true, ...(await dorong.kirim({ oleh })) });
  } catch (g) {
    return galat(res, 500, g);
  }
});

module.exports = router;
module.exports.untukLayar = untukLayar;
