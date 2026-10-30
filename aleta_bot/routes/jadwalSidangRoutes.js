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
 *   GET  /disidang                keadaan disidang hari ini, satu kueri ringan
 *                                 (6 Okt 2026) - "sedang berjalan" seketika
 *   GET  /ringan?dari&sampai      hanya kolom yang berubah sepanjang hari (ditunda,
 *                                 hasil/putus, kehadiran, sidang berikutnya) untuk
 *                                 satu rentang (empat kueri berindeks) - 22 Okt 2026
 *   POST /skors                   skors / lanjutkan sidang (kering bawaan) -
 *                                 perbaikan 2 Okt 2026, butir 10; F3.1 (17 Okt):
 *                                 + alasanKode baku dan perkiraanLanjut
 *   GET  /skors?dari&sampai[&perkaraId]  daftar skors (berlaku + sudah
 *                                 dilanjutkan, beserta lamanya) - hanya tabel
 *                                 ALETA, F3.1
 *   POST /berjalan                tandai / batalkan tanda "sedang berjalan"
 *                                 (kering bawaan) - 2 Okt 2026 malam, butir 3
 *   GET  /kalender?perkaraId      Court Calendar perkara (hanya SELECT) - bahan
 *                                 tanggal sidang berikutnya, 2 Okt 2026 malam
 *   GET  /pihak-elektronik?perkaraId  ada/tidaknya email para pihak + persetujuan
 *                                 e-Court (dari tabel bot - tanpa alamat email) -
 *                                 bahan aturan ketidakhadiran, 2 Okt 2026 malam
 *   GET  /mediasi?perkaraId       proses mediasi + daftar mediator + akun
 *   POST /mediator                penetapan mediator ke SIPP (kering bawaan)
 *   GET  /tunda-mediasi?mediasiId&tanggal  keadaan pertemuan mediasi + bahan formulir Tunda
 *   POST /tunda-mediasi           tunda mediasi ke SIPP persis seperti SIPP (kering bawaan) -
 *                                 26 Okt 2026, tundaMediasiService
 *   GET  /hasil-mediasi-sipp?mediasiId   isian hasil mediasi SIPP + pilihan + akun (28 Okt 2026)
 *   POST /hasil-mediasi-sipp      hasil mediasi ke SIPP persis Edit Hasil Mediasi (kering bawaan)
 *   GET  /kehadiran-sidang?perkaraId  sidang + usulan pembetulan kehadiran (30 Okt 2026, G4 4.4)
 *   POST /kehadiran-sidang        pembetulan kehadiran sidang ke SIPP atas akun PP (kering bawaan)
 *   GET  /putusan-dokumen?perkaraId  tanggal + amar putusan SIPP utuh + nama berkas (G4 4.3, hanya SELECT)
 *   GET  /court-calendar?perkaraId  Court Calendar SIPP + id baris (hanya SELECT)
 *   GET  /court-calendar/jumlah?perkaraId=1,2,3  jumlah baris per perkara
 *   POST /court-calendar          tambah/sunting Court Calendar ke SIPP atas
 *                                 akun SIPP petugas (kering bawaan) - 6 Okt
 *                                 2026, butir 3; courtCalendarTulisService
 *   GET  /kasir?perkaraId         jurnal keuangan + usulan Kasir (hanya SELECT)
 *   GET  /kasir/cari?nomor        cari perkara menurut nomor (hanya SELECT)
 *   POST /kasir                   tambah baris jurnal ke SIPP atas akun SIPP
 *                                 petugas (kering bawaan) - kasirJurnalService
 *   GET  /kasir/harian?tanggal    Kasir Manual (satu hari) (hanya SELECT)
 *   GET  /kasir/rekap?dari&sampai rekap pengeluaran kasir (hanya SELECT)
 *   GET  /kasir/pengingat         tugas kasir tertinggal (hanya SELECT)
 *   POST /kasir/setor-pnbp        catat setoran PNBP di basis data ALETA bot
 *   POST /belum-upload/tarik      tarik ulang e-Court SATU perkara dari penanda
 *                                 "belum upload" (7 Okt 2026) - tidak menulis
 *                                 ke SIPP; daftar dokumen + berkas baru ke arsip
 *                                 ALETA. Tidak menunggu selesai.
 *   GET  /belum-upload/tarik?nomorPerkara  keadaan tarikan itu (ditanya portal
 *                                 berkala sampai selesai)
 */

const crypto = require("crypto");
const express = require("express");

const { readRuntimeConfig } = require("../config/runtime-config");
const sidangSelesaiService = require("../services/sidangSelesaiService");
const disidangLangsungService = require("../services/disidangLangsungService");
const jadwalRinganService = require("../services/jadwalRinganService");
const sidangHasilService = require("../services/sidangHasilService");
const sidangKontakService = require("../services/sidangKontakService");
const mediatorTulisService = require("../services/mediatorTulisService");
const tundaMediasiService = require("../services/tundaMediasiService");
const hasilMediasiTulisService = require("../services/hasilMediasiTulisService");
const courtCalendarTulisService = require("../services/courtCalendarTulisService");

const router = express.Router();
// Keputusan 104 (18 Okt 2026): tulisan manual di luar jam kerja ditanyakan dulu - lihat antreanTulisSippService.
const { manualJamKerja } = require("../services/antreanTulisSippService");

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
  // Butir 45 (17 Okt 2026): TANPA jalan mundur ke alamat soket. Itu alamat peti portal
  // (172.18.0.2) - 19 baris sys_audittrail 29 Sep-16 Okt memuatnya, alamat yang
  // tidak pernah dipakai petugas mana pun, jadi penanda ALETA di audit SIPP.
  // Kosong lebih jujur daripada alamat mesin ALETA (sama dengan putusanTulisService).
  return "";
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

// 6 Okt 2026: keadaan disidang hari ini, satu kueri ringan - portal menanyakannya
// tiap 5 detik supaya "sedang berjalan" terdeteksi dalam hitungan detik.
router.get("/disidang", wajibToken, async (req, res) => {
  try {
    res.json({ ok: true, ...(await disidangLangsungService.disidangHariIni()) });
  } catch (galat) {
    galat500(res, galat);
  }
});

// 22 Okt 2026: bacaan RINGAN jadwal (empat kueri berindeks untuk seluruh daftar,
// tanpa view; ~10 ms, 15 KB). Portal menanyakannya tiap 8 detik saat tab terlihat;
// jadwal penuh (~40 kueri, ~250 ms) tetap tiap 45 detik. Keadaan `disidang`
// tetap lewat /disidang (5 detik).
router.get("/ringan", wajibToken, async (req, res) => {
  try {
    res.json(await jadwalRinganService.jadwalRingan({ dari: req.query.dari, sampai: req.query.sampai }));
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

/**
 * Skors / lanjutkan sidang (perbaikan 2 Okt 2026, butir 10). Kering bawaan.
 * Yang tertulis ke SIPP hanya antrian.status asli (0<->1); siapa, kapan, IP,
 * dan "lewat ALETA" hanya di tabel ALETA aleta_bot_sidang_skors.
 */
router.post("/skors", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const hasil = await sidangSelesaiService.setelSkors({
      perkaraId: badan.perkaraId,
      tanggalSidang: badan.tanggalSidang,
      nomorPerkara: badan.nomorPerkara,
      ruangId: badan.ruangId,
      skors: badan.skors !== false,
      alasan: badan.alasan,
      alasanKode: badan.alasanKode,
      perkiraanLanjut: badan.perkiraanLanjut,
      panggilSaatSkors: badan.panggilSaatSkors,
      hasilSidangSelesai: badan.hasilSidangSelesai === true,
      oleh: operator,
      ip: alamatAudit(req),
      kering: badan.kering !== false,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

/**
 * Daftar skors (F3.1, 17 Okt 2026) - satu tanggal atau rentang pendek, boleh
 * satu perkara. Hanya SELECT pada tabel ALETA aleta_bot_sidang_skors.
 */
router.get("/skors", wajibToken, async (req, res) => {
  try {
    const dari = String(req.query.dari || "").slice(0, 10);
    const hasil = await sidangSelesaiService.daftarSkors({
      dari,
      sampai: String(req.query.sampai || dari).slice(0, 10),
      perkaraId: String(req.query.perkaraId || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

/**
 * Tanda "sedang berjalan" manual (perbaikan 2 Okt 2026 malam, butir 3). Kering
 * bawaan. Yang tertulis ke aplikasi antrian ruang tunggu hanya nilai asli
 * aplikasinya (nomor ruang / NULL) - bawaan sejak 5 Okt 2026, kecuali
 * ALETA_ANTRIAN_DISIDANG_PROSES=mati; siapa, kapan, IP, dan "lewat ALETA" hanya di tabel ALETA
 * aleta_bot_sidang_berjalan.
 */
router.post("/berjalan", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const hasil = await sidangSelesaiService.setelBerjalan({
      perkaraId: badan.perkaraId,
      tanggalSidang: badan.tanggalSidang,
      nomorPerkara: badan.nomorPerkara,
      ruang: badan.ruang,
      berjalan: badan.berjalan !== false,
      hasilSidangSelesai: badan.hasilSidangSelesai === true,
      oleh: operator,
      ip: alamatAudit(req),
      kering: badan.kering !== false,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

/** Court Calendar perkara - hanya SELECT. kalender null = tidak terbaca; [] = tidak ada rencana. */
router.get("/kalender", wajibToken, async (req, res) => {
  try {
    const kalender = await sidangHasilService.kalenderPerkara(req.query.perkaraId);
    res.json({ ok: true, kalender });
  } catch (galat) {
    galat500(res, galat);
  }
});

/**
 * TUNDA OTOMATIS 16.30 (22 Okt 2026) - bahan satu sidang dalam SATU panggilan:
 * keadaan + riwayat + antrian + atas nama siapa (PP) dari alur yang sama dengan
 * borang tunda, Court Calendar, email (ada/tidak), kunci perkara, dan hari
 * sidang keliling berikutnya di lokasi yang sama. HANYA MEMBACA.
 */
router.get("/tunda-otomatis/bahan", wajibToken, async (req, res) => {
  try {
    res.json(await require("../services/tundaOtomatisBahanService").bahanSidang(req.query.jadwalId));
  } catch (galat) {
    galat500(res, galat);
  }
});

/** Baris antrean tunda otomatis sejak tanggal tertentu (WITA) - status untuk daftar. Hanya membaca. */
router.get("/tunda-otomatis/antrean", wajibToken, async (req, res) => {
  try {
    const sejak = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.sejak || "")) ? `${req.query.sejak} 00:00:00` : "";
    const baris = await require("../services/antreanTulisSippService")
      .layanan()
      .daftarMenurutAwalan({ awalan: "sidang-tunda:otomatis:", sejak });
    res.json({ ok: true, baris });
  } catch (galat) {
    galat500(res, galat);
  }
});

/** "Jangan tunda otomatis" sesudah diantrekan: membatalkan baris OTOMATIS yang masih menunggu. */
router.post("/tunda-otomatis/antrean-batal", wajibToken, async (req, res) => {
  try {
    const jadwalId = String((req.body && req.body.jadwalId) || "").replace(/\D/g, "");
    if (!jadwalId) return res.status(400).json({ ok: false, alasan: "jadwal_tidak_sah" });
    res.json(await require("../services/antreanTulisSippService").layanan().batalkanOtomatis(`sidang-tunda:otomatis:${jadwalId}`));
  } catch (galat) {
    galat500(res, galat);
  }
});

/**
 * Email dan persetujuan saluran elektronik para pihak - bahan aturan tunda karena
 * ketidakhadiran. Hanya membaca (SIPP SELECT + tabel bot hasil jembatan e-Court);
 * alamat email TIDAK dikirim, hanya ada/tidaknya.
 */
router.get("/pihak-elektronik", wajibToken, async (req, res) => {
  try {
    const hasil = await sidangKontakService.kontakPerkara(req.query.perkaraId);
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch {
    // Pesan galat sengaja tidak diteruskan: dapat membawa nilai kueri (data pribadi).
    res.status(500).json({ ok: false, error: "kontak_pihak_tidak_terbaca" });
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
        // Kode + nasib transaksi + sebab teknis (uji rilis 9 Okt 2026).
        alasan: hasil.ok
          ? ""
          : `${String(hasil.alasan || "gagal")}${
              hasil.dipulihkan === true ? " (dibatalkan utuh)" : hasil.dipulihkan === false ? " (TIDAK dipulihkan)" : ""
            }${hasil.pada && hasil.pada.tabel ? ` ${hasil.pada.tabel}` : ""}${hasil.pesan ? `: ${hasil.pesan}` : ""}`.slice(0, 160),
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

/**
 * Tunda mediasi dari Jadwal Mediasi (26 Okt 2026) - tundaMediasiService.
 *   GET  /tunda-mediasi?mediasiId&tanggal   keadaan pertemuan + bahan formulir (hanya SELECT)
 *   POST /tunda-mediasi                     rencana (kering bawaan) / tulis ke SIPP
 */
router.get("/tunda-mediasi", wajibToken, async (req, res) => {
  try {
    const hasil = await tundaMediasiService.keadaanTunda({ mediasiId: req.query.mediasiId, tanggal: req.query.tanggal });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

// Tulisan manual di luar jam kerja ditanyakan dulu (keputusan 104) - sama dengan tunda sidang.
router.post(
  "/tunda-mediasi",
  wajibToken, manualJamKerja("mediasi-tunda", (b) => `${String(b.mediasiId || "")}:${String(b.tanggal || "").slice(0, 10)}`, async (req, res) => {
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
        res.status(400).json({ ok: false, alasan: "operator_tidak_disebut", pesan: tundaMediasiService.pesanTolak("operator_tidak_disebut") });
        return;
      }
      const kering = badan.kering !== false;
      const rencana = await tundaMediasiService.susunRencanaTunda({
        mediasiId: badan.mediasiId,
        tanggal: badan.tanggal,
        tanggalBaru: badan.tanggalBaru,
        tempat: badan.tempat,
        jam: badan.jam,
        sampaiJam: badan.sampaiJam,
        kehadiran: badan.kehadiran,
        alasan: badan.alasan,
        keterangan: badan.keterangan,
        atasNama: badan.atasNama,
        operator,
        ip: alamatAudit(req),
      });

      const catatJejak = (hasil, langkah) => {
        if (!jejak) return;
        void jejak.catat({
          aksi: "tulis",
          jenis: "mediasi-tunda",
          perkaraId: rencana.perkara ? rencana.perkara.perkaraId : 0,
          nomorPerkara: rencana.perkara ? rencana.perkara.nomorPerkara : "",
          tanggalPenetapan: rencana.baru ? rencana.baru.tanggal : "",
          akunSipp: rencana.atasNama ? rencana.atasNama.username : "",
          namaPejabat: rencana.atasNama ? rencana.atasNama.namaLengkap : "",
          akunSippMasuk: String(badan.operatorAkunSipp || "").slice(0, 60),
          operator,
          ip: alamatAudit(req),
          berhasil: hasil.ok === true,
          kering,
          alasan: hasil.ok
            ? ""
            : `${String(hasil.alasan || "gagal")}${
                hasil.dipulihkan === true ? " (dibatalkan utuh)" : hasil.dipulihkan === false ? " (TIDAK dipulihkan)" : ""
              }${hasil.pada && hasil.pada.tabel ? ` ${hasil.pada.tabel}` : ""}${hasil.pesan ? `: ${hasil.pesan}` : ""}`.slice(0, 160),
          // Alasan/keterangan penundaan tidak punya kolom di SIPP - hanya tercatat di sini.
          langkah: [
            ...langkah,
            ...(rencana.alasanTunda || rencana.keteranganTunda
              ? [{ tabel: "(catatan ALETA)", aksi: "CATAT", keterangan: `alasan: ${rencana.alasanTunda || "-"}${rencana.keteranganTunda ? `; keterangan: ${rencana.keteranganTunda}` : ""}` }]
              : []),
          ],
        });
      };

      if (!rencana.ok) {
        if (jejak) {
          void jejak.catat({
            aksi: "tulis",
            jenis: "mediasi-tunda",
            perkaraId: 0,
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

      const hasil = await tundaMediasiService.jalankanRencanaTunda(rencana, { kering });
      catatJejak(hasil, rencana.langkah);
      if (hasil.ok !== true && !hasil.pesan) {
        hasil.pesan = tundaMediasiService.pesanTolak(String(hasil.alasan || "gagal"), hasil);
      }

      res.status(hasil.ok ? 200 : 409).json({
        ...hasil,
        perkara: rencana.perkara,
        mediasiId: rencana.mediasiId,
        lama: rencana.lama,
        baru: rencana.baru,
        kehadiran: rencana.kehadiran,
        peringatan: rencana.peringatan,
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
  })
);

/**
 * Hasil mediasi dari Jadwal Mediasi (28 Okt 2026) - hasilMediasiTulisService.
 *   GET  /hasil-mediasi-sipp?mediasiId   isian hasil di SIPP + pilihan + akun (hanya SELECT)
 *   POST /hasil-mediasi-sipp             rencana (kering bawaan) / tulis ke SIPP persis Edit Hasil Mediasi SIPP
 */
router.get("/hasil-mediasi-sipp", wajibToken, async (req, res) => {
  try {
    const hasil = await hasilMediasiTulisService.keadaanHasil({ mediasiId: req.query.mediasiId });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post(
  "/hasil-mediasi-sipp",
  wajibToken, manualJamKerja("mediasi-hasil", (b) => String(b.mediasiId || ""), async (req, res) => {
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
        res.status(400).json({ ok: false, alasan: "operator_tidak_disebut", pesan: hasilMediasiTulisService.pesanTolak("operator_tidak_disebut") });
        return;
      }
      const kering = badan.kering !== false;
      const rencana = await hasilMediasiTulisService.susunRencanaHasil({
        mediasiId: badan.mediasiId,
        hasil: badan.hasil,
        tanggalLaporan: badan.tanggalLaporan,
        tanggalKesepakatan: badan.tanggalKesepakatan,
        isiKesepakatan: badan.isiKesepakatan,
        keterangan: badan.keterangan,
        atasNama: badan.atasNama,
        operator,
        ip: alamatAudit(req),
      });
      const catatJejak = (hasil) => {
        if (!jejak) return;
        void jejak.catat({
          aksi: "tulis",
          jenis: "mediasi-hasil",
          perkaraId: rencana.perkara ? rencana.perkara.perkaraId : 0,
          nomorPerkara: rencana.perkara ? rencana.perkara.nomorPerkara : "",
          tanggalPenetapan: rencana.laporan || "",
          akunSipp: rencana.atasNama ? rencana.atasNama.username : "",
          namaPejabat: rencana.atasNama ? rencana.atasNama.namaLengkap : "",
          akunSippMasuk: String(badan.operatorAkunSipp || "").slice(0, 60),
          operator,
          ip: alamatAudit(req),
          berhasil: hasil.ok === true,
          kering,
          alasan: hasil.ok
            ? ""
            : `${String(hasil.alasan || "gagal")}${
                hasil.dipulihkan === true ? " (dibatalkan utuh)" : hasil.dipulihkan === false ? " (TIDAK dipulihkan)" : ""
              }${hasil.pada && hasil.pada.tabel ? ` ${hasil.pada.tabel}` : ""}${hasil.pesan ? `: ${hasil.pesan}` : ""}`.slice(0, 160),
          langkah: rencana.langkah || [],
        });
      };
      if (!rencana.ok) {
        catatJejak(rencana);
        res.status(400).json(rencana);
        return;
      }
      const hasil = await hasilMediasiTulisService.jalankanRencanaHasil(rencana, { kering });
      catatJejak(hasil);
      if (hasil.ok !== true && !hasil.pesan) hasil.pesan = hasilMediasiTulisService.pesanTolak(String(hasil.alasan || "gagal"), hasil);
      res.status(hasil.ok ? 200 : 409).json({
        ...hasil,
        perkara: rencana.perkara,
        mediasiId: rencana.mediasiId,
        hasil: rencana.hasil,
        hasilOk: hasil.ok,
        laporan: rencana.laporan,
        kesepakatan: rencana.kesepakatan,
        tanggalHasil: rencana.tanggalHasil,
        tahapanSesudah: rencana.tahapanSesudah,
        riwayatDihapus: rencana.riwayatDihapus,
        riwayatBaru: rencana.riwayatBaru,
        sebelumnya: rencana.sebelumnya,
        peringatan: rencana.peringatan,
        atasNama: rencana.atasNama,
        rencana: kering
          ? (rencana.langkah || []).map((x) => ({ tabel: x.tabel, aksi: x.aksi, keterangan: x.keterangan }))
          : undefined,
      });
    } catch (galat) {
      galat500(res, galat);
    }
  })
);

/**
 * Pembetulan pilihan kehadiran sidang (G4 4.4, 30 Okt 2026) - kehadiranSidangTulisService.
 *   GET  /kehadiran-sidang?perkaraId[&basJadwalId&basNama]  sidang + usulan (verstek / BAS) - hanya SELECT
 *   POST /kehadiran-sidang  { jadwalId, dihadiriOleh, sebelum, sebab, operator, kering }  bentuk Edit Jadwal Sidang
 *        SIPP atas akun PP perkara (kering bawaan). Penekan = PP perkara ditegakkan di portal.
 */
const kehadiranSidangTulisService = require("../services/kehadiranSidangTulisService");

router.get("/kehadiran-sidang", wajibToken, async (req, res) => {
  try {
    const hasil = await kehadiranSidangTulisService.layanan().keadaanKehadiran({
      perkaraId: req.query.perkaraId,
      basJadwalId: req.query.basJadwalId,
      basNama: String(req.query.basNama || "").slice(0, 300),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post(
  "/kehadiran-sidang",
  wajibToken, manualJamKerja("kehadiran-sidang", (b) => String(b.jadwalId || ""), async (req, res) => {
    let jejak = null;
    try {
      jejak = require("../services/jejakAletaService");
    } catch {
      jejak = null;
    }
    try {
      const badan = req.body || {};
      const kering = badan.kering !== false;
      const layanan = kehadiranSidangTulisService.layanan();
      const rencana = await layanan.susunRencanaKehadiran({
        jadwalId: badan.jadwalId,
        dihadiriOleh: badan.dihadiriOleh,
        sebelum: badan.sebelum === undefined ? undefined : badan.sebelum,
        sebab: badan.sebab,
        operator: String(badan.operator || "").trim(),
        ip: alamatAudit(req),
      });
      const catatJejak = (hasil) => {
        if (!jejak) return;
        void jejak.catat({
          aksi: "tulis",
          jenis: "kehadiran-sidang",
          perkaraId: rencana.perkara ? rencana.perkara.perkaraId : 0,
          nomorPerkara: rencana.perkara ? rencana.perkara.nomorPerkara : "",
          tanggalPenetapan: rencana.sidang ? rencana.sidang.tanggal : "",
          akunSipp: rencana.atasNama ? rencana.atasNama.username : "",
          namaPejabat: rencana.atasNama ? rencana.atasNama.namaLengkap : "",
          akunSippMasuk: String(badan.operatorAkunSipp || "").slice(0, 60),
          operator: String(badan.operator || ""),
          ip: alamatAudit(req),
          berhasil: hasil.ok === true,
          kering,
          alasan: hasil.ok
            ? `${rencana.kalimat || ""} (${rencana.sebab || "usulan"})`.slice(0, 160)
            : `${String(hasil.alasan || "gagal")}${hasil.dipulihkan === true ? " (dibatalkan utuh)" : hasil.dipulihkan === false ? " (TIDAK dipulihkan)" : ""}`.slice(0, 160),
          langkah: rencana.langkah || [],
        });
      };
      if (!rencana.ok) {
        catatJejak(rencana);
        res.status(400).json(rencana);
        return;
      }
      const hasil = await layanan.jalankanRencanaKehadiran(rencana, { kering });
      catatJejak(hasil);
      res.status(hasil.ok ? 200 : 409).json({
        ...hasil,
        perkara: rencana.perkara,
        sidang: rencana.sidang,
        dari: rencana.dari,
        ke: rencana.ke,
        kalimat: rencana.kalimat,
        sepertiBorang: rencana.sepertiBorang,
        andaian: rencana.andaian,
        atasNama: rencana.atasNama,
        rencana: kering ? (rencana.langkah || []).map((x) => ({ tabel: x.tabel, aksi: x.aksi, keterangan: x.keterangan })) : undefined,
      });
    } catch (galat) {
      galat500(res, galat);
    }
  })
);

/** Bahan pencocokan putusan SIPP vs dokumen (G4 4.3): tanggal + amar UTUH + nama berkas. Hanya SELECT. */
router.get("/putusan-dokumen", wajibToken, async (req, res) => {
  try {
    const hasil = await require("../services/putusanDokumenService").layanan().bahanPutusan(req.query.perkaraId);
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

/** Jumlah baris Court Calendar untuk banyak perkara sekaligus (?perkaraId=1,2,3). Hanya SELECT. */
router.get("/court-calendar/jumlah", wajibToken, async (req, res) => {
  try {
    const hasil = await courtCalendarTulisService.jumlahKalender(req.query.perkaraId);
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

/** Court Calendar perkara beserta id barisnya - bahan menyunting baris lama. Hanya SELECT. */
router.get("/court-calendar", wajibToken, async (req, res) => {
  try {
    const hasil = await courtCalendarTulisService.daftarKalender(req.query.perkaraId);
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

/**
 * Tambah / sunting Court Calendar ke SIPP (6 Okt 2026, butir 3). Kering
 * bawaan. Yang tertulis ke SIPP hanya perkara_court_calendar, dalam bentuk
 * blangko SIPP (tanpa sys_audittrail - SIPP sendiri tidak menulisnya); siapa,
 * kapan, IP, dan "lewat ALETA" hanya di jejak ALETA.
 */
router.post("/court-calendar", wajibToken, async (req, res) => {
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
    const ip = alamatAudit(req);
    const rencana = await courtCalendarTulisService.susunRencana({
      perkaraId: badan.perkaraId,
      tambah: badan.tambah,
      ubah: badan.ubah,
      akunSipp: badan.akunSipp,
      operator,
      ip,
    });

    if (!rencana.ok) {
      if (jejak) {
        void jejak.catat({
          aksi: "tulis",
          jenis: "court-calendar",
          perkaraId: badan.perkaraId,
          akunSipp: String(rencana.akunSipp || akunSipp || ""),
          operator,
          ip,
          berhasil: false,
          kering,
          alasan: String(rencana.alasan || "ditolak"),
          langkah: [],
        });
      }
      res.status(400).json(rencana);
      return;
    }

    const hasil = await courtCalendarTulisService.jalankanRencana(rencana, { kering });
    if (jejak) {
      void jejak.catat({
        aksi: "tulis",
        jenis: "court-calendar",
        perkaraId: rencana.perkara.perkaraId,
        nomorPerkara: rencana.perkara.nomorPerkara,
        akunSipp: rencana.akunSipp.username,
        namaPejabat: rencana.akunSipp.namaLengkap,
        operator,
        ip,
        berhasil: hasil.ok === true,
        kering,
        alasan: hasil.ok ? "" : String(hasil.alasan || "sebagian tidak tersimpan"),
        langkah: rencana.langkah,
      });
    }

    res.status(hasil.ok || kering ? 200 : 409).json({
      ...hasil,
      perkara: rencana.perkara,
      akunSipp: rencana.akunSipp,
      ditolak: rencana.ditolak,
      dilewati: rencana.dilewati,
    });
  } catch (galat) {
    galat500(res, galat);
  }
});

/**
 * ============================================================================
 * KASIR - JURNAL KEUANGAN PERKARA (6 Okt 2026, kasirJurnalService)
 * ============================================================================
 *
 *   GET  /kasir?perkaraId   jurnal SIPP perkara + usulan baris yang BELUM ada
 *                           (hanya SELECT)
 *   GET  /kasir/cari?nomor  perkara menurut nomornya (hanya SELECT)
 *   POST /kasir             tambah baris jurnal ke SIPP - bentuk blangko
 *                           "Tambah" jurnal SIPP + sys_audittrail, atas akun
 *                           SIPP petugas. Kering kecuali kering:false tegas.
 */
router.get("/kasir/cari", wajibToken, async (req, res) => {
  try {
    const kasirJurnalService = require("../services/kasirJurnalService");
    res.json(await kasirJurnalService.cariPerkara(req.query.nomor));
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/kasir", wajibToken, async (req, res) => {
  try {
    const kasirJurnalService = require("../services/kasirJurnalService");
    const hasil = await kasirJurnalService.usulanPerkara(req.query.perkaraId);
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post(
  "/kasir",
  wajibToken,
  manualJamKerja("kasir-manual", (b) => `${b.perkaraId || ""}:${require("crypto").createHash("sha1").update(JSON.stringify(b.baris || [])).digest("hex").slice(0, 16)}`, async (req, res) => {
  let jejak = null;
  try {
    jejak = require("../services/jejakAletaService");
  } catch {
    jejak = null;
  }
  try {
    const kasirJurnalService = require("../services/kasirJurnalService");
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const kering = badan.kering !== false;
    const ip = alamatAudit(req);
    // 28 Okt 2026: SEMUA tulisan jurnal Kasir ALETA (per perkara, Kasir Manual satu hari, otomatis)
    // SELALU atas AKUN KASIR SIPP, siapa pun yang menekan tombolnya; pengguna ALETA itu hanya
    // tercatat di jejak. Tanpa akun kasir (belum ada / belum dipilih): tidak menulis apa pun.
    const kasirAkun = await require("../services/kasirAkunService").tentukan();
    if (!kasirAkun.ok) {
      res.status(400).json({ ok: false, alasan: kasirAkun.alasan, pesan: kasirAkun.pesan, calon: kasirAkun.calon });
      return;
    }
    const akunSipp = kasirAkun.username;
    const rencana = await kasirJurnalService.susunRencana({
      perkaraId: badan.perkaraId,
      baris: badan.baris,
      akunSipp,
      operator,
      ip,
    });
    if (!rencana.ok) {
      if (jejak) {
        void jejak.catat({
          aksi: "tulis",
          jenis: "kasir-jurnal",
          perkaraId: badan.perkaraId,
          akunSipp: String(rencana.akunSipp || akunSipp || ""),
          operator,
          ip,
          berhasil: false,
          kering,
          alasan: String(rencana.alasan || "ditolak"),
          langkah: [],
        });
      }
      res.status(400).json(rencana);
      return;
    }

    const hasil = await kasirJurnalService.jalankanRencana(rencana, { kering });
    if (jejak) {
      void jejak.catat({
        aksi: "tulis",
        // 1.189.x butir 2: simpanan dari Kasir Manual (satu hari) ditandai di
        // jejak ALETA (bukan di SIPP).
        jenis: badan.massal === true ? "kasir-jurnal-massal" : "kasir-jurnal",
        perkaraId: rencana.perkara.perkaraId,
        nomorPerkara: rencana.perkara.nomorPerkara,
        akunSipp: rencana.akunSipp.username,
        namaPejabat: rencana.akunSipp.namaLengkap,
        operator,
        ip,
        berhasil: hasil.ok === true,
        kering,
        alasan: hasil.ok ? "" : String(hasil.alasan || "sebagian tidak tersimpan"),
        langkah: kasirJurnalService.langkahDatarDenganHasil(rencana, hasil.hasil),
      });
    }
    res.status(hasil.ok || kering ? 200 : 409).json({
      ...hasil,
      perkara: rencana.perkara,
      akunSipp: rencana.akunSipp,
      ditolak: rencana.ditolak,
      dilewati: rencana.dilewati,
    });
  } catch (galat) {
    galat500(res, galat);
  }
  }, (b) => `Jurnal kasir perkara ${b.perkaraId || ""}`)
);

/**
 * ============================================================================
 * KASIR OTOMATIS 1.189.x (butir 2, 4, 5)
 * ============================================================================
 *
 *   GET  /kasir/harian?tanggal    perkara hari itu yang perlu dijurnal + usulan
 *                                 menurut keadaannya (hanya SELECT)
 *   GET  /kasir/rekap?dari&sampai rekap pengeluaran/pemasukan (hanya SELECT)
 *   GET  /kasir/pengingat         tugas kasir yang tertinggal (hanya SELECT)
 *   POST /kasir/setor-pnbp        catat setoran PNBP - basis data ALETA saja,
 *                                 TIDAK ke SIPP
 */
router.get("/kasir/harian", wajibToken, async (req, res) => {
  try {
    const kasirJurnalService = require("../services/kasirJurnalService");
    res.json(await kasirJurnalService.daftarHarian(String(req.query.tanggal || ""), { batas: req.query.batas }));
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/kasir/rekap", wajibToken, async (req, res) => {
  try {
    const hasil = await require("../services/kasirRekapService").rekap({ dari: req.query.dari, sampai: req.query.sampai });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/kasir/pengingat", wajibToken, async (req, res) => {
  try {
    res.json(await require("../services/kasirRekapService").pengingat({ hariIni: req.query.hariIni }));
  } catch (galat) {
    galat500(res, galat);
  }
});

/**
 * AKUN KASIR + RIWAYAT KASIR (28 Okt 2026)
 *
 *   GET  /kasir/akun                  akun kasir SIPP yang berlaku (grup Kasir, aktif) + calon
 *   POST /kasir/akun { username }     Super Admin/admin memilih bila akun kasirnya lebih dari satu
 *                                     (hak diperiksa rute portal; basis data ALETA bot saja)
 *   GET  /kasir/riwayat?dari&sampai&nomor&batas   jurnal yang ditulis Kasir ALETA (jejak ALETA, hanya SELECT)
 */
router.get("/kasir/akun", wajibToken, async (req, res) => {
  try {
    res.json(await require("../services/kasirAkunService").tentukan());
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post("/kasir/akun", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await require("../services/kasirAkunService").simpanPilihan({ username: badan.username, operator: badan.operator });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/kasir/riwayat", wajibToken, async (req, res) => {
  try {
    const hasil = await require("../services/jejakAletaService").riwayatKasir({
      dari: req.query.dari,
      sampai: req.query.sampai,
      nomor: req.query.nomor,
      batas: req.query.batas,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post("/kasir/setor-pnbp", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await require("../services/kasirRekapService").catatSetor({
      tanggal: badan.tanggal,
      ntpn: badan.ntpn,
      keterangan: badan.keterangan,
      operator: badan.operator,
      akunSipp: badan.akunSipp,
      ip: alamatAudit(req),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

/**
 * ============================================================================
 * KASIR OTOMATIS - SAKLAR HARI PUTUS (13 Okt 2026, kasirOtomatisService)
 * ============================================================================
 *
 *   GET  /kasir/otomatis?tanggal     perkara putus hari itu + keadaan tiap
 *                                    butir (sudah/akan/dilewati) - hanya SELECT
 *   POST /kasir/otomatis/setelan     saklar + butir (basis data ALETA bot)
 *   POST /kasir/otomatis             tulis butir hari putus SATU perkara atas
 *                                    akun SIPP petugas; saklar dibaca di sini -
 *                                    mati = tidak menulis apa pun
 * Hak (kasir/keuangan menulis, panitera membaca) diperiksa rute portal.
 */
router.get("/kasir/otomatis", wajibToken, async (req, res) => {
  try {
    const hasil = await require("../services/kasirOtomatisService").daftar(String(req.query.tanggal || ""), { batas: req.query.batas });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post("/kasir/otomatis/setelan", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await require("../services/kasirOtomatisService").simpanSetelan({
      nyala: typeof badan.nyala === "boolean" ? badan.nyala : undefined,
      butir: Array.isArray(badan.butir) ? badan.butir : undefined,
      operator: badan.operator,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.post("/kasir/otomatis", wajibToken, async (req, res) => {
  let jejak = null;
  try {
    jejak = require("../services/jejakAletaService");
  } catch {
    jejak = null;
  }
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    const kering = badan.kering !== false;
    const ip = alamatAudit(req);
    const hasil = await require("../services/kasirOtomatisService").jalankanPerkara({
      perkaraId: badan.perkaraId,
      operator,
      ip,
      kering,
    });
    if (jejak && Array.isArray(hasil.langkahDatar) && hasil.langkahDatar.length) {
      void jejak.catat({
        aksi: "tulis",
        jenis: "kasir-otomatis",
        perkaraId: hasil.perkara ? hasil.perkara.perkaraId : badan.perkaraId,
        nomorPerkara: hasil.perkara ? hasil.perkara.nomorPerkara : "",
        akunSipp: hasil.akunSipp ? hasil.akunSipp.username : "",
        namaPejabat: hasil.akunSipp ? hasil.akunSipp.namaLengkap : "",
        operator,
        ip,
        berhasil: hasil.ok === true,
        kering,
        alasan: hasil.ok ? "" : String(hasil.alasan || hasil.pesan || "sebagian tidak tersimpan"),
        langkah: hasil.langkahDatar,
      });
    }
    const { langkahDatar: _abaikan, ...jawab } = hasil;
    res.status(hasil.ok || hasil.kosong || kering ? 200 : hasil.alasan === "saklar_mati" ? 409 : 400).json(jawab);
  } catch (galat) {
    galat500(res, galat);
  }
});

// ============================================================================
// 7 Okt 2026: penanda "belum upload" dapat ditekan - tarik ulang e-Court HANYA
// untuk perkara itu. Kunci ganda, jeda per perkara, dan penolakan bila ada
// penarikan lain dijaga di ecourtVerifikasiHarianService.tarikSekarang.
// ============================================================================
router.post("/belum-upload/tarik", wajibToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await require("../services/ecourtVerifikasiHarianService").tarikSekarang({
      nomorPerkara: String(badan.nomorPerkara || ""),
      tanggal: String(badan.tanggal || "").slice(0, 10),
      olehSiapa: String(badan.operator || "").slice(0, 120),
    });
    res.status(hasil.ok ? 200 : 409).json(hasil);
  } catch (galat) {
    galat500(res, galat);
  }
});

router.get("/belum-upload/tarik", wajibToken, async (req, res) => {
  try {
    res.json(require("../services/ecourtVerifikasiHarianService").statusTarikan(String(req.query.nomorPerkara || "")));
  } catch (galat) {
    galat500(res, galat);
  }
});

module.exports = router;
