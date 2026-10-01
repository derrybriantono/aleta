"use strict";

/**
 * Rute gerbang internal untuk sesi e-Court PRIBADI dan aksi e-Court per
 * perkara (perbaikan 1 Okt 2026: E9, E10, E11, 16b). Dipasang di app.js pada
 * /internal/aleta-bot bersama internalGatewayRoutes, dengan penjagaan token
 * yang sama.
 *
 * ============================================================================
 * BADAN PERMINTAAN DAPAT MEMUAT SANDI ATAU PASSPHRASE
 * ============================================================================
 *
 * /ecourt-pengguna/login/kirim membawa sandi e-Court, /ecourt-aksi/tte
 * membawa passphrase TTE. Tidak satu pun bagian badan permintaan dicatat, dan
 * pesan galat tidak pernah diteruskan apa adanya dari rute-rute itu.
 *
 * penggunaId dan nama SELALU dari portal yang sudah mengautentikasi
 * penggunanya (lihat rute portal src/app/api/aleta-ecourt/ecourt-*).
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const sesiPengguna = require("../services/ecourtSesiPenggunaService");
const aksi = require("../services/ecourtAksiService");
const pantau = require("../services/ecourtPantauPutusanService");

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

const ambil = (req, kunci) => String((req.body && req.body[kunci]) || req.query[kunci] || "");

// ---------------------------------------------------------------------------
// Sesi e-Court pribadi
// ---------------------------------------------------------------------------

router.get("/ecourt-pengguna/sesi", wajibToken, (req, res) => {
  const penggunaId = String(req.query.penggunaId || "");
  res.json({
    ok: true,
    peranTersedia: sesiPengguna.PERAN_ECOURT.map((p) => ({ kode: p, sebutan: sesiPengguna.SEBUTAN_PERAN[p] })),
    sesi: sesiPengguna.daftarSesi(penggunaId),
  });
});

router.post("/ecourt-pengguna/login/mulai", wajibToken, async (req, res) => {
  try {
    const hasil = await sesiPengguna.mulaiSambung({ penggunaId: ambil(req, "penggunaId"), peran: ambil(req, "peran") });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch {
    res.status(500).json({ ok: false, alasan: "gagal_membuka_login" });
  }
});

router.post("/ecourt-pengguna/login/kirim", wajibToken, async (req, res) => {
  try {
    const hasil = await sesiPengguna.kirimSambung({
      penggunaId: String(req.body?.penggunaId || ""),
      peran: String(req.body?.peran || ""),
      namaPengguna: String(req.body?.namaPengguna || ""),
      email: String(req.body?.email || ""),
      sandi: String(req.body?.sandi || ""),
      captcha: String(req.body?.captcha || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch {
    // Galat sengaja tidak diteruskan: badan permintaan memuat sandi.
    res.status(500).json({ ok: false, alasan: "gagal_memproses_login" });
  }
});

router.post("/ecourt-pengguna/periksa", wajibToken, async (req, res) => {
  try {
    const hasil = await sesiPengguna.periksa({ penggunaId: ambil(req, "penggunaId"), peran: ambil(req, "peran") });
    res.json(hasil);
  } catch {
    res.status(500).json({ ok: false, alasan: "gagal_memeriksa" });
  }
});

router.post("/ecourt-pengguna/keluar", wajibToken, (req, res) => {
  res.json(sesiPengguna.hapusSesi(ambil(req, "penggunaId"), ambil(req, "peran")));
});

// ---------------------------------------------------------------------------
// Aksi per perkara
// ---------------------------------------------------------------------------

router.get("/ecourt-aksi/perkara", wajibToken, async (req, res) => {
  try {
    res.json(
      await aksi.ringkasPerkara({
        nomorPerkara: String(req.query.nomor || ""),
        penggunaId: String(req.query.penggunaId || ""),
        nama: String(req.query.nama || ""),
        tanggalSidang: String(req.query.tanggalSidang || ""),
      })
    );
  } catch (galat) {
    res.status(500).json({ ok: false, alasan: String((galat && galat.message) || galat).slice(0, 200) });
  }
});

router.get("/ecourt-aksi/keadaan-putusan", wajibToken, async (req, res) => {
  try {
    const nomor = []
      .concat(req.query.nomor || [])
      .flatMap((x) => String(x).split("|"))
      .filter(Boolean);
    res.json(await aksi.keadaanPutusanBanyak(nomor));
  } catch (galat) {
    res.status(500).json({ ok: false, alasan: String((galat && galat.message) || galat).slice(0, 200), keadaan: {} });
  }
});

router.get("/ecourt-aksi/unduh", wajibToken, async (req, res) => {
  try {
    const hasil = await aksi.unduhLewatSesi({
      penggunaId: String(req.query.penggunaId || ""),
      nama: String(req.query.nama || ""),
      documentKey: String(req.query.documentKey || ""),
      format: String(req.query.format || "pdf"),
    });
    if (!hasil.ok) return res.status(400).json({ ok: false, alasan: hasil.alasan });
    res.setHeader("Content-Type", hasil.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(hasil.namaBerkas)}`
    );
    res.setHeader("Cache-Control", "no-store");
    return res.end(hasil.isi);
  } catch {
    return res.status(500).json({ ok: false, alasan: "unduh_gagal" });
  }
});

router.post("/ecourt-aksi/verifikasi", wajibToken, async (req, res) => {
  try {
    const hasil = await aksi.verifikasi({
      penggunaId: String(req.body?.penggunaId || ""),
      nama: String(req.body?.nama || ""),
      documentKey: String(req.body?.documentKey || ""),
      keputusan: String(req.body?.keputusan || ""),
      keterangan: String(req.body?.keterangan || ""),
      konfirmasi: req.body?.konfirmasi === true,
      kering: req.body?.kering === true,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch {
    res.status(500).json({ ok: false, alasan: "verifikasi_gagal_diproses" });
  }
});

router.post("/ecourt-aksi/tte", wajibToken, async (req, res) => {
  try {
    const hasil = await aksi.tte({
      penggunaId: String(req.body?.penggunaId || ""),
      nama: String(req.body?.nama || ""),
      nomorPerkara: String(req.body?.nomorPerkara || ""),
      passphrase: typeof req.body?.passphrase === "string" ? req.body.passphrase : "",
      konfirmasi: req.body?.konfirmasi === true,
    });
    if (req.body) req.body.passphrase = "";
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch {
    // Galat sengaja tidak diteruskan: badan permintaan memuat passphrase.
    if (req.body) req.body.passphrase = "";
    res.status(500).json({ ok: false, alasan: "tte_gagal_diproses" });
  }
});

router.get("/ecourt-putusan/akun", wajibToken, async (req, res) => {
  try {
    res.json(
      await aksi.akunPutusan({ penggunaId: String(req.query.penggunaId || ""), nomorPerkara: String(req.query.nomor || "") })
    );
  } catch (galat) {
    res.status(500).json({ ok: false, alasan: String((galat && galat.message) || galat).slice(0, 200), akun: null, salinan: null });
  }
});

router.post("/ecourt-putusan/unggah", wajibToken, async (req, res) => {
  try {
    const base64 = String(req.body?.berkasBase64 || "");
    const hasil = await aksi.unggahSalinan({
      penggunaId: String(req.body?.penggunaId || ""),
      nama: String(req.body?.nama || ""),
      nomorPerkara: String(req.body?.nomor || ""),
      isi: base64 ? Buffer.from(base64, "base64") : Buffer.alloc(0),
      konfirmasi: req.body?.konfirmasi === true,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch {
    res.status(500).json({ ok: false, alasan: "unggah_gagal_diproses" });
  }
});

// ---------------------------------------------------------------------------
// Pemantau putusan (E11)
// ---------------------------------------------------------------------------

router.get("/ecourt-aksi/pantau-putusan", wajibToken, (req, res) => {
  res.json({ ok: true, ...pantau.getStatus() });
});

router.post("/ecourt-aksi/pantau-putusan", wajibToken, (req, res) => {
  const b = req.body || {};
  const pengaturan = pantau.saveSettings({
    ...(b.aktif !== undefined ? { aktif: b.aktif === true } : {}),
    ...(b.jarakMenit !== undefined ? { jarakMenit: b.jarakMenit } : {}),
    ...(b.maksPerJam !== undefined ? { maksPerJam: b.maksPerJam } : {}),
    ...(b.jedaUlangJam !== undefined ? { jedaUlangJam: b.jedaUlangJam } : {}),
    ...(b.rentangHari !== undefined ? { rentangHari: b.rentangHari } : {}),
  });
  res.json({ ok: true, pengaturan, ...pantau.getStatus() });
});

// Pemantau dinyalakan bersama rute ini, kecuali dimatikan lewat lingkungan
// (dan tidak pernah di bawah uji).
if (process.env.NODE_ENV !== "test" && process.env.ALETA_ECOURT_PANTAU_PUTUSAN_MATI !== "1") {
  pantau.mulai();
}

module.exports = router;
