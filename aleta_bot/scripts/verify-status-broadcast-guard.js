#!/usr/bin/env node
"use strict";

/**
 * Membuktikan ALETA Bot TIDAK membalas status WhatsApp dan tidak mengirim
 * apa pun ke saluran siaran.
 *
 *   node scripts/verify-status-broadcast-guard.js
 *
 * Bot hanya boleh melayani dua hal: membalas chat langsung, dan mengirim
 * notifikasi yang sudah diatur. Tanpa penjagaan ini, pembaruan status masuk ke
 * handler pesan sama seperti chat biasa dan bot akan membalas status orang.
 */
const audience = require("../services/whatsappAudienceService");

let lulus = 0;
let gagal = 0;

function periksa(label, aktual, harapan) {
  const cocok = aktual === harapan;
  if (cocok) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}\n        harapan=${JSON.stringify(harapan)} aktual=${JSON.stringify(aktual)}`);
  }
}

console.log("\n== Chat id yang tidak boleh dilayani ==");
for (const id of [
  "status@broadcast",
  "STATUS@BROADCAST",
  "1234567890@broadcast",
  "abcdef@newsletter",
]) {
  periksa(`"${id}" dikenali sebagai status/siaran`, audience.isStatusOrBroadcastChatId(id), true);
}

console.log("\n== Chat id yang tetap harus dilayani ==");
for (const id of ["6281234567890@c.us", "6281234567890-1600000000@g.us", "", null]) {
  periksa(`"${id}" bukan status/siaran`, audience.isStatusOrBroadcastChatId(id), false);
}

console.log("\n== Pesan masuk ==");
periksa(
  "pembaruan status ditolak lewat properti isStatus",
  audience.getIncomingRejectionReason({ isStatus: true, from: "6281234567890@c.us", body: "halo" }),
  "status_whatsapp"
);
periksa(
  "pembaruan status ditolak lewat pengirim status@broadcast",
  audience.getIncomingRejectionReason({ from: "status@broadcast", body: "halo" }),
  "status_atau_siaran_whatsapp"
);
periksa(
  "siaran ditolak lewat properti broadcast",
  audience.getIncomingRejectionReason({ broadcast: true, from: "6281234567890@c.us", body: "halo" }),
  "siaran_whatsapp"
);
periksa(
  "pesan bot sendiri tidak memicu balasan berantai",
  audience.getIncomingRejectionReason({ fromMe: true, from: "6281234567890@c.us", body: "halo" }),
  "pesan_dari_bot_sendiri"
);

console.log("\n== Yang TIDAK boleh ikut terblokir ==");
periksa(
  "chat langsung tetap dilayani",
  audience.shouldServeIncomingMessage({ from: "6281234567890@c.us", body: "info perkara" }),
  true
);
periksa(
  "chat grup tetap dilayani (penyaringan grup diurus terpisah)",
  audience.shouldServeIncomingMessage({ from: "6281234567890-1600000000@g.us", body: "info" }),
  true
);
periksa(
  "isStatus bernilai false tidak dianggap status",
  audience.shouldServeIncomingMessage({ isStatus: false, broadcast: false, from: "6281234567890@c.us", body: "hai" }),
  true
);

console.log("\n== Penjagaan di jalur pengiriman ==");
const messageService = require("../services/messageService");
const logService = require("../services/logService");

const dicatat = [];
const asliSkipped = logService.logMessageSkipped;
const asliEvent = logService.logSystemEvent;
logService.logMessageSkipped = (data) => dicatat.push(data);
logService.logSystemEvent = () => {};

(async () => {
  let terkirim = 0;
  const hasil = await messageService.safeSendMessage({
    to: "status@broadcast",
    message: "seharusnya tidak pernah terkirim",
    notificationKey: "uji",
    category: "system",
    sendFn: async () => {
      terkirim += 1;
      return { id: "x" };
    },
  });

  periksa("pengiriman ke status@broadcast ditolak", hasil, null);
  periksa("fungsi kirim tidak pernah dipanggil", terkirim, 0);
  periksa(
    "alasan penolakan tercatat di log",
    dicatat.some((item) => item && item.errorMessage === "status_atau_siaran_bukan_tujuan_sah"),
    true
  );

  logService.logMessageSkipped = asliSkipped;
  logService.logSystemEvent = asliEvent;

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
})().catch((galat) => {
  console.error("Verifikasi gagal dijalankan:", galat && galat.message ? galat.message : galat);
  process.exit(2);
});
