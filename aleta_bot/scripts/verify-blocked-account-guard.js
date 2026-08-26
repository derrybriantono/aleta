#!/usr/bin/env node
"use strict";

/**
 * Membuktikan akun yang DIBLOKIR di portal tidak menerima WhatsApp dari ALETA
 * Bot, termasuk saat nama dan nomornya datang dari SIPP.
 *
 *   node scripts/verify-blocked-account-guard.js
 *
 * Daftar penerima pegawai dari portal memang sudah menyaring akun nonaktif,
 * tetapi notifikasi perkara mengambil nama dan nomor langsung dari SIPP - dan
 * SIPP tidak tahu apa-apa soal pemblokiran di ALETA. Itulah lubang yang
 * ditutup di sini.
 */

// Konfigurasi runtime dipalsukan SEBELUM messageService dimuat, karena
// messageService mengambil readRuntimeConfig saat require.
const runtimeConfigModule = require("../config/runtime-config");
const KONFIG_UJI = {
  botEnabled: true,
  notificationsEnabled: true,
  dryRunEnabled: false,
  messageDelayMs: 0,
  retryLimit: 0,
  blockedRecipients: {
    numbers: ["628123450001"],
    names: ["derry briantono", "siti aminah"],
  },
};
runtimeConfigModule.readRuntimeConfig = () => KONFIG_UJI;

const blocked = require("../services/blockedRecipientService");
const messageService = require("../services/messageService");
const recipientValidationService = require("../services/recipientValidationService");
const logService = require("../services/logService");
const whatsappStatusService = require("../services/whatsappStatusService");

// Pengiriman normal harus benar-benar sampai ke fungsi kirim, jadi status
// WhatsApp dipalsukan tersambung.
whatsappStatusService.getStatus = () => ({ status: "connected" });
whatsappStatusService.recordMessageSent = () => {};

let lulus = 0;
let gagal = 0;

function periksa(label, aktual, harapan) {
  if (aktual === harapan) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}\n        harapan=${JSON.stringify(harapan)} aktual=${JSON.stringify(aktual)}`);
  }
}

console.log("\n== Pemblokiran berdasarkan nomor ==");
periksa(
  "nomor terblokir ditolak",
  blocked.getBlockReason({ number: "628123450001" }, KONFIG_UJI),
  "akun_diblokir_nomor"
);
periksa(
  "nomor bentuk lokal 08xx tetap dikenali",
  blocked.getBlockReason({ number: "08123450001" }, KONFIG_UJI),
  "akun_diblokir_nomor"
);
periksa(
  "nomor dengan spasi dan tanda hubung tetap dikenali",
  blocked.getBlockReason({ number: "0812-345-0001" }, KONFIG_UJI),
  "akun_diblokir_nomor"
);
periksa("nomor lain tetap boleh", blocked.getBlockReason({ number: "6285241237788" }, KONFIG_UJI), "");

console.log("\n== Pemblokiran berdasarkan nama (jalur data SIPP) ==");
periksa(
  "nama dari SIPP dengan nomor BERBEDA tetap tertahan",
  blocked.getBlockReason({ number: "628777777777", name: "DERRY BRIANTONO" }, KONFIG_UJI),
  "akun_diblokir_nama"
);
periksa(
  "gelar di belakang nama tidak membuat blokir lolos",
  blocked.getBlockReason({ number: "628777777777", name: "Derry Briantono, S.H." }, KONFIG_UJI),
  "akun_diblokir_nama"
);
periksa(
  "gelar depan dan belakang sekaligus tetap tertahan",
  blocked.getBlockReason({ number: "628777777777", name: "Dr. H. Derry Briantono, S.H., M.H." }, KONFIG_UJI),
  "akun_diblokir_nama"
);
periksa(
  "nama pegawai lain tetap boleh dikirimi",
  blocked.getBlockReason({ number: "628777777777", name: "Budi Santoso" }, KONFIG_UJI),
  ""
);

console.log("\n== Tanpa daftar blokir, tidak ada yang tertahan ==");
periksa(
  "daftar kosong tidak memblokir siapa pun",
  blocked.getBlockReason({ number: "628123450001", name: "Derry Briantono" }, { blockedRecipients: { numbers: [], names: [] } }),
  ""
);
periksa(
  "konfigurasi tanpa field blockedRecipients aman",
  blocked.getBlockReason({ number: "628123450001" }, {}),
  ""
);

console.log("\n== Pratinjau Kirim Manual menandai lebih dulu ==");
const pratinjau = recipientValidationService.analyzeRecipientNumber("628777777777", {
  recipientType: "employee",
  recipient: { nama_pegawai: "Derry Briantono, S.H." },
});
const pratinjauBersih = recipientValidationService.analyzeRecipientNumber("6285241237788", {
  recipientType: "employee",
  recipient: { nama_pegawai: "Budi Santoso" },
});
periksa("penerima terblokir ditandai tidak boleh dikirim", pratinjau.allowed, false);
periksa(
  "alasannya tercantum di pratinjau",
  (pratinjau.issues || []).some((item) => String(item).startsWith("akun_diblokir")),
  true
);
periksa("pegawai aktif tidak ikut tertandai", pratinjauBersih.allowed, true);

console.log("\n== Jalur pengiriman benar-benar tidak mengirim ==");
const dicatat = [];
logService.logMessageSkipped = (data) => dicatat.push(data);
logService.logSystemEvent = () => {};
logService.logMessageAttempt = () => {};
logService.logMessageSent = () => {};
logService.hasSentIdempotencyKey = async () => false;

(async () => {
  let terkirim = 0;
  const kirimPalsu = async () => {
    terkirim += 1;
    return { id: "x" };
  };

  const lewatNomor = await messageService.safeSendMessage({
    to: "628123450001",
    message: "seharusnya tidak terkirim",
    notificationKey: "uji_nomor",
    category: "employee",
    metadata: { templateId: "tpl_uji", messageContractSource: "notification_registry", messageContractVersion: 1 },
    sendFn: kirimPalsu,
  });
  periksa("pengiriman ke nomor terblokir dibatalkan", lewatNomor, null);

  const lewatNama = await messageService.safeSendMessage({
    to: "628777777777",
    message: "seharusnya tidak terkirim",
    notificationKey: "uji_nama",
    category: "employee",
    metadata: {
      recipientName: "Derry Briantono, S.H.",
      templateId: "tpl_uji",
      messageContractSource: "notification_registry",
      messageContractVersion: 1,
    },
    sendFn: kirimPalsu,
  });
  periksa("pengiriman ke nama terblokir dari SIPP dibatalkan", lewatNama, null);

  periksa("fungsi kirim tidak pernah dipanggil", terkirim, 0);
  periksa(
    "alasan pemblokiran tercatat di log",
    dicatat.filter((item) => item && String(item.errorMessage || "").startsWith("akun_diblokir")).length,
    2
  );

  const boleh = await messageService.safeSendMessage({
    to: "6285241237788",
    message: "ini harus terkirim",
    notificationKey: "uji_normal",
    category: "employee",
    metadata: {
      recipientName: "Budi Santoso",
      templateId: "tpl_uji",
      messageContractSource: "notification_registry",
      messageContractVersion: 1,
    },
    sendFn: kirimPalsu,
  });
  periksa("pegawai aktif TETAP menerima pesan", terkirim, 1);
  periksa("pengiriman normal mengembalikan hasil", Boolean(boleh), true);

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
