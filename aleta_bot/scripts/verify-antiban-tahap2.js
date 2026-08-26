#!/usr/bin/env node
"use strict";

/**
 * Memeriksa delapan pengaman anti-blokir Tahap 2.
 *
 *   node scripts/verify-antiban-tahap2.js
 *
 * Yang diuji paling keras di sini ada dua, dan keduanya soal SIKAP saat
 * pengamannya sendiri bermasalah:
 *
 *   1. GAGAL-TERBUKA. Indikator mengetik, pemanasan nomor, dan pengutamaan
 *      penerima adalah pengaman tambahan. Tidak satu pun boleh mendiamkan
 *      pemberitahuan pengadilan ketika WhatsApp atau database bermasalah.
 *
 *   2. GAGAL-TERTUTUP, sekali saja. Kebalikannya berlaku untuk tanda blokir:
 *      begitu WhatsApp menyebut alasan tingkat akun, bot harus berhenti pada
 *      kejadian PERTAMA. Menunggu kejadian kedua berarti sengaja mengambil
 *      risiko yang sudah jelas.
 */

const path = require("path");

// botDbService diganti tiruan agar tidak menyentuh database sungguhan.
const botDbPath = require.resolve("../services/botDbService");
require("../services/botDbService");
const dbState = { gagal: false, sentToday: 0, engaged: new Set() };
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  toMysqlDate: (value) => new Date(value).toISOString().slice(0, 19).replace("T", " "),
  query: async (sql, params = []) => {
    if (dbState.gagal) throw new Error("database tidak dapat dijangkau");
    if (/COUNT\(\*\) AS jumlah/i.test(sql)) return [{ jumlah: dbState.sentToday }];
    if (/ack >= 3/.test(sql)) return dbState.engaged.has(String(params[0])) ? [{ 1: 1 }] : [];
    return [];
  },
  getDbStatus: () => ({ ok: true }),
};

const pace = require("../services/sendingPaceService");
const presence = require("../services/humanPresenceService");
const banSignal = require("../services/banSignalService");
const warmup = require("../services/numberWarmupService");
const health = require("../services/recipientHealthService");
const templates = require("../services/templateService");

let lulus = 0;
let gagal = 0;

function periksa(label, kondisi) {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}`);
  }
}

const PROFIL_MINIMAL = [
  { label: "beruntun", minMs: 20000, maxMs: 45000, weight: 35 },
  { label: "pendek", minMs: 45000, maxMs: 90000, weight: 30 },
  { label: "sedang", minMs: 90000, maxMs: 180000, weight: 22 },
  { label: "panjang", minMs: 180000, maxMs: 420000, weight: 10 },
  { label: "jeda", minMs: 480000, maxMs: 900000, weight: 3 },
];

async function utama() {
  console.log("\n== 1. Irama campuran: bentuk sebarannya ==");
  {
    const config = { enabled: true, minGapMs: 20000, maxGapMs: 40000, perRecipientCooldownMs: 0, gapProfile: PROFIL_MINIMAL };
    const contoh = [];
    for (let i = 0; i < 20000; i += 1) contoh.push(pace.pickGapMs(config));

    const terkecil = Math.min(...contoh);
    const terbesar = Math.max(...contoh);
    periksa(`tidak pernah di bawah 20 dtk (${(terkecil / 1000).toFixed(1)})`, terkecil >= 20000);
    periksa(`tidak pernah di atas 15 mnt (${(terbesar / 1000).toFixed(1)})`, terbesar <= 900000);

    // Inti dari irama campuran: jarak pendek DAN jarak panjang sama-sama muncul.
    // Sebaran yang seluruhnya terkumpul di satu rentang berarti kembali
    // berbentuk mesin, dan itulah yang hendak dihindari.
    const pendek = contoh.filter((ms) => ms < 60000).length / contoh.length;
    const panjang = contoh.filter((ms) => ms > 180000).length / contoh.length;
    periksa(`banyak jarak pendek (${(pendek * 100).toFixed(0)}%)`, pendek > 0.4 && pendek < 0.75);
    periksa(`ada jeda panjang sesekali (${(panjang * 100).toFixed(0)}%)`, panjang > 0.05 && panjang < 0.25);

    const rataRata = contoh.reduce((a, b) => a + b, 0) / contoh.length;
    periksa(`rata-rata sekitar 2 menit (${(rataRata / 1000).toFixed(0)} dtk)`, rataRata > 90000 && rataRata < 140000);

    // Semua kelompok harus benar-benar terpakai; bobot yang tidak pernah
    // terpilih berarti ada kesalahan pada undiannya.
    for (const bucket of PROFIL_MINIMAL) {
      const jumlah = contoh.filter((ms) => ms >= bucket.minMs && ms <= bucket.maxMs).length;
      periksa(`kelompok "${bucket.label}" terpakai (${jumlah}x)`, jumlah > 0);
    }
  }

  console.log("\n== 1b. Kapasitas cukup untuk 100-200 pesan per hari ==");
  {
    const rataRataMs = pace.averageGapMs(PROFIL_MINIMAL, 20000, 40000);
    const kapasitas = Math.floor((8 * 3600000) / rataRataMs);
    periksa(`kapasitas ${kapasitas} pesan/hari, di atas 200`, kapasitas >= 210);
    periksa("tidak berlebihan sampai kehilangan penyamaran", kapasitas < 400);
  }

  console.log("\n== 1c. Profil rusak diabaikan, bukan ditebak ==");
  {
    periksa("bukan larik -> null", pace.normalizeGapProfile("bukan larik") === null);
    periksa("larik kosong -> null", pace.normalizeGapProfile([]) === null);
    periksa("rentang terbalik dibuang", pace.normalizeGapProfile([{ minMs: 100, maxMs: 10, weight: 5 }]) === null);
    periksa("bobot nol dibuang", pace.normalizeGapProfile([{ minMs: 10, maxMs: 100, weight: 0 }]) === null);
    const campuran = pace.normalizeGapProfile([
      { minMs: 10, maxMs: 100, weight: 5 },
      { minMs: 100, maxMs: 10, weight: 5 },
    ]);
    periksa("entri sah tetap dipakai", Array.isArray(campuran) && campuran.length === 1);

    const tanpaProfil = { enabled: true, minGapMs: 8000, maxGapMs: 15000, gapProfile: null };
    const nilai = pace.pickGapMs(tanpaProfil);
    periksa(`tanpa profil kembali ke min/max (${nilai})`, nilai >= 8000 && nilai <= 15000);
  }

  console.log("\n== 4. Ritme kantor: istirahat siang dan hari libur ==");
  {
    const rhythm = pace.getRhythmConfig({});
    const window = { enabled: true, start: "08:00", end: "16:00" };

    // Rabu 9 September 2026 pukul 12.30 - tengah istirahat siang.
    const siang = new Date(2026, 8, 9, 12, 30, 0, 0);
    const geser = pace.shiftOutOfQuietPeriod(siang, rhythm, window);
    periksa(`istirahat siang digeser ke 13.00 (${geser.getHours()}:${String(geser.getMinutes()).padStart(2, "0")})`,
      geser.getHours() === 13 && geser.getMinutes() === 0);

    // Rabu pukul 10.00 - di luar istirahat, tidak boleh disentuh.
    const pagi = new Date(2026, 8, 9, 10, 0, 0, 0);
    periksa("di luar istirahat tidak digeser", pace.shiftOutOfQuietPeriod(pagi, rhythm, window).getTime() === pagi.getTime());

    // Jumat 11 September 2026 pukul 11.45 - jeda Jumat lebih panjang.
    const jumat = new Date(2026, 8, 11, 11, 45, 0, 0);
    const geserJumat = pace.shiftOutOfQuietPeriod(jumat, rhythm, window);
    periksa(`Jumat 11.45 digeser ke 13.30 (${geserJumat.getHours()}:${String(geserJumat.getMinutes()).padStart(2, "0")})`,
      geserJumat.getHours() === 13 && geserJumat.getMinutes() === 30);
    periksa("Jumat 11.45 memang di luar jeda hari biasa", jumat.getHours() * 60 + jumat.getMinutes() < 12 * 60);

    // Sabtu 12 September 2026 -> Senin 14 September.
    const sabtu = new Date(2026, 8, 12, 10, 0, 0, 0);
    const geserSabtu = pace.shiftOutOfQuietPeriod(sabtu, rhythm, window);
    periksa(`Sabtu digeser ke Senin (${geserSabtu.getDate()} Sep)`, geserSabtu.getDay() === 1 && geserSabtu.getDate() === 14);
    periksa("mendarat di jam buka", geserSabtu.getHours() === 8);

    periksa("Sabtu dikenali hari libur", pace.isRestDay(sabtu, rhythm) === true);
    periksa("Minggu dikenali hari libur", pace.isRestDay(new Date(2026, 8, 13), rhythm) === true);
    periksa("Rabu bukan hari libur", pace.isRestDay(pagi, rhythm) === false);
  }

  console.log("\n== 4b. Hari libur nasional dari portal ==");
  {
    const rhythm = pace.getRhythmConfig({ sendingRhythm: { holidays: ["2026-08-17"] } });
    const window = { enabled: true, start: "08:00", end: "16:00" };
    const merdeka = new Date(2026, 7, 17, 9, 0, 0, 0);
    periksa("17 Agustus dikenali libur", pace.isRestDay(merdeka, rhythm) === true);
    const geser = pace.shiftOutOfQuietPeriod(merdeka, rhythm, window);
    periksa(`digeser ke hari berikutnya (${geser.getDate()} Agu)`, geser.getDate() === 18);
  }

  console.log("\n== 4c. Ritme dimatikan -> perilaku lama persis ==");
  {
    const mati = { enabled: false, holidays: [], skipWeekend: true, lunchStart: "12:00", lunchEnd: "13:00", fridayLunchStart: "11:30", fridayLunchEnd: "13:30" };
    const sabtuSiang = new Date(2026, 8, 12, 12, 30, 0, 0);
    periksa("tidak digeser sama sekali", pace.shiftOutOfQuietPeriod(sabtuSiang, mati, {}).getTime() === sabtuSiang.getTime());

    // computeScheduledAt tanpa ritme harus berperilaku seperti sebelum ritme ada.
    const hasil = pace.computeScheduledAt({
      now: sabtuSiang,
      paceConfig: { enabled: true, minGapMs: 0, maxGapMs: 0, perRecipientCooldownMs: 0 },
      window: { enabled: false },
    });
    periksa("tanpa ritme: tidak ada alasan office_rhythm", !hasil.reasons.includes("office_rhythm"));
  }

  console.log("\n== 2. Lama mengetik sebanding panjang pesan ==");
  {
    const config = presence.getPresenceConfig({});
    const pendek = presence.typingDurationMs("Ya.", config);
    const panjang = presence.typingDurationMs("x".repeat(500), config);
    periksa(`pesan pendek cepat (${pendek} ms)`, pendek >= config.minTypingMs && pendek <= 2000);
    periksa(`pesan panjang lebih lama (${panjang} ms)`, panjang > pendek);
    periksa("tidak pernah melebihi batas atas", panjang <= config.maxTypingMs);
    periksa("pesan kosong tetap punya jeda minimum", presence.typingDurationMs("", config) === config.minTypingMs);

    // Dua pesan sama panjang tidak boleh menghasilkan jeda identik.
    const a = presence.typingDurationMs("x".repeat(60), config);
    const b = presence.typingDurationMs("x".repeat(60), config);
    const c = presence.typingDurationMs("x".repeat(60), config);
    periksa("ada keragaman antar pemanggilan", !(a === b && b === c));
  }

  console.log("\n== 2b. GAGAL-TERBUKA: mengetik gagal, jeda tetap dijalankan ==");
  {
    const mulai = Date.now();
    const hasil = await presence.showTyping({ getChatById: async () => { throw new Error("chat tidak ditemukan"); } }, "628@c.us", 120);
    const lama = Date.now() - mulai;
    periksa("tidak melempar galat", hasil && hasil.shown === false);
    periksa(`jeda tetap dijalankan (${lama} ms)`, lama >= 110);

    const tanpaClient = await presence.showTyping(null, "628@c.us", 60);
    periksa("tanpa client tetap aman", tanpaClient.shown === false);

    const chatRusak = { getChatById: async () => ({ sendStateTyping: async () => { throw new Error("gagal"); } }) };
    const hasilRusak = await presence.showTyping(chatRusak, "628@c.us", 30);
    periksa("sendStateTyping gagal tetap aman", hasilRusak.shown === false);
  }

  console.log("\n== 2c. Indikator benar-benar dipanggil bila tersedia ==");
  {
    const jejak = [];
    const client = {
      getChatById: async () => ({
        sendStateTyping: async () => jejak.push("typing"),
        clearState: async () => jejak.push("clear"),
      }),
    };
    const hasil = await presence.showTyping(client, "628@c.us", 20);
    periksa("indikator ditampilkan", hasil.shown === true);
    periksa("sendStateTyping dipanggil", jejak.includes("typing"));
    periksa("indikator dipadamkan setelahnya", jejak.includes("clear"));
  }

  console.log("\n== 3. Menandai pesan masuk terbaca ==");
  {
    let dipanggil = "";
    const client = { sendSeen: async (chatId) => { dipanggil = chatId; } };
    periksa("sendSeen dipanggil", (await presence.markSeen(client, "628@c.us")) === true && dipanggil === "628@c.us");

    const gagalClient = { sendSeen: async () => { throw new Error("gagal"); } };
    periksa("GAGAL-TERBUKA: galat tidak dilempar", (await presence.markSeen(gagalClient, "628@c.us")) === false);
    periksa("tanpa client aman", (await presence.markSeen(null, "628@c.us")) === false);
    periksa("tanpa chatId aman", (await presence.markSeen(client, "")) === false);
    periksa("dapat dimatikan dari portal",
      (await presence.markSeen(client, "628@c.us", presence.getPresenceConfig({ humanPresence: { markSeenEnabled: false } }))) === false);
  }

  console.log("\n== 7. ATURAN POKOK: tanda tingkat akun -> berhenti seketika ==");
  {
    for (const alasan of ["TOS_BLOCK", "SMB_TOS_BLOCK", "UNPAIRED", "UNPAIRED_IDLE", "LOGOUT", "PROXYBLOCK"]) {
      banSignal.resetForTest();
      const hasil = banSignal.recordDisconnect(alasan);
      periksa(`${alasan}: berhenti pada kejadian pertama`, hasil.halted === true && hasil.shouldReconnect === false);
      periksa(`${alasan}: pengiriman ikut berhenti`, banSignal.isHalted() === true);
    }
  }

  console.log("\n== 7b. Gangguan jaringan TIDAK menghentikan layanan ==");
  {
    for (const alasan of ["NAVIGATION", "UNLAUNCHED", "CONFLICT", "", null, undefined, "ECONNRESET"]) {
      banSignal.resetForTest();
      const hasil = banSignal.recordDisconnect(alasan);
      periksa(`${JSON.stringify(alasan)}: tetap menyambung ulang`, hasil.shouldReconnect === true && hasil.halted === false);
    }
  }

  console.log("\n== 7c. auth_failure baru berhenti setelah beruntun ==");
  {
    banSignal.resetForTest();
    const pertama = banSignal.recordAuthFailure("sesi kedaluwarsa");
    periksa("sekali gagal masih boleh menyambung", pertama.shouldReconnect === true);
    banSignal.recordAuthFailure("sesi kedaluwarsa");
    const ketiga = banSignal.recordAuthFailure("sesi kedaluwarsa");
    periksa(`berhenti pada gagal ke-${banSignal.AUTH_FAILURE_THRESHOLD}`, ketiga.halted === true);

    banSignal.resetForTest();
    banSignal.recordAuthFailure("sekali");
    banSignal.recordReady();
    const setelahPulih = banSignal.recordAuthFailure("lagi");
    periksa("hitungan dinolkan setelah tersambung", setelahPulih.streak === 1);
  }

  console.log("\n== 7d. Penghentian hanya boleh dilepas admin ==");
  {
    banSignal.resetForTest();
    banSignal.recordDisconnect("TOS_BLOCK");
    banSignal.recordReady();
    periksa("tersambung ulang TIDAK membatalkan penghentian", banSignal.isHalted() === true);
    banSignal.release("admin");
    periksa("admin dapat melepaskan", banSignal.isHalted() === false);
    banSignal.resetForTest();
  }

  console.log("\n== 5. Pemanasan nomor bertahap ==");
  {
    const config = { enabled: true, startedAt: "2026-08-01T00:00:00.000Z", startCap: 30, targetCap: 200, stepDays: 3 };
    const tahap = (hari) => warmup.currentCap(config, new Date(Date.parse(config.startedAt) + (hari - 1) * 86400000));
    periksa(`hari 1: 30 (${tahap(1).cap})`, tahap(1).cap === 30);
    periksa(`hari 3: 30 (${tahap(3).cap})`, tahap(3).cap === 30);
    periksa(`hari 4: 60 (${tahap(4).cap})`, tahap(4).cap === 60);
    periksa(`hari 7: 120 (${tahap(7).cap})`, tahap(7).cap === 120);
    periksa("hari 10: sudah penuh, pemanasan selesai", tahap(10).active === false && tahap(10).reason === "selesai");
    periksa("naik bertahap, tidak melompat", tahap(4).cap > tahap(3).cap && tahap(7).cap > tahap(4).cap);
  }

  console.log("\n== 5b. Pemanasan tidak pernah membungkam balasan ==");
  {
    const runtimeConfig = { numberWarmup: { enabled: true, startedAt: new Date().toISOString(), startCap: 5, targetCap: 200, stepDays: 3 } };
    dbState.sentToday = 999;
    for (const kategori of ["manual", "system", "critical", "reply", "command", "admin"]) {
      const hasil = await warmup.checkWarmupLimit(kategori, { runtimeConfig });
      periksa(`${kategori}: tidak ikut dibatasi`, hasil.allowed === true);
    }
    const notifikasi = await warmup.checkWarmupLimit("party", { runtimeConfig });
    periksa("notifikasi memang ditahan saat batas tercapai", notifikasi.allowed === false);

    dbState.sentToday = 1;
    const belumPenuh = await warmup.checkWarmupLimit("party", { runtimeConfig });
    periksa("di bawah batas tetap boleh", belumPenuh.allowed === true);
  }

  console.log("\n== 5c. GAGAL-TERBUKA: pemanasan bermasalah tetap mengirim ==");
  {
    const runtimeConfig = { numberWarmup: { enabled: true, startedAt: new Date().toISOString(), startCap: 1, targetCap: 200, stepDays: 3 } };
    dbState.gagal = true;
    const hasil = await warmup.checkWarmupLimit("party", { runtimeConfig });
    dbState.gagal = false;
    periksa("database gagal -> tetap kirim", hasil.allowed === true && hasil.reason === "hitungan_gagal_dibaca");

    const rusak = { numberWarmup: { enabled: true, startedAt: "bukan tanggal", startCap: 1, targetCap: 200, stepDays: 3 } };
    const hasilRusak = await warmup.checkWarmupLimit("party", { runtimeConfig: rusak });
    periksa("tanggal mulai rusak -> tetap kirim", hasilRusak.allowed === true);

    const mati = await warmup.checkWarmupLimit("party", { runtimeConfig: {} });
    periksa("pemanasan mati -> tetap kirim", mati.allowed === true);
  }

  console.log("\n== 6. Mendahulukan penerima yang membaca pesan ==");
  {
    dbState.engaged = new Set(["6285242120977"]);
    periksa("penerima yang membaca dikenali", (await health.hasEngaged("6285242120977")) === true);
    periksa("penerima yang belum membaca dikenali", (await health.hasEngaged("6285242120988")) === false);
    periksa("nomor kosong aman", (await health.hasEngaged("")) === false);

    dbState.gagal = true;
    const saatGagal = await health.hasEngaged("6285242120977");
    dbState.gagal = false;
    periksa("GAGAL-TERBUKA: database gagal -> dianggap belum terlibat", saatGagal === false);

    const sumber = require("fs").readFileSync(
      path.resolve(__dirname, "..", "services", "messageQueueService.js"),
      "utf8"
    );
    periksa("prioritas hanya digeser satu tingkat", /dasar - 1 : dasar/.test(sumber));
    periksa("prioritas eksplisit pemanggil dihormati", /if \(eksplisit\) return dasar/.test(sumber));
    periksa(
      "pekerja antrean hanya memilih pesan yang sudah waktunya",
      /scheduled_at <= NOW\(\)/.test(sumber)
    );
  }

  console.log("\n== 8. Variasi kalimat pembuka ==");
  {
    const pesan = "Assalamualaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\n\nDetail Sidang Perkara:\n- Nomor: 123";
    const hasil = new Set();
    for (let i = 0; i < 200; i += 1) hasil.add(templates.varyOpening(pesan, {}));
    periksa(`menghasilkan beberapa bentuk (${hasil.size})`, hasil.size > 1);

    for (const bentuk of hasil) {
      periksa("isi pesan tetap utuh", bentuk.includes("Detail Sidang Perkara:") && bentuk.includes("- Nomor: 123"));
      break;
    }

    const salamSah = templates.DEFAULT_OPENING_VARIANTS[0];
    let semuaSah = true;
    for (const bentuk of hasil) {
      if (!salamSah.includes(bentuk.split("\n")[0])) semuaSah = false;
    }
    periksa("seluruh bentuk salam tetap baku", semuaSah);

    periksa("dapat dimatikan dari portal",
      templates.varyOpening(pesan, { openingVariationEnabled: false }) === pesan);
    periksa("pesan tanpa kalimat pembuka dikenal tidak disentuh",
      templates.varyOpening("Sidang Anda besok pukul 09.00.", {}) === "Sidang Anda besok pukul 09.00.");
    periksa("pesan kosong aman", templates.varyOpening("", {}) === "");
    periksa("null aman", templates.varyOpening(null, {}) === "");
  }

  console.log("\n== 8b. Variasi tidak merusak isi pesan suntingan admin ==");
  {
    // Baris yang MIRIP tetapi tidak persis tidak boleh ikut diganti.
    const disunting = "Assalamualaikum Warahmatullahi Wabarakatuh, Bapak/Ibu.\n\nDetail: 123";
    periksa("baris mirip tidak diganti", templates.varyOpening(disunting, {}) === disunting);

    // Kelompok yang sama hanya diganti sekali.
    const berulang = "Assalamualaikum Wr. Wb.,\nbaris\nbaris\nAssalamualaikum Wr. Wb.,";
    const hasil = templates.varyOpening(berulang, {});
    periksa("kelompok sama tidak diganti dua kali", hasil.split("\n")[3] === "Assalamualaikum Wr. Wb.,");
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama().catch((error) => {
  console.error("Gagal menjalankan pengujian:", error);
  process.exit(1);
});
