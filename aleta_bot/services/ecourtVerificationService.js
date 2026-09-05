"use strict";

/**
 * Verifikasi dokumen e-Court oleh hakim lewat WhatsApp — Tahap 5.
 *
 * ============================================================================
 * INI KEPUTUSAN HUKUM, BUKAN INFORMASI
 * ============================================================================
 *
 * Seluruh layanan ALETA sebelumnya hanya MENYAMPAIKAN. Berkas ini berbeda: ia
 * mencatat keputusan majelis hakim yang menentukan apakah sebuah Jawaban resmi
 * masuk berkas perkara atau tidak.
 *
 * Nomor WhatsApp bukan bukti identitas yang setara dengan login e-Court (email,
 * sandi, captcha). Nomor bisa berpindah SIM, ponsel bisa dipinjam, pesan bisa
 * terkirim tanpa sengaja. Untuk pemberitahuan, kesalahan seperti itu paling
 * buruk membuat pihak menerima pesan yang keliru. Untuk verifikasi, kesalahan
 * yang sama bisa membuat dokumen resmi tercatat salah pada perkara sungguhan.
 *
 * Karena itu SELURUH penjagaan di sini bersifat GAGAL-TERTUTUP - kebalikan dari
 * seluruh layanan lain di ALETA. Bila ada yang tidak dapat dipastikan, jawaban
 * bakunya adalah MENOLAK.
 *
 * ============================================================================
 * TAHAP INI BELUM MENYENTUH e-COURT
 * ============================================================================
 *
 * Keputusan yang tercatat di sini hanya tersimpan di database ALETA. Meneruskan
 * ke kotak dialog e-Court yang sesungguhnya adalah Tahap 6, dan sengaja
 * dipisahkan supaya bentuk alurnya dapat dilihat lebih dulu sebelum sistem
 * resmi disentuh.
 */

const crypto = require("crypto");

const { readRuntimeConfig } = require("../config/runtime-config");
const db = require("../db_config");
const botDb = require("./botDbService");
const logService = require("./logService");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtDocumentService = require("./ecourtDocumentService");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");
const { normalizeLegacyEmployeeName } = require("./employeeNameUtil");
const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");

/** Berapa lama satu sesi verifikasi terbuka sebelum hangus sendiri. */
const SESSION_TTL_MS = Number(process.env.ALETA_BOT_ECOURT_VERIFY_TTL_MS || 10 * 60 * 1000);
/** Kata yang membuka menu verifikasi. */
const VERIFY_KEYWORDS = new Set(["verifikasi", "verifikasi dokumen", "periksa dokumen"]);
/** Kata konfirmasi akhir. Sengaja panjang dan tidak mungkin terketik tanpa sengaja. */
const CONFIRM_VALID = "SAYA SETUJU VALID";
const CONFIRM_INVALID = "SAYA SETUJU TIDAK VALID";

let schemaReady = false;

/** Sesi percakapan verifikasi, per nomor WhatsApp. */
const sessions = new Map();

function getSession(chatId) {
  const sesi = sessions.get(chatId);
  if (!sesi) return null;
  if (sesi.expiresAt <= Date.now()) {
    sessions.delete(chatId);
    return null;
  }
  return sesi;
}

function setSession(chatId, state) {
  sessions.set(chatId, { ...state, expiresAt: Date.now() + SESSION_TTL_MS });
}

function clearSession(chatId) {
  sessions.delete(chatId);
}

function clearAllSessions() {
  sessions.clear();
}

async function ensureSchema() {
  if (schemaReady) return true;
  const siap = await ecourtStoreService.ensureSchema();
  if (!siap) return false;

  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_verifications (
      id VARCHAR(64) PRIMARY KEY,
      document_key VARCHAR(191) NOT NULL,
      nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
      judul_dokumen VARCHAR(255) NOT NULL DEFAULT '',
      nomor_hakim VARCHAR(64) NOT NULL DEFAULT '',
      nama_hakim VARCHAR(191) NOT NULL DEFAULT '',
      keputusan VARCHAR(32) NOT NULL DEFAULT '',
      keterangan TEXT,
      diputuskan_pada DATETIME NOT NULL,
      diteruskan_pada DATETIME NULL,
      hasil_penerusan VARCHAR(191) NOT NULL DEFAULT '',
      UNIQUE KEY uq_abev_dokumen (document_key),
      INDEX idx_abev_penerusan (diteruskan_pada)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  schemaReady = true;
  return true;
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Apakah teks ini membuka menu verifikasi? */
function isVerifyKeyword(text) {
  return VERIFY_KEYWORDS.has(cleanText(text).toLowerCase());
}

/**
 * Mengenali hakim dari nomor WhatsApp pengirim.
 *
 * GAGAL-TERTUTUP. Nomor yang tidak terdaftar di direktori pegawai, atau
 * terdaftar tetapi bukan sebagai hakim, mengembalikan null - dan pemanggil
 * harus memperlakukan null sebagai penolakan, bukan sebagai "belum tahu".
 *
 * Peran diperiksa dari role maupun nama jabatan, karena Ketua dan Wakil Ketua
 * pengadilan juga bersidang sebagai hakim.
 */
function identifyJudge(senderNumber, runtimeConfig = readRuntimeConfig()) {
  const nomor = normalizeIndonesianPhoneNumber(String(senderNumber || "").replace(/@c\.us$/i, ""));
  if (!nomor) return null;

  const daftar = Array.isArray(runtimeConfig.employeeRecipients) ? runtimeConfig.employeeRecipients : [];
  for (const pegawai of daftar) {
    const nomorPegawai = normalizeIndonesianPhoneNumber(
      String(pegawai.whatsappNumber || pegawai.whatsapp_number || pegawai.whatsappChatId || pegawai.whatsapp_chat_id || "")
        .replace(/@c\.us$/i, "")
    );
    if (!nomorPegawai || nomorPegawai !== nomor) continue;

    const peran = `${pegawai.roleId || pegawai.role_id || ""} ${pegawai.positionName || pegawai.position_name || ""}`.toLowerCase();
    if (!/hakim|ketua/.test(peran)) return null;

    return {
      nomor,
      nama: cleanText(pegawai.name || pegawai.nama || ""),
      namaPencarian: normalizeLegacyEmployeeName(pegawai.name || pegawai.nama || ""),
      jabatan: cleanText(pegawai.positionName || pegawai.position_name || ""),
    };
  }
  return null;
}

/**
 * Apakah hakim ini benar-benar duduk pada majelis perkara tersebut?
 *
 * Inilah penjagaan terpenting di seluruh berkas ini. Hakim lain - sekalipun
 * terdaftar sah di ALETA - tidak boleh memverifikasi perkara yang bukan
 * miliknya.
 *
 * Pencocokan nama memakai nama TANPA GELAR di kedua sisi, karena direktori
 * ALETA menyimpan nama bergelar ("DERRY BRIANTONO, S.H.") sedangkan SIPP
 * menyimpan bentuk yang berbeda-beda. Pencocokan dilakukan pada nama utuh,
 * bukan potongan: mencocokkan sebagian nama berisiko meloloskan hakim lain
 * yang namanya beririsan.
 *
 * @returns {Promise<{ anggota: boolean, alasan: string, majelis: string[] }>}
 */
async function isOnPanel(nomorPerkara, namaPencarian) {
  const nama = cleanText(namaPencarian);
  if (!nama) return { anggota: false, alasan: "nama_hakim_kosong", majelis: [] };

  let rows;
  try {
    rows = await runQuery(
      `SELECT hkpn.nama_gelar AS nama_gelar
         FROM perkara AS p
         JOIN perkara_hakim_pn AS hk ON hk.perkara_id = p.perkara_id AND hk.aktif = 'Y'
         LEFT JOIN hakim_pn AS hkpn ON hkpn.id = hk.hakim_id
        WHERE p.nomor_perkara = ?
        ORDER BY hk.urutan ASC`,
      [normalizeCaseNumber(nomorPerkara)]
    );
  } catch (error) {
    // GAGAL-TERTUTUP: SIPP tidak terbaca berarti keanggotaan majelis tidak
    // dapat dipastikan, dan yang tidak dapat dipastikan harus ditolak.
    return { anggota: false, alasan: `sipp_tidak_terbaca: ${error.message}`, majelis: [] };
  }

  const majelis = rows.map((row) => cleanText(row.nama_gelar)).filter(Boolean);
  if (majelis.length === 0) return { anggota: false, alasan: "majelis_belum_ditetapkan", majelis: [] };

  const dicari = nama.toLowerCase();
  const cocok = majelis.some((anggota) => normalizeLegacyEmployeeName(anggota).toLowerCase() === dicari);

  return {
    anggota: cocok,
    alasan: cocok ? "" : "bukan_anggota_majelis",
    majelis,
  };
}

/**
 * Dokumen yang menunggu diverifikasi pada perkara yang ditangani hakim ini.
 *
 * Hanya dokumen berstatus "belum" yang ditampilkan - yang sudah diverifikasi
 * tidak perlu diverifikasi lagi lewat jalur ini.
 */
async function listPendingForJudge(hakim, { limit = 10 } = {}) {
  await ensureSchema();
  const batas = Math.max(1, Math.min(50, Number(limit) || 10));

  const rows = await botDb.query(
    `SELECT d.* FROM aleta_bot_ecourt_documents d
      LEFT JOIN aleta_bot_ecourt_verifications v ON v.document_key = d.document_key
      WHERE d.status_verifikasi = 'belum'
        AND v.id IS NULL
      ORDER BY d.diunggah_pada ASC
      LIMIT ${batas * 5}`
  );

  // Penyaringan keanggotaan majelis dilakukan PER PERKARA di sini, bukan di
  // dalam SQL, karena daftar dokumen ada di database ALETA sedangkan susunan
  // majelis ada di SIPP - dua database berbeda yang tidak bisa di-join.
  const hasil = [];
  const sudahDiperiksa = new Map();

  for (const dokumen of rows) {
    if (hasil.length >= batas) break;
    const nomorPerkara = String(dokumen.nomor_perkara || "");
    if (!nomorPerkara) continue;

    if (!sudahDiperiksa.has(nomorPerkara)) {
      sudahDiperiksa.set(nomorPerkara, await isOnPanel(nomorPerkara, hakim.namaPencarian));
    }
    const panel = sudahDiperiksa.get(nomorPerkara);
    if (panel.anggota) hasil.push(dokumen);
  }

  return hasil;
}

/** Menyimpan keputusan hakim. Hanya dipanggil setelah seluruh penjagaan lolos. */
async function recordDecision({ dokumen, hakim, keputusan, keterangan = "" }) {
  // Berkas pendaftaran TIDAK dapat diverifikasi.
  //
  // Dokumen bukti, gugatan, dan surat kuasa tidak mengenal verifikasi
  // majelis di e-Court - tidak ada tombolnya di sana, dan tidak ada
  // keputusan yang ditunggu. Mencatat verifikasi atasnya menghasilkan
  // keputusan hukum yang tidak punya padanan di sistem resmi.
  //
  // Ekstensi memang sudah tidak menampilkan tombolnya, tetapi menyembunyikan
  // tombol bukan penjagaan: permintaan yang disusun sendiri tetap sampai ke
  // sini. Penjagaan yang sesungguhnya ada di titik penyimpanan, seperti
  // pemeriksaan keanggotaan majelis.
  //
  // Diperiksa SEBELUM menyentuh database: yang ditolak tidak perlu membuka
  // koneksi, dan penolakannya dapat diuji tanpa database sama sekali.
  if (String(dokumen && dokumen.status_verifikasi) === "tidak_perlu") {
    const galat = new Error("dokumen_tidak_mengenal_verifikasi");
    galat.tidakPerluVerifikasi = true;
    throw galat;
  }

  await ensureSchema();
  const sekarang = new Date();

  // ==========================================================================
  // KEPUTUSAN YANG SUDAH SAMPAI KE e-COURT TIDAK DAPAT DITIMPA DI SINI
  // ==========================================================================
  //
  // Barisnya berkunci unik per dokumen, dan penyimpanannya menimpa isi yang
  // lama. Selama keputusannya masih mengantre, menimpa memang benar - hakim
  // boleh berubah pikiran sebelum apa pun dikirim.
  //
  // Sesudah diteruskan, tidak. e-Court sudah memegang keputusan yang lama dan
  // tidak ada yang akan mengiriminya yang baru: penerusan hanya mengambil
  // baris yang diteruskan_pada-nya masih kosong, dan menimpa tidak
  // mengosongkannya kembali. Yang tertinggal adalah ALETA menyebut satu
  // keputusan sementara sistem resmi memuat keputusan yang lain - selisih yang
  // tidak terlihat oleh siapa pun, pada catatan yang paling tidak boleh
  // berselisih.
  //
  // Membatalkan keputusan yang sudah terkirim adalah pekerjaan manusia di
  // e-Court, bukan pekerjaan yang boleh dikerjakan diam-diam dari sini.
  const sebelumnya = await botDb.query(
    `SELECT keputusan, nama_hakim, diteruskan_pada
       FROM aleta_bot_ecourt_verifications WHERE document_key = ? LIMIT 1`,
    [String(dokumen.document_key || "")]
  );
  const lama = Array.isArray(sebelumnya) ? sebelumnya[0] : null;

  if (lama && lama.diteruskan_pada) {
    void logService.logSecurityEvent({
      eventType: "ecourt_verification_denied",
      severity: "warning",
      message: "Keputusan verifikasi yang sudah diteruskan ke e-Court ditolak untuk diubah.",
      metadata: {
        documentKey: dokumen.document_key,
        nomorPerkara: dokumen.nomor_perkara,
        keputusanLama: String(lama.keputusan || ""),
        keputusanBaru: keputusan,
        hakimLama: String(lama.nama_hakim || ""),
        hakimBaru: hakim.nama,
      },
    });
    const galat = new Error("keputusan_sudah_diteruskan");
    galat.sudahDiteruskan = true;
    throw galat;
  }

  // Masih mengantre: boleh diubah, tetapi TIDAK diam-diam. Keputusan yang
  // berganti - apalagi oleh hakim yang berbeda - adalah hal yang harus dapat
  // ditelusuri sesudahnya.
  if (lama) {
    void logService.logSecurityEvent({
      eventType: "ecourt_verification_recorded",
      severity: "warning",
      message: "Keputusan verifikasi yang belum diteruskan diubah.",
      metadata: {
        documentKey: dokumen.document_key,
        nomorPerkara: dokumen.nomor_perkara,
        keputusanLama: String(lama.keputusan || ""),
        keputusanBaru: keputusan,
        hakimLama: String(lama.nama_hakim || ""),
        hakimBaru: hakim.nama,
      },
    });
  }

  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_verifications
       (id, document_key, nomor_perkara, judul_dokumen, nomor_hakim, nama_hakim, keputusan, keterangan, diputuskan_pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       keputusan = VALUES(keputusan),
       keterangan = VALUES(keterangan),
       nomor_hakim = VALUES(nomor_hakim),
       nama_hakim = VALUES(nama_hakim),
       diputuskan_pada = VALUES(diputuskan_pada)`,
    [
      crypto.randomUUID(),
      String(dokumen.document_key || ""),
      String(dokumen.nomor_perkara || ""),
      String(dokumen.judul_dokumen || ""),
      hakim.nomor,
      hakim.nama,
      keputusan,
      cleanText(keterangan).slice(0, 1000),
      botDb.toMysqlDate(sekarang),
    ]
  );

  // Jejak keamanan wajib: keputusan hukum harus punya rekam siapa, kapan, apa.
  void logService.logSecurityEvent({
    eventType: "ecourt_verification_recorded",
    severity: "warning",
    message: `Hakim memutuskan dokumen e-Court: ${keputusan}.`,
    metadata: {
      documentKey: dokumen.document_key,
      nomorPerkara: dokumen.nomor_perkara,
      judulDokumen: dokumen.judul_dokumen,
      namaHakim: hakim.nama,
      keputusan,
      diputuskanPada: sekarang.toISOString(),
    },
  });
}

/** Keputusan yang belum diteruskan ke e-Court. Dipakai Tahap 6. */
async function listPendingForward({ limit = 50 } = {}) {
  await ensureSchema();
  const batas = Math.max(1, Math.min(200, Number(limit) || 50));
  const rows = await botDb.query(
    `SELECT v.*, d.sumber_url
       FROM aleta_bot_ecourt_verifications v
       LEFT JOIN aleta_bot_ecourt_documents d ON d.document_key = v.document_key
      WHERE v.diteruskan_pada IS NULL
      ORDER BY v.diputuskan_pada ASC
      LIMIT ${batas}`
  );
  return Array.isArray(rows) ? rows : [];
}

/** Menandai keputusan sudah diteruskan ke e-Court. */
async function markForwarded(documentKey, hasil) {
  await ensureSchema();
  await botDb.query(
    `UPDATE aleta_bot_ecourt_verifications
        SET diteruskan_pada = ?, hasil_penerusan = ?
      WHERE document_key = ?`,
    [botDb.toMysqlDate(new Date()), cleanText(hasil).slice(0, 191), String(documentKey || "")]
  );
}

/**
 * Mengenali hakim dari NAMA, untuk jalur portal.
 *
 * ============================================================================
 * KENAPA NAMA, DAN APA BATASNYA
 * ============================================================================
 *
 * Jalur WhatsApp mengenali hakim dari nomor pengirim - sesuatu yang tidak bisa
 * dipalsukan pemanggil. Jalur portal berbeda: identitas sudah dipastikan lebih
 * dulu oleh portal (login, sesi, akun aktif), lalu namanya diteruskan ke sini
 * lewat gerbang internal yang menuntut token.
 *
 * Artinya kepercayaan di sini bersandar pada DUA hal: token gerbang internal,
 * dan autentikasi portal. Nama saja tidak pernah cukup - dan karena itu
 * pemeriksaan berikutnya tetap dijalankan utuh:
 *
 *   1. Nama harus terdaftar di direktori pegawai SEBAGAI HAKIM.
 *   2. Hakim itu harus duduk pada majelis perkara yang bersangkutan.
 *
 * Keduanya sama persis dengan jalur WhatsApp. Portal tidak mendapat kelonggaran
 * apa pun; ia hanya masuk lewat pintu yang berbeda.
 */
function identifyJudgeByName(namaLengkap, runtimeConfig = readRuntimeConfig()) {
  const dicari = normalizeLegacyEmployeeName(namaLengkap).toLowerCase();
  if (!dicari) return null;

  const daftar = Array.isArray(runtimeConfig.employeeRecipients) ? runtimeConfig.employeeRecipients : [];
  for (const pegawai of daftar) {
    const namaPegawai = normalizeLegacyEmployeeName(pegawai.name || pegawai.nama || "").toLowerCase();
    if (!namaPegawai || namaPegawai !== dicari) continue;

    const peran = `${pegawai.roleId || pegawai.role_id || ""} ${pegawai.positionName || pegawai.position_name || ""}`.toLowerCase();
    if (!/hakim|ketua/.test(peran)) return null;

    return {
      nomor: String(pegawai.whatsappNumber || pegawai.whatsapp_number || "").replace(/@c\.us$/i, ""),
      nama: cleanText(pegawai.name || pegawai.nama || ""),
      namaPencarian: normalizeLegacyEmployeeName(pegawai.name || pegawai.nama || ""),
      jabatan: cleanText(pegawai.positionName || pegawai.position_name || ""),
    };
  }
  return null;
}

/**
 * Daftar dokumen menunggu untuk hakim yang membuka portal.
 *
 * @returns {Promise<{ ok: boolean, alasan: string, hakim: object|null, dokumen: Array }>}
 */
async function listForPortal(namaLengkap, { limit = 50, runtimeConfig = readRuntimeConfig() } = {}) {
  const hakim = identifyJudgeByName(namaLengkap, runtimeConfig);
  if (!hakim) {
    void logService.logSecurityEvent({
      eventType: "ecourt_verification_denied",
      severity: "warning",
      message: "Daftar verifikasi portal diminta oleh akun yang bukan hakim terdaftar.",
      metadata: { alasan: "bukan_hakim_terdaftar", jalur: "portal" },
    });
    return { ok: false, alasan: "bukan_hakim_terdaftar", hakim: null, dokumen: [] };
  }

  const dokumen = await listPendingForJudge(hakim, { limit });
  return {
    ok: true,
    alasan: "",
    hakim: { nama: hakim.nama, jabatan: hakim.jabatan },
    dokumen: dokumen.map((item) => ({
      documentKey: item.document_key,
      nomorPerkara: item.nomor_perkara,
      judulDokumen: item.judul_dokumen,
      peranPengunggah: item.peran_pengunggah,
      diunggahPada: item.diunggah_pada,
      agenda: item.agenda,
      batasUnggahTeks: item.batas_unggah_teks,
      adaBerkas: Boolean(item.berkas_pdf || item.berkas_word),
      sumberUrl: item.sumber_url,
    })),
  };
}

/**
 * Menyimpan keputusan dari portal.
 *
 * Seluruh penjagaan jalur WhatsApp berlaku sama di sini, termasuk pemeriksaan
 * keanggotaan majelis TEPAT SEBELUM menyimpan - bukan hanya saat daftar dibuat.
 *
 * Konfirmasi eksplisit tetap dituntut. Di WhatsApp bentuknya kalimat panjang;
 * di portal bentuknya `konfirmasi: true` yang hanya dikirim setelah petugas
 * menekan tombol kedua. Tanpa itu, keputusan TIDAK tersimpan.
 */
async function decideFromPortal({
  namaLengkap,
  documentKey,
  keputusan,
  konfirmasi = false,
  keterangan = "",
  runtimeConfig = readRuntimeConfig(),
} = {}) {
  if (keputusan !== "valid" && keputusan !== "tidak_valid") {
    return { ok: false, alasan: "keputusan_tidak_dikenali" };
  }
  if (konfirmasi !== true) {
    return { ok: false, alasan: "konfirmasi_belum_diberikan" };
  }

  const hakim = identifyJudgeByName(namaLengkap, runtimeConfig);
  if (!hakim) {
    void logService.logSecurityEvent({
      eventType: "ecourt_verification_denied",
      severity: "warning",
      message: "Keputusan verifikasi portal ditolak: akun bukan hakim terdaftar.",
      metadata: { alasan: "bukan_hakim_terdaftar", jalur: "portal" },
    });
    return { ok: false, alasan: "bukan_hakim_terdaftar" };
  }

  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`,
    [String(documentKey || "")]
  );
  const dokumen = rows[0];
  if (!dokumen) return { ok: false, alasan: "dokumen_tidak_ditemukan" };

  const panel = await isOnPanel(dokumen.nomor_perkara, hakim.namaPencarian);
  if (!panel.anggota) {
    void logService.logSecurityEvent({
      eventType: "ecourt_verification_denied",
      severity: "warning",
      message: "Hakim mencoba memverifikasi perkara di luar majelisnya lewat portal.",
      metadata: { nomorPerkara: dokumen.nomor_perkara, namaHakim: hakim.nama, alasan: panel.alasan, jalur: "portal" },
    });
    return { ok: false, alasan: "bukan_anggota_majelis" };
  }

  // Penolakan yang disengaja dijawab dengan sebabnya, bukan dilepas menjadi
  // galat 500. Petugas yang menerima "terjadi kesalahan" akan mencoba lagi;
  // yang menerima "sudah diteruskan ke e-Court" tahu bahwa yang tersisa adalah
  // pekerjaan di e-Court, bukan di sini.
  try {
    await recordDecision({ dokumen, hakim, keputusan, keterangan });
  } catch (galat) {
    if (galat && galat.sudahDiteruskan) return { ok: false, alasan: "keputusan_sudah_diteruskan" };
    if (galat && galat.tidakPerluVerifikasi) {
      return { ok: false, alasan: "dokumen_tidak_mengenal_verifikasi" };
    }
    throw galat;
  }

  return {
    ok: true,
    alasan: "",
    keputusan,
    nomorPerkara: dokumen.nomor_perkara,
    judulDokumen: dokumen.judul_dokumen,
  };
}

/**
 * Menangani satu pesan masuk dari hakim.
 *
 * Mengembalikan null bila pesan ini bukan untuk menu verifikasi, sehingga
 * penangan chat lain tetap mendapat gilirannya.
 *
 * @returns {Promise<{ reply: string, attachment?: object }|null>}
 */
async function handleMessage({ senderNumber, text, runtimeConfig = readRuntimeConfig() } = {}) {
  const chatId = String(senderNumber || "");
  const pesan = cleanText(text);
  const sesi = getSession(chatId);

  // Pesan hanya diproses bila memang membuka menu, atau sedang ada sesi
  // terbuka. Tanpa ini, setiap angka yang diketik siapa pun akan tertangkap.
  if (!isVerifyKeyword(pesan) && !sesi) return null;

  const hakim = identifyJudge(chatId, runtimeConfig);
  if (!hakim) {
    clearSession(chatId);
    void logService.logSecurityEvent({
      eventType: "ecourt_verification_denied",
      severity: "warning",
      message: "Menu verifikasi e-Court diminta oleh nomor yang bukan hakim terdaftar.",
      metadata: { alasan: "bukan_hakim_terdaftar" },
    });
    return {
      reply:
        "Menu verifikasi dokumen hanya dapat dipakai hakim yang menangani perkara.\n\n" +
        "Bila Anda hakim dan nomor ini belum terdaftar, hubungi admin portal ALETA.",
    };
  }

  // --- Membuka menu ---
  if (isVerifyKeyword(pesan)) {
    let daftar;
    try {
      daftar = await listPendingForJudge(hakim);
    } catch (error) {
      return { reply: `Daftar dokumen belum dapat dibaca saat ini (${error.message}). Silakan coba lagi beberapa saat lagi.` };
    }

    if (daftar.length === 0) {
      clearSession(chatId);
      return {
        reply: `Tidak ada dokumen yang menunggu verifikasi pada perkara yang ${hakim.nama} tangani.`,
      };
    }

    setSession(chatId, { tahap: "pilih", daftar: daftar.map((item) => item.document_key) });
    const baris = daftar.map((item, index) => {
      const nomor = index + 1;
      return `${nomor}. ${cleanText(item.judul_dokumen) || "Dokumen"}\n   Perkara ${cleanText(item.nomor_perkara)} · dari ${cleanText(item.peran_pengunggah) || "pihak"}`;
    });

    return {
      reply:
        `Dokumen menunggu verifikasi (${daftar.length}):\n\n${baris.join("\n\n")}\n\n` +
        `Balas dengan nomor untuk membaca dokumennya.\n` +
        `Balas BATAL untuk menutup menu.`,
    };
  }

  if (cleanText(pesan).toUpperCase() === "BATAL") {
    clearSession(chatId);
    return { reply: "Menu verifikasi ditutup. Tidak ada keputusan yang tersimpan." };
  }

  // --- Memilih dokumen ---
  if (sesi.tahap === "pilih") {
    const pilihan = Number(pesan);
    if (!Number.isInteger(pilihan) || pilihan < 1 || pilihan > sesi.daftar.length) {
      return { reply: `Pilihan tidak dikenali. Balas angka 1 sampai ${sesi.daftar.length}, atau BATAL.` };
    }

    const documentKey = sesi.daftar[pilihan - 1];
    const rows = await botDb.query(
      `SELECT * FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`,
      [documentKey]
    );
    const dokumen = rows[0];
    if (!dokumen) {
      clearSession(chatId);
      return { reply: "Dokumen tidak ditemukan lagi. Ketik verifikasi untuk membuka daftar terbaru." };
    }

    // Penjagaan keanggotaan majelis DIPERIKSA ULANG di sini, tidak cukup
    // mengandalkan penyaringan saat daftar dibuat. Susunan majelis bisa
    // berubah di antara saat daftar ditampilkan dan saat dokumen dipilih.
    const panel = await isOnPanel(dokumen.nomor_perkara, hakim.namaPencarian);
    if (!panel.anggota) {
      clearSession(chatId);
      void logService.logSecurityEvent({
        eventType: "ecourt_verification_denied",
        severity: "warning",
        message: "Hakim mencoba memverifikasi perkara di luar majelisnya.",
        metadata: { nomorPerkara: dokumen.nomor_perkara, namaHakim: hakim.nama, alasan: panel.alasan },
      });
      return { reply: "Anda tidak tercatat sebagai majelis pada perkara tersebut, sehingga dokumennya tidak dapat diverifikasi dari sini." };
    }

    const berkas = ecourtDocumentService.pickBestAttachment({
      berkasPdf: dokumen.berkas_pdf,
      berkasWord: dokumen.berkas_word,
    });

    setSession(chatId, { tahap: "putuskan", documentKey });

    const keterangan = [
      `Dokumen: ${cleanText(dokumen.judul_dokumen)}`,
      `Perkara: ${cleanText(dokumen.nomor_perkara)}`,
      `Diunggah oleh: ${cleanText(dokumen.peran_pengunggah) || "tidak diketahui"}`,
      dokumen.diunggah_pada ? `Waktu unggah: ${new Date(dokumen.diunggah_pada).toLocaleString("id-ID")}` : "",
      "",
      berkas.ok
        ? "Berkasnya dilampirkan pada pesan ini. Mohon dibaca lebih dulu."
        : `Berkasnya belum dapat dilampirkan (${berkas.reason}). Mohon dibuka melalui e-Court sebelum memutuskan.`,
      "",
      "Setelah membaca, balas:",
      `- ${CONFIRM_VALID}`,
      `- ${CONFIRM_INVALID}`,
      "",
      "Balas BATAL untuk membatalkan tanpa menyimpan keputusan.",
    ].filter((baris) => baris !== null);

    return {
      reply: keterangan.join("\n"),
      attachment: berkas.ok
        ? { source: berkas.absolutePath, name: berkas.fileName, kind: "ecourt_document", required: false }
        : null,
    };
  }

  // --- Memutuskan ---
  if (sesi.tahap === "putuskan") {
    const jawaban = cleanText(pesan).toUpperCase();
    // Kalimat konfirmasi sengaja panjang dan harus PERSIS. Balasan pendek
    // seperti "1" atau "ya" tidak diterima, supaya jempol yang salah pencet
    // tidak pernah menghasilkan keputusan hukum.
    const keputusan = jawaban === CONFIRM_VALID ? "valid" : jawaban === CONFIRM_INVALID ? "tidak_valid" : null;

    if (!keputusan) {
      return {
        reply:
          "Keputusan belum tersimpan karena balasannya tidak persis.\n\n" +
          `Balas tepat: ${CONFIRM_VALID}\n` +
          `atau: ${CONFIRM_INVALID}\n\n` +
          "Balas BATAL untuk membatalkan.",
      };
    }

    const rows = await botDb.query(
      `SELECT * FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`,
      [sesi.documentKey]
    );
    const dokumen = rows[0];
    if (!dokumen) {
      clearSession(chatId);
      return { reply: "Dokumen tidak ditemukan lagi. Keputusan tidak tersimpan." };
    }

    // Penjagaan terakhir, tepat sebelum menyimpan.
    const panel = await isOnPanel(dokumen.nomor_perkara, hakim.namaPencarian);
    if (!panel.anggota) {
      clearSession(chatId);
      return { reply: "Keputusan tidak tersimpan: Anda tidak tercatat sebagai majelis pada perkara tersebut." };
    }

    try {
      await recordDecision({ dokumen, hakim, keputusan });
    } catch (galat) {
      clearSession(chatId);
      if (galat && galat.sudahDiteruskan) {
        return {
          reply:
            "Keputusan TIDAK diubah: keputusan atas dokumen ini sudah diteruskan ke e-Court.\n\n" +
            "Perubahan sesudah penerusan harus dikerjakan langsung di e-Court oleh petugas, " +
            "supaya catatan ALETA dan e-Court tidak berselisih.",
        };
      }
      if (galat && galat.tidakPerluVerifikasi) {
        return { reply: "Dokumen ini tidak mengenal verifikasi majelis di e-Court. Keputusan tidak tersimpan." };
      }
      throw galat;
    }
    clearSession(chatId);

    return {
      reply:
        `Keputusan tersimpan: *${keputusan === "valid" ? "VALID" : "TIDAK VALID"}*\n\n` +
        `Dokumen: ${cleanText(dokumen.judul_dokumen)}\n` +
        `Perkara: ${cleanText(dokumen.nomor_perkara)}\n\n` +
        "Keputusan ini tercatat di ALETA dan menunggu diteruskan ke e-Court oleh petugas. " +
        "Status di e-Court belum berubah sampai penerusan itu dilakukan.",
    };
  }

  clearSession(chatId);
  return null;
}

module.exports = {
  CONFIRM_INVALID,
  CONFIRM_VALID,
  SESSION_TTL_MS,
  clearAllSessions,
  clearSession,
  ensureSchema,
  handleMessage,
  identifyJudge,
  identifyJudgeByName,
  listForPortal,
  decideFromPortal,
  isOnPanel,
  isVerifyKeyword,
  listPendingForJudge,
  listPendingForward,
  markForwarded,
  recordDecision,
};
