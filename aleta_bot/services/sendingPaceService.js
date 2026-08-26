"use strict";

/**
 * Pengatur JARAK WAKTU antar pesan keluar (anti suspend/banned).
 *
 * Masalah yang diselesaikan: satu kali jalan notifikasi bisa memasukkan puluhan
 * pesan sekaligus ke antrean, semuanya dengan scheduled_at = sekarang. Akibatnya
 * walau tipe pesannya sama dan isinya benar, WhatsApp melihat puluhan pesan
 * keluar dalam hitungan detik dari satu nomor — pola paling khas akun bot dan
 * pemicu suspend/banned yang paling sering.
 *
 * Solusinya: setiap pesan notifikasi baru diberi JADWAL KIRIM sendiri yang
 * bergeser maju dari pesan terakhir di antrean, dengan jarak acak (jitter).
 * Karena penjadwalan dilakukan saat masuk antrean (bukan saat kirim), jarak
 * tetap terjaga walau bot restart, worker dipicu manual, atau batch diperbesar.
 *
 * Tiga lapis pengaman di sini:
 *   1. JARAK ANTREAN  - pesan ke-N dijadwalkan minimal `minGapMs` setelah pesan
 *                       ke-(N-1), diacak sampai `maxGapMs`.
 *   2. JEDA PER ORANG - satu nomor tidak menerima dua pesan berdekatan; pesan
 *                       kedua digeser sampai cooldown terlewati.
 *   3. JAM AMAN       - pesan yang jatuh di luar jam kirim (mis. notifikasi
 *                       malam) TIDAK ditahan menumpuk lalu meledak serentak
 *                       saat jam buka, melainkan langsung dijadwalkan rapi
 *                       menyebar mulai jam buka berikutnya.
 *
 * Pesan interaktif (balasan chat, manual, sistem) TIDAK ikut dijadwalkan ulang:
 * orang sedang menunggu jawabannya, dan balasan wajar memang cepat.
 */

const { readRuntimeConfig } = require("../config/runtime-config");
const botDb = require("./botDbService");

const DEFAULT_MIN_GAP_MS = 8000;
const DEFAULT_MAX_GAP_MS = 15000;
const DEFAULT_PER_RECIPIENT_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * IRAMA CAMPURAN — jarak antar pesan yang menyerupai manusia.
 *
 * Jarak acak di dalam satu rentang sempit (mis. selalu 2-5 menit) ternyata
 * TETAP berbentuk mesin: manusia tidak pernah seseragam itu. Orang membalas
 * beberapa pesan beruntun dalam setengah menit, lalu diam sepuluh menit karena
 * mengerjakan hal lain, lalu beruntun lagi.
 *
 * Karena itu jaraknya tidak diambil dari satu rentang, melainkan dari beberapa
 * KELOMPOK rentang yang dipilih menurut bobotnya. Hasilnya sebaran berekor
 * panjang: banyak jarak pendek, sesekali jeda panjang — bentuk yang sama dengan
 * percakapan sungguhan.
 *
 * Bobot di bawah menghasilkan rata-rata sekitar 112 detik, yaitu sekitar 257
 * pesan per hari pada jendela kirim 8 jam. Itu memberi kelonggaran cukup di
 * atas kebutuhan nyata PA Donggala (100-200 pesan per hari) tanpa membuat
 * iramanya rapat.
 */
const DEFAULT_GAP_PROFILE = [
  { label: "beruntun", minMs: 20000, maxMs: 45000, weight: 35 },
  { label: "pendek", minMs: 45000, maxMs: 90000, weight: 30 },
  { label: "sedang", minMs: 90000, maxMs: 180000, weight: 22 },
  { label: "panjang", minMs: 180000, maxMs: 420000, weight: 10 },
  { label: "jeda", minMs: 480000, maxMs: 900000, weight: 3 },
];
/** Batas aman: pesan tidak digeser lebih dari 7 hari ke depan. */
const MAX_DEFER_MS = 7 * 24 * 60 * 60 * 1000;
/** Kategori yang dikirim apa adanya (tidak dijadwalkan ulang). */
const IMMEDIATE_CATEGORIES = new Set(["manual", "system", "critical", "admin", "reply", "command"]);

function parseClockToMinutes(value, fallback) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return fallback;
  }
  return hours * 60 + minutes;
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function atMinutesOfDay(date, totalMinutes, dayOffset = 0) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + dayOffset);
  result.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return result;
}

/** Kategori yang boleh dijadwalkan ulang demi keamanan akun. */
function isPacedCategory(category) {
  return !IMMEDIATE_CATEGORIES.has(String(category || "").toLowerCase());
}

/**
 * Membaca kelompok jarak dari pengaturan, membuang entri yang tidak masuk akal.
 *
 * Entri rusak DIBUANG, bukan diperbaiki diam-diam. Kelompok yang bobotnya nol
 * atau rentangnya terbalik tidak punya tafsiran yang benar, dan menebak
 * maksudnya berisiko menghasilkan irama yang justru lebih rapat dari yang
 * diinginkan admin.
 */
function normalizeGapProfile(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const buckets = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const minMs = Number(item.minMs);
    const maxMs = Number(item.maxMs);
    const weight = Number(item.weight);
    if (!Number.isFinite(minMs) || minMs < 0) continue;
    if (!Number.isFinite(maxMs) || maxMs < minMs) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    buckets.push({ label: String(item.label || "").trim() || "tanpa nama", minMs, maxMs, weight });
  }
  return buckets.length > 0 ? buckets : null;
}

/** Rata-rata jarak menurut bobot tiap kelompok. Dipakai perkiraan kapasitas. */
function averageGapMs(profile, fallbackMinMs, fallbackMaxMs) {
  const buckets = normalizeGapProfile(profile);
  if (!buckets) return (fallbackMinMs + fallbackMaxMs) / 2;
  let totalBobot = 0;
  let jumlah = 0;
  for (const bucket of buckets) {
    totalBobot += bucket.weight;
    jumlah += bucket.weight * ((bucket.minMs + bucket.maxMs) / 2);
  }
  return totalBobot > 0 ? jumlah / totalBobot : (fallbackMinMs + fallbackMaxMs) / 2;
}

function getPaceConfig(runtimeConfig = readRuntimeConfig()) {
  const pace = runtimeConfig.sendingPace || {};
  const minGapMs = Math.max(0, Number(pace.minGapMs ?? DEFAULT_MIN_GAP_MS) || 0);
  const rawMaxGapMs = Math.max(0, Number(pace.maxGapMs ?? DEFAULT_MAX_GAP_MS) || 0);
  const cooldown = Number(pace.perRecipientCooldownMs ?? DEFAULT_PER_RECIPIENT_COOLDOWN_MS);
  return {
    enabled: pace.enabled !== false,
    minGapMs,
    // Jitter hanya berlaku bila max benar-benar lebih besar dari min.
    maxGapMs: rawMaxGapMs > minGapMs ? rawMaxGapMs : minGapMs,
    perRecipientCooldownMs: Math.max(0, Number.isFinite(cooldown) ? cooldown : DEFAULT_PER_RECIPIENT_COOLDOWN_MS),
    // Kosong berarti memakai rentang min/max seperti perilaku sebelumnya.
    gapProfile: normalizeGapProfile(pace.gapProfile),
  };
}

function getSendingWindowConfig(runtimeConfig = readRuntimeConfig()) {
  const window = runtimeConfig.sendingWindow || {};
  return {
    enabled: window.enabled !== false,
    start: String(window.start || "07:30"),
    end: String(window.end || "21:00"),
  };
}

/**
 * RITME KANTOR — jeda yang membuat pengiriman menyerupai jam kerja sungguhan.
 *
 * Jam kirim saja belum cukup. Pengiriman yang mengalir rata dari pukul 08 sampai
 * 16 tanpa pernah berhenti tidak menyerupai kantor mana pun: tidak ada istirahat
 * siang, tidak ada Jumatan, dan tetap bekerja pada hari Sabtu-Minggu.
 *
 * Jumat sengaja punya jeda sendiri yang lebih panjang. Di Pengadilan Agama,
 * salat Jumat memundurkan seluruh kegiatan siang, dan pengiriman yang berjalan
 * persis pada jam itu justru menonjol sebagai sesuatu yang bukan manusia.
 */
function getRhythmConfig(runtimeConfig = readRuntimeConfig()) {
  const rhythm = runtimeConfig.sendingRhythm || {};
  const holidays = Array.isArray(rhythm.holidays)
    ? rhythm.holidays.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return {
    enabled: rhythm.enabled !== false,
    lunchStart: String(rhythm.lunchStart || "12:00"),
    lunchEnd: String(rhythm.lunchEnd || "13:00"),
    fridayLunchStart: String(rhythm.fridayLunchStart || "11:30"),
    fridayLunchEnd: String(rhythm.fridayLunchEnd || "13:30"),
    skipWeekend: rhythm.skipWeekend !== false,
    holidays,
  };
}

function toDateKey(date) {
  const bulan = String(date.getMonth() + 1).padStart(2, "0");
  const tanggal = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${bulan}-${tanggal}`;
}

/** Hari libur: Sabtu, Minggu, atau tanggal yang didaftarkan admin. */
function isRestDay(date, rhythm) {
  const hari = date.getDay();
  if (rhythm.skipWeekend && (hari === 0 || hari === 6)) return true;
  return rhythm.holidays.includes(toDateKey(date));
}

/**
 * Menggeser sebuah waktu keluar dari jeda istirahat dan hari libur.
 *
 * Sama seperti jam kirim: waktu yang jatuh di jeda TIDAK dibatalkan, melainkan
 * dipindahkan ke titik terdekat sesudahnya. Pemberitahuan pengadilan tetap
 * berangkat, hanya pada saat yang wajar.
 *
 * @param {Date} date waktu yang diusulkan
 * @param {object} rhythm hasil getRhythmConfig
 * @param {object} window hasil getSendingWindowConfig, untuk membuka hari berikutnya
 */
function shiftOutOfQuietPeriod(date, rhythm, window) {
  if (!rhythm.enabled) return date;

  const windowStartMinutes = parseClockToMinutes(window && window.start, 8 * 60);
  let current = new Date(date.getTime());

  // Hari libur beruntun (mis. Sabtu-Minggu, atau cuti bersama) perlu dilewati
  // satu per satu. Batas 30 hari mencegah putaran tak berujung bila daftar
  // liburnya salah isi.
  let langkah = 0;
  while (isRestDay(current, rhythm) && langkah < 30) {
    current = atMinutesOfDay(current, windowStartMinutes, 1);
    langkah += 1;
  }

  const isJumat = current.getDay() === 5;
  const mulai = parseClockToMinutes(
    isJumat ? rhythm.fridayLunchStart : rhythm.lunchStart,
    isJumat ? 11 * 60 + 30 : 12 * 60
  );
  const selesai = parseClockToMinutes(
    isJumat ? rhythm.fridayLunchEnd : rhythm.lunchEnd,
    isJumat ? 13 * 60 + 30 : 13 * 60
  );
  if (selesai <= mulai) return current;

  const menit = minutesOfDay(current);
  if (menit >= mulai && menit < selesai) {
    return atMinutesOfDay(current, selesai);
  }
  return current;
}

/**
 * Jarak acak antar pesan berurutan. Interval tetap = ciri bot.
 *
 * Bila ada kelompok jarak (gapProfile), satu kelompok dipilih dulu menurut
 * bobotnya, baru jaraknya diacak di dalam kelompok itu. Dua tingkat pengacakan
 * inilah yang menghasilkan sebaran menyerupai manusia — bukan sekadar acak
 * dalam satu rentang.
 */
function pickGapMs(config) {
  const buckets = config.gapProfile;
  if (Array.isArray(buckets) && buckets.length > 0) {
    const totalBobot = buckets.reduce((jumlah, bucket) => jumlah + bucket.weight, 0);
    let undian = Math.random() * totalBobot;
    for (const bucket of buckets) {
      undian -= bucket.weight;
      if (undian <= 0) {
        return Math.floor(bucket.minMs + Math.random() * (bucket.maxMs - bucket.minMs + 1));
      }
    }
    // Pembulatan floating point bisa menyisakan undian sedikit di atas nol
    // setelah seluruh bobot dikurangi; kelompok terakhir yang menanggungnya.
    const terakhir = buckets[buckets.length - 1];
    return Math.floor(terakhir.minMs + Math.random() * (terakhir.maxMs - terakhir.minMs + 1));
  }
  if (config.maxGapMs > config.minGapMs) {
    return Math.floor(config.minGapMs + Math.random() * (config.maxGapMs - config.minGapMs + 1));
  }
  return config.minGapMs;
}

/**
 * Menggeser sebuah waktu ke dalam jam kirim aman.
 *
 * Bukan sekadar menolak: waktu di luar jam aman dipindahkan ke pembukaan jam
 * kirim berikutnya, supaya notifikasi malam tetap terkirim — hanya pada jam
 * yang wajar dan tanpa menumpuk jadi ledakan pengiriman.
 */
function shiftIntoSendingWindow(date, window) {
  if (!window.enabled) return date;
  const startMinutes = parseClockToMinutes(window.start, 7 * 60 + 30);
  const endMinutes = parseClockToMinutes(window.end, 21 * 60);
  if (startMinutes === endMinutes) return date;

  const current = minutesOfDay(date);

  // Jam kirim melewati tengah malam (mis. 22:00-06:00).
  if (startMinutes > endMinutes) {
    if (current >= startMinutes || current <= endMinutes) return date;
    return atMinutesOfDay(date, startMinutes);
  }

  // Jam kirim normal dalam satu hari (mis. 08:00-16:00).
  if (current < startMinutes) return atMinutesOfDay(date, startMinutes);
  if (current > endMinutes) return atMinutesOfDay(date, startMinutes, 1);
  return date;
}

/**
 * Jadwal terakhir yang sudah dipesan oleh proses ini.
 *
 * Pembacaan MAX(scheduled_at) dari database bisa memberi nilai lama bila dua
 * notifikasi berjalan pada menit cron yang sama dan pemesanan slot-nya
 * berselang-seling — keduanya akan membaca nilai yang sama lalu mendapat jadwal
 * yang sama pula. Penanda di memori ini menutup celah itu untuk satu proses bot,
 * yang memang topologi pemakaiannya.
 */
let lastReservedMs = 0;

async function readLastQueuedScheduleMs() {
  const rows = await botDb.query(
    `SELECT MAX(scheduled_at) AS last_at
       FROM aleta_bot_message_queue
      WHERE status IN ('pending', 'processing')`
  );
  const raw = rows && rows[0] ? rows[0].last_at : null;
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readRecipientLastScheduleMs(recipientNumber, sinceMs) {
  const normalized = String(recipientNumber || "").trim();
  if (!normalized) return 0;
  const rows = await botDb.query(
    `SELECT MAX(scheduled_at) AS last_at
       FROM aleta_bot_message_queue
      WHERE recipient_number = ?
        AND status IN ('pending', 'processing', 'sent', 'delivered', 'read')
        AND scheduled_at >= ?`,
    [normalized, botDb.toMysqlDate(new Date(sinceMs))]
  );
  const raw = rows && rows[0] ? rows[0].last_at : null;
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Menghitung jadwal kirim untuk satu pesan baru — inti dari semua perhitungan
 * di file ini. Dipisah dari akses database supaya bisa diuji langsung.
 */
function computeScheduledAt({
  now,
  lastQueuedMs = 0,
  recipientLastMs = 0,
  paceConfig,
  window,
  // Tanpa ritme yang diberikan, perilakunya sama persis seperti sebelum ritme
  // kantor ada. Pemanggil yang menginginkannya harus memintanya secara sadar.
  rhythm = { enabled: false },
}) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now) || Date.now();
  const reasons = [];

  if (!paceConfig.enabled) {
    return { scheduledAt: new Date(nowMs), deferredMs: 0, reasons: ["pace_disabled"] };
  }

  let candidateMs = nowMs;

  // 1. Jarak dari pesan terakhir di antrean.
  if (lastQueuedMs > 0) {
    const gapMs = pickGapMs(paceConfig);
    const afterQueueMs = lastQueuedMs + gapMs;
    if (afterQueueMs > candidateMs) {
      candidateMs = afterQueueMs;
      reasons.push("queue_gap");
    }
  }

  // 2. Jeda per penerima: satu nomor tidak diberondong.
  if (recipientLastMs > 0 && paceConfig.perRecipientCooldownMs > 0) {
    const afterCooldownMs = recipientLastMs + paceConfig.perRecipientCooldownMs;
    if (afterCooldownMs > candidateMs) {
      candidateMs = afterCooldownMs;
      reasons.push("recipient_cooldown");
    }
  }

  // 3. Jam kirim aman. Diulang karena pergeseran ke jam buka bisa menabrak
  //    pesan lain yang sudah dijadwalkan di sana.
  const beforeWindowMs = candidateMs;
  let shiftedMs = shiftIntoSendingWindow(new Date(candidateMs), window).getTime();
  if (shiftedMs > beforeWindowMs) {
    reasons.push("sending_window");
    // Setelah digeser ke jam buka, jaga jarak lagi dari pesan terakhir supaya
    // antrean yang tertahan semalam tidak berangkat serentak.
    if (lastQueuedMs > 0) {
      const afterQueueMs = lastQueuedMs + pickGapMs(paceConfig);
      if (afterQueueMs > shiftedMs) shiftedMs = afterQueueMs;
    }
  }
  candidateMs = Math.max(shiftedMs, candidateMs);

  // 4. Ritme kantor: keluar dari istirahat siang dan hari libur.
  //    Dijalankan SETELAH jam kirim, karena pergeseran ke jam buka hari
  //    berikutnya bisa saja mendarat tepat di hari Sabtu.
  const beforeRhythmMs = candidateMs;
  let rhythmMs = shiftOutOfQuietPeriod(new Date(candidateMs), rhythm, window).getTime();
  if (rhythmMs > beforeRhythmMs) {
    reasons.push("office_rhythm");
    // Sama seperti pergeseran jam kirim: antrean yang tertahan selama jeda
    // makan siang atau akhir pekan tidak boleh berangkat serentak begitu
    // jedanya berakhir.
    if (lastQueuedMs > 0) {
      const afterQueueMs = lastQueuedMs + pickGapMs(paceConfig);
      if (afterQueueMs > rhythmMs) rhythmMs = afterQueueMs;
    }
    candidateMs = Math.max(rhythmMs, candidateMs);
  }

  // Pembatas kewarasan. Bila antrean menumpuk tidak wajar — atau ada jadwal
  // rusak di database yang membuat perhitungan melompat jauh — jadwal dipangkas
  // ke batas maksimum. Pemangkasan disebar acak dalam rentang satu jam terakhir,
  // sebab memangkas ke satu titik waktu yang sama persis justru akan menciptakan
  // ledakan pengiriman — persis masalah yang hendak dicegah modul ini.
  let cappedMs = candidateMs;
  const limitMs = nowMs + MAX_DEFER_MS;
  if (candidateMs > limitMs) {
    cappedMs = limitMs - Math.floor(Math.random() * 60 * 60 * 1000);
    reasons.push("defer_capped");
  }

  return {
    scheduledAt: new Date(cappedMs),
    deferredMs: Math.max(0, cappedMs - nowMs),
    reasons,
  };
}

/**
 * Memesan slot kirim untuk satu pesan yang akan masuk antrean.
 * Mengembalikan Date yang dipakai sebagai scheduled_at.
 */
async function reserveSendSlot({ category, recipientNumber, now = new Date() } = {}) {
  const runtimeConfig = readRuntimeConfig();
  const paceConfig = getPaceConfig(runtimeConfig);

  if (!paceConfig.enabled || !isPacedCategory(category)) {
    return { scheduledAt: now, deferredMs: 0, reasons: ["immediate_category"] };
  }

  const window = getSendingWindowConfig(runtimeConfig);
  const nowMs = now.getTime();
  const queuedMs = await readLastQueuedScheduleMs();
  // Penanda memori diabaikan bila sudah lewat: antrean yang sudah habis
  // terkirim tidak boleh membuat pesan baru ikut tertunda.
  const lastQueuedMs = Math.max(queuedMs, lastReservedMs > nowMs ? lastReservedMs : 0);
  const recipientLastMs = paceConfig.perRecipientCooldownMs > 0
    ? await readRecipientLastScheduleMs(recipientNumber, nowMs - paceConfig.perRecipientCooldownMs)
    : 0;

  const rhythm = getRhythmConfig(runtimeConfig);
  const decision = computeScheduledAt({ now, lastQueuedMs, recipientLastMs, paceConfig, window, rhythm });
  lastReservedMs = Math.max(lastReservedMs, decision.scheduledAt.getTime());
  return decision;
}

/** Melupakan penanda memori. Dipakai pengujian dan saat antrean dikosongkan. */
function resetReservedSlots() {
  lastReservedMs = 0;
}

/** Ringkasan untuk dashboard/diagnostik. */
function describePace() {
  const runtimeConfig = readRuntimeConfig();
  const paceConfig = getPaceConfig(runtimeConfig);
  const window = getSendingWindowConfig(runtimeConfig);
  const rhythm = getRhythmConfig(runtimeConfig);
  const rataRataMs = averageGapMs(paceConfig.gapProfile, paceConfig.minGapMs, paceConfig.maxGapMs);
  const jamKirim =
    (parseClockToMinutes(window.end, 16 * 60) - parseClockToMinutes(window.start, 8 * 60)) / 60;

  return {
    ...paceConfig,
    sendingWindow: window,
    sendingRhythm: rhythm,
    averageGapMs: paceConfig.enabled ? Math.round(rataRataMs) : null,
    estimatedPerHour:
      paceConfig.enabled && rataRataMs > 0 ? Math.floor(3600000 / rataRataMs) : null,
    // Perkiraan kapasitas harian. Inilah angka yang perlu dibandingkan dengan
    // kebutuhan nyata sebelum irama dirapatkan atau direnggangkan.
    estimatedPerDay:
      paceConfig.enabled && rataRataMs > 0 && jamKirim > 0
        ? Math.floor((jamKirim * 3600000) / rataRataMs)
        : null,
  };
}

module.exports = {
  DEFAULT_GAP_PROFILE,
  averageGapMs,
  computeScheduledAt,
  describePace,
  getPaceConfig,
  getRhythmConfig,
  getSendingWindowConfig,
  isPacedCategory,
  isRestDay,
  normalizeGapProfile,
  pickGapMs,
  reserveSendSlot,
  resetReservedSlots,
  shiftIntoSendingWindow,
  shiftOutOfQuietPeriod,
};
