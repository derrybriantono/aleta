"use strict";

/**
 * Membuat akun bot BERPERILAKU seperti orang yang memegang ponsel.
 *
 * Dua kebiasaan manusia yang selama ini tidak pernah dilakukan ALETA, padahal
 * pustakanya sudah menyediakannya sejak awal:
 *
 *   1. MENGETIK. Orang yang mengirim pesan panjang terlihat "sedang mengetik..."
 *      lebih dulu. Pesan yang muncul mendadak tanpa jeda mengetik adalah salah
 *      satu jejak mesin yang paling mudah dibaca.
 *
 *   2. MEMBACA. Orang membuka pesan yang masuk. Akun yang mengirim ratusan pesan
 *      tetapi tidak pernah membuka satu pun pesan masuk berperilaku seperti
 *      corong satu arah - dan corong satu arah persis yang dicari penyaring
 *      spam.
 *
 * --- Semuanya GAGAL-TERBUKA ---
 *
 * Tidak satu pun fungsi di sini boleh menggagalkan pengiriman. Semuanya hanya
 * mempercantik perilaku; bila WhatsApp belum siap, chat tidak ditemukan, atau
 * pustakanya berubah, pesan pengadilan tetap harus berangkat. Karena itu setiap
 * pemanggilan dibungkus try/catch dan mengembalikan penanda, bukan melempar.
 */

/** Lama mengetik per huruf. Pengetik cepat di ponsel sekitar 30 ms/huruf. */
const MS_PER_CHAR = 30;
/** Jeda mengetik terpendek yang masih terlihat oleh penerima. */
const MIN_TYPING_MS = 800;
/**
 * Jeda mengetik terpanjang.
 *
 * Dibatasi 4 detik BUKAN karena manusia mengetik secepat itu, melainkan karena
 * balasan chat juga melewati jalur ini dan ada orang yang sedang menunggu
 * jawabannya. Kepercayaan pada layanan lebih berharga daripada tambahan
 * kemiripan beberapa detik.
 */
const MAX_TYPING_MS = 4000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPresenceConfig(runtimeConfig = {}) {
  const presence = runtimeConfig.humanPresence || {};
  return {
    typingEnabled: presence.typingEnabled !== false,
    markSeenEnabled: presence.markSeenEnabled !== false,
    msPerChar: Math.max(0, Number(presence.msPerChar ?? MS_PER_CHAR) || MS_PER_CHAR),
    minTypingMs: Math.max(0, Number(presence.minTypingMs ?? MIN_TYPING_MS) || 0),
    maxTypingMs: Math.max(0, Number(presence.maxTypingMs ?? MAX_TYPING_MS) || 0),
  };
}

/**
 * Berapa lama "sedang mengetik" ditampilkan untuk sebuah pesan.
 *
 * Sebanding dengan panjang pesan, karena pesan panjang memang lebih lama
 * diketik - jeda mengetik yang selalu sama persis untuk pesan sepanjang apa pun
 * justru menjadi pola tersendiri.
 */
function typingDurationMs(text, config = getPresenceConfig()) {
  const panjang = typeof text === "string" ? text.length : String(text || "").length;
  if (panjang === 0) return config.minTypingMs;
  const kasar = panjang * config.msPerChar;
  // Sedikit keragaman supaya dua pesan dengan panjang sama tidak menghasilkan
  // jeda yang identik sampai milidetik.
  const berjitter = kasar * (0.85 + Math.random() * 0.3);
  return Math.round(Math.min(config.maxTypingMs, Math.max(config.minTypingMs, berjitter)));
}

/**
 * Mengambil objek chat tanpa pernah melempar galat.
 *
 * @returns {Promise<object|null>}
 */
async function resolveChat(client, chatId) {
  if (!client || typeof client.getChatById !== "function") return null;
  if (!chatId) return null;
  try {
    return await client.getChatById(chatId);
  } catch {
    return null;
  }
}

/**
 * Menampilkan "sedang mengetik..." lalu menunggu selama durasi yang diminta.
 *
 * Bila indikator gagal ditampilkan, penantiannya TETAP dijalankan. Jeda itu
 * sendiri sudah bernilai untuk keamanan akun, terlepas dari apakah penerima
 * melihat indikatornya.
 *
 * @returns {Promise<{shown: boolean, waitedMs: number}>}
 */
async function showTyping(client, chatId, durationMs, config = getPresenceConfig()) {
  const lama = Math.max(0, Number(durationMs) || 0);
  if (!config.typingEnabled || lama === 0) {
    if (lama > 0) await sleep(lama);
    return { shown: false, waitedMs: lama };
  }

  let shown = false;
  const chat = await resolveChat(client, chatId);
  if (chat && typeof chat.sendStateTyping === "function") {
    try {
      await chat.sendStateTyping();
      shown = true;
    } catch {
      shown = false;
    }
  }

  await sleep(lama);

  // Indikator mengetik padam sendiri setelah beberapa detik, tetapi memadamkan
  // secara sadar mencegah keadaan janggal ketika pengiriman gagal sesudah ini:
  // penerima akan melihat "sedang mengetik" yang tidak pernah menghasilkan
  // pesan apa pun.
  if (shown && chat && typeof chat.clearState === "function") {
    try {
      await chat.clearState();
    } catch {
      /* dibiarkan: indikator akan padam sendiri */
    }
  }

  return { shown, waitedMs: lama };
}

/**
 * Menandai sebuah percakapan sudah dibaca.
 *
 * @returns {Promise<boolean>} true bila benar-benar ditandai
 */
async function markSeen(client, chatId, config = getPresenceConfig()) {
  if (!config.markSeenEnabled) return false;
  if (!client || !chatId) return false;

  // Client.sendSeen lebih murah daripada getChatById karena tidak perlu
  // memuat seluruh isi percakapan.
  if (typeof client.sendSeen === "function") {
    try {
      await client.sendSeen(chatId);
      return true;
    } catch {
      return false;
    }
  }

  const chat = await resolveChat(client, chatId);
  if (chat && typeof chat.sendSeen === "function") {
    try {
      await chat.sendSeen();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

module.exports = {
  MAX_TYPING_MS,
  MIN_TYPING_MS,
  MS_PER_CHAR,
  getPresenceConfig,
  markSeen,
  showTyping,
  typingDurationMs,
};
