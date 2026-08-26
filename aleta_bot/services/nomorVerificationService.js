"use strict";

/**
 * Verifikasi kepemilikan nomor WhatsApp sebelum dokumen dikirim.
 *
 * ============================================================================
 * KENAPA INI ADA
 * ============================================================================
 *
 * Perkara di Pengadilan Agama adalah perceraian, waris, dan hak asuh anak.
 * Nomor telepon pihak diketik petugas dari formulir tulisan tangan.
 *
 * Satu digit salah, dan dokumen Jawaban perceraian seseorang terkirim ke
 * WhatsApp orang asing - lengkap dengan nama, alamat, dan isi sengketa
 * keluarganya. Dulu kesalahan seperti itu berujung surat kembali ke pengadilan.
 * Sekarang berujung PDF terkirim, terbaca, dan tidak bisa ditarik kembali.
 *
 * Karena itu, sebelum satu berkas pun dikirim ke nomor yang belum dikenal,
 * ALETA bertanya lebih dulu - TANPA lampiran, dan TANPA menyebut isi perkara:
 *
 *   "Apakah benar ini nomor Sdr/i Sulastri? Balas YA bila benar."
 *
 * Pertanyaannya sengaja sesedikit mungkin membuka informasi. Bila nomornya
 * ternyata milik orang lain, yang bocor hanya sebuah nama - bukan bahwa orang
 * itu sedang berperkara, apalagi perkara apa.
 *
 * ============================================================================
 * GAGAL-TERTUTUP
 * ============================================================================
 *
 * Seperti verifikasi hakim, dan berbeda dari pemberitahuan biasa: apa pun yang
 * tidak dapat dipastikan berakhir dengan TIDAK MENGIRIM. Nomor yang belum
 * dijawab tidak menerima dokumen. Nomor yang dijawab "bukan" tidak pernah
 * dikirimi apa pun lagi, dan petugas diberi tahu supaya datanya diperbaiki.
 */

const crypto = require("crypto");

const botDb = require("./botDbService");
const logService = require("./logService");
const { cleanText } = require("./ecourtTextService");
const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");
const { readRuntimeConfig } = require("../config/runtime-config");

/** Bawaan bila portal maupun env belum mengaturnya. */
const ULANGI_SETELAH_MS = Number(process.env.ALETA_BOT_VERIFIKASI_ULANG_MS || 3 * 24 * 60 * 60 * 1000);

/**
 * Tenggang sebelum pertanyaan boleh diulang.
 *
 * Dibaca dari portal setiap kali dipakai, bukan sekali saat modul dimuat -
 * supaya perubahan dari portal langsung berlaku tanpa perlu restart bot.
 */
function ulangiSetelahMs(runtimeConfig = readRuntimeConfig()) {
  const hari = Number(runtimeConfig.ecourtTanyaUlangHari);
  if (Number.isFinite(hari) && hari >= 1 && hari <= 60) return hari * 24 * 60 * 60 * 1000;
  return ULANGI_SETELAH_MS;
}

const JAWABAN_YA = new Set(["ya", "y", "benar", "betul", "iya", "ya benar"]);
const JAWABAN_BUKAN = new Set(["bukan", "tidak", "salah", "bukan saya", "salah nomor"]);

const STATUS = {
  MENUNGGU: "menunggu",
  TERVERIFIKASI: "terverifikasi",
  DITOLAK: "ditolak",
};

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return true;
  const siap = await botDb.ensureSchema();
  if (!siap) return false;

  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_nomor_terverifikasi (
      id VARCHAR(64) PRIMARY KEY,
      nomor VARCHAR(32) NOT NULL,
      nama_pihak VARCHAR(191) NOT NULL DEFAULT '',
      nama_kunci VARCHAR(191) NOT NULL DEFAULT '',
      status VARCHAR(32) NOT NULL DEFAULT 'menunggu',
      ditanya_pada DATETIME NULL,
      dijawab_pada DATETIME NULL,
      jawaban_mentah VARCHAR(191) NOT NULL DEFAULT '',
      jumlah_ditanya INT NOT NULL DEFAULT 0,
      dilepas_oleh VARCHAR(191) NOT NULL DEFAULT '',
      dilepas_pada DATETIME NULL,
      updated_at DATETIME NOT NULL,
      UNIQUE KEY uq_abnt_nomor_nama (nomor, nama_kunci),
      INDEX idx_abnt_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Instalasi yang tabelnya sudah terbentuk sebelum kolom jejak ada tetap
  // mendapatkannya, karena CREATE TABLE IF NOT EXISTS tidak menyentuh tabel
  // yang sudah berdiri.
  await botDb.addColumnIfMissing("aleta_bot_nomor_terverifikasi", "dilepas_oleh", "VARCHAR(191) NOT NULL DEFAULT ''");
  await botDb.addColumnIfMissing("aleta_bot_nomor_terverifikasi", "dilepas_pada", "DATETIME NULL");

  schemaReady = true;
  return true;
}

/**
 * Kunci pencocokan nama.
 *
 * Verifikasi diikat pada pasangan NOMOR + NAMA, bukan nomor saja. Sebuah nomor
 * yang sudah terbukti milik Sulastri tetap boleh menerima dokumen perkara lain
 * selama pihaknya masih Sulastri - tetapi tidak otomatis dipercaya bila tiba-
 * tiba dipakai untuk pihak bernama lain.
 */
function namaKunci(nama) {
  return cleanText(nama)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalisasiNomor(nomor) {
  return normalizeIndonesianPhoneNumber(String(nomor || "").replace(/@c\.us$/i, ""));
}

/** Catatan verifikasi untuk satu pasangan nomor dan nama. */
async function getStatus(nomor, namaPihak) {
  await ensureSchema();
  const nomorBersih = normalisasiNomor(nomor);
  const kunci = namaKunci(namaPihak);
  if (!nomorBersih || !kunci) return null;

  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_nomor_terverifikasi WHERE nomor = ? AND nama_kunci = ? LIMIT 1`,
    [nomorBersih, kunci]
  );
  return rows[0] || null;
}

/** Kalimat tanya. Sengaja tidak menyebut perkara, dokumen, maupun pengadilan mana. */
function buildQuestion(namaPihak) {
  const nama = cleanText(namaPihak);
  return [
    `Assalamualaikum. Apakah benar ini nomor WhatsApp Sdr/i *${nama}*?`,
    "",
    "Balas *YA* bila benar.",
    "Balas *BUKAN* bila nomor ini bukan milik beliau.",
    "",
    "Pertanyaan ini dikirim untuk memastikan tidak ada surat yang salah alamat.",
    "Selama belum dijawab, tidak ada berkas yang dikirim ke nomor ini.",
  ].join("\n");
}

/**
 * Memastikan nomor sudah terverifikasi sebelum dokumen dikirim.
 *
 * Tidak mengirim apa pun sendiri. Bila pertanyaan perlu diajukan, pemanggil
 * diberi teksnya lewat `pertanyaan` dan bertanggung jawab mengirimnya - supaya
 * seluruh pengiriman tetap lewat satu pintu keluar yang sama.
 *
 * @returns {Promise<{ boleh: boolean, status: string, pertanyaan: string|null, alasan: string }>}
 */
async function ensureVerified(nomor, namaPihak) {
  await ensureSchema();
  const nomorBersih = normalisasiNomor(nomor);
  const kunci = namaKunci(namaPihak);

  if (!nomorBersih) return { boleh: false, status: "", pertanyaan: null, alasan: "nomor_tidak_sah" };
  if (!kunci) {
    // Tanpa nama, tidak ada yang bisa dikonfirmasi. Mengirim dokumen ke nomor
    // yang tidak diketahui pemiliknya persis risiko yang hendak dicegah.
    return { boleh: false, status: "", pertanyaan: null, alasan: "nama_pihak_tidak_diketahui" };
  }

  const catatan = await getStatus(nomorBersih, namaPihak);

  if (catatan && catatan.status === STATUS.TERVERIFIKASI) {
    return { boleh: true, status: STATUS.TERVERIFIKASI, pertanyaan: null, alasan: "" };
  }

  if (catatan && catatan.status === STATUS.DITOLAK) {
    return { boleh: false, status: STATUS.DITOLAK, pertanyaan: null, alasan: "nomor_dinyatakan_bukan_milik_pihak" };
  }

  // Sudah ditanya dan belum dijawab: diamkan sampai tenggang lewat, jangan
  // ditanya berulang-ulang setiap kali pekerja berjalan.
  if (catatan && catatan.ditanya_pada) {
    const jarak = Date.now() - new Date(catatan.ditanya_pada).getTime();
    if (jarak < ulangiSetelahMs()) {
      return { boleh: false, status: STATUS.MENUNGGU, pertanyaan: null, alasan: "menunggu_jawaban" };
    }
  }

  const sekarang = new Date();
  await botDb.query(
    `INSERT INTO aleta_bot_nomor_terverifikasi
       (id, nomor, nama_pihak, nama_kunci, status, ditanya_pada, jumlah_ditanya, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       ditanya_pada = VALUES(ditanya_pada),
       jumlah_ditanya = jumlah_ditanya + 1,
       updated_at = VALUES(updated_at)`,
    [
      crypto.randomUUID(),
      nomorBersih,
      cleanText(namaPihak).slice(0, 191),
      kunci.slice(0, 191),
      STATUS.MENUNGGU,
      botDb.toMysqlDate(sekarang),
      botDb.toMysqlDate(sekarang),
    ]
  );

  return {
    boleh: false,
    status: STATUS.MENUNGGU,
    pertanyaan: buildQuestion(namaPihak),
    alasan: "pertanyaan_dikirim",
  };
}

/**
 * Menangani jawaban atas pertanyaan verifikasi.
 *
 * Mengembalikan null bila pesan ini bukan jawaban verifikasi, sehingga alur
 * chat lain tetap mendapat gilirannya.
 */
async function handleReply({ senderNumber, text } = {}) {
  await ensureSchema();
  const nomor = normalisasiNomor(senderNumber);
  const jawaban = cleanText(text).toLowerCase();
  if (!nomor || !jawaban) return null;

  const adalahYa = JAWABAN_YA.has(jawaban);
  const adalahBukan = JAWABAN_BUKAN.has(jawaban);
  if (!adalahYa && !adalahBukan) return null;

  // Hanya bermakna bila memang ada pertanyaan yang sedang menunggu jawaban.
  // Tanpa penjagaan ini, kata "ya" dari siapa pun akan tertangkap di sini dan
  // tidak pernah sampai ke menu lain.
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_nomor_terverifikasi
      WHERE nomor = ? AND status = ?
      ORDER BY ditanya_pada DESC LIMIT 1`,
    [nomor, STATUS.MENUNGGU]
  );
  const catatan = rows[0];
  if (!catatan) return null;

  const status = adalahYa ? STATUS.TERVERIFIKASI : STATUS.DITOLAK;
  const sekarang = botDb.toMysqlDate(new Date());
  await botDb.query(
    `UPDATE aleta_bot_nomor_terverifikasi
        SET status = ?, dijawab_pada = ?, jawaban_mentah = ?, updated_at = ?
      WHERE id = ?`,
    [status, sekarang, cleanText(text).slice(0, 191), sekarang, catatan.id]
  );

  void logService.logSecurityEvent({
    eventType: adalahYa ? "nomor_terverifikasi" : "nomor_ditolak_pemilik",
    severity: adalahYa ? "info" : "warning",
    message: adalahYa
      ? "Pemilik nomor membenarkan identitasnya."
      : "Pemilik nomor menyatakan nomor ini bukan milik pihak yang dimaksud.",
    metadata: { namaPihak: catatan.nama_pihak, status },
  });

  if (adalahYa) {
    return {
      reply:
        "Terima kasih. Nomor ini sudah tercatat.\n\n" +
        "Pemberitahuan perkara akan dikirim ke nomor ini bila ada perkembangan.",
    };
  }

  return {
    reply:
      "Terima kasih atas koreksinya. Nomor ini tidak akan dikirimi berkas perkara.\n\n" +
      "Mohon maaf atas ketidaknyamanannya.",
  };
}

/**
 * Membatalkan catatan "sudah ditanya" ketika pertanyaannya gagal terkirim.
 *
 * ensureVerified mencatat waktu bertanya SEBELUM pesannya benar-benar masuk
 * antrean, karena pengirimannya dilakukan pemanggil. Bila pengiriman itu gagal
 * dan catatannya dibiarkan, nomor tersebut dianggap "sedang ditunggu" selama
 * tiga hari padahal pertanyaannya tidak pernah sampai - dan berkasnya menggantung
 * selama itu tanpa ada yang tahu sebabnya.
 */
async function markQuestionFailed(nomor, namaPihak) {
  await ensureSchema();
  const nomorBersih = normalisasiNomor(nomor);
  const kunci = namaKunci(namaPihak);
  if (!nomorBersih || !kunci) return false;

  await botDb.query(
    `UPDATE aleta_bot_nomor_terverifikasi
        SET ditanya_pada = NULL, updated_at = ?
      WHERE nomor = ? AND nama_kunci = ? AND status = ?`,
    [botDb.toMysqlDate(new Date()), nomorBersih, kunci, STATUS.MENUNGGU]
  );
  return true;
}

/**
 * Melepas nomor yang pernah dijawab BUKAN, supaya ditanya ulang.
 *
 * ============================================================================
 * KENAPA INI HARUS ADA
 * ============================================================================
 *
 * Tanpa fungsi ini, jawaban BUKAN mengunci pasangan nomor+nama SELAMANYA.
 * Petugas yang sudah memperbaiki data di SIPP tetap tidak bisa mengirim ke
 * nomor itu, dan satu-satunya jalan keluar adalah membuka database.
 *
 * Halaman panitera menampilkan daftarnya, jadi petugas MELIHAT masalahnya
 * tanpa bisa berbuat apa-apa - keadaan yang lebih menjengkelkan daripada
 * tidak menampilkannya sama sekali.
 *
 * Melepas TIDAK langsung mengizinkan pengiriman. Statusnya kembali ke
 * "menunggu" dengan pertanyaan yang belum diajukan, sehingga pemiliknya
 * ditanya sekali lagi dan tetap dialah yang menentukan. Petugas hanya boleh
 * membuka kesempatan bertanya, bukan memutuskan atas nama pemilik nomor.
 *
 * @returns {Promise<{ ok: boolean, alasan: string }>}
 */
async function resetNumber(nomor, namaPihak, { olehSiapa = "" } = {}) {
  await ensureSchema();
  const nomorBersih = normalisasiNomor(nomor);
  const kunci = namaKunci(namaPihak);
  if (!nomorBersih || !kunci) return { ok: false, alasan: "nomor_atau_nama_tidak_sah" };

  const catatan = await getStatus(nomorBersih, namaPihak);
  if (!catatan) return { ok: false, alasan: "catatan_tidak_ditemukan" };
  if (catatan.status !== STATUS.DITOLAK) {
    // Hanya yang berstatus ditolak yang perlu dilepas. Melepas nomor yang
    // sudah terverifikasi justru membuang kepercayaan yang sudah didapat.
    return { ok: false, alasan: "hanya_nomor_ditolak_yang_dapat_dilepas" };
  }

  const sekarang = botDb.toMysqlDate(new Date());
  await botDb.query(
    `UPDATE aleta_bot_nomor_terverifikasi
        SET status = ?, ditanya_pada = NULL, dijawab_pada = NULL, jawaban_mentah = '',
            dilepas_oleh = ?, dilepas_pada = ?, updated_at = ?
      WHERE id = ?`,
    [STATUS.MENUNGGU, cleanText(olehSiapa).slice(0, 191), sekarang, sekarang, catatan.id]
  );

  void logService.logSecurityEvent({
    eventType: "nomor_dilepas_untuk_ditanya_ulang",
    severity: "warning",
    message: "Nomor yang pernah dinyatakan salah alamat dilepas agar ditanya ulang.",
    metadata: {
      namaPihak: catatan.nama_pihak,
      olehSiapa: cleanText(olehSiapa),
      jawabanSebelumnya: catatan.jawaban_mentah || "",
    },
  });

  return { ok: true, alasan: "" };
}

/** Nomor yang pemiliknya menyatakan bukan pihak. Perlu diperbaiki petugas. */
async function listSalahAlamat({ limit = 100 } = {}) {
  await ensureSchema();
  const batas = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await botDb.query(
    `SELECT nomor, nama_pihak, dijawab_pada FROM aleta_bot_nomor_terverifikasi
      WHERE status = ? ORDER BY dijawab_pada DESC LIMIT ${batas}`,
    [STATUS.DITOLAK]
  );
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  STATUS,
  ULANGI_SETELAH_MS,
  ulangiSetelahMs,
  buildQuestion,
  ensureSchema,
  ensureVerified,
  getStatus,
  handleReply,
  listSalahAlamat,
  markQuestionFailed,
  resetNumber,
  namaKunci,
};
