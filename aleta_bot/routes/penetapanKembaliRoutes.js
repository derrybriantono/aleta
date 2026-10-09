"use strict";

/**
 * Rute gerbang internal PENETAPAN KEMBALI (Jadwal Sidang, 6 Okt 2026).
 * Dipasang di app.js pada /internal/aleta-bot/penetapan-kembali, token sama
 * dengan rute internal lain.
 *
 *   POST /keadaan   { perkaraId: [], cari }  penetapan yang sekarang berlaku +
 *                   daftar pilihan hakim/PP/JS/ruangan. Hanya membaca.
 *   POST /tulis     satu perkara, satu jenis (pmh|ppp|pjs|phs). KERING
 *                   kecuali `kering: false` disebut tegas. Menulis ke SIPP
 *                   dalam bentuk borang "penetapan/penunjukan kembali" SIPP
 *                   (penetapanKembaliService), atas akun SIPP petugas yang
 *                   menekan tombolnya, jam basis data sesudah jeda nyata.
 *
 * operator, olehUsername, dan ip SELALU dari portal yang sudah
 * mengautentikasi penggunanya. Pejabat penetap hanya ke jejak ALETA.
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const layanan = require("../services/penetapanKembaliService");
// Penjalan bertransaksi yang sama dengan tombol tunda/putus (jalankanRencanaUtuh).
const sidangHasilService = require("../services/sidangHasilService");
const jejakAletaService = require("../services/jejakAletaService");
const jedaManusiaService = require("../services/jedaManusiaService");

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

/** IPv4 peramban petugas (kolom ipaddress varchar(15)); selain itu kosong. */
function alamatAudit(badan) {
  const ip = String((badan && badan.ip) || "").trim();
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip.length <= 15 ? ip : "";
}

router.post("/keadaan", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await layanan.keadaanUntukLayar({
      perkaraId: Array.isArray(badan.perkaraId) ? badan.perkaraId : [],
      cari: String(badan.cari || ""),
    });
    res.json(hasil);
  } catch (galat) {
    res.status(500).json({ ok: false, alasan: String((galat && galat.message) || galat).slice(0, 200) });
  }
});

router.post("/tulis", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const kering = badan.kering !== false;
    const ip = alamatAudit(badan);

    // Jeda sungguhan SEBELUM rencana disusun: jam audit diambil penyusun
    // rencana sesudahnya, jadi yang tercatat jam yang sungguh terjadi.
    if (!kering) await jedaManusiaService.jeda("simpan", { kering });

    const minta = {
      jenis: String(badan.jenis || ""),
      perkaraId: badan.perkaraId,
      tanggalPenetapan: String(badan.tanggalPenetapan || ""),
      alasan: String(badan.alasan || ""),
      hakimId: Array.isArray(badan.hakimId) ? badan.hakimId : [],
      petugasId: badan.petugasId,
      tanggalSidang: String(badan.tanggalSidang || ""),
      jamSidang: String(badan.jamSidang || ""),
      ruanganId: badan.ruanganId,
      olehUsername: String(badan.olehUsername || ""),
      operator,
      ip,
    };
    const rencana = await layanan.susunRencanaKembali(minta);
    const pejabat = String(badan.pejabatUsername || "").trim().slice(0, 150);

    if (!rencana.ok) {
      void jejakAletaService.catat({
        aksi: "kembali",
        jenis: minta.jenis,
        perkaraId: badan.perkaraId,
        tanggalPenetapan: minta.tanggalPenetapan,
        akunSipp: minta.olehUsername,
        namaPejabat: pejabat,
        operator,
        ip,
        berhasil: false,
        kering,
        alasan: String(rencana.alasan || "ditolak"),
        langkah: [],
      });
      res.status(400).json(rencana);
      return;
    }

    // ========================================================================
    // SATU TRANSAKSI (uji rilis 9 Okt 2026, pola kasus 273)
    // ========================================================================
    //
    // Penetapan kembali MENONAKTIFKAN majelis/PP/JS lama (UPDATE aktif='T')
    // lalu MENYISIPKAN yang baru. Ditulis lepas-lepas, kegagalan di antara
    // keduanya meninggalkan perkara TANPA majelis/PP/JS aktif sama sekali.
    // Kini seluruh langkahnya satu transaksi (semua tabelnya InnoDB, diukur di
    // server): gagal di tengah = ROLLBACK, keadaan SIPP kembali seperti semula.
    // Mesin langkahnya tetap penetapanTulisService.jalankanRencana.
    const hasil = await sidangHasilService.jalankanRencanaUtuh(rencana, { kering });

    void jejakAletaService.catat({
      aksi: "kembali",
      jenis: rencana.jenis,
      perkaraId: badan.perkaraId,
      nomorPerkara: rencana.perkara.nomorPerkara,
      tanggalPenetapan: rencana.tanggalPenetapan,
      akunSipp: rencana.atasNama.username,
      namaPejabat: pejabat,
      operator,
      ip,
      berhasil: hasil.ok === true,
      kering,
      alasan: hasil.ok
        ? ""
        : `${String(hasil.alasan || "gagal")}${
            hasil.dipulihkan === true ? " (dibatalkan utuh)" : hasil.dipulihkan === false ? " (TIDAK dipulihkan)" : ""
          }${hasil.pesan ? `: ${String(hasil.pesan)}` : ""}`.slice(0, 160),
      // Langkah pertama memuat alasan penggantiannya - itulah satu-satunya
      // tempat alasan PJS tersimpan (SIPP tidak menyimpannya).
      langkah: rencana.langkah,
    });

    res.status(hasil.ok ? 200 : 409).json({
      ...hasil,
      jenis: rencana.jenis,
      perkara: rencana.perkara,
      atasNama: rencana.atasNama,
      alasan: hasil.ok ? undefined : hasil.alasan,
      alasanPenggantian: rencana.alasan,
      formulir: rencana.formulir,
      ringkas: rencana.ringkas,
      catatan: rencana.catatan,
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
    res.status(500).json({ ok: false, alasan: String((galat && galat.message) || galat).slice(0, 200) });
  }
});

module.exports = router;
