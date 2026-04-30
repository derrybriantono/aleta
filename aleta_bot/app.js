require("dotenv").config();

const { exec } = require('child_process');
const http = require("http");
const fs = require("fs");
const {
  Client,
  LocalAuth,
  MessageMedia,
} = require("whatsapp-web.js");
const path = require('path');
const qrcode2 = require("qrcode-terminal");
const figlet = require("figlet");
const cron = require("node-cron");
const getData = require("./query");
const notification = require("./notifikasi");
const detailPerkara = require("./detail");
const express = require("express");
const { phoneNumberFormatter } = require("./helpers/formatter");
const { readRuntimeConfig } = require("./config/runtime-config");
const messageService = require("./services/messageService");
const messageQueueService = require("./services/messageQueueService");
const logService = require("./services/logService");
const rateLimitService = require("./services/rateLimitService");
const whatsappStatusService = require("./services/whatsappStatusService");
const queueWorkerService = require("./services/queueWorkerService");
const botDbService = require("./services/botDbService");
const { validateStartupConfig } = require("./services/configValidationService");
const { buildIdempotencyKey, buildManualIdempotencyKey } = require("./services/idempotencyService");
const notificationRegistryService = require("./services/notificationRegistryService");
const { validateQuery } = require("./services/queryValidatorService");
const { validateTemplate } = require("./services/templateService");
const externalDbService = require("./services/externalDbService");
const publicQaIntentService = require("./services/publicQaIntentService");
const aiRuntimeConfigService = require("./services/aiRuntimeConfigService");
const aiProviderAdapter = require("./services/aiProviderAdapter");
const internalGatewayRoutes = require("./routes/internalGatewayRoutes");
const app = express();
const port = 3003;
const server = http.createServer(app);
const {
  adminId,
  hakimIds,
  paniteraIds,
  jurusitaIds,
  ketuaId,
  paniteraId,
  kasirId,
  ptspId,
  penjagaSidangId
} = require('./whatsapp');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

validateStartupConfig();
void botDbService.ensureSchema().then((ready) => {
  if (!ready) {
    console.warn("[ALETA Bot] Tabel DB aleta_bot_* belum siap. Log/queue akan fallback sementara bila diperlukan.");
  }
});

// console log bot name
figlet("AletaBot", function (err, data) {
  if (err) {
    console.log("Ada yang salah...");
    console.dir(err);
    return;
  }
  console.log(data);
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile("index.html", {
    root: __dirname,
  });
});

//inisiasi whatsapp
const initialRuntimeConfig = readRuntimeConfig();
const chromeExecutablePath =
  String(process.env.ALETA_BOT_CHROME_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || "").trim();

const puppeteerLaunchConfig = {
  headless: true,
  args: [
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
  ],
};

if (chromeExecutablePath) {
  puppeteerLaunchConfig.executablePath = chromeExecutablePath;
}

function getWhatsappStartupErrorMessage(error) {
  const rawMessage = error && error.message ? error.message : String(error || "");
  const isChromeMissing =
    /could not find chrome/i.test(rawMessage) ||
    /chrome.*not.*found/i.test(rawMessage) ||
    /browser was not found/i.test(rawMessage) ||
    /failed to launch the browser process/i.test(rawMessage);

  if (!isChromeMissing) {
    return rawMessage || "Inisialisasi WhatsApp client gagal.";
  }

  const envHint = chromeExecutablePath
    ? `Path Chrome dari env saat ini: ${chromeExecutablePath}. Pastikan file tersebut ada dan dapat dijalankan.`
    : "Set PUPPETEER_EXECUTABLE_PATH atau ALETA_BOT_CHROME_EXECUTABLE_PATH ke lokasi chrome.exe.";

  return [
    "Chrome/Puppeteer belum terinstall atau tidak ditemukan.",
    "Jalankan: npx puppeteer browsers install chrome",
    "atau set PUPPETEER_EXECUTABLE_PATH.",
    envHint,
  ].join(" ");
}

const client = new Client({
  webVersionCache: { type: 'none' },
  puppeteer: puppeteerLaunchConfig,
  // session is deprecated
  // session: sessionCfg,
  authStrategy: new LocalAuth({
    clientId: initialRuntimeConfig.whatsapp?.sessionName || "aleta-session",
  }),
  qrTimeoutMs: 0,
});

const originalSendMessage = client.sendMessage.bind(client);
client.sendMessage = async (id, ...args) => {
  return messageService.safeSendMessage({
    client,
    sendFn: originalSendMessage,
    to: id,
    message: args[0],
    options: args[1],
    category: "notification",
    metadata: { source: "legacy_client_sendMessage" },
  });
};

const safeSendMessage = async (id, ...args) => {
  return messageService.safeSendMessage({
    client,
    sendFn: originalSendMessage,
    to: id,
    message: args[0],
    options: args[1],
    category: "notification",
    metadata: { source: "legacy_safeSendMessage" },
  });
};

const safeSendTrackedMessage = async ({
  id,
  message,
  options,
  category = "notification",
  notificationKey = "",
  jobKey = "",
  recipientName = "",
  metadata = {},
  idempotencyKey = "",
  dryRun,
}) => {
  return messageService.safeSendMessage({
    client,
    sendFn: originalSendMessage,
    to: id,
    message,
    options,
    category,
    notificationKey,
    jobKey,
    recipientName,
    metadata,
    idempotencyKey,
    dryRun,
  });
};

async function resolveLegacyAiCommandResponse({ prompt, senderNumber, senderName, commandKey }) {
  const question = String(prompt || "").trim();
  if (!question) {
    return "Tidak ada isi pertanyaan untuk diproses. Silakan tulis pertanyaan layanan yang ingin Bapak/Ibu tanyakan.";
  }

  try {
    const publicQa = await publicQaIntentService.resolvePublicQaAnswer({
      message: question,
      senderNumber,
      senderName,
    });
    const legacyResponse = publicQa.handled && publicQa.legacyCommand
      ? await getData(publicQa.legacyCommand.toLocaleLowerCase())
      : "";
    const finalPublicQa = await publicQaIntentService.finalizePublicQaAnswer({
      publicQa,
      message: question,
      senderNumber,
      legacyResponse,
    });

    return (
      finalPublicQa.answer ||
      publicQa.answer ||
      legacyResponse ||
      "Maaf, pertanyaan belum dapat dikenali. Silakan pilih menu layanan atau hubungi PTSP/petugas resmi pengadilan."
    );
  } catch (error) {
    logService.logSystemEvent({
      eventType: "legacy_ai_command_failed",
      severity: "warning",
      message: "Command AI legacy gagal diproses melalui Public Q&A.",
      metadata: {
        commandKey,
        errorMessage: error.message,
      },
    });
    return "Maaf, layanan AI belum dapat memproses pertanyaan saat ini. Silakan coba lagi atau hubungi PTSP/petugas resmi pengadilan.";
  }
}

let whatsappInitializePromise = null;

const startWhatsappClient = (source = "manual") => {
  const currentState = whatsappStatusService.getStatus();
  const currentStatus = currentState.status || "unknown";

  if (["connected", "authenticated", "qr_needed"].includes(currentStatus)) {
    return {
      started: false,
      status: currentStatus,
      message:
        currentStatus === "connected"
          ? "WhatsApp sudah terhubung."
          : "WhatsApp client sudah berjalan. QR akan tersedia jika login diperlukan.",
    };
  }

  if (whatsappInitializePromise) {
    return {
      started: false,
      status: "initializing",
      message: "WhatsApp client sedang diinisialisasi. Tunggu status/QR beberapa detik.",
    };
  }

  whatsappStatusService.setStatus("initializing", "initialize", {
    message: `WhatsApp client diinisialisasi (${source}).`,
    source,
  });

  whatsappInitializePromise = Promise.resolve()
    .then(() => client.initialize())
    .catch((error) => {
      const friendlyMessage = getWhatsappStartupErrorMessage(error);
      whatsappStatusService.setStatus("disconnected", "initialize_failed", {
        severity: "error",
        message: friendlyMessage,
        errorMessage: friendlyMessage,
        rawErrorMessage: error && error.message ? error.message : String(error),
        source,
        chromeExecutablePathConfigured: Boolean(chromeExecutablePath),
        chromeExecutablePath: chromeExecutablePath ? "[configured]" : "",
        puppeteerCacheDirConfigured: Boolean(process.env.PUPPETEER_CACHE_DIR),
      });
      console.error("Inisialisasi WhatsApp gagal:", friendlyMessage);
    })
    .finally(() => {
      whatsappInitializePromise = null;
    });

  return {
    started: true,
    status: "initializing",
    message: "WhatsApp client sedang diinisialisasi. QR akan tersedia jika login diperlukan.",
  };
};

queueWorkerService.startQueueWorker((payload) =>
  messageService.safeSendMessage({ client, sendFn: originalSendMessage, ...payload })
);

client.on("qr", (qr) => {
  // NOTE: This event will not be fired if a session is specified.
  whatsappStatusService.setStatus("qr_needed", "qr", { message: "QR login WhatsApp dibuat.", qrString: qr });
  qrcode2.generate(qr, { small: true });
});

client.on("ready", () => {
  const phoneNumber = client.info?.wid?.user || "";
  whatsappStatusService.setStatus("connected", "ready", { message: "WhatsApp client siap dan terhubung.", phoneNumber });
  safeSendMessage(adminId, "Bot Whatsapp Siap dan Terhubung!");
  console.log("READY");
});

// Menyimpan sesi ke file
client.on("authenticated", () => {
  whatsappStatusService.setStatus("authenticated", "authenticated", { message: "WhatsApp client berhasil autentikasi." });
  console.log("AUTHENTICATED");
});

client.on("auth_failure", (msg) => {
  // Fired if session restore was unsuccessfull
  whatsappStatusService.setStatus("auth_failure", "auth_failure", {
    severity: "error",
    message: "WhatsApp authentication failure.",
    errorMessage: String(msg || ""),
  });
  console.error("AUTHENTICATION FAILURE", msg);
});

client.on("change_battery", (batteryInfo) => {
  // Battery percentage for attached device has changed
  const { battery, plugged } = batteryInfo;
  console.log(`Battery: ${battery}% - Charging? ${plugged}`);
});

client.on('change_state', (state) => {
  console.log("CHANGE STATE", state);
  whatsappStatusService.setStatus(String(state || "").toLowerCase(), "change_state", { state, message: `WhatsApp state: ${state}` });
  if (state === "CONFLICT" || state === "UNLAUNCHED") {
    client.takeOver();
  } else if (state === "disconnected") {
    console.log("Bot terputus. Mencoba untuk menghubungkan kembali...");
    reconnect();
  }
});

client.on('error', (error) => {
  whatsappStatusService.setStatus("unknown", "error", {
    severity: "error",
    message: "WhatsApp client error.",
    errorMessage: error && error.message ? error.message : String(error),
  });
  console.error("Terjadi kesalahan:", error);
});

client.on("disconnected", (reason) => {
  whatsappStatusService.setStatus("disconnected", "disconnected", {
    severity: "warning",
    message: "WhatsApp client disconnected.",
    reason,
  });
  reconnect();
});

let isReconnecting = false;
const reconnect = () => {
  if (isReconnecting) return;
  isReconnecting = true;
  console.log("Jadwal reconnect dalam 10 detik...");
  whatsappStatusService.setStatus("reconnecting", "reconnect_scheduled", { message: "Reconnect dijadwalkan dalam 10 detik." });
  setTimeout(async () => {
    try {
      console.log("Mencoba untuk menghubungkan kembali...");
      whatsappStatusService.setStatus("reconnecting", "reconnect_attempt", { message: "Mencoba reconnect WhatsApp client." });
      await client.destroy();
      whatsappInitializePromise = null;
      startWhatsappClient("reconnect");
    } catch (err) {
      whatsappStatusService.setStatus("disconnected", "reconnect_failed", {
        severity: "error",
        message: "Reconnect WhatsApp gagal.",
        errorMessage: err.message,
      });
      console.error("Reconnect gagal:", err.message);
    } finally {
      isReconnecting = false;
    }
  }, 10000);
};

if (readRuntimeConfig().botEnabled) {
  startWhatsappClient("startup");
} else {
  whatsappStatusService.setStatus("disconnected", "initialize_skipped", { message: "Bot nonaktif dari konfigurasi portal." });
  console.log("[ALETA Bot] Bot nonaktif dari konfigurasi portal. WhatsApp client tidak diinisialisasi.");
}

client.on('message', async (msg) => {
  if (!msg.body || msg.body.trim() === '') return;

  console.log("Pesan diterima:", msg.body);

  try {
      let chat = await msg.getChat();

      let message = msg.body.toLocaleLowerCase();
      let prefix = message.split("#");

      if (!chat.isGroup) {
          if (prefix[0] === "detail") {
              const response = await detailPerkara(prefix[1]);
              msg.reply(response, null, { ignoreQuoteErrors: true });
          } else if (prefix[0] === "ai") {
              const response = await resolveLegacyAiCommandResponse({
                  prompt: prefix.slice(1).join("#"),
                  senderNumber: msg.from || "",
                  senderName: msg._data?.notifyName || "",
                  commandKey: "ai",
              });
              msg.reply(response, null, { ignoreQuoteErrors: true });
          } else if (prefix[0] === "bot") {
              if (prefix[1]) {
                  const response = await resolveLegacyAiCommandResponse({
                      prompt: prefix.slice(1).join("#"),
                      senderNumber: msg.from || "",
                      senderName: msg._data?.notifyName || "",
                      commandKey: "bot",
                  });
                  msg.reply(response, null, { ignoreQuoteErrors: true });
              } else {
                  msg.reply("Tidak ada isi untuk diproses setelah 'bot'.", null, { ignoreQuoteErrors: true });
              }
          } else {
              const publicQa = await publicQaIntentService.resolvePublicQaAnswer({
                  message: msg.body,
                  senderNumber: msg.from || "",
                  senderName: msg._data?.notifyName || "",
              });
              let response;
              if (publicQa.handled) {
                  const legacyResponse = publicQa.legacyCommand
                      ? await getData(publicQa.legacyCommand.toLocaleLowerCase())
                      : "";
                  const finalPublicQa = await publicQaIntentService.finalizePublicQaAnswer({
                      publicQa,
                      message: msg.body,
                      senderNumber: msg.from || "",
                      legacyResponse,
                  });
                  response = finalPublicQa.answer || publicQa.answer || legacyResponse;
              } else {
                  response = await getData(message);
              }
              msg.reply(response, null, { ignoreQuoteErrors: true });
          }
      } else {
          console.log("Pesan berasal dari grup, tidak diproses");
      }
  } catch (error) {
      console.error("Error yang terjadi:", error);
      msg.reply("Terjadi kesalahan saat memproses permintaan Anda.", null, { ignoreQuoteErrors: true });
  }
});

// Fungsi untuk mendapatkan nama hari dalam bahasa Indonesia
const getNamaHari = (date) => {
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return hari[date.getDay()];
};

// Fungsi untuk mendapatkan tanggal
const formatTanggal = (date) => {
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const day = String(date.getDate()).padStart(2, '0');
  const month = bulan[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

// Fungsi untuk mendapatkan nama hari besok dalam bahasa Indonesia
const getNamaHariBesok = () => {
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1); // Menambahkan satu hari
  return hari[tomorrow.getDay()];
};

// Fungsi untuk mendapatkan tanggal besok
const formatTanggalBesok = () => {
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1); // Menambahkan satu hari
  const day = String(tomorrow.getDate()).padStart(2, '0');
  const month = bulan[tomorrow.getMonth()];
  const year = tomorrow.getFullYear();
  return `${day} ${month} ${year}`;
};

const pengadilan = "Pengadilan Agama Donggala";
const zonaWaktu = "WITA";

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, Ai buatan Hakim Derry Briantono, S.H., berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n";
//     msg += messagesToSend.join('\n\n');

// TOTAL PENERIMAAN PERKARA AKTIF DAN MEDIASI
const sendKetuaPenerimaanPerkara = async () => { 
  try {
    let promisePerkaraHakim = notification.getTotalPenerimaanPerkaraSemuaHakimLengkap();
    let messagePerkaraHakim = await promisePerkaraHakim;
    let promiseMediasiHakim = notification.getTotalPenerimaanMediasiSemuaHakim();
    let messageMediasiHakim = await promiseMediasiHakim;
    let promisePerkaraPanitera = notification.getTotalPenerimaanPerkaraSemuaPanitera();
    let messagePerkaraPanitera = await promisePerkaraPanitera;
    let promisePerkaraJurusita = notification.getTotalPenerimaanPerkaraSemuaJurusita();
    let messagePerkaraJurusita = await promisePerkaraJurusita;

    if (
      messagePerkaraHakim === "Tidak ada data" &&
      messagePerkaraPanitera === "Tidak ada data" &&
      messagePerkaraJurusita === "Tidak ada data" &&
      messageMediasiHakim === "Tidak ada data"
    ) {
      console.log(`Data tidak ada, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n*DATA PENERIMAAN PERKARA SETIAP HAKIM, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraHakim}\n\n*DATA MEDIASI SETIAP HAKIM, DARI JUMLAH KEBERHASILAN TERBESAR KE TERKECIL* :\n${messageMediasiHakim}`;
    
    return msg;
  } catch (error) {
    console.log(error);
  }
};

cron.schedule("50 07 1 * *", () => {
  sendKetuaPenerimaanPerkara().then((message) => {
    if (!message) return;
    Object.values(ketuaId).forEach((id) => {
      client.sendMessage(id, message).then(() => {
        console.log("Pesan berhasil dikirim ke", id);
      }).catch((error) => {
        console.error("Gagal mengirim pesan ke", id, "dengan error:", error);
      });
    });
  }).catch((error) => {
    console.error("Terjadi kesalahan Penerimaan Perkara:", error);
  });
});

//     let msg = `*_Hai, saya Aleta, berikut data Triwulan :_*\n\n*TRIWULAN E-COURT* :\n${messageTriwulanEcourt}\n\n*TRIWULAN MEDIASI* :\n${messageTriwulanMediasi}`;
    
// NOTIFIKASI UNTUK PANITERA BULANAN
const sendPanitera = async () => {
  try {
    let promiseBA = notification.getDataBA();
    let messageBA = await promiseBA;
    let promisePutusanBelumMinut = notification.getDataPutusanBelumMinut();
    let messagePutusanBelumMinut = await promisePutusanBelumMinut;
    let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
    let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
    let promiseBelumSerahHukum = notification.getDataBelumSerahHukum();
    let messageBelumSerahHukum = await promiseBelumSerahHukum;
    let promiseSaksiTidakLengkap = notification.getDataSaksiTidakLengkap();
    let messageSaksiTidakLengkap = await promiseSaksiTidakLengkap;
    let promiseSisaPanjarPn = notification.getDataSisaPanjarPn();
    let messageSisaPanjarPn = await promiseSisaPanjarPn;
    let promiseSisaPanjarBanding = notification.getDataSisaPanjarBanding();
    let messageSisaPanjarBanding = await promiseSisaPanjarBanding;
    let promiseSisaPanjarKasasi = notification.getDataSisaPanjarKasasi();
    let messageSisaPanjarKasasi = await promiseSisaPanjarKasasi;
    let promiseStatistikDetail = notification.getStatistikDetail();
    let messageStatistikDetail = await promiseStatistikDetail;
    let promiseBelumBhtBanding = notification.getBelumBhtBanding();
    let messageBelumBhtBanding = await promiseBelumBhtBanding;
    let promiseBelumBhtKasasi = notification.getBelumBhtKasasi();
    let messageBelumBhtKasasi = await promiseBelumBhtKasasi;
    let promiseBelumPanggilan = notification.getBelumPanggilan();
    let messageBelumPanggilan = await promiseBelumPanggilan;
    let promiseDatabanding = notification.getDataBanding();
    let messageDataBanding = await promiseDatabanding;
    let promiseDataKasasi = notification.getDataKasasi();
    let messageDataKasasi = await promiseDataKasasi;
    let promiseDataPK = notification.getDataPK();
    let messageDataPK = await promiseDataPK;
    let promiseDataPetitum = notification.getDataEdocPetitum();
    let messageDataPetitum = await promiseDataPetitum;
    let promiseDataEdocAnonimisasi = notification.getDataEdocAnonimisasi();
    let messageDataAnonimisasi = await promiseDataEdocAnonimisasi;
    let promiseDataBelumDelegasi = notification.getDataBelumDelegasi();
    let messageDataBelumDelegasi = await promiseDataBelumDelegasi;
    let promiseDataVerstek = notification.getDataVerstek();
    let messageDataVerstek = await promiseDataVerstek;
    let promiseTundaMediasi = notification.getDataTundaMediasi();
    let messageTundaMediasi = await promiseTundaMediasi;

    const counts = {
      jumlahBA: messageBA === "Tidak ada data" ? 0 : messageBA.split('\n\n').length,
      jumlahPutusanBelumMinut: messagePutusanBelumMinut === "Tidak ada data" ? 0 : messagePutusanBelumMinut.split('\n\n').length,
      jumlahBelumBhtPerdata: messageBelumBhtPerdata === "Tidak ada data" ? 0 : messageBelumBhtPerdata.split('\n\n').length,
      jumlahBelumSerahHukum: messageBelumSerahHukum === "Tidak ada data" ? 0 : messageBelumSerahHukum.split('\n\n').length,
      jumlahSaksiTidakLengkap: messageSaksiTidakLengkap === "Tidak ada data" ? 0 : messageSaksiTidakLengkap.split('\n\n').length,
      jumlahSisaPanjarPn: messageSisaPanjarPn === "Tidak ada data" ? 0 : messageSisaPanjarPn.split('\n\n').length,
      jumlahSisaPanjarBanding: messageSisaPanjarBanding === "Tidak ada data" ? 0 : messageSisaPanjarBanding.split('\n\n').length,
      jumlahSisaPanjarKasasi: messageSisaPanjarKasasi === "Tidak ada data" ? 0 : messageSisaPanjarKasasi.split('\n\n').length,
      jumlahStatistikDetail: messageStatistikDetail === "Tidak ada data" ? 0 : messageStatistikDetail.split('\n\n').length,
      jumlahBelumBhtBanding: messageBelumBhtBanding === "Tidak ada data" ? 0 : messageBelumBhtBanding.split('\n\n').length,
      jumlahBelumBhtKasasi: messageBelumBhtKasasi === "Tidak ada data" ? 0 : messageBelumBhtKasasi.split('\n\n').length,
      jumlahBelumPanggilan: messageBelumPanggilan === "Tidak ada data" ? 0 : messageBelumPanggilan.split('\n\n').length,
      jumlahDataBanding: messageDataBanding === "Tidak ada data" ? 0 : messageDataBanding.split('\n\n').length,
      jumlahDataKasasi: messageDataKasasi === "Tidak ada data" ? 0 : messageDataKasasi.split('\n\n').length,
      jumlahDataPK: messageDataPK === "Tidak ada data" ? 0 : messageDataPK.split('\n\n').length,
      jumlahDataPetitum: messageDataPetitum === "Tidak ada data" ? 0 : messageDataPetitum.split('\n\n').length,
      jumlahDataAnonimisasi: messageDataAnonimisasi === "Tidak ada data" ? 0 : messageDataAnonimisasi.split('\n\n').length,
      jumlahDataBelumDelegasi: messageDataBelumDelegasi === "Tidak ada data" ? 0 : messageDataBelumDelegasi.split('\n\n').length,
      jumlahDataVerstek: messageDataVerstek === "Tidak ada data" ? 0 : messageDataVerstek.split('\n\n').length,
      jumlahTundaMediasi: messageTundaMediasi === "Tidak ada data" ? 0 : messageTundaMediasi.split('\n\n').length
  };
  
  const messages = {
      messageStatistikDetail: counts.jumlahStatistikDetail > 0 ? `*STATISTIK DETAIL PENANGANAN PERKARA TAHUN INI : \n${messageStatistikDetail}` : '',
      messageBelumPanggilan: counts.jumlahBelumPanggilan > 0 ? `*JENIS BELUM PANGGILAN TIDAK SESUAI SEJUMLAH ${counts.jumlahBelumPanggilan} PERKARA* : \n${messageBelumPanggilan}` : '',
      messageTundaMediasi: counts.jumlahTundaMediasi > 0 ? `*PERKARA YANG BELUM DI TUNDA MEDIASI* SEJUMLAH *${counts.jumlahTundaMediasi} PERKARA* : \n${messageTundaMediasi}` : '',
      messageSisaPanjarPn: counts.jumlahSisaPanjarPn > 0 ? `*SISA PANJAR PERKARA TINGKAT PERTAMA YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN SEJUMLAH ${counts.jumlahSisaPanjarPn} PERKARA* : \n${messageSisaPanjarPn}` : '',
      messageSisaPanjarBanding: counts.jumlahSisaPanjarBanding > 0 ? `*SISA PANJAR PERKARA TINGKAT BANDING YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN SEJUMLAH ${counts.jumlahSisaPanjarBanding} PERKARA* : \n${messageSisaPanjarBanding}` : '',
      messageSisaPanjarKasasi: counts.jumlahSisaPanjarKasasi > 0 ? `*SISA PANJAR PERKARA TINGKAT KASASI YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN SEJUMLAH ${counts.jumlahSisaPanjarKasasi} PERKARA* : \n${messageSisaPanjarKasasi}` : '',
      messageBA: counts.jumlahBA > 0 ? `*DATA PERKARA YANG BELUM UPLOAD BAS* SEJUMLAH *${counts.jumlahBA} PERKARA* : \n${messageBA}` : '',
      messageDataBelumDelegasi: counts.jumlahDataBelumDelegasi > 0 ? `*DATA DELEGASI BELUM DILAKSANAKAN* SEJUMLAH *${counts.jumlahDataBelumDelegasi} PERKARA* : \n${messageDataBelumDelegasi}` : '',
      messagePutusanBelumMinut: counts.jumlahPutusanBelumMinut > 0 ? `*DATA PUTUSAN YANG BELUM DI MINUTASI* SEJUMLAH *${counts.jumlahPutusanBelumMinut} PERKARA* : \n${messagePutusanBelumMinut}` : '',
      messageBelumBhtPerdata: counts.jumlahBelumBhtPerdata > 0 ? `*DATA PERKARA PERDATA YANG BELUM BERISI TANGGAL BHT SEJUMLAH ${counts.jumlahBelumBhtPerdata} PERKARA* : \n${messageBelumBhtPerdata}` : '',
      messageBelumBhtBanding: counts.jumlahBelumBhtBanding > 0 ? `*DATA PERKARA BANDING YANG BELUM BERISI TANGGAL BHT SEJUMLAH ${counts.jumlahBelumBhtBanding} PERKARA* : \n${messageBelumBhtBanding}` : '',
      messageBelumBhtKasasi: counts.jumlahBelumBhtKasasi > 0 ? `*DATA PERKARA KASASI YANG BELUM BERISI TANGGAL BHT SEJUMLAH ${counts.jumlahBelumBhtKasasi} PERKARA* : \n${messageBelumBhtKasasi}` : '',
      messageSaksiTidakLengkap: counts.jumlahSaksiTidakLengkap > 0 ? `DATA PERKARA YANG DATA SAKSI TIDAK LENGKAP SEJUMLAH ${counts.jumlahSaksiTidakLengkap} PERKARA* : \n${messageSaksiTidakLengkap}` : '',
      messageDataBanding: counts.jumlahDataBanding > 0 ? `*DATA BANDING BELUM DIKIRIM SEJUMLAH ${counts.jumlahDataBanding} PERKARA* : \n${messageDataBanding}` : '',
      messageDataKasasi: counts.jumlahDataKasasi > 0 ? `**DATA KASASI BELUM DIKIRIM SEJUMLAH ${counts.jumlahDataKasasi} PERKARA* : \n${messageDataKasasi}` : '',
      messageDataPK: counts.jumlahDataPK > 0 ? `*DATA BANDING PK DIKIRIM SEJUMLAH ${counts.jumlahDataPK} PERKARA* : \n${messageDataPK}` : '',
      messageDataPetitum: counts.jumlahDataPetitum > 0 ? `*DATA PERKARA BELUM BERISI EDOC PETITUM SEJUMLAH ${counts.jumlahDataPetitum} PERKARA* : \n${messageDataPetitum}` : '',
      messageDataAnonimisasi: counts.jumlahDataAnonimisasi > 0 ? `*PERKARA PUTUSAN BELUM ANONIMISASI* SEJUMLAH *${counts.jumlahDataAnonimisasi} PERKARA* : \n${messageDataAnonimisasi}` : '',
      messageDataVerstek: counts.jumlahDataVerstek > 0 ? `*JENIS PUTUSAN VERSTEK TIDAK SESUAI (LUPA INPUT VERSTEK) SEJUMLAH ${counts.jumlahDataVerstek} PERKARA* : \n${messageDataVerstek}` : '',
      messageBelumSerahHukum: counts.jumlahBelumSerahHukum > 0 ? `*DATA PERKARA YANG BELUM DISERAHKAN KE BAGIAN HUKUM/ARSIP SEJUMLAH ${counts.jumlahBelumSerahHukum} PERKARA* : \n${messageBelumSerahHukum}` : ''
  };      

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log("Data tidak ada, tidak mengirim pesan.");
      return; 
    }

    let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n";
    msg += messagesToSend.join('\n\n');

    return msg;
  } catch (error) {
    console.log(error);
  }
};

cron.schedule("50 07 1 * *", () => {
  sendPanitera().then((res) => {
    if (!res) return;
    Object.values(paniteraId).forEach((id) => {
      safeSendMessage(id, res).then(() => {
        console.log("Pesan panitera berhasil diproses untuk", id);
      });
    });
  }).catch((error) => {
    console.error("Terjadi kesalahan sendPanitera:", error);
  });
});

//     let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n*DATA PENERIMAAN PERKARA SETIAP PANITERA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraPanitera}\n\n*DATA PENERIMAAN PERKARA SETIAP JURUSITA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraJurusita}`;

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara (Silahkan Cek Detailnya dengan mengacu pada kode query nya (seperti monev bas) :_*\n\n";
//     msg += messagesToSend.join('\n\n');

//     const counts = { jumlahValidasiHarian: messageBelumValidasi === "Tidak ada data" ? 0 : messageBelumValidasi.split('\n\n').length }; 
    
//     let msg = `_Hai, saya Aleta, berikut yang belum di validasi oleh validator sejumlah *${counts.jumlahValidasiHarian} Proses*_ : \n${messageBelumValidasi}`;
  
//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

// cron.schedule("30 09 * * Monday-Friday", () => {
//   sendProduk().then((message) => {
    
// cron.schedule("00 15 * * Monday-Friday", () => {
//   sendProduk().then((message) => {
    
//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

// NOTIFIKASI PENJAGA SIDANG
const sendPenjagaSidangHariIni = async () => {
  try {
    let promiseJadwalSidangPerdata = notification.getDataJadwalSidangPerdata();
    let messageJadwalSidangPerdata = await promiseJadwalSidangPerdata;
    let promiseJadwalMediasi = notification.getDataJadwalMediasi();
    let messageJadwalMediasi = await promiseJadwalMediasi;
    let promiseBelumPanggilanHariSidang = notification.getBelumPanggilanHariSidang();
    let messageBelumPanggilanHariSidang = await promiseBelumPanggilanHariSidang;

    const counts = {
      totalSidang: messageJadwalSidangPerdata === "Tidak ada data" ? 0 : messageJadwalSidangPerdata.split('\n\n').length,
      totalMediasi: messageJadwalMediasi === "Tidak ada data" ? 0 : messageJadwalMediasi.split('\n\n').length,
      totalPanggilan: messageBelumPanggilanHariSidang === "Tidak ada data" ? 0 : messageBelumPanggilanHariSidang.split('\n\n').length,
    };

    const messages = {
      messageJadwalSidang: counts.totalSidang > 0 ? `*JADWAL SIDANG HARI INI (${counts.totalSidang} PERKARA)* : \n${messageJadwalSidangPerdata}` : '',
      messageJadwalMediasi: counts.totalMediasi > 0 ? `*JADWAL MEDIASI HARI INI (${counts.totalMediasi} PERKARA)* : \n${messageJadwalMediasi}` : '',
      messagePanggilan: counts.totalPanggilan > 0 ? `*PANGGILAN BELUM DILAKSANAKAN UNTUK SIDANG HARI INI (${counts.totalPanggilan} PERKARA)* : \n${messageBelumPanggilanHariSidang}` : '',
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log("Data tidak ada, tidak mengirim pesan.");
      return; 
    }

    let msg = "*_Hai, saya Aleta, berikut data keadaan perkara (Untuk Cek Kode Hakim dan Panitera Ketik : kode) :_* \n\n";
    msg += messagesToSend.join('\n\n');

    return msg;
  } catch (error) {
    console.log(error);
  }
};

const sendPenjagaSidangBesok = async () => {
  try {
    let promiseJadwalSidangBesok = notification.getDataJadwalBesok();
    let messageJadwalSidangBesok = await promiseJadwalSidangBesok;
    let promiseJadwalMediasiBesok = notification.getDataJadwalMediasiBesok();
    let messageJadwalMediasiBesok = await promiseJadwalMediasiBesok;

    const counts = {
      totalSidangBesok: messageJadwalSidangBesok === "Tidak ada data" ? 0 : messageJadwalSidangBesok.split('\n\n').length,
      totalMediasiBesok: messageJadwalMediasiBesok === "Tidak ada data" ? 0 : messageJadwalMediasiBesok.split('\n\n').length,
    };

    const messages = {
      messageJadwalSidangBesok: counts.totalSidangBesok > 0 ? `*JADWAL SIDANG BESOK (${counts.totalSidangBesok} PERKARA)* : \n${messageJadwalSidangBesok}` : '',
      messageJadwalMediasiBesok: counts.totalMediasiBesok > 0 ?`*JADWAL MEDIASI BESOK (${counts.totalMediasiBesok} PERKARA)* : \n${messageJadwalMediasiBesok}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log("Data tidak ada, tidak mengirim pesan.");
      return; 
    }

    let msg = "*_Hai, saya Aleta, berikut data keadaan perkara untuk besok :_* \n\n";
    msg += messagesToSend.join('\n\n');

    return msg;
  } catch (error) {
    console.log(error);
  }
};

cron.schedule("10 07 * * Monday-Friday", () => {
  sendPenjagaSidangHariIni().then((message) => {
    if (!message) return;
    Object.values(penjagaSidangId).forEach((id) => {
      client.sendMessage(id, message).then(() => {
        console.log("Pesan berhasil dikirim ke", id);
      }).catch((error) => {
        console.error("Gagal mengirim pesan ke", id, "dengan error:", error);
      });
    });
  }).catch((error) => {
    console.error("Terjadi kesalahan:", error);
  });
});

cron.schedule("00 20 * * *", () => {
  sendPenjagaSidangBesok().then((message) => {
    if (!message) return;
    Object.values(penjagaSidangId).forEach((id) => {
      client.sendMessage(id, message).then(() => {
        console.log("Pesan berhasil dikirim ke", id);
      }).catch((error) => {
        console.error("Gagal mengirim pesan ke", id, "dengan error:", error);
      });
    });
  }).catch((error) => {
    console.error("Terjadi kesalahan:", error);
  });
});

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

//     const counts = { jumlahDelegasi: messageBelumSerahHukum === "Tidak ada data" ? 0 : messageBelumSerahHukum.split('\n\n').length }; 
    
//     let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*DATA PERKARA YANG BELUM DISERAHKAN KE BAGIAN HUKUM/ARSIP SEJUMLAH ${counts.jumlahDelegasi} PERKARA* : \n${messageBelumSerahHukum}`;

// NOTIFIKASI KASIR HARIAN
const sendPengingatKasir = async () => {
  try {
    
    let promiseSisaPanjarPn = notification.getDataSisaPanjarPn();
    let messageSisaPanjarPn = await promiseSisaPanjarPn;
    let promiseMeteraiRedaksiPsp = notification.getDataMeteraiRedaksiPsp();
    let messageMeteraiRedaksiPsp = await promiseMeteraiRedaksiPsp;
    let promiseDaftarPenetapan = notification.getDataDaftarPenetapan();
    let messageDaftarPenetapan = await promiseDaftarPenetapan;

    const counts = {
      jumlahPanjar: messageSisaPanjarPn === "Tidak ada data" ? 0 : messageSisaPanjarPn.split('\n\n').length,
      jumlahMaterai: messageMeteraiRedaksiPsp === "Tidak ada data" ? 0 : messageMeteraiRedaksiPsp.split('\n\n').length,
      jumlahPenetapan: messageDaftarPenetapan === "Tidak ada data" ? 0 : messageDaftarPenetapan.split('\n\n').length,
    };

    const messages = {
      messagePenetapan: counts.jumlahPenetapan > 0 ? `*PERKARA YANG BELUM PMH/PENUNJUKKAN PP/PENUNJUKKAN JS SERTA PHS SEJUMLAH ${counts.jumlahPenetapan} PERKARA* : \n${messageDaftarPenetapan}` : '',
      messageMaterai: counts.jumlahMaterai > 0 ? `*PERKARA YANG BELUM DIKELUARKAN MATERAI, REDAKSI DAN PSP SEJUMLAH ${counts.jumlahMaterai} PERKARA* : \n${messageMeteraiRedaksiPsp}` : '',
      messagePanjar: counts.jumlahPanjar > 0 ? `*SISA PANJAR PERKARA TINGKAT PERTAMA YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN SEJUMLAH ${counts.jumlahPanjar} PERKARA* : \n${messageSisaPanjarPn}` : '',
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log("Data tidak ada, tidak mengirim pesan.");
      return; 
    }

    let msg = "*Hai, mengingatkan kembali tentang situasi keadaan perkara sampai sore hari ini :* \n\n";
    msg += messagesToSend.join('\n\n');

    return msg;
  } catch (error) {
    console.log(error);
  }
};

cron.schedule("30 14 * * Monday-Thursday", () => {
  sendPengingatKasir().then((message) => {
    if (!message) return;
    Object.values(ptspId).forEach((id) => {
      client.sendMessage(id, message).then(() => {
        console.log("Pesan berhasil dikirim ke", id);
      }).catch((error) => {
        console.error("Gagal mengirim pesan ke", id, "dengan error:", error);
      });
    });

    Object.values(kasirId).forEach((id) => {
      safeSendTrackedMessage({
        id,
        message,
        category: "employee",
        notificationKey: "pegawai-kasir-harian",
        idempotencyKey: buildIdempotencyKey({
          notificationKey: "pegawai-kasir-harian",
          recipientNumber: id,
          eventDate: new Date().toISOString().slice(0, 10),
          messageType: "daily-reminder",
        }),
        metadata: { source: "pilot_pegawai_kasir" },
      }).then(() => {
        console.log("Pesan kasir berhasil diproses untuk", id);
      });
    });

  }).catch((error) => {
    console.error("Terjadi kesalahan sendPengingatKasir:", error);
  });
});

// NOTIFIKASI PENGINGAT TIAP USER SESUAI NAMA
// NOTIFIKASI SIDANG DAN MEDIASI HAKIM
const sendPengingatHakim = async (id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, isBesok = false, testMode = false) => {
  try {
    let messageJadwalSidangPerdata = await getDataJadwalSidang(nama);
    let messageJadwalMediasi = await getDataJadwalMediasi(nama);

    const counts = {
      jumlahSidang: messageJadwalSidangPerdata === "Tidak ada data" ? 0 : messageJadwalSidangPerdata.split('\n\n').length,
      jumlahMediasi: messageJadwalMediasi === "Tidak ada data" ? 0 : messageJadwalMediasi.split('\n\n').length
    };

    if (messageJadwalSidangPerdata === "Tidak ada data" && messageJadwalMediasi === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    const waktu = isBesok ? "besok" : "hari ini";
    const namaHari = isBesok ? getNamaHariBesok() : getNamaHari(new Date());
    const tanggal = isBesok ? formatTanggalBesok() : formatTanggal(new Date());

    const messages = {
      messageSidang: counts.jumlahSidang > 0 ? `*JADWAL SIDANG ${waktu.toUpperCase()}* SEJUMLAH *${counts.jumlahSidang} PERKARA* : \n${messageJadwalSidangPerdata}` : '',
      messageMediasi: counts.jumlahMediasi > 0 ? `*JADWAL MEDIASI ${waktu.toUpperCase()}* SEJUMLAH *${counts.jumlahMediasi} PERKARA* : \n${messageJadwalMediasi}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, Saya Aleta, mengingatkan kembali persiapan untuk ${role} ${nama} ${waktu} ${namaHari}, tanggal ${tanggal} :_* \n\n`;
    msg += messagesToSend.join('\n\n');

    if (!testMode) {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    } else {
      console.log(`Test Mode: Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    }

    return msg;
  } catch (error) {
    console.error(error);
  }
};

// Mengatur pengingat untuk sidang pagi
const pengingatPagiHakim = (id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, testMode = false) => {
  cron.schedule("15 07 * * Monday-Friday", () => {
    sendPengingatHakim(id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, false, testMode).then((message) => {
      if (message) {
        console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat pagi:", error);
    });
  });
};

// Mengatur pengingat untuk sidang malam
const pengingatMalamHakim = (id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, testMode = false) => {
  cron.schedule("00 20 * * Sunday-Thursday", () => {
    sendPengingatHakim(id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, true, testMode).then((message) => {
      if (message) {
        console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat malam:", error);
    });
  });
};

// Mengatur pengingat untuk semua hakim pagi
Object.entries(hakimIds).forEach(([nama, id]) => {
  pengingatPagiHakim(id, nama, notification.getDataJadwalSidangPerdataHakim, notification.getDataJadwalMediasiHakim, "Hakim", false);
});

// Mengatur pengingat untuk semua hakim malam
Object.entries(hakimIds).forEach(([nama, id]) => {
  pengingatMalamHakim(id, nama, notification.getDataJadwalBesokHakim, notification.getDataJadwalMediasiBesokHakim, "Hakim", false);
});

// NOTIFIKASI PENGINGAT SIDANG DAN PENUNDAAN MEDIASI PANITERA
const sendPengingatPaniteraSidang = async (id, nama, getDataJadwalSidang, getDataTundaMediasi, role, isBesok = false, testMode = false) => {
  try {
    let messageJadwalSidangPerdata = await getDataJadwalSidang(nama);
    let messageJadwalMediasi = await getDataTundaMediasi(nama);

    const counts = {
      jumlahSidang: messageJadwalSidangPerdata === "Tidak ada data" ? 0 : messageJadwalSidangPerdata.split('\n\n').length,
      jumlahMediasi: messageJadwalMediasi === "Tidak ada data" ? 0 : messageJadwalMediasi.split('\n\n').length
    };

    if (messageJadwalSidangPerdata === "Tidak ada data" && messageJadwalMediasi === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return;
    }

    const waktu = isBesok ? "besok" : "hari ini";
    const namaHari = isBesok ? getNamaHariBesok() : getNamaHari(new Date());
    const tanggal = isBesok ? formatTanggalBesok() : formatTanggal(new Date());

    const messages = {
      messageSidang: counts.jumlahSidang > 0 ? `*JADWAL SIDANG ${waktu.toUpperCase()}* SEJUMLAH *${counts.jumlahSidang} PERKARA* : \n${messageJadwalSidangPerdata}` : '',
      messageMediasi: counts.jumlahMediasi > 0 ? `*STATUS MEDIASI YANG BELUM DI PROSES* SEJUMLAH *${counts.jumlahMediasi} PERKARA* : \n${messageJadwalMediasi}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    let msg = `*_Hai, Saya Aleta, mengingatkan kembali persiapan untuk ${role} ${nama} ${waktu} ${namaHari}, tanggal ${tanggal} :_* \n\n`;
    msg += messagesToSend.join('\n\n');

    if (!testMode) {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    } else {
      console.log(`Test Mode: Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    }

    return msg;
  } catch (error) {
    console.log(error);
  }
};

// Mengatur pengingat untuk sidang pagi
const pengingatPagiPanitera = (id, nama, getDataJadwalSidang, getDataTundaMediasi, role, testMode = false) => {
  cron.schedule("00 07 * * Monday-Friday", () => {
    sendPengingatPaniteraSidang(id, nama, getDataJadwalSidang, getDataTundaMediasi, role, false, testMode).then((message) => {
        if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
        }
      })
      .catch((error) => {
        console.error("Terjadi kesalahan:", error);
      });
  });
}

// Mengatur pengingat untuk sidang malam
const pengingatMalamPanitera = (id, nama, getDataJadwalSidang, getDataTundaMediasi, role, testMode = false) => {
  cron.schedule("00 20 * * *", () => {
    sendPengingatPaniteraSidang(id, nama, getDataJadwalSidang, getDataTundaMediasi, role, true, testMode).then((message) => {
        if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
        }
      })
      .catch((error) => {
        console.error("Terjadi kesalahan:", error);
      });
  });
}

// Mengatur pengingat untuk semua panitera pagi
Object.entries(paniteraIds).forEach(([nama, id]) => {
  pengingatPagiPanitera(id, nama, notification.getDataJadwalSidangPerdataPanitera, notification.getDataTundaMediasiPanitera, "Panitera", false);
});

// Mengatur pengingat untuk semua panitera malam
Object.entries(paniteraIds).forEach(([nama, id]) => {
  pengingatMalamPanitera(id, nama, notification.getDataJadwalBesokPaniteraNew, notification.getDataTundaMediasiPanitera, "Panitera", false);
});

// NOTIFIKASI PENGINGAT LUPA MINUT, PUTUSAN, ANONIMISASI DAN TUNDA UNTUK HAKIM
const sendStatusSidangHakim = async (id, nama, getDataPutusanBelumMinut, getDataUploadPutusan, getDataEdocAnonimisasi, getDataLupaTundaHakim, role, testMode = false) => { 
  try {
    let messagePutusanBelumMinut = await getDataPutusanBelumMinut(nama);
    let messageUploadPutusan = await getDataUploadPutusan(nama);
    let messageDataAnonimisasi = await getDataEdocAnonimisasi(nama);
    let messageLupaTunda = await getDataLupaTundaHakim(nama);

    const counts = {
      jumlahBelumMinut: messagePutusanBelumMinut === "Tidak ada data" ? 0 : messagePutusanBelumMinut.split('\n\n').length,
      jumlahUploadPutusan: messageUploadPutusan === "Tidak ada data" ? 0 : messageUploadPutusan.split('\n\n').length,
      jumlahDataAnonimisasi: messageDataAnonimisasi === "Tidak ada data" ? 0 : messageDataAnonimisasi.split('\n\n').length,
      jumlahLupaTunda: messageLupaTunda === "Tidak ada data" ? 0 : messageLupaTunda.split('\n\n').length
    };

    if (messagePutusanBelumMinut === "Tidak ada data" && messageUploadPutusan === "Tidak ada data" && messageDataAnonimisasi === "Tidak ada data" && messageLupaTunda === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    const messages = {
      messageBelumMinut: counts.jumlahBelumMinut > 0 ? `*DATA PUTUSAN YANG BELUM DI MINUTASI* SEJUMLAH *${counts.jumlahBelumMinut} PERKARA* : \n${messagePutusanBelumMinut}` : '',
      messageUploadPutusan: counts.jumlahUploadPutusan > 0 ? `*PERKARA YANG BELUM UPLOAD PUTUSAN* SEJUMLAH *${counts.jumlahUploadPutusan} PERKARA* : \n${messageUploadPutusan}` : '',
      messageDataAnonimisasi: counts.jumlahDataAnonimisasi > 0 ? `*PERKARA PUTUSAN BELUM ANONIMISASI* SEJUMLAH *${counts.jumlahDataAnonimisasi} PERKARA* : \n${messageDataAnonimisasi}` : '',
      messageLupaTunda: counts.jumlahLupaTunda > 0 ? `*DATA LUPA TUNDA* SEJUMLAH *${counts.jumlahLupaTunda} PERKARA* : \n${messageLupaTunda}` : ''
    };
    
    const messagesToSend = Object.values(messages).filter(value => value !== '');
    
    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }
    
    let msg = `*Hai, mengingatkan kembali tentang situasi keadaan perkara ${role} ${nama} sampai sore hari ini :*\n\n`;
    msg += messagesToSend.join('\n\n');
    
    if (!testMode) {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    } else {
      console.log(`Test Mode: Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    }

    return msg; 
  } catch (error) {
    console.log(error);
  }
};

// Mengatur pengingat untuk sidang
const statusSidangHakim = (cronTime, id, nama, getDataPutusanBelumMinut, getDataUploadPutusan, getDataEdocAnonimisasi, getDataLupaTundaHakim, role, testMode = false) => { 
  cron.schedule(cronTime, () => {
    sendStatusSidangHakim(id, nama, getDataPutusanBelumMinut, getDataUploadPutusan, getDataEdocAnonimisasi, getDataLupaTundaHakim, role, testMode).then((message) => {
      if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat:", error);
    });
  });
};

// Mengatur pengingat untuk semua hakim
Object.entries(hakimIds).forEach(([nama, id]) => {
  statusSidangHakim("30 14 * * Monday-Friday", id, nama, notification.getDataPutusanBelumMinutHakim, notification.getDataUploadPutusanHakim, notification.getDataEdocAnonimisasiHakim, notification.getDataLupaTundaHakim, "Majelis Hakim/Hakim Tunggal", false);
  statusSidangHakim("00 19 * * Monday-Friday", id, nama, notification.getDataPutusanBelumMinutHakim, notification.getDataUploadPutusanHakim, notification.getDataEdocAnonimisasiHakim, notification.getDataLupaTundaHakim, "Majelis Hakim/Hakim Tunggal", false);
});

// NOTIFIKASI PENGINGAT MINUTASI, TUNDA MEDIASI DAN TUNDA SIDANG YANG LUPA
const sendStatusSidangPanitera = async (id, nama, getDataPutusanBelumMinut, getDataTundaMediasi, getDataLupaTunda, role, testMode = false) => {
  try {
    let messagePutusanBelumMinut = await getDataPutusanBelumMinut(nama);
    let messageTundaMediasi = await getDataTundaMediasi(nama);
    let messageLupaTunda = await getDataLupaTunda(nama);

    const counts = {
      jumlahBelumMinut: messagePutusanBelumMinut === "Tidak ada data" ? 0 : messagePutusanBelumMinut.split('\n\n').length,
      jumlahTundaMediasi: messageTundaMediasi === "Tidak ada data" ? 0 : messageTundaMediasi.split('\n\n').length,
      jumlahLupaTunda: messageLupaTunda === "Tidak ada data" ? 0 : messageLupaTunda.split('\n\n').length
    };

    if (messagePutusanBelumMinut === "Tidak ada data" && messageTundaMediasi === "Tidak ada data" && messageLupaTunda === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }
    
    const messages = {
      messagePutusanBelumMinut: counts.jumlahBelumMinut > 0 ? `*DATA PUTUSAN YANG BELUM DI MINUTASI* SEJUMLAH *${counts.jumlahBelumMinut} PERKARA* : \n${messagePutusanBelumMinut}` : '',
      messageTundaMediasi: counts.jumlahTundaMediasi > 0 ? `*PERKARA YANG BELUM DI TUNDA MEDIASI* SEJUMLAH *${counts.jumlahTundaMediasi} PERKARA* : \n${messageTundaMediasi}` : '',
      messageLupaTunda: counts.jumlahLupaTunda > 0 ? `*PERKARA YANG BELUM DILAKUKAN PENUNDAAN* SEJUMLAH *${counts.jumlahLupaTunda} PERKARA* : \n${messageLupaTunda}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, mengingatkan kembali tentang situasi keadaan perkara ${role} ${nama} sampai sore hari ini :_*\n`;
    msg += messagesToSend.join('\n\n');
    
    if (testMode) {
      console.log(`[TEST MODE] Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    } else {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    }

    return msg;
  } catch (error) {
    console.log(error);
  }
};

// Fungsi untuk menjadwalkan tugas pengiriman status sidang panitera
const statusSidangPanitera = (cronTime, id, nama, getDataPutusanBelumMinut, getDataTundaMediasi, getDataLupaTunda, role, testMode = false) => {
  cron.schedule(cronTime, () => {
    sendStatusSidangPanitera(id, nama, getDataPutusanBelumMinut, getDataTundaMediasi, getDataLupaTunda, role, testMode).then((message) => {
      if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat:", error);
    });
  });
};

// Mengatur pengingat untuk semua panitera
Object.entries(paniteraIds).forEach(([nama, id]) => {
  statusSidangPanitera("30 14 * * Monday-Friday", id, nama, notification.getDataPutusanBelumMinutPanitera, notification.getDataTundaMediasiPanitera, notification.getDataLupaTundaPanitera, "Panitera", false);
  statusSidangPanitera("45 18 * * Monday-Friday", id, nama, notification.getDataPutusanBelumMinutPanitera, notification.getDataTundaMediasiPanitera, notification.getDataLupaTundaPanitera, "Panitera", false);
});

// NOTIFIKASI ANTRIAN SIDANG YANG TELAH HADIR HARI INI
const sendAntrianSidangHariIni = async (id, nama, getDataAntrianSidangHariIni, role, testMode = false) => { 
  try {
    let messageAntrianSidangHariIni = await getDataAntrianSidangHariIni(nama);
    console.log(`Hasil ${role} ${nama}:`, messageAntrianSidangHariIni);
    
    const jumlahSidangHariIni = messageAntrianSidangHariIni === "Tidak ada data" ? 0 : messageAntrianSidangHariIni.split('\n\n').length;

    if (messageAntrianSidangHariIni === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `Hai, saya Aleta, sekarang telah pukul 08:55, berikut perkara ditangani oleh ${role} ${nama} yang telah hadir sejumlah *${jumlahSidangHariIni} Perkara* :\n${messageAntrianSidangHariIni}`;
    
    if (testMode) { 
      console.log(`[TEST MODE] Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    } else {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    }

    return msg;
  } catch (error) {
    console.log(`Gagal mengirim pesan ke ${role} ${nama}:`, error);
  }
};

// Mengatur pengingat untuk bas
const statusSidangHariIni = (id, nama, getDataAntrianSidangHariIni, role, testMode = false) => { 
  cron.schedule("55 08 * * Monday-Friday", () => {
    sendAntrianSidangHariIni(id, nama, getDataAntrianSidangHariIni, role, testMode).then((message) => { 
      if (message) {
        console.log(`Pesan berhasil dikirim ke ${role} ${nama}`, id); 
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat antrian sidang hari ini:", error);
    });
  });
}

// Mengatur pengingat untuk semua hakim
Object.entries(hakimIds).forEach(([nama, id]) => {
  statusSidangHariIni(id, nama, notification.getDataAntrianSidangHakim, "Majelis Hakim/Hakim Tunggal", false); 
});

// Mengatur pengingat untuk semua panitera
Object.entries(paniteraIds).forEach(([nama, id]) => {
  statusSidangHariIni(id, nama, notification.getDataAntrianSidangPanitera, "Panitera", false); 
});

// NOTIFIKASI PUTUS DAN TUNDA SIDANG HARI SIDANG JURUSITA
const sendStatusSidangJurusita = async (id, nama, getDataPutusJurusita, getDataTundaJurusita, role, testMode = false) => { 
  try {
    let messagePutusJurusita = await getDataPutusJurusita(nama);
    let messageTundaJurusita = await getDataTundaJurusita(nama);

    const counts = {
      jumlahPutus: messagePutusJurusita === "Tidak ada data" ? 0 : messagePutusJurusita.split('\n\n').length,
      jumlahTunda: messageTundaJurusita === "Tidak ada data" ? 0 : messageTundaJurusita.split('\n\n').length
    };

    if (messagePutusJurusita === "Tidak ada data" && messageTundaJurusita === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    const messages = {
      messagePutus: counts.jumlahPutus > 0 ? `*PUTUS HARI INI* SEJUMLAH *${counts.jumlahPutus} PERKARA* : \n${messagePutusJurusita}` : '',
      messageTunda: counts.jumlahTunda > 0 ? `*TUNDA HARI INI* SEJUMLAH *${counts.jumlahTunda} PERKARA* : \n${messageTundaJurusita}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, saya Aleta, berikut data keadaan perkara ${role} ${nama} :_*\n`;
    msg += messagesToSend.join('\n\n');

    if (testMode) {
      console.log(`[TEST MODE] Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    } else {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    }

    return msg;
  } catch (error) {
    console.log(error);
  }
};

// Fungsi untuk menjadwalkan tugas pengiriman status sidang jurusita
const statusSidangJurusita = (cronTime, id, nama, getDataPutusJurusita, getDataTundaJurusita, role, testMode = false) => {
  cron.schedule(cronTime, () => {
    sendStatusSidangJurusita(id, nama, getDataPutusJurusita, getDataTundaJurusita, role, testMode).then((message) => {
      if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat:", error);
    });
  });
};

Object.entries(jurusitaIds).forEach(([nama, id]) => {
  statusSidangJurusita("00 12 * * Monday-Friday", id, nama, notification.getDataPutusJurusitaNew, notification.getDataTundaJurusitaNew, "Jurusita", false); 
  statusSidangJurusita("15 16 * * Monday-Friday", id, nama, notification.getDataPutusJurusitaNew, notification.getDataTundaJurusitaNew, "Jurusita", false); 
});

//     const jumlahBas = messageBeritaAcaraSidang === "Tidak ada data" ? 0 : messageBeritaAcaraSidang.split('\n\n').length;

//     let msg = `*_Hai, Saya Aleta, mengingatkan kembali mengenai status BAS untuk ${role} ${nama} :_*\n\n*DATA PERKARA YANG BELUM UPLOAD BAS* SEJUMLAH *${jumlahBas} PERKARA* :\n${messageBeritaAcaraSidang}`;
    
//NOTIFIKASI KEADAAN RELAAS, DELEGASI KELUAR DAN DELEGASI MASUK
const sendRelaasJurusita = async (id, nama, getBelumPanggilan, getDataBelumDelegasi, getDataPemberitahuanPutusanBelum, role, testMode = false) => {
  try {
    let messageBelumPanggilan = await getBelumPanggilan(nama);
    let messageDataBelumDelegasi = await getDataBelumDelegasi(nama);
    let messagePemberitahuanPutusanBelum = await getDataPemberitahuanPutusanBelum(nama);

    const counts = {
      jumlahPanggilan: messageBelumPanggilan === "Tidak ada data" ? 0 : messageBelumPanggilan.split('\n\n').length,
      jumlahDelegasi: messageDataBelumDelegasi === "Tidak ada data" ? 0 : messageDataBelumDelegasi.split('\n\n').length,
      jumlahPemberitahuan: messagePemberitahuanPutusanBelum === "Tidak ada data" ? 0 : messagePemberitahuanPutusanBelum.split('\n\n').length
    };
    
    if (messageBelumPanggilan === "Tidak ada data" && messageDataBelumDelegasi === "Tidak ada data" && messagePemberitahuanPutusanBelum === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    const messages = {
      messageBelumPanggilan: counts.jumlahPanggilan > 0 ? `*PANGGILAN BELUM DILAKSANAKAN UNTUK SIDANG HARI INI* SEJUMLAH *${counts.jumlahPanggilan} PERKARA* : \n${messageBelumPanggilan}` : '',
      messageDataBelumDelegasi: counts.jumlahDelegasi > 0 ? `*DATA DELEGASI BELUM DILAKSANAKAN* SEJUMLAH *${counts.jumlahDelegasi} PERKARA* : \n${messageDataBelumDelegasi}` : '',
      messagePemberitahuanPutusanBelum: counts.jumlahPemberitahuan > 0 ? `*DATA PERKARA SUDAH PUTUS YANG BELUM DIBERITAHUKAN* SEJUMLAH *${counts.jumlahPemberitahuan} PERKARA* : \n${messagePemberitahuanPutusanBelum}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, mengingatkan kembali tentang situasi keadaan perkara ${role} ${nama} sampai sore hari ini :_*\n`;
    msg += messagesToSend.join('\n\n');
    
    if (testMode) { 
      console.log(`[TEST MODE] Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    } else {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    }

    return msg;
  } catch (error) {
    console.log(error);
  }
};

// Mengatur pengingat untuk relaas jurusita
const statusRelaasJurusita = (id, nama, getBelumPanggilan, getDataBelumDelegasi, getDataPemberitahuanPutusanBelum, role, testMode = false) => {
  cron.schedule("00 09 * * Friday", () => {
    sendRelaasJurusita(id, nama, getBelumPanggilan, getDataBelumDelegasi, getDataPemberitahuanPutusanBelum, role, testMode).then((message) => {
      if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat:", error);
    });
  });
};

Object.entries(jurusitaIds).forEach(([nama, id]) => {
  statusRelaasJurusita(id, nama, notification.getBelumPanggilanJurusita, notification.getDataBelumDelegasiJurusita, notification.getDataPemberitahuanPutusanBelumJurusita, "Jurusita", false);
});

//     const jumlahPengingatRelaas = messagePengingatRelaas === "Tidak ada data" ? 0 : messagePengingatRelaas.split('\n\n').length;

//     let msg = `*_Hai, saya Aleta, berikut adalah batas akhir pelaksanaan panggilan untuk ${role} ${nama} sejumlah ${jumlahPengingatRelaas} Perkara :_* \n${messagePengingatRelaas}`;
    
//     const jumlahRelaas = messageBelumPanggilanHariIni === "Tidak ada data" ? 0 : messageBelumPanggilanHariIni.split('\n\n').length;

//     let msg = `*_Hai, saya Aleta, berikut data keadaan perkara untuk ${role} ${nama} :_*\n\n*PANGGILAN BELUM DILAKSANAKAN UNTUK SIDANG HARI INI* SEJUMLAH *${jumlahRelaas} PERKARA* : \n${messageBelumPanggilanHariIni}`;
    
//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = `*_Hai, berikut keadaan perkara ${role} ${nama} yang ditangani :_*\n`;
//     msg += messagesToSend.join('\n\n');

// NOTIFIKASI PARA PIHAK
// Fungsi untuk mengirim pesan ke pihak baru
const sendPihakBaru = async (testMode = false) => {
  try {
    const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = await notification.getDataPihakBaru();
    console.log("Pihak P Daftar/Sidang Pertama:", pihakP); 
    console.log("Pihak T Daftar/Sidang Pertama:", pihakT); 
    console.log("Kuasa P Daftar/Sidang Pertama:", kuasaP); 
    console.log("Kuasa T Daftar/Sidang Pertama:", kuasaT); 
    console.log("Turut T Daftar/Sidang Pertama:", turutT); 
    console.log("Intervensi Daftar/Sidang Pertama:", intervensi); 

    const sentMessages = new Set();

    const groupedPihak = {};

    pihakP.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakP.push(pihak);
    });

    pihakT.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakT.push(pihak);
    });

    kuasaP.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaP.push(kuasa);
    });

    kuasaT.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaT.push(kuasa);
    });

    turutT.forEach(turut => {
      const key = turut.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].turutT.push(turut);
    });

    intervensi.forEach(intervensi => {
      const key = intervensi.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].intervensi.push(intervensi);
    });

    // Kirim pesan untuk setiap grup berdasarkan perkara_id
    for (const key in groupedPihak) {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

      // Kirim pesan untuk pihak P
      if (pihakP.length > 0) {
        for (const pihak of pihakP) {
          const formattedNumber = phoneNumberFormatter(pihak.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${pihak.nama}*\n` +
          `- Jenis Perkara: *${pihak.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${pihak.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${pihak.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${pihak.tanggal_sidang}*\n` +
          `- Ruangan: *${pihak.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          // Fungsi Pengiriman file edoc gugatan
          const hostFilePath = `/var/www/html/SIPP/${pihak.petitum_dok}`;
          const containerFilePath = path.join('temp', `${pihak.petitum_dok}`);
          const containerHostname = 'aleta-bot-v2-container'; //ganti sesuai dengan nama docker container
          const dockerCpCommand = `docker cp ${hostFilePath} ${containerHostname}:${containerFilePath}`;

          exec(dockerCpCommand, async (error, stdout, stderr) => {
            if (error) {
              console.error(`Gagal menyalin file: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`Stderr dari perintah docker cp: ${stderr}`);
              return;
            }

            console.log(`File berhasil disalin ke container: ${stdout}`);

            const existsCommand = `docker exec ${containerHostname} test -f ${containerFilePath}`;
            exec(existsCommand, async (checkError, checkStdout, checkStderr) => {
              if (checkError) {
                console.log(`File tidak ditemukan di container: ${checkError.message}`);
                if (testMode) {
                  console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                } else {
                  await safeSendMessage(formattedNumber, message);
                  console.log(`Pesan berhasil dikirim ke Penggugat Pihak Baru ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                }
                return;
              }
              if (checkStderr) {
                console.error(`Stderr dari perintah pemeriksaan: ${checkStderr}`);
                return;
              }

              // Kirim file melalui WhatsApp
              const media = MessageMedia.fromFilePath(containerFilePath);
              await safeSendMessage(formattedNumber, media, { caption: message });
              console.log(`File .rtf berhasil dikirim ke ${formattedNumber}`);

              // Hapus file sementara setelah dikirim
              fs.unlinkSync(containerFilePath);
            });
          });
        }
      }

      // Kirim pesan untuk pihak T
      if (pihakT.length > 0) {
        for (const pihak of pihakT) {
          const formattedNumber = phoneNumberFormatter(pihak.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${pihak.nama}*\n` +
          `- Jenis Perkara: *${pihak.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${pihak.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${pihak.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${pihak.tanggal_sidang}*\n` +
          `- Ruangan: *${pihak.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          // Fungsi Pengiriman file edoc gugatan
          const hostFilePath = `/var/www/html/SIPP/${pihak.petitum_dok}`;
          const containerFilePath = path.join('temp', `${pihak.petitum_dok}`);
          const containerHostname = 'aleta-bot-v2-container'; //ganti sesuai dengan nama docker container
          const dockerCpCommand = `docker cp ${hostFilePath} ${containerHostname}:${containerFilePath}`;

          exec(dockerCpCommand, async (error, stdout, stderr) => {
            if (error) {
              console.error(`Gagal menyalin file: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`Stderr dari perintah docker cp: ${stderr}`);
              return;
            }

            console.log(`File berhasil disalin ke container: ${stdout}`);

            const existsCommand = `docker exec ${containerHostname} test -f ${containerFilePath}`;
            exec(existsCommand, async (checkError, checkStdout, checkStderr) => {
              if (checkError) {
                console.log(`File tidak ditemukan di container: ${checkError.message}`);
                if (testMode) {
                  console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                } else {
                  await safeSendMessage(formattedNumber, message);
                  console.log(`Pesan berhasil dikirim ke Tergugat Pihak Baru ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                }
                return;
              }
              if (checkStderr) {
                console.error(`Stderr dari perintah pemeriksaan: ${checkStderr}`);
                return;
              }

              // Kirim file melalui WhatsApp
              const media = MessageMedia.fromFilePath(containerFilePath);
              await safeSendMessage(formattedNumber, media, { caption: message });
              console.log(`File .rtf berhasil dikirim ke ${formattedNumber}`);

              // Hapus file sementara setelah dikirim
              fs.unlinkSync(containerFilePath);
            });
          });
        }
      }

      // Kirim pesan untuk kuasa P
      if (kuasaP.length > 0) {
        for (const kuasa of kuasaP) {
          const formattedNumber = phoneNumberFormatter(kuasa.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${kuasa.nama}*\n` +
          `- Jenis Perkara: *${kuasa.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${kuasa.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${kuasa.tanggal_sidang}*\n` +
          `- Ruangan: *${kuasa.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          // Fungsi Pengiriman file edoc gugatan
          const hostFilePath = `/var/www/html/SIPP/${kuasa.petitum_dok}`;
          const containerFilePath = path.join('temp', `${kuasa.petitum_dok}`);
          const containerHostname = 'aleta-bot-v2-container'; //ganti sesuai dengan nama docker container
          const dockerCpCommand = `docker cp ${hostFilePath} ${containerHostname}:${containerFilePath}`;

          exec(dockerCpCommand, async (error, stdout, stderr) => {
            if (error) {
              console.error(`Gagal menyalin file: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`Stderr dari perintah docker cp: ${stderr}`);
              return;
            }

            console.log(`File berhasil disalin ke container: ${stdout}`);

            const existsCommand = `docker exec ${containerHostname} test -f ${containerFilePath}`;
            exec(existsCommand, async (checkError, checkStdout, checkStderr) => {
              if (checkError) {
                console.log(`File tidak ditemukan di container: ${checkError.message}`);
                if (testMode) {
                  console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                } else {
                  await safeSendMessage(formattedNumber, message);
                  console.log(`Pesan berhasil dikirim ke Kuasa Penggugat Pihak Baru ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                }
                return;
              }
              if (checkStderr) {
                console.error(`Stderr dari perintah pemeriksaan: ${checkStderr}`);
                return;
              }

              // Kirim file melalui WhatsApp
              const media = MessageMedia.fromFilePath(containerFilePath);
              await safeSendMessage(formattedNumber, media, { caption: message });
              console.log(`File .rtf berhasil dikirim ke ${formattedNumber}`);

              // Hapus file sementara setelah dikirim
              fs.unlinkSync(containerFilePath);
            });
          });
        }
      }

      // Kirim pesan untuk kuasa T
      if (kuasaT.length > 0) {
        for (const kuasa of kuasaT) {
          const formattedNumber = phoneNumberFormatter(kuasa.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${kuasa.nama}*\n` +
          `- Jenis Perkara: *${kuasa.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${kuasa.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${kuasa.tanggal_sidang}*\n` +
          `- Ruangan: *${kuasa.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          // Fungsi Pengiriman file edoc gugatan
          const hostFilePath = `/var/www/html/SIPP/${kuasa.petitum_dok}`;
          const containerFilePath = path.join('temp', `${kuasa.petitum_dok}`);
          const containerHostname = 'aleta-bot-v2-container'; //ganti sesuai dengan nama docker container
          const dockerCpCommand = `docker cp ${hostFilePath} ${containerHostname}:${containerFilePath}`;

          exec(dockerCpCommand, async (error, stdout, stderr) => {
            if (error) {
              console.error(`Gagal menyalin file: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`Stderr dari perintah docker cp: ${stderr}`);
              return;
            }

            console.log(`File berhasil disalin ke container: ${stdout}`);

            const existsCommand = `docker exec ${containerHostname} test -f ${containerFilePath}`;
            exec(existsCommand, async (checkError, checkStdout, checkStderr) => {
              if (checkError) {
                console.log(`File tidak ditemukan di container: ${checkError.message}`);
                if (testMode) {
                  console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                } else {
                  await safeSendMessage(formattedNumber, message);
                  console.log(`Pesan berhasil dikirim ke Kuasa Tergugat Pihak Baru ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                }
                return;
              }
              if (checkStderr) {
                console.error(`Stderr dari perintah pemeriksaan: ${checkStderr}`);
                return;
              }

              // Kirim file melalui WhatsApp
              const media = MessageMedia.fromFilePath(containerFilePath);
              await safeSendMessage(formattedNumber, media, { caption: message });
              console.log(`File .rtf berhasil dikirim ke ${formattedNumber}`);

              // Hapus file sementara setelah dikirim
              fs.unlinkSync(containerFilePath);
            });
          });
        }
      }

      // Kirim pesan untuk turut T
      if (turutT.length > 0) {
        for (const turut of turutT) {
          const formattedNumber = phoneNumberFormatter(turut.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${turut.nama}*\n` +
          `- Jenis Perkara: *${turut.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${turut.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${turut.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${turut.tanggal_sidang}*\n` +
          `- Ruangan: *${turut.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          // Fungsi Pengiriman file edoc gugatan
          const hostFilePath = `/var/www/html/SIPP/${turut.petitum_dok}`;
          const containerFilePath = path.join('temp', `${kuasa.petitum_dok}`);
          const containerHostname = 'aleta-bot-v2-container'; //ganti sesuai dengan nama docker container
          const dockerCpCommand = `docker cp ${hostFilePath} ${containerHostname}:${containerFilePath}`;

          exec(dockerCpCommand, async (error, stdout, stderr) => {
            if (error) {
              console.error(`Gagal menyalin file: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`Stderr dari perintah docker cp: ${stderr}`);
              return;
            }

            console.log(`File berhasil disalin ke container: ${stdout}`);

            const existsCommand = `docker exec ${containerHostname} test -f ${containerFilePath}`;
            exec(existsCommand, async (checkError, checkStdout, checkStderr) => {
              if (checkError) {
                console.log(`File tidak ditemukan di container: ${checkError.message}`);
                if (testMode) {
                  console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                } else {
                  await safeSendMessage(formattedNumber, message);
                  console.log(`Pesan berhasil dikirim ke Kuasa Penggugat Pihak Baru ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                }
                return;
              }
              if (checkStderr) {
                console.error(`Stderr dari perintah pemeriksaan: ${checkStderr}`);
                return;
              }

              // Kirim file melalui WhatsApp
              const media = MessageMedia.fromFilePath(containerFilePath);
              await safeSendMessage(formattedNumber, media, { caption: message });
              console.log(`File .rtf berhasil dikirim ke ${formattedNumber}`);

              // Hapus file sementara setelah dikirim
              fs.unlinkSync(containerFilePath);
            });
          });
        }
      }

      // Kirim pesan untuk intervensi
      if (intervensi.length > 0) {
        for (const inv of intervensi) {
          const formattedNumber = phoneNumberFormatter(inv.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${inv.nama}*\n` +
          `- Jenis Perkara: *${inv.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${inv.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${inv.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${inv.tanggal_sidang}*\n` +
          `- Ruangan: *${inv.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          // Fungsi Pengiriman file edoc gugatan
          const hostFilePath = `/var/www/html/SIPP/${inv.petitum_dok}`;
          const containerFilePath = path.join('temp', `${inv.petitum_dok}`);
          const containerHostname = 'aleta-bot-v2-container'; //ganti sesuai dengan nama docker container
          const dockerCpCommand = `docker cp ${hostFilePath} ${containerHostname}:${containerFilePath}`;

          exec(dockerCpCommand, async (error, stdout, stderr) => {
            if (error) {
              console.error(`Gagal menyalin file: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`Stderr dari perintah docker cp: ${stderr}`);
              return;
            }

            console.log(`File berhasil disalin ke container: ${stdout}`);

            const existsCommand = `docker exec ${containerHostname} test -f ${containerFilePath}`;
            exec(existsCommand, async (checkError, checkStdout, checkStderr) => {
              if (checkError) {
                console.log(`File tidak ditemukan di container: ${checkError.message}`);
                if (testMode) {
                  console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                } else {
                  await safeSendMessage(formattedNumber, message);
                  console.log(`Pesan berhasil dikirim ke Intervensi Pihak Baru ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}`);
                }
                return;
              }
              if (checkStderr) {
                console.error(`Stderr dari perintah pemeriksaan: ${checkStderr}`);
                return;
              }

              // Kirim file melalui WhatsApp
              const media = MessageMedia.fromFilePath(containerFilePath);
              await safeSendMessage(formattedNumber, media, { caption: message });
              console.log(`File .rtf berhasil dikirim ke ${formattedNumber}`);

              // Hapus file sementara setelah dikirim
              fs.unlinkSync(containerFilePath);
            });
          });
        }
      }
    }
  } catch (error) {
    console.error('Gagal mengambil data atau mengirim pesan:', error.message);
  }
};

const sendMessagePihakBaru = (testMode = false) => {
  cron.schedule("00 17 * * Monday-Friday", async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak baru...");
          await sendPihakBaru(testMode); // Memanggil fungsi sendPihakBaru dengan testMode
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
  });
};

// Panggil fungsi penjadwalan
sendMessagePihakBaru();

// Fungsi untuk mengirim pesan akta cerai
const sendPihakAktaCerai = async (testMode = false) => {
    try {
        const { pihakP, pihakT } = await notification.getDataPihakAktaCerai(); // Ambil data akta cerai
        console.log("Data Akta Cerai Pihak P:", pihakP); // Log data akta cerai pihak P
        console.log("Data Akta Cerai Pihak T:", pihakT); // Log data akta cerai pihak T

        const groupedPihak = {};

        pihakP.forEach(pihak => {
            const key = pihak.perkara_id;
            if (!groupedPihak[key]) {
                groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
            }
            groupedPihak[key].pihakP.push(pihak);
        });

        pihakT.forEach(pihak => {
            const key = pihak.perkara_id;
            if (!groupedPihak[key]) {
                groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
            }
            groupedPihak[key].pihakT.push(pihak);
        });

        // Kirim pesan untuk setiap grup berdasarkan perkara_id
        for (const key in groupedPihak) {
            const { pihakP, pihakT } = groupedPihak[key];

            const sentMessages = new Set();

            // Kirim pesan untuk pihak P
            for (const pihak of pihakP) {
                const formattedNumber = phoneNumberFormatter(pihak.telepon);
                const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
                `Halo, saya Aleta, Bot ${pengadilan}.\n` +
                `Informasi mengenai Akta Cerai Anda:\n` +
                `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
                `- Nama: *${pihak.nama}*\n` +
                `- Nomor Seri Akta Cerai: *${pihak.no_seri_akta_cerai}*\n` +
                `- Tanggal Terbit Akta Cerai: *${pihak.tanggal_akta_cerai}*\n\n` +
                `Akta Cerai sekarang dapat diambil secara online.\n` +
                `Silahkan mengunjungi https://eac.mahkamahagung.go.id/ dan apabila masih belum memahami silahkan hubungi *0822-7111-5021*.\n\n` +
                `Ini adalah notifikasi, Anda tidak perlu membalasnya. Abaikan pesan ini jika Akta Cerai telah diambil. Terima kasih.`;

                if (!sentMessages.has(formattedNumber)) {
                  try {
                    if (testMode) {
                      console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                    } else {
                      await safeSendMessage(formattedNumber, message);
                      console.log(`Pesan berhasil dikirim ke Penggugat Akta Cerai ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                    }
                  } catch (sendError) {
                    console.error(`Gagal kirim pesan ke ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                  }
                  sentMessages.add(formattedNumber);
                }
            }

            // Kirim pesan untuk pihak T
            for (const pihak of pihakT) {
                const formattedNumber = phoneNumberFormatter(pihak.telepon);
                const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
                `Halo, saya Aleta, Bot ${pengadilan}.\n` +
                `Informasi mengenai Akta Cerai Anda:\n` +
                `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
                `- Nama: *${pihak.nama}*\n` +
                `- Nomor Seri Akta Cerai: *${pihak.no_seri_akta_cerai}*\n` +
                `- Tanggal Terbit Akta Cerai: *${pihak.tanggal_akta_cerai}*\n\n` +
                `Akta Cerai sekarang dapat diambil secara online.\n` +
                `Silahkan mengunjungi https://eac.mahkamahagung.go.id/ dan apabila masih belum memahami silahkan hubungi *0822-7111-5021*.\n\n` +
                `Ini adalah notifikasi, Anda tidak perlu membalasnya. Abaikan pesan ini jika Akta Cerai telah diambil. Terima kasih.`;

                if (!sentMessages.has(formattedNumber)) {
                  try {
                    if (testMode) {
                      console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                    } else {
                      await safeSendMessage(formattedNumber, message);
                      console.log(`Pesan berhasil dikirim ke ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                    }
                  } catch (sendError) {
                    console.error(`Gagal kirim pesan ke Tergugat Akta Cerai ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                  }
                  sentMessages.add(formattedNumber);
                }
            }
        }
    } catch (error) {
        console.error("Error sending akta cerai messages:", error);
    }
};

const sendMessagePihakAktaCerai = (testMode = false) => {
  cron.schedule("00 16 * * *", async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak belum ambil akta cerai ...");
          await sendPihakAktaCerai(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
  });
};

sendMessagePihakAktaCerai();

// Fungsi untuk mengirim pesan kurang sisa panjar
const sendPihakSisaPanjar = async (testMode = false) => {
  try {
    const { sisaPanjar } = await notification.getDataHabisBiaya();
    console.log("Sisa Panjar:", sisaPanjar); // Log data Sisa Panjar

    const sentMessages = new Set();

    if (sisaPanjar && sisaPanjar.length > 0) {
      for (const pihak of sisaPanjar) {
        const formattedNumber = phoneNumberFormatter(pihak.telepon);
        const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
        `Sdr/Sdri **${pihak.nama}**, perkara Nomor ${pihak.nomor_perkara} memiliki sisa biaya:\n` +
        `- Kurang dari Rp100.000,00 atau telah habis.\n\n` +
        `Tindakan yang perlu dilakukan:\n` +
        `1. Silakan ke PTSP ${pengadilan} untuk arahan penambahan panjar.\n` +
        `2. Lakukan pembayaran hanya di kasir ${pengadilan}.\n\n` +
        `Untuk cek biaya, ketik:\n` +
        `biaya#${pihak.nomor_urut_perkara}.${pihak.alur_status}.${pihak.tahun_pendaftaran}\n\n` +
        `Ini adalah notifikasi, anda tidak perlu membalasnya.\nInfo lebih lanjut hubungi *0822-7111-5021*.`;

        if (!sentMessages.has(formattedNumber)) {
          try {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              await safeSendTrackedMessage({
                id: formattedNumber,
                message,
                category: "party",
                notificationKey: "pihak-sisa-panjar",
                recipientName: pihak.nama,
                idempotencyKey: buildIdempotencyKey({
                  notificationKey: "pihak-sisa-panjar",
                  perkaraId: pihak.perkara_id,
                  nomorPerkara: pihak.nomor_perkara,
                  recipientNumber: formattedNumber,
                  eventDate: new Date().toISOString().slice(0, 10),
                  messageType: "sisa-panjar-habis",
                }),
                metadata: {
                  source: "pilot_pihak_sisa_panjar",
                  nomorPerkara: pihak.nomor_perkara,
                  perkaraId: pihak.perkara_id,
                },
              });
              console.log(`Pesan berhasil dikirim ke Pihak Sisa Panjar ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
            }
          } catch (sendError) {
            console.error(`Gagal kirim pesan ke Pihak Sisa Panjar ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
          }
          sentMessages.add(formattedNumber);
        }
      }
    }
  } catch (error) {
    console.error("Error sending sisa panjar messages:", error);
  }
};

const sendMessagePihakPanjar = (testMode = false) => {
  cron.schedule("00 19 * * *", async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak kurang panjar ...");
          await sendPihakSisaPanjar(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
  });
};

sendMessagePihakPanjar();

// Fungsi untuk mengirim pesan sisa panjar yang belum diambil
const sendPihakPanjarBelum = async (testMode = false) => {
  try {
    const { sisaPertama, sisaBanding, sisaKasasi, sisaPk, sisaEksekusi } = await notification.getDataPihakSisaPanjar();
    const allSisaPanjar = [...sisaPertama, ...sisaBanding, ...sisaKasasi, ...sisaPk, ...sisaEksekusi];
    console.log("Sisa Panjar Belum:", allSisaPanjar); // Log data Sisa Panjar

    const sentMessages = new Set();

    if (allSisaPanjar && allSisaPanjar.length > 0) {
      for (const pihak of allSisaPanjar) {
        const formattedNumber = phoneNumberFormatter(pihak.telepon);
        const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
        `Sdr/Sdri *${pihak.nama}*, perkara Nomor ${pihak.nomor_perkara} memiliki sisa panjar yang belum diambil, yaitu sejumlah :\n\n` +
        `Sisa Panjar : ${pihak.sisa}\n\n` +
        `Silakan ke PTSP ${pengadilan} untuk arahan lebih lanjut.\n\n` +
        `Untuk cek biaya, ketik:\n\n` +
        `biaya#${pihak.nomor_urut_perkara}.${pihak.alur_status}.${pihak.tahun_pendaftaran}\n\n` +
        `Ini adalah notifikasi, anda tidak perlu membalasnya.\nAtau hubungi *0822-7111-5021* untuk info lebih lanjut.`;

        if (!sentMessages.has(formattedNumber)) {
          try {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              await safeSendMessage(formattedNumber, message);
              console.log(`Pesan berhasil dikirim ke Pihak Panjar Belum ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
            }
          } catch (sendError) {
            console.error(`Gagal kirim pesan ke Pihak Panjar Belum ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
          }
          sentMessages.add(formattedNumber);
        }
      }
    }
  } catch (error) {
    console.error("Error sending panjar belum messages:", error);
  }
};

// Menjadwalkan pengiriman pesan panjar yang belum dibayar
const sendMessagePihakPanjarBelum = (testMode = false) => {
  cron.schedule("30 15 * * *", async () => { // Atur waktu sesuai kebutuhan
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak panjar yang belum dibayar ...");
          await sendPihakPanjarBelum(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
  });
};

sendMessagePihakPanjarBelum();

// Fungsi untuk mengirim pesan putusan
const sendPihakPutusan = async (testMode = false) => {
  try {
    const { pihakP: putusanP, pihakT: putusanT, kuasaP: putusanKuasaP, kuasaT: putusanKuasaT, turutT: putusanTurutT, intervensi: putusanIntervensi } = await notification.getDataPutusanPihak(); // Ambil data putusan
    console.log("Data Putusan Pihak P:", putusanP); // Log data putusan pihak P
    console.log("Data Putusan Pihak T:", putusanT); // Log data putusan pihak T
    console.log("Data Putusan Kuasa P:", putusanKuasaP); // Log data putusan kuasa P
    console.log("Data Putusan Kuasa T:", putusanKuasaT); // Log data putusan kuasa T
    console.log("Data Putusan Turut T:", putusanTurutT); // Log data putusan turut T
    console.log("Data Putusan Intervensi:", putusanIntervensi); // Log data putusan intervensi

    const sentMessages = new Set();

    const groupedPihak = {};

    putusanP.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakP.push(pihak);
    });

    putusanT.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakT.push(pihak);
    });

    putusanKuasaP.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaP.push(kuasa);
    });

    putusanKuasaT.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaT.push(kuasa);
    });

    putusanTurutT.forEach(turut => {
      const key = turut.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].turutT.push(turut);
    });

    putusanIntervensi.forEach(intervensi => {
      const key = intervensi.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].intervensi.push(intervensi);
    });

    // Kirim pesan untuk setiap grup berdasarkan perkara_id
    for (const key in groupedPihak) {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

      // Kirim notifikasi putusan untuk pihak P
      if (pihakP.length > 0) {
        for (const putusan of pihakP) { // Iterasi semua putusan P
          const formattedNumber = phoneNumberFormatter(putusan.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${putusan.nama}*\n` +
          `- Jenis Perkara: *${putusan.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${putusan.nomor_perkara}*\n` +
          `- Status Putusan: *${putusan.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${putusan.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${putusan.amar_putusan}` +
          `- Unduh file PDF di ${putusan.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Penggugat Putusan ${putusan.nama} (${formattedNumber}) untuk perkara ${putusan.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Penggugat Putusan ${putusan.nama} (${formattedNumber}) untuk perkara ${putusan.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk pihak T
      if (pihakT.length > 0) {
        for (const putusan of pihakT) { // Iterasi semua putusan T
          const formattedNumber = phoneNumberFormatter(putusan.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${putusan.nama}*\n` +
          `- Jenis Perkara: *${putusan.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${putusan.nomor_perkara}*\n` +
          `- Status Putusan: *${putusan.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${putusan.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${putusan.amar_putusan}` +
          `- Unduh file PDF di ${putusan.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Tergugat Putusan ${putusan.nama} (${formattedNumber}) untuk perkara ${putusan.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Tergugat Putusan${putusan.nama} (${formattedNumber}) untuk perkara ${putusan.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk kuasa P
      if (kuasaP.length > 0) {
        for (const kuasa of kuasaP) { // Iterasi semua kuasa P
          const formattedNumber = phoneNumberFormatter(kuasa.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${kuasa.nama}*\n` +
          `- Jenis Perkara: *${kuasa.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${kuasa.nomor_perkara}*\n` +
          `- Status Putusan: *${kuasa.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${kuasa.amar_putusan}` +
          `- Unduh file PDF di ${kuasa.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Kuasa Penggugat Putusan ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Kuasa Penggugat Putusan${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk kuasa T
      if (kuasaT.length > 0) {
        for (const kuasa of kuasaT) { // Iterasi semua kuasa T
          const formattedNumber = phoneNumberFormatter(kuasa.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${kuasa.nama}*\n` +
          `- Jenis Perkara: *${kuasa.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${kuasa.nomor_perkara}*\n` +
          `- Status Putusan: *${kuasa.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${kuasa.amar_putusan}` +
          `- Unduh file PDF di ${kuasa.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Kuasa Tergugat Putusan ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Kuasa Tergugat Putusan ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk turut T
      if (turutT.length > 0) {
        for (const turut of turutT) { // Iterasi semua turut T
          const formattedNumber = phoneNumberFormatter(turut.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${turut.nama}*\n` +
          `- Jenis Perkara: *${turut.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${turut.nomor_perkara}*\n` +
          `- Status Putusan: *${turut.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${turut.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${turut.amar_putusan}` +
          `- Unduh file PDF di ${turut.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Turut Tergugat Putusan ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Turut Tergugat Putusan${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk intervensi
      if (intervensi.length > 0) {
        for (const inv of intervensi) { // Iterasi semua intervensi
          const formattedNumber = phoneNumberFormatter(inv.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${inv.nama}*\n` +
          `- Jenis Perkara: *${inv.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${inv.nomor_perkara}*\n` +
          `- Status Putusan: *${inv.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${inv.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${inv.amar_putusan}` +
          `- Unduh file PDF di ${inv.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Intervensi Putusan ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Intervensi Putusan ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

    }
  } catch (error) {
    console.error(`Gagal mendapatkan data putusan: ${error.message}`);
  }
};

const sendMessagePihakPutusan = (testMode = false) => {
  cron.schedule("30 23 * * *", async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak putusan ...");
          await sendPihakPutusan(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
  });
};

sendMessagePihakPutusan();

const sendPihakHariSidang = async (testMode = true) => {
  try {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = await notification.getDataPihakHariSidang();
      console.log("Pihak P Sidang Hari Ini:", pihakP); 
      console.log("Pihak T Sidang Hari Ini:", pihakT); 
      console.log("Kuasa P Sidang Hari Ini:", kuasaP); 
      console.log("Kuasa T Sidang Hari Ini:", kuasaT); 
      console.log("Turut T Sidang Hari Ini:", turutT); 
      console.log("Intervensi Sidang Hari Ini:", intervensi); 
      const sentMessages = new Set(); 

      const groupedPihak = {};

      pihakP.forEach(pihak => {
          const key = pihak.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].pihakP.push(pihak);
      });

      pihakT.forEach(pihak => {
          const key = pihak.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].pihakT.push(pihak);
      });

      kuasaP.forEach(kuasa => {
          const key = kuasa.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].kuasaP.push(kuasa);
      });

      kuasaT.forEach(kuasa => {
          const key = kuasa.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].kuasaT.push(kuasa);
      });

      turutT.forEach(turut => {
          const key = turut.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].turutT.push(turut);
      });

      intervensi.forEach(inv => {
          const key = inv.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].intervensi.push(inv);
      });

      // Kirim pesan untuk setiap grup berdasarkan perkara_id
      for (const key in groupedPihak) {
          const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

          // Kirim pesan untuk pihak P
          if (pihakP.length > 0) {
              for (const pihak of pihakP) {
                  const formattedNumber = phoneNumberFormatter(pihak.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${pihak.nama}**\n` +
                  `- Jenis Perkara: ${pihak.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
                  `- Jadwal: ${pihak.hari_sidang}, ${pihak.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${pihak.ruangan}\n` +
                  `- Agenda: ${pihak.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${pihak.para_pihak}\n\n` +
                  `Ambil Antrian Online:\n` +
                  `- *Ketik: daftar antrian#${pihak.nomor_urut_perkara}.${pihak.alur_status}.${pihak.tahun_pendaftaran}.*\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Pihak Penggugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Pihak Penggugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk pihak T
          if (pihakT.length > 0) {
              for (const pihak of pihakT) {
                  const formattedNumber = phoneNumberFormatter(pihak.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${pihak.nama}**\n` +
                  `- Jenis Perkara: ${pihak.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
                  `- Jadwal: ${pihak.hari_sidang}, ${pihak.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${pihak.ruangan}\n` +
                  `- Agenda: ${pihak.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${pihak.para_pihak}\n\n` +
                  `Ambil Antrian Online:\n` +
                  `- *Ketik: antrian online#${pihak.nomor_urut_perkara}.${pihak.alur_status}.${pihak.tahun_pendaftaran}.*\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Pihak Tergugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Pihak Tergugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk kuasa P
          if (kuasaP.length > 0) {
              for (const kuasa of kuasaP) {
                  const formattedNumber = phoneNumberFormatter(kuasa.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${kuasa.nama}**\n` +
                  `- Jenis Perkara: ${kuasa.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${kuasa.nomor_perkara}\n` +
                  `- Jadwal: ${kuasa.hari_sidang}, ${kuasa.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${kuasa.ruangan}\n` +
                  `- Agenda: ${kuasa.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${kuasa.para_pihak}\n\n` +
                  `Ambil Antrian Online:\n` +
                  `- *Ketik: daftar antrian#${kuasa.nomor_urut_perkara}.${kuasa.alur_status}.${kuasa.tahun_pendaftaran}.*\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Kuasa Penggugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Kuasa Penggugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk kuasa T
          if (kuasaT.length > 0) {
              for (const kuasa of kuasaT) {
                  const formattedNumber = phoneNumberFormatter(kuasa.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${kuasa.nama}**\n` +
                  `- Jenis Perkara: ${kuasa.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${kuasa.nomor_perkara}\n` +
                  `- Jadwal: ${kuasa.hari_sidang}, ${kuasa.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${kuasa.ruangan}\n` +
                  `- Agenda: ${kuasa.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${kuasa.para_pihak}\n\n` +
                  `Ambil Antrian Online:\n` +
                  `- *Ketik: antrian online#${kuasa.nomor_urut_perkara}.${kuasa.alur_status}.${kuasa.tahun_pendaftaran}.*\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Kuasa Tergugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Kuasa Tergugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk turut T
          if (turutT.length > 0) {
              for (const turut of turutT) {
                  const formattedNumber = phoneNumberFormatter(turut.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${turut.nama}**\n` +
                  `- Jenis Perkara: ${turut.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${turut.nomor_perkara}\n` +
                  `- Jadwal: ${turut.hari_sidang}, ${turut.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${turut.ruangan}\n` +
                  `- Agenda: ${turut.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${turut.para_pihak}\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Turut Tergugat Hari Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Turut Tergugat Hari Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk intervensi
          if (intervensi.length > 0) {
              for (const inv of intervensi) {
                  const formattedNumber = phoneNumberFormatter(inv.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${inv.nama}**\n` +
                  `- Jenis Perkara: ${inv.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${inv.nomor_perkara}\n` +
                  `- Jadwal: ${inv.hari_sidang}, ${inv.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${inv.ruangan}\n` +
                  `- Agenda: ${inv.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${inv.para_pihak}\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Intervensi Hari Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Intervensi Hari Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }
      }

  } catch (error) {
      console.error(`Terjadi kesalahan: ${error.message}`);
  }
};

const sendMessageHariSidang = (testMode = false) => {
  cron.schedule("00 07 * * *", async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk hari sidang ...");
          await sendPihakHariSidang(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
  });
};

sendMessageHariSidang()

const sendPihakSebelumHariSidang = async (testMode = true) => {
  try {
    const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = await notification.getDataPihakSebelumHariSidang(); // Ambil kuasaP dan kuasaT
    console.log("Pihak P Sidang 3 Hari Lagi:", pihakP); 
    console.log("Pihak T Sidang 3 Hari Lagi:", pihakT); 
    console.log("Kuasa P Sidang 3 Hari Lagi:", kuasaP); 
    console.log("Kuasa T Sidang 3 Hari Lagi:", kuasaT); 
    console.log("Turut T Sidang 3 Hari Lagi:", turutT); 
    console.log("Intervensi Sidang 3 Hari Lagi:", intervensi); 
    const sentMessages = new Set(); 

    const groupedPihak = {};

    pihakP.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakP.push(pihak);
    });

    pihakT.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakT.push(pihak);
    });

    kuasaP.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaP.push(kuasa);
    });

    kuasaT.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaT.push(kuasa);
    });

    turutT.forEach(turut => {
      const key = turut.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].turutT.push(turut);
    });

    intervensi.forEach(inv => {
      const key = inv.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].intervensi.push(inv);
    });

    // Kirim pesan untuk setiap grup berdasarkan perkara_id
    for (const key in groupedPihak) {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

      // Kirim pesan untuk pihak P
      if (pihakP.length > 0) {
        for (const pihak of pihakP) {
          const formattedNumber = phoneNumberFormatter(pihak.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${pihak.nama}**\n` +
          `- Jenis Perkara: ${pihak.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
          `- Jadwal: ${pihak.hari_sidang}, ${pihak.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${pihak.ruangan}\n` +
          `- Agenda: ${pihak.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${pihak.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Penggugat 3 Hari Sebelum Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Penggugat 3 Hari Sebelum Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk pihak T
      if (pihakT.length > 0) {
        for (const pihak of pihakT) {
          const formattedNumber = phoneNumberFormatter(pihak.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${pihak.nama}**\n` +
          `- Jenis Perkara: ${pihak.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
          `- Jadwal: ${pihak.hari_sidang}, ${pihak.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${pihak.ruangan}\n` +
          `- Agenda: ${pihak.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${pihak.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Tergugat 3 Hari Sebelum Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Tergugat 3 Hari Sebelum Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk kuasa P
      if (kuasaP.length > 0) {
        for (const kuasa of kuasaP) {
          const formattedNumber = phoneNumberFormatter(kuasa.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${kuasa.nama}**\n` +
          `- Jenis Perkara: ${kuasa.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${kuasa.nomor_perkara}\n` +
          `- Jadwal: ${kuasa.hari_sidang}, ${kuasa.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${kuasa.ruangan}\n` +
          `- Agenda: ${kuasa.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Kuasa Penggugat 3 Hari Sebelum Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Kuasa Penggugat 3 Hari Sebelum Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk kuasa T
      if (kuasaT.length > 0) {
        for (const kuasa of kuasaT) {
          const formattedNumber = phoneNumberFormatter(kuasa.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${kuasa.nama}**\n` +
          `- Jenis Perkara: ${kuasa.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${kuasa.nomor_perkara}\n` +
          `- Jadwal: ${kuasa.hari_sidang}, ${kuasa.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${kuasa.ruangan}\n` +
          `- Agenda: ${kuasa.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke Kuasa Tergugat 3 Hari Sebelum Sidang ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Kuasa Tergugat 3 Hari Sebelum Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk turut T
      if (turutT.length > 0) {
        for (const turut of turutT) {
          const formattedNumber = phoneNumberFormatter(turut.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${turut.nama}**\n` +
          `- Jenis Perkara: ${turut.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${turut.nomor_perkara}\n` +
          `- Jadwal: ${turut.hari_sidang}, ${turut.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${turut.ruangan}\n` +
          `- Agenda: ${turut.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${turut.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Turut Tergugat 3 Hari Sebelum Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Turut Tergugat 3 Hari Sebelum Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk intervensi
      if (intervensi.length > 0) {
        for (const inv of intervensi) {
          const formattedNumber = phoneNumberFormatter(inv.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${inv.nama}**\n` +
          `- Jenis Perkara: ${inv.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${inv.nomor_perkara}\n` +
          `- Jadwal: ${inv.hari_sidang}, ${inv.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${inv.ruangan}\n` +
          `- Agenda: ${inv.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${inv.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Intervensi 3 Hari Sebelum Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Intervensi 3 Hari Sebelum Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error dalam fungsi sendPihakSebelumHariSidang:', error.message);
  }
};

const sendMessageSebelumHariSidang = (testMode = false) => {
  cron.schedule("00 09 * * *", async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk sebelum hari sidang ...");
          await sendPihakSebelumHariSidang(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
  });
};

sendMessageSebelumHariSidang();

const sendPihakTundaCuti = async (testMode = true) => {
  try {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = await notification.getDataPihakTundaCuti();
      console.log("Pihak P Sidang Tunda Cuti:", pihakP); 
      console.log("Pihak T Sidang Tunda Cuti:", pihakT); 
      console.log("Kuasa P Sidang Tunda Cuti:", kuasaP); 
      console.log("Kuasa T Sidang Tunda Cuti:", kuasaT); 
      console.log("Turut T Sidang Tunda Cuti:", turutT); 
      console.log("Intervensi Sidang Tunda Cuti:", intervensi); 
      const sentMessages = new Set(); 

      const groupedPihak = {};

      pihakP.forEach(pihak => {
          const key = pihak.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].pihakP.push(pihak);
      });

      pihakT.forEach(pihak => {
          const key = pihak.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].pihakT.push(pihak);
      });

      kuasaP.forEach(kuasa => {
          const key = kuasa.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].kuasaP.push(kuasa);
      });

      kuasaT.forEach(kuasa => {
          const key = kuasa.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].kuasaT.push(kuasa);
      });

      turutT.forEach(turut => {
          const key = turut.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].turutT.push(turut);
      });

      intervensi.forEach(inv => {
          const key = inv.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].intervensi.push(inv);
      });

      // Kirim pesan untuk setiap grup berdasarkan perkara_id
      for (const key in groupedPihak) {
          const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

          // Kirim pesan untuk pihak P
          if (pihakP.length > 0) {
              for (const pihak of pihakP) {
                  const formattedNumber = phoneNumberFormatter(pihak.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${pihak.nama} yang dijadwalkan untuk sidang pada hari ${pihak.hari_sidang}, tanggal ${pihak.tanggal_sidang} pada perkara ${pihak.jenis_perkara_nama} dengan nomor register ${pihak.nomor_perkara}, dengan agenda sidang ${pihak.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${pihak.hari_cuti}, tanggal ${pihak.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${pihak.ruangan} dengan agenda sidang ${pihak.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Pihak Penggugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Pihak Penggugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk pihak T
          if (pihakT.length > 0) {
              for (const pihak of pihakT) {
                  const formattedNumber = phoneNumberFormatter(pihak.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${pihak.nama} yang dijadwalkan untuk sidang pada hari ${pihak.hari_sidang}, tanggal ${pihak.tanggal_sidang} pada perkara ${pihak.jenis_perkara_nama} dengan nomor register ${pihak.nomor_perkara}, dengan agenda sidang ${pihak.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${pihak.hari_cuti}, tanggal ${pihak.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${pihak.ruangan} dengan agenda sidang ${pihak.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Pihak Tergugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Pihak Tergugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk kuasa P
          if (kuasaP.length > 0) {
              for (const kuasa of kuasaP) {
                  const formattedNumber = phoneNumberFormatter(kuasa.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${kuasa.nama} yang dijadwalkan untuk sidang pada hari ${kuasa.hari_sidang}, tanggal ${kuasa.tanggal_sidang} pada perkara ${kuasa.jenis_perkara_nama} dengan nomor register ${kuasa.nomor_perkara}, dengan agenda sidang ${kuasa.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${kuasa.hari_cuti}, tanggal ${kuasa.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${kuasa.ruangan} dengan agenda sidang ${kuasa.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Kuasa Penggugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Kuasa Penggugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk kuasa T
          if (kuasaT.length > 0) {
              for (const kuasa of kuasaT) {
                  const formattedNumber = phoneNumberFormatter(kuasa.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${kuasa.nama} yang dijadwalkan untuk sidang pada hari ${kuasa.hari_sidang}, tanggal ${kuasa.tanggal_sidang} pada perkara ${kuasa.jenis_perkara_nama} dengan nomor register ${kuasa.nomor_perkara}, dengan agenda sidang ${kuasa.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${kuasa.hari_cuti}, tanggal ${kuasa.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${kuasa.ruangan} dengan agenda sidang ${kuasa.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Kuasa Tergugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Kuasa Tergugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk turut T
          if (turutT.length > 0) {
              for (const turut of turutT) {
                  const formattedNumber = phoneNumberFormatter(turut.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${turut.nama} yang dijadwalkan untuk sidang pada hari ${turut.hari_sidang}, tanggal ${turut.tanggal_sidang} pada perkara ${turut.jenis_perkara_nama} dengan nomor register ${turut.nomor_perkara}, dengan agenda sidang ${turut.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${turut.hari_cuti}, tanggal ${turut.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${turut.ruangan} dengan agenda sidang ${turut.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Turut Tergugat Hari Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Turut Tergugat Hari Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk intervensi
          if (intervensi.length > 0) {
              for (const inv of intervensi) {
                  const formattedNumber = phoneNumberFormatter(inv.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${inv.nama} yang dijadwalkan untuk sidang pada hari ${inv.hari_sidang}, tanggal ${inv.tanggal_sidang} pada perkara ${inv.jenis_perkara_nama} dengan nomor register ${inv.nomor_perkara}, dengan agenda sidang ${inv.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${inv.hari_cuti}, tanggal ${inv.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${inv.ruangan} dengan agenda sidang ${inv.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Intervensi Hari Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Intervensi Hari Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }
      }

  } catch (error) {
      console.error(`Terjadi kesalahan: ${error.message}`);
  }
};

const sendMessageTundaCuti = (testMode = false) => {
  cron.schedule("00 12 24 11 *", async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk hari sidang ...");
          await sendPihakTundaCuti(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
  });
};

sendMessageTundaCuti()

///////////////////////////////////////////////////

// whatsapp api
// ── WhatsApp Gateway Internal Routes (Task 1) ────────────────────────────────
app.use("/internal/aleta-bot", internalGatewayRoutes);
// ─────────────────────────────────────────────────────────────────────────────

const getRequestToken = (req) => {
  const authHeader = req.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.get("x-aleta-internal-token") || req.get("x-aleta-bot-token") || req.query.token || "";
};

const isLoopbackRequest = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) || ip.endsWith("127.0.0.1");
};

const ensureInternalAccess = (req, res, action = "internal_access") => {
  const runtimeConfig = readRuntimeConfig();
  const configuredToken =
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    runtimeConfig.internalApiToken ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    "";
  const requestToken = getRequestToken(req);

  if (configuredToken && requestToken === configuredToken) {
    return true;
  }

  if (configuredToken && !requestToken) {
    logService.logSecurityEvent({
      eventType: "blocked_internal_endpoint_missing_token",
      severity: "warning",
      message: `Blocked ALETA Bot endpoint access without token: ${action}`,
      metadata: {
        action,
        ip: req.ip || req.socket?.remoteAddress,
        path: req.path,
        hasConfiguredToken: true,
      },
    });

    res.status(401).json({
      status: false,
      ok: false,
      error: "missing_token",
      message: "Forbidden. ALETA Bot internal token is required.",
    });
    return false;
  }

  if (!configuredToken && isLoopbackRequest(req)) {
    return true;
  }

  logService.logSecurityEvent({
    eventType: "blocked_internal_endpoint",
    severity: "warning",
    message: `Blocked ALETA Bot endpoint access: ${action}`,
    metadata: {
      action,
      ip: req.ip || req.socket?.remoteAddress,
      path: req.path,
      hasConfiguredToken: Boolean(configuredToken),
    },
  });

  res.status(403).json({
    status: false,
    ok: false,
    error: "invalid_token",
    message: "Forbidden. ALETA Bot internal token is required.",
  });
  return false;
};

app.get("/internal/aleta-bot/status", (req, res) => {
  if (!ensureInternalAccess(req, res, "status")) return;
  const runtimeConfig = readRuntimeConfig();
  Promise.all([
    messageQueueService.getQueueStats(),
    logService.getMessageStatsToday(),
    logService.getSystemStatsToday(),
    logService.getRecentLogs("whatsapp", 1),
    logService.getRecentLogs("notification", 1),
    publicQaIntentService.getPublicQaSnapshot(),
    aiRuntimeConfigService.getAiRuntimeConfig().then(aiRuntimeConfigService.maskAiRuntimeConfig),
  ]).then(([queueStats, messageStatsToday, systemStatsToday, whatsappEvents, notificationRuns, publicQa, aiConfig]) => res.status(200).json({
    status: true,
    whatsapp: whatsappStatusService.getStatus(),
    db: botDbService.getDbStatus(),
    worker: queueWorkerService.getWorkerStatus(),
    bot: {
      botEnabled: runtimeConfig.botEnabled,
      notificationsEnabled: runtimeConfig.notificationsEnabled,
      dryRunEnabled: runtimeConfig.dryRunEnabled,
      messageDelayMs: runtimeConfig.messageDelayMs,
      retryLimit: runtimeConfig.retryLimit,
    },
    rateLimit: rateLimitService.getRateLimitStats(runtimeConfig),
    queue: queueStats,
    registry: notificationRegistryService.getRegistrySnapshot(),
    dbConnections: externalDbService.listConnections(),
    publicQa,
    aiRuntime: aiConfig,
    messageStatsToday,
    systemStatsToday,
    lastWhatsappEvent: whatsappEvents[0] || null,
    lastNotificationRun: notificationRuns[0] || null,
  })).catch((error) => {
    logService.logSystemEvent({
      eventType: "internal_status_failed",
      severity: "error",
      message: "Endpoint status internal ALETA Bot gagal dibaca.",
      metadata: { errorMessage: error.message },
    });
    res.status(500).json({ status: false, message: "Internal status failed.", error: error.message });
  });
});

app.post("/internal/aleta-bot/whatsapp/connect", (req, res) => {
  if (!ensureInternalAccess(req, res, "whatsapp_connect")) return;

  try {
    const runtimeConfig = readRuntimeConfig();
    const dryRun = Boolean(req.body?.dryRun || req.query?.dryRun === "true");

    if (dryRun) {
      const waState = whatsappStatusService.getStatus();
      return res.status(200).json({
        ok: true,
        status: waState.status || "unknown",
        started: false,
        dryRun: true,
        qrAvailable: waState.status === "qr_needed" && Boolean(waState.lastQrString),
        botEnabled: Boolean(runtimeConfig.botEnabled),
        message: "Dry-run connect berhasil: endpoint tersedia dan tidak menginisialisasi client.",
      });
    }

    const result = startWhatsappClient("internal_connect");
    const waState = whatsappStatusService.getStatus();
    logService.logWhatsappEvent({
      eventType: "internal_whatsapp_connect_requested",
      severity: runtimeConfig.botEnabled ? "info" : "warning",
      message: "Connect WhatsApp Gateway diminta dari endpoint internal.",
      metadata: {
        status: waState.status,
        started: result.started,
        botEnabled: Boolean(runtimeConfig.botEnabled),
        note: runtimeConfig.botEnabled ? "" : "Bot disabled, tetapi koneksi WhatsApp tetap boleh dipairing dari control panel.",
      },
    });

    return res.status(200).json({
      ok: true,
      status: waState.status || result.status,
      started: result.started,
      qrAvailable: waState.status === "qr_needed" && Boolean(waState.lastQrString),
      botEnabled: Boolean(runtimeConfig.botEnabled),
      message: runtimeConfig.botEnabled
        ? result.message
        : `${result.message} Bot masih nonaktif untuk pengiriman/notifikasi sampai diaktifkan dari pengaturan.`,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "internal_whatsapp_connect_failed",
      severity: "error",
      message: "Endpoint connect WhatsApp internal gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({
      ok: false,
      error: "connect_failed",
      message: "Connect WhatsApp Gateway gagal diproses.",
    });
  }
});

app.get("/internal/aleta-bot/ai-config", async (req, res) => {
  if (!ensureInternalAccess(req, res, "ai_config")) return;
  try {
    const config = await aiRuntimeConfigService.getAiRuntimeConfig();
    const masked = aiRuntimeConfigService.maskAiRuntimeConfig(config);
    res.status(200).json({
      ok: true,
      status: masked.status,
      provider: masked.provider,
      model: masked.model,
      publicQaAiEnabled: masked.publicQaAiAnswerEnabled,
      apiKeyConfigured: masked.apiKeyConfigured && masked.secretAvailable,
      source: masked.configSource,
      lastSyncAt: masked.syncedAt,
      lastTestAt: masked.lastTestAt,
      lastTestStatus: masked.lastTestStatus,
      message: masked.message,
      config: masked,
    });
  } catch (error) {
    const message = aiRuntimeConfigService.sanitizeAiError(error);
    logService.logSystemEvent({
      eventType: "ai_config_read_failed",
      severity: "error",
      message: "Endpoint AI config ALETA Bot gagal dibaca.",
      metadata: { errorMessage: message },
    });
    res.status(500).json({ ok: false, status: "error", message });
  }
});

app.post("/internal/aleta-bot/ai-config/sync", async (req, res) => {
  if (!ensureInternalAccess(req, res, "ai_config_sync")) return;
  try {
    const config = await aiRuntimeConfigService.updateAiRuntimeConfig(req.body || {}, "manajemen_surat");
    res.status(200).json({ status: true, config });
  } catch (error) {
    const message = aiRuntimeConfigService.sanitizeAiError(error);
    logService.logSystemEvent({
      eventType: "ai_config_sync_failed",
      severity: "warning",
      message: "Sinkronisasi AI config dari portal gagal.",
      metadata: { errorMessage: message },
    });
    res.status(400).json({ status: false, message });
  }
});

app.post("/internal/aleta-bot/ai-config/test", async (req, res) => {
  if (!ensureInternalAccess(req, res, "ai_config_test")) return;
  try {
    const result = await aiProviderAdapter.testProviderConnection(req.body?.config || {});
    logService.logSystemEvent({
      eventType: "ai_runtime_test",
      severity: result.ok ? "info" : "warning",
      message: result.ok ? "Test AI runtime berhasil." : "Test AI runtime gagal.",
      metadata: {
        provider: result.provider,
        model: result.model,
        status: result.status,
        errorMessage: result.errorMessage || "",
      },
    });
    res.status(result.ok ? 200 : 400).json({ status: result.ok, result });
  } catch (error) {
    const message = aiProviderAdapter.sanitizeAiError(error);
    res.status(400).json({ status: false, message });
  }
});

app.get("/internal/aleta-bot/queue", async (req, res) => {
  if (!ensureInternalAccess(req, res, "queue")) return;
  try {
    const limit = Number(req.query?.limit || 20);
    res.status(200).json({
      status: true,
      stats: await messageQueueService.getQueueStats(),
      items: await messageQueueService.readQueuePublic(limit),
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "internal_queue_failed",
      severity: "error",
      message: "Endpoint queue internal ALETA Bot gagal dibaca.",
      metadata: { errorMessage: error.message },
    });
    res.status(500).json({ status: false, message: "Internal queue failed." });
  }
});

app.post("/internal/aleta-bot/validate-query", (req, res) => {
  if (!ensureInternalAccess(req, res, "validate_query")) return;
  const result = validateQuery(req.body?.sqlText || "", {
    category: req.body?.category,
    recipientColumn: req.body?.recipientColumn,
    outputColumns: req.body?.outputColumns,
  });
  res.status(200).json({ status: true, validation: result });
});

app.post("/internal/aleta-bot/validate-template", (req, res) => {
  if (!ensureInternalAccess(req, res, "validate_template")) return;
  const result = validateTemplate(req.body?.template || {}, {
    category: req.body?.category,
    outputColumns: req.body?.outputColumns,
    requiredPlaceholders: req.body?.requiredPlaceholders,
  });
  res.status(200).json({ status: true, validation: result });
});

app.get("/internal/aleta-bot/public-qa/intents", async (req, res) => {
  if (!ensureInternalAccess(req, res, "public_qa_intents")) return;
  try {
    res.status(200).json({
      status: true,
      intents: publicQaIntentService.getRuntimeIntents(),
      logs: await publicQaIntentService.getRecentPublicQaLogs(50),
      snapshot: await publicQaIntentService.getPublicQaSnapshot(),
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "public_qa_intents_failed",
      severity: "error",
      message: "Endpoint intent Pertanyaan Para Pihak gagal dibaca.",
      metadata: { errorMessage: error.message },
    });
    res.status(500).json({ status: false, message: "Public QA intents failed.", error: error.message });
  }
});

app.post("/internal/aleta-bot/public-qa/test", async (req, res) => {
  if (!ensureInternalAccess(req, res, "public_qa_test")) return;
  try {
    const question = String(req.body?.question || "");
    const result = await publicQaIntentService.resolvePublicQaAnswer({
      message: question,
      senderNumber: String(req.body?.senderNumber || "test"),
      senderName: String(req.body?.senderName || "Super Admin Preview"),
    });
    res.status(200).json({ status: true, result });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "public_qa_test_failed",
      severity: "warning",
      message: "Test intent Pertanyaan Para Pihak gagal.",
      metadata: { errorMessage: error.message },
    });
    res.status(400).json({ status: false, message: error.message });
  }
});

app.post("/internal/aleta-bot/registry/enqueue-dry-run", async (req, res) => {
  if (!ensureInternalAccess(req, res, "registry_enqueue_dry_run")) return;
  try {
    const item = await notificationRegistryService.enqueuePilotDryRun(req.body?.notificationKey, req.body?.sampleData || {});
    res.status(200).json({ status: true, item });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "registry_dry_run_enqueue_failed",
      severity: "warning",
      message: "Pilot registry ALETA Bot gagal dimasukkan ke queue dry-run.",
      metadata: { notificationKey: req.body?.notificationKey, errorMessage: error.message },
    });
    res.status(400).json({ status: false, message: error.message });
  }
});

app.get("/internal/aleta-bot/db-connections", (req, res) => {
  if (!ensureInternalAccess(req, res, "db_connections")) return;
  res.status(200).json({ status: true, connections: externalDbService.listConnections() });
});

app.post("/internal/aleta-bot/db-connections/test", async (req, res) => {
  if (!ensureInternalAccess(req, res, "db_connection_test")) return;
  const connectionKey = req.body?.connectionKey || req.body?.key || "sipp_primary";
  const result = req.body?.connection
    ? await externalDbService.testConnectionConfig(req.body.connection)
    : await externalDbService.testConnection(connectionKey);
  logService.logSystemEvent({
    eventType: "external_db_connection_test",
    severity: result.status === "success" ? "info" : "warning",
    message: result.status === "success" ? "Test koneksi database eksternal berhasil." : "Test koneksi database eksternal gagal.",
    metadata: { connectionKey, status: result.status, error: result.error, source: result.source },
  });
  res.status(result.status === "success" ? 200 : 400).json({ status: result.status === "success", result });
});

app.post("/send-message", async (req, res) => {
  if (!ensureInternalAccess(req, res, "manual_send_post")) return;

  const runtimeConfig = readRuntimeConfig();
  if (!runtimeConfig.manualSendEnabled) {
    logService.logSecurityEvent({
      eventType: "manual_send_disabled",
      severity: "warning",
      message: "Manual send endpoint dipanggil saat manualSendEnabled=false.",
      metadata: { path: req.path },
    });
    res.status(403).json({ status: false, message: "Manual send is disabled." });
    return;
  }

  const to = req.body.to || req.body.number || req.body.recipient;
  const message = req.body.message || "";
  const shouldQueue = req.body.queue !== false;
  const idempotencyKey = req.body.idempotencyKey || buildManualIdempotencyKey({
    recipientNumber: to,
    message,
    requestId: req.body.requestId,
  });

  if (shouldQueue) {
    const item = await messageQueueService.enqueueMessage({
      to,
      message,
      category: "manual",
      notificationKey: "manual-send",
      idempotencyKey,
      metadata: { source: "post_send_message" },
    });
    const processed = await messageQueueService.processQueueBatch(1, (payload) =>
      messageService.safeSendMessage({ client, sendFn: originalSendMessage, ...payload })
    );
    res.status(200).json({ status: true, queued: true, item, processed });
    return;
  }

  const response = await messageService.safeSendMessage({
    client,
    sendFn: originalSendMessage,
    to,
    message,
    category: "manual",
    notificationKey: "manual-send",
    idempotencyKey,
    metadata: { source: "post_send_message" },
  });

  res.status(200).json({ status: true, queued: false, sent: Boolean(response) });
});

app.get("/send-message/:number/:message", async (req, res) => {
  if (!ensureInternalAccess(req, res, "manual_send_get")) return;
  if (!readRuntimeConfig().manualSendEnabled) {
    res.status(403).json({ status: false, message: "Manual send is disabled." });
    return;
  }

  let numberId = req.params.number;
  let message = req.params.message;

  let split = message.split("+");
  let fix_message = split.join(" ");

  const response = await messageService.safeSendMessage({
    client,
    sendFn: originalSendMessage,
    to: numberId,
    message: fix_message,
    category: "manual",
    notificationKey: "manual-send",
    idempotencyKey: buildManualIdempotencyKey({ recipientNumber: numberId, message: fix_message, requestId: req.query.requestId }),
    metadata: { source: "get_send_message" },
  });

  res.status(200).json({
    status: true,
    response,
  });
});

app.get("/send-message-group/:number/:message", async (req, res) => {
  if (!ensureInternalAccess(req, res, "manual_send_group_get")) return;
  if (!readRuntimeConfig().manualSendEnabled) {
    res.status(403).json({ status: false, message: "Manual send is disabled." });
    return;
  }

  let numberId = req.params.number;
  let message = req.params.message;

  let split = message.split("+");
  let fix_message = split.join(" ");

  const response = await messageService.safeSendMessage({
    client,
    sendFn: originalSendMessage,
    to: numberId,
    message: fix_message,
    category: "manual",
    notificationKey: "manual-send-group",
    idempotencyKey: buildManualIdempotencyKey({ recipientNumber: numberId, message: fix_message, requestId: req.query.requestId }),
    metadata: { source: "get_send_message_group" },
  });

  res.status(200).json({
    status: true,
    response,
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Aleta listening at port ${port}`);
});
