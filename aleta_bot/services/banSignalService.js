"use strict";

/**
 * Berhenti total begitu WhatsApp menunjukkan tanda menandai akun.
 *
 * --- Masalah yang diselesaikan ---
 *
 * Sebelum ini, app.js memanggil reconnect() pada SETIAP peristiwa terputus,
 * termasuk ketika alasan terputusnya adalah TOS_BLOCK - yaitu WhatsApp
 * menyatakan akun melanggar ketentuan layanan. Menyambung ulang berkali-kali
 * setelah ditandai adalah hal terburuk yang bisa dilakukan: setiap percobaan
 * tercatat, dan suspend sementara berubah menjadi blokir permanen.
 *
 * --- Yang membedakan dua jenis terputus ---
 *
 * Tidak semua terputus berarti bahaya. Listrik padam, internet putus, dan
 * Chromium yang mati adalah kejadian biasa yang memang harus disambung ulang.
 * Yang tidak boleh disambung ulang adalah alasan yang menyebut AKUN:
 * dikeluarkan, tidak dipasangkan lagi, atau diblokir karena ketentuan layanan.
 *
 * Karena itu berkas ini memilah alasannya, bukan menghitung semuanya sama rata.
 *
 * --- Sikapnya sengaja tidak simetris ---
 *
 * Untuk tanda akun: BERHENTI SEKETIKA, satu kali saja sudah cukup. Menunggu
 * kejadian kedua berarti sengaja mengambil risiko yang sudah jelas.
 *
 * Untuk kegagalan yang samar (auth_failure): berhenti setelah beberapa kali
 * beruntun, karena sekali gagal masih mungkin sekadar sesi kedaluwarsa.
 *
 * Berhenti di sini berarti bot tidak menyambung ulang dan tidak mengirim apa
 * pun sampai ADMIN melepaskannya secara sadar. Itu disengaja: keputusan
 * menyalakan kembali nomor yang sedang ditandai harus diambil manusia yang
 * tahu keadaannya, bukan oleh pengatur waktu.
 */

const logService = require("./logService");

/**
 * Alasan terputus yang menyebut keadaan AKUN, bukan keadaan jaringan.
 *
 * Diambil dari whatsapp-web.js/src/util/Constants.js. Dicocokkan sebagai
 * potongan kata agar tetap dikenali walau pustakanya kelak menambah awalan
 * atau keterangan pada nilainya.
 */
const ACCOUNT_LEVEL_REASONS = [
  "TOS_BLOCK",
  "SMB_TOS_BLOCK",
  "PROXYBLOCK",
  "UNPAIRED",
  "UNPAIRED_IDLE",
  "LOGOUT",
  "BANNED",
  "BAN",
];

/** Alasan yang jelas-jelas soal jaringan/proses, bukan soal akun. */
const TRANSIENT_REASONS = ["NAVIGATION", "UNLAUNCHED", "CONFLICT", "DEPRECATED_VERSION"];

/** Berapa kali auth_failure beruntun sebelum bot berhenti sendiri. */
const AUTH_FAILURE_THRESHOLD = 3;

const state = {
  halted: false,
  haltedAt: null,
  haltReason: "",
  haltDetail: "",
  authFailureStreak: 0,
  lastSignalAt: null,
  signals: [],
};

/** Menyimpan sedikit riwayat untuk diagnosis, tanpa membiarkannya tumbuh. */
const MAX_SIGNAL_HISTORY = 20;

function normalize(value) {
  return String(value == null ? "" : value).trim().toUpperCase();
}

/**
 * Apakah alasan terputus ini menunjuk ke akun?
 *
 * Alasan KOSONG dianggap TIDAK menunjuk ke akun. Terputus tanpa keterangan
 * jauh lebih sering disebabkan jaringan, dan menghentikan seluruh layanan
 * pengadilan karena satu kedipan internet adalah kerugian yang lebih pasti
 * daripada risiko yang dihindarinya.
 */
function isAccountLevelReason(reason) {
  const teks = normalize(reason);
  if (!teks) return false;
  return ACCOUNT_LEVEL_REASONS.some((kata) => teks.includes(kata));
}

/**
 * Apakah alasan ini gangguan sementara yang wajar disambung ulang?
 *
 * Kebalikan langsung dari isAccountLevelReason: apa pun yang tidak menyebut
 * akun dianggap sementara. Daftar TRANSIENT_REASONS ada untuk keterbacaan dan
 * diagnosis - ia menyebutkan alasan yang sudah dikenal - tetapi sengaja TIDAK
 * dijadikan syarat, karena alasan yang belum pernah terlihat pun tidak boleh
 * menghentikan layanan pengadilan.
 */
function isTransientReason(reason) {
  return !isAccountLevelReason(reason);
}

function pushSignal(entry) {
  state.signals.push(entry);
  if (state.signals.length > MAX_SIGNAL_HISTORY) {
    state.signals.splice(0, state.signals.length - MAX_SIGNAL_HISTORY);
  }
  state.lastSignalAt = entry.at;
}

/**
 * Menghentikan bot dan mencatatnya sebagai peristiwa keamanan.
 *
 * Pencatatannya tidak ditunggu agar penghentian tidak ikut gagal bila
 * database sedang bermasalah - justru pada saat itulah penghentian paling
 * dibutuhkan.
 */
function halt(reason, detail = "") {
  if (state.halted) return getStatus();
  state.halted = true;
  state.haltedAt = new Date().toISOString();
  state.haltReason = String(reason || "tanda_blokir");
  state.haltDetail = String(detail || "");

  console.error(
    `[ALETA Bot] BERHENTI OTOMATIS: WhatsApp menandai akun (${state.haltReason}). ` +
      `Bot tidak akan menyambung ulang maupun mengirim pesan sampai dilepaskan admin dari portal.`
  );
  void logService.logSecurityEvent({
    eventType: "whatsapp_ban_signal_halt",
    severity: "critical",
    message:
      "Bot dihentikan otomatis karena WhatsApp menunjukkan tanda pemblokiran akun. " +
      "Jangan sambungkan ulang sebelum banding suspend selesai ditinjau.",
    metadata: { reason: state.haltReason, detail: state.haltDetail, haltedAt: state.haltedAt },
  });
  return getStatus();
}

/**
 * Melaporkan peristiwa terputus.
 *
 * @returns {{ halted: boolean, shouldReconnect: boolean, accountLevel: boolean }}
 */
function recordDisconnect(reason) {
  const accountLevel = isAccountLevelReason(reason);
  pushSignal({ type: "disconnected", reason: String(reason || ""), accountLevel, at: new Date().toISOString() });

  if (accountLevel) {
    halt("terputus_tingkat_akun", String(reason || ""));
    return { halted: true, shouldReconnect: false, accountLevel: true };
  }
  return { halted: state.halted, shouldReconnect: !state.halted, accountLevel: false };
}

/**
 * Melaporkan kegagalan autentikasi.
 *
 * @returns {{ halted: boolean, shouldReconnect: boolean, streak: number }}
 */
function recordAuthFailure(detail = "") {
  state.authFailureStreak += 1;
  pushSignal({
    type: "auth_failure",
    reason: String(detail || ""),
    streak: state.authFailureStreak,
    at: new Date().toISOString(),
  });

  if (state.authFailureStreak >= AUTH_FAILURE_THRESHOLD) {
    halt("gagal_autentikasi_beruntun", `${state.authFailureStreak}x: ${detail}`);
    return { halted: true, shouldReconnect: false, streak: state.authFailureStreak };
  }
  return { halted: state.halted, shouldReconnect: !state.halted, streak: state.authFailureStreak };
}

/**
 * Menandai bot berhasil tersambung.
 *
 * Hitungan gagal beruntun dinolkan, tetapi penghentian TIDAK dibatalkan.
 * Bot yang sudah dihentikan karena tanda blokir hanya boleh dinyalakan admin.
 */
function recordReady() {
  state.authFailureStreak = 0;
  return getStatus();
}

/** Apakah pengiriman sedang dihentikan karena tanda blokir? */
function isHalted() {
  return state.halted === true;
}

/** Melepaskan penghentian. Hanya dipanggil atas tindakan sadar admin. */
function release(actor = "admin") {
  if (!state.halted) return getStatus();
  const sebelumnya = { reason: state.haltReason, detail: state.haltDetail, haltedAt: state.haltedAt };
  state.halted = false;
  state.haltedAt = null;
  state.haltReason = "";
  state.haltDetail = "";
  state.authFailureStreak = 0;

  void logService.logSecurityEvent({
    eventType: "whatsapp_ban_signal_released",
    severity: "warning",
    message: "Penghentian otomatis karena tanda pemblokiran dilepaskan secara manual.",
    metadata: { ...sebelumnya, actor: String(actor || "admin") },
  });
  return getStatus();
}

/** Keadaan sekarang, untuk status layanan dan diagnosis. */
function getStatus() {
  return {
    halted: state.halted,
    haltedAt: state.haltedAt,
    haltReason: state.haltReason,
    haltDetail: state.haltDetail,
    authFailureStreak: state.authFailureStreak,
    authFailureThreshold: AUTH_FAILURE_THRESHOLD,
    lastSignalAt: state.lastSignalAt,
    recentSignals: state.signals.slice(-5),
  };
}

/** Mengosongkan seluruh keadaan. Dipakai pengujian. */
function resetForTest() {
  state.halted = false;
  state.haltedAt = null;
  state.haltReason = "";
  state.haltDetail = "";
  state.authFailureStreak = 0;
  state.lastSignalAt = null;
  state.signals = [];
}

module.exports = {
  ACCOUNT_LEVEL_REASONS,
  AUTH_FAILURE_THRESHOLD,
  TRANSIENT_REASONS,
  getStatus,
  halt,
  isAccountLevelReason,
  isHalted,
  isTransientReason,
  recordAuthFailure,
  recordDisconnect,
  recordReady,
  release,
  resetForTest,
};
