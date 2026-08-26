"use strict";

/**
 * Membatasi jumlah kiriman harian secara bertahap setelah nomor bermasalah.
 *
 * --- Kapan ini dipakai ---
 *
 * Nomor yang baru pulih dari suspend, atau nomor yang baru pertama kali dipakai
 * bot, tidak boleh langsung mengirim ratusan pesan sehari. Akun yang tiba-tiba
 * melonjak dari nol ke volume penuh adalah pola yang paling khas dari nomor
 * yang dibeli untuk mengirim massal - dan itu justru yang membuat suspend
 * kedua datang lebih cepat daripada yang pertama.
 *
 * --- Bagaimana bentuknya ---
 *
 * Mulai dari batas kecil, naik dua kali lipat setiap beberapa hari, sampai
 * mencapai batas penuh sekitar dua minggu. Kenaikan bertahap menyerupai layanan
 * yang penggunanya bertambah, bukan mesin yang dinyalakan sekaligus.
 *
 * Contoh dengan bawaan (mulai 30, lipat dua tiap 3 hari, batas 200):
 *
 *   Hari 1-3    : 30 pesan/hari
 *   Hari 4-6    : 60
 *   Hari 7-9    : 120
 *   Hari 10-12  : 200  (sudah menyentuh batas penuh)
 *   Hari 13+    : selesai, pembatasan dilepas sendiri
 *
 * --- Yang TIDAK dibatasi ---
 *
 * Balasan chat, pesan manual, dan pesan sistem tidak pernah ikut dibatasi.
 * Pemanasan mengendalikan pesan yang BOT MULAI SENDIRI, sedangkan menjawab
 * orang yang bertanya justru memperkuat kesan akun yang wajar. Membatasi
 * balasan akan merugikan dua kali: layanannya memburuk, dan akunnya makin
 * terlihat satu arah.
 */

const botDb = require("./botDbService");
const logService = require("./logService");
const { readRuntimeConfig } = require("../config/runtime-config");

const DEFAULT_START_CAP = 30;
const DEFAULT_TARGET_CAP = 200;
const DEFAULT_STEP_DAYS = 3;
/** Kategori yang tidak pernah ikut dibatasi pemanasan. */
const EXEMPT_CATEGORIES = new Set(["manual", "system", "critical", "admin", "reply", "command"]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getWarmupConfig(runtimeConfig = readRuntimeConfig()) {
  const warmup = runtimeConfig.numberWarmup || {};
  const startCap = Math.max(1, Number(warmup.startCap ?? DEFAULT_START_CAP) || DEFAULT_START_CAP);
  const targetCap = Math.max(startCap, Number(warmup.targetCap ?? DEFAULT_TARGET_CAP) || DEFAULT_TARGET_CAP);
  const stepDays = Math.max(1, Number(warmup.stepDays ?? DEFAULT_STEP_DAYS) || DEFAULT_STEP_DAYS);
  return {
    enabled: warmup.enabled === true,
    startedAt: String(warmup.startedAt || "").trim(),
    startCap,
    targetCap,
    stepDays,
  };
}

/** Apakah kategori ini ikut dibatasi pemanasan? */
function isWarmupCategory(category) {
  return !EXEMPT_CATEGORIES.has(String(category || "").toLowerCase());
}

/**
 * Berapa hari pemanasan sudah berjalan. Hari pertama dihitung sebagai 1.
 *
 * @returns {number|null} null bila tanggal mulainya tidak sah
 */
function warmupDay(config, now = new Date()) {
  if (!config.startedAt) return null;
  const mulai = new Date(config.startedAt);
  const mulaiMs = mulai.getTime();
  if (!Number.isFinite(mulaiMs)) return null;

  const selisih = now.getTime() - mulaiMs;
  // Tanggal mulai di masa depan diperlakukan sebagai hari pertama, bukan
  // sebagai hari negatif yang akan menghasilkan batas nol dan mendiamkan
  // seluruh pemberitahuan.
  if (selisih < 0) return 1;
  return Math.floor(selisih / MS_PER_DAY) + 1;
}

/**
 * Batas kiriman untuk hari ini menurut tahap pemanasan.
 *
 * @returns {{ active: boolean, cap: number|null, day: number|null, step: number|null, reason: string }}
 */
function currentCap(config = getWarmupConfig(), now = new Date()) {
  if (!config.enabled) return { active: false, cap: null, day: null, step: null, reason: "tidak_aktif" };

  const hari = warmupDay(config, now);
  if (hari === null) {
    // Tanggal mulai rusak. Pemanasan DIABAIKAN, bukan dipakai dengan tebakan:
    // menebak akan menghasilkan batas yang tidak diinginkan siapa pun, dan
    // pembatasan yang salah berarti pemberitahuan pengadilan tidak terkirim.
    return { active: false, cap: null, day: null, step: null, reason: "tanggal_mulai_tidak_sah" };
  }

  const tahap = Math.floor((hari - 1) / config.stepDays);
  const batas = Math.min(config.targetCap, config.startCap * Math.pow(2, tahap));

  // Sudah menyentuh batas penuh berarti pemanasan selesai dengan sendirinya.
  if (batas >= config.targetCap) {
    return { active: false, cap: null, day: hari, step: tahap, reason: "selesai" };
  }
  return { active: true, cap: Math.floor(batas), day: hari, step: tahap, reason: "berjalan" };
}

/** Berapa pesan yang sudah dikirim hari ini pada kategori yang dibatasi. */
async function countSentToday(now = new Date()) {
  const awalHari = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const rows = await botDb.query(
    `SELECT COUNT(*) AS jumlah
       FROM aleta_bot_message_logs
      WHERE status = 'sent'
        AND created_at >= ?
        AND (category IS NULL OR category NOT IN ('manual', 'system', 'critical', 'admin', 'reply', 'command'))`,
    [botDb.toMysqlDate(awalHari)]
  );
  const jumlah = rows && rows[0] ? Number(rows[0].jumlah) : 0;
  return Number.isFinite(jumlah) ? jumlah : 0;
}

/**
 * Apakah pesan ini boleh berangkat menurut pemanasan?
 *
 * GAGAL-TERBUKA. Bila jumlah kiriman hari ini tidak bisa dibaca, pesan
 * DIIZINKAN. Pemanasan adalah pengaman tambahan; mendiamkan pemberitahuan
 * pengadilan karena database sedang bermasalah adalah kerugian yang lebih
 * pasti daripada risiko yang dihindarinya.
 *
 * @returns {Promise<{allowed: boolean, cap: number|null, sent: number|null, day: number|null, reason: string}>}
 */
async function checkWarmupLimit(category, { now = new Date(), runtimeConfig = readRuntimeConfig() } = {}) {
  const config = getWarmupConfig(runtimeConfig);
  const tahap = currentCap(config, now);
  if (!tahap.active) {
    return { allowed: true, cap: null, sent: null, day: tahap.day, reason: tahap.reason };
  }
  if (!isWarmupCategory(category)) {
    return { allowed: true, cap: tahap.cap, sent: null, day: tahap.day, reason: "kategori_dikecualikan" };
  }

  let terkirim;
  try {
    terkirim = await countSentToday(now);
  } catch {
    return { allowed: true, cap: tahap.cap, sent: null, day: tahap.day, reason: "hitungan_gagal_dibaca" };
  }

  if (terkirim >= tahap.cap) {
    return { allowed: false, cap: tahap.cap, sent: terkirim, day: tahap.day, reason: "batas_pemanasan_tercapai" };
  }
  return { allowed: true, cap: tahap.cap, sent: terkirim, day: tahap.day, reason: "berjalan" };
}

/** Ringkasan untuk status layanan. */
function describeWarmup(runtimeConfig = readRuntimeConfig(), now = new Date()) {
  const config = getWarmupConfig(runtimeConfig);
  const tahap = currentCap(config, now);
  return {
    enabled: config.enabled,
    startedAt: config.startedAt || null,
    startCap: config.startCap,
    targetCap: config.targetCap,
    stepDays: config.stepDays,
    day: tahap.day,
    capToday: tahap.cap,
    active: tahap.active,
    reason: tahap.reason,
  };
}

/** Mencatat bahwa pengiriman ditahan pemanasan. Dipanggil paling banyak sekali per hari. */
const sudahDicatat = new Set();
function logWarmupHold(detail) {
  const kunci = `${new Date().toISOString().slice(0, 10)}`;
  if (sudahDicatat.has(kunci)) return;
  sudahDicatat.add(kunci);
  void logService.logSystemEvent({
    eventType: "number_warmup_limit_reached",
    severity: "info",
    message: `Batas pemanasan nomor hari ini tercapai (${detail.sent}/${detail.cap} pada hari ke-${detail.day}). Sisa pemberitahuan berangkat besok.`,
    metadata: detail,
  });
}

module.exports = {
  DEFAULT_START_CAP,
  DEFAULT_STEP_DAYS,
  DEFAULT_TARGET_CAP,
  EXEMPT_CATEGORIES,
  checkWarmupLimit,
  countSentToday,
  currentCap,
  describeWarmup,
  getWarmupConfig,
  isWarmupCategory,
  logWarmupHold,
  warmupDay,
};
