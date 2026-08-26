"use strict";

/**
 * Menentukan lawan bicara mana yang BOLEH dilayani ALETA Bot.
 *
 * Bot hanya melayani dua hal:
 *   1. membalas orang yang mengirim chat langsung ke nomor bot, dan
 *   2. mengirim pesan yang memang sudah diatur di Notifikasi.
 *
 * Di luar itu bot harus diam. Yang paling mudah terlanggar adalah STATUS
 * WhatsApp: pembaruan status masuk ke handler pesan sama seperti chat biasa
 * (pengirimnya "status@broadcast"), sehingga tanpa penyaringan bot akan
 * membalas status orang - pesan yang tidak pernah diminta siapa pun dan
 * terlihat seperti bot berkomentar di status pegawai atau pihak berperkara.
 *
 * Saluran siaran lain (broadcast list, channel/newsletter) diperlakukan sama.
 */

const STATUS_CHAT_ID = "status@broadcast";

/** Chat id yang tidak boleh dilayani maupun dikirimi pesan. */
function isStatusOrBroadcastChatId(value) {
  const id = String(value || "").trim().toLowerCase();
  if (!id) return false;
  if (id === STATUS_CHAT_ID) return true;
  // Daftar siaran dan channel WhatsApp.
  return /@broadcast$/.test(id) || /@newsletter$/.test(id);
}

/**
 * Alasan sebuah pesan masuk TIDAK boleh dilayani, atau "" bila boleh.
 * Mengembalikan alasan (bukan sekadar boolean) supaya bisa dicatat di log dan
 * admin tahu kenapa bot diam.
 */
function getIncomingRejectionReason(msg) {
  if (!msg || typeof msg !== "object") return "pesan_tidak_valid";

  // whatsapp-web.js menandai pembaruan status lewat beberapa properti yang
  // tidak selalu ada bersamaan, jadi ketiganya diperiksa.
  if (msg.isStatus === true) return "status_whatsapp";
  if (msg.broadcast === true) return "siaran_whatsapp";
  if (isStatusOrBroadcastChatId(msg.from)) return "status_atau_siaran_whatsapp";
  if (isStatusOrBroadcastChatId(msg.to)) return "status_atau_siaran_whatsapp";

  // Pesan yang dikirim bot sendiri tidak boleh memicu balasan berantai.
  if (msg.fromMe === true) return "pesan_dari_bot_sendiri";

  return "";
}

function shouldServeIncomingMessage(msg) {
  return getIncomingRejectionReason(msg) === "";
}

module.exports = {
  STATUS_CHAT_ID,
  isStatusOrBroadcastChatId,
  getIncomingRejectionReason,
  shouldServeIncomingMessage,
};
