"use strict";

/**
 * Menu pilihan bernomor untuk pihak berperkara.
 *
 * Sebelumnya pengguna harus mengetik perintah bersyarat seperti
 * "akta#123.G.2026" — mereka wajib hafal kata perintahnya SEKALIGUS nomor
 * perkaranya, dalam format yang tepat. Bagi masyarakat umum itu hambatan nyata,
 * dan salah ketik sedikit saja membuat bot tidak menjawab.
 *
 * Di sini bot yang menyodorkan pilihan: perkara apa saja yang terdaftar atas
 * nomor WhatsApp itu, lalu informasi apa saja yang tersedia untuk perkara
 * terpilih. Pengguna cukup membalas satu angka.
 *
 * Mengapa menu bernomor, bukan tombol:
 *   WhatsApp sudah MENGHENTIKAN dukungan tombol dan daftar interaktif untuk
 *   klien tidak resmi — pustaka whatsapp-web.js sendiri menandainya deprecated
 *   dan pesannya tidak lagi tampil di ponsel penerima. Menu bernomor bekerja di
 *   setiap versi WhatsApp tanpa kecuali. Untuk layanan publik, jalur yang selalu
 *   berhasil lebih berharga daripada tampilan yang lebih manis tetapi bisa
 *   membuat warga menekan tombol yang tidak merespons.
 *
 * KEAMANAN: menu ini tidak menambah kewenangan sedikit pun. Daftar perkaranya
 * berasal dari caseDirectoryService yang memakai aturan yang sama dengan
 * verifikasi lama, dan setiap jawaban tetap melewati getData() yang menegakkan
 * guardCaseCommandAccess. Menu hanya membuat yang sudah boleh diakses menjadi
 * mudah ditemukan.
 */

const { readRuntimeConfig } = require("../config/runtime-config");
const caseDirectoryService = require("./caseDirectoryService");
const optOutService = require("./optOutService");
const caseSnapshotService = require("./caseSnapshotService");
const caseJourneyService = require("./caseJourneyService");
const caseSummonsService = require("./caseSummonsService");
const caseDocumentService = require("./caseDocumentService");
const legalGlossaryService = require("./legalGlossaryService");

/** Kata yang membuka menu. */
const MENU_KEYWORDS = new Set(["menu", "menu utama", "mulai", "start", "bantuan", "pilihan"]);

/** Sapaan pembuka yang layak dijawab dengan menu bila pengirim punya perkara. */
const GREETING_KEYWORDS = new Set([
  "halo",
  "hallo",
  "hai",
  "hi",
  "hei",
  "assalamualaikum",
  "assalamu alaikum",
  "asslmkm",
  "aslmkm",
  "ass",
  "permisi",
  "pagi",
  "siang",
  "sore",
  "malam",
]);

/**
 * Informasi yang dapat dipilih untuk sebuah perkara.
 *
 * `command` dikirim apa adanya ke getData() sebagai "<command>#<nomor perkara>",
 * jadi seluruh logika lama dipakai ulang tanpa disalin.
 */
const CASE_INFO_OPTIONS = [
  {
    key: "perjalanan",
    label: "Perjalanan perkara (sudah sampai mana)",
    // Tidak lewat getData(): tampilan ini disusun caseJourneyService dari
    // tabel yang sama dengan "Rincian perkara". Hak aksesnya tetap diperiksa
    // di dalam layanan itu, sama seperti perintah perkara lainnya.
    handler: "journey",
    appliesTo: () => true,
  },
  {
    key: "panggilan",
    label: "Status panggilan sidang",
    // Ditempatkan tepat setelah perjalanan perkara karena keduanya menjawab
    // pertanyaan keadaan, bukan pertanyaan data.
    handler: "summons",
    appliesTo: () => true,
  },
  { key: "jadwal", label: "Jadwal sidang", command: "jadwal", appliesTo: () => true },
  { key: "detail", label: "Rincian perkara", command: "detail", appliesTo: () => true },
  { key: "biaya", label: "Biaya dan sisa panjar", command: "biaya", appliesTo: () => true },
  {
    key: "akta",
    label: "Akta cerai",
    command: "akta",
    // Akta cerai hanya terbit dari perkara perdata gugatan/permohonan.
    appliesTo: (item) => ["Gugatan", "Gugatan Sederhana", "Permohonan"].includes(item.jenisPerkara),
  },
  { key: "putusan", label: "Salinan putusan", command: "putusan", appliesTo: () => true },
  {
    key: "dokumen",
    label: "Kirim berkas putusan (PDF)",
    // Mengirim berkas ke antrean, bukan membalas langsung: pesan bermedia lebih
    // berat dan harus ikut aturan jarak kirim.
    handler: "document",
    appliesTo: () => true,
  },
  {
    key: "antrian",
    label: "Daftar antrian sidang online",
    // Perintahnya menentukan SLOT pendaftaran: "daftar antrian" mendaftarkan
    // pihak_1 (penggugat/pemohon), "antrian online" mendaftarkan pihak_2
    // (tergugat/termohon). Karena itu perintahnya harus mengikuti peran
    // pengirim, bukan dipatok satu nilai - salah slot berarti orangnya
    // terdaftar sebagai pihak lawan.
    command: (item) => (isSecondParty(item) ? "antrian online" : "daftar antrian"),
    // Berbeda dari pilihan lain, ini MENULIS ke data antrian sidang. Tidak
    // boleh disimpan sementara, dan tidak boleh dijawab dari data lama.
    mutates: true,
    appliesTo: () => true,
  },
];

/** Apakah pihak ini berada di posisi kedua (tergugat/termohon)? */
function isSecondParty(item = {}) {
  const ke = String(item.pihakKe || "").trim().toLowerCase();
  return ke === "2" || ke === "t";
}

/** Perintah yang dikirim ke jalur lama untuk satu pilihan menu. */
function resolveOptionCommand(option, item) {
  return typeof option.command === "function" ? option.command(item) : option.command;
}

const sessions = new Map();

function sessionTtlMs() {
  const runtimeConfig = readRuntimeConfig();
  const minutes = Number(runtimeConfig.publicQaSessionTtlMinutes || 20);
  return Math.max(1, Math.min(120, Number.isFinite(minutes) ? minutes : 20)) * 60 * 1000;
}

function normalizeKeyword(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Angka pilihan tunggal, mis. "2" atau "2." — bukan nomor perkara. */
function parseSelection(text) {
  const raw = String(text || "").trim().replace(/[.)]+$/, "");
  if (!/^\d{1,2}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 0 && value <= 20 ? value : null;
}

function getSession(chatId) {
  const session = sessions.get(chatId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(chatId);
    return null;
  }
  return session;
}

function setSession(chatId, state) {
  sessions.set(chatId, { ...state, expiresAt: Date.now() + sessionTtlMs() });
}

function clearSession(chatId) {
  sessions.delete(chatId);
}

function clearAllSessions() {
  sessions.clear();
}

/**
 * Sebab data sebuah pilihan masih kosong.
 *
 * Hampir setiap "belum ada data" punya alasan yang bisa disebutkan, dan
 * menyebutkannya mengubah jawaban yang terasa buntu menjadi keterangan yang
 * menjelaskan posisi perkara.
 */
const EMPTY_ANSWER_REASONS = {
  dokumen: "Berkas putusan tersedia setelah putusan dibacakan dan berkasnya diunggah ke sistem.",
  panggilan: "Panggilan sidang dicatat setelah Jurusita menyerahkannya kepada pihak. Bila hari sidang belum ditetapkan, panggilan memang belum dibuat.",
  jadwal: "Hari sidang berikutnya belum ditetapkan majelis hakim. Panggilan resmi akan disampaikan Jurusita ke alamat Anda.",
  akta: "Akta cerai baru terbit setelah putusan berkekuatan hukum tetap, yaitu 14 hari sejak putusan diberitahukan bila tidak ada banding.",
  putusan: "Salinan putusan baru tersedia setelah perkara diputus dan putusannya selesai diminutasi.",
  biaya: "Rincian biaya muncul setelah panjar dibayarkan dan tercatat di kasir pengadilan.",
  detail: "Rincian perkara akan terisi seiring berjalannya tahapan persidangan.",
  antrian: "Pendaftaran antrian sidang online hanya dapat dilakukan pada hari sidang Anda.",
};

function explainEmptyAnswer(optionKey) {
  return (
    EMPTY_ANSWER_REASONS[String(optionKey || "")] ||
    "Data ini akan terisi seiring berjalannya tahapan perkara Anda."
  );
}

/** Pilihan informasi yang berlaku untuk satu perkara. */
function infoOptionsFor(item) {
  return CASE_INFO_OPTIONS.filter((option) => option.appliesTo(item));
}

function footerLine() {
  return optOutService.OPT_OUT_FOOTER;
}

/** Layar 1: daftar perkara milik nomor pengirim. */
function renderCaseMenu(cases) {
  const lines = ["*Perkara Anda yang terdaftar:*", ""];
  cases.forEach((item, index) => {
    lines.push(`*${index + 1}.* ${item.nomorPerkara}`);
    lines.push(`     ${item.jenisPerkara} — sebagai ${caseDirectoryService.describeRole(item)}`);
  });
  lines.push("");
  lines.push("Balas dengan *angka* perkara yang ingin Anda tanyakan.");
  lines.push("");
  lines.push(footerLine());
  return lines.join("\n");
}

/** Layar 2: informasi yang tersedia untuk perkara terpilih. */
function renderInfoMenu(item, options) {
  const lines = [`*Perkara ${item.nomorPerkara}*`, `${item.jenisPerkara} — sebagai ${caseDirectoryService.describeRole(item)}`, "", "*Informasi yang tersedia:*", ""];
  options.forEach((option, index) => {
    lines.push(`*${index + 1}.* ${option.label}`);
  });
  lines.push("");
  lines.push("Balas dengan *angka* informasi yang Anda perlukan.");
  lines.push('Ketik *MENU* untuk memilih perkara lain.');
  return lines.join("\n");
}

function renderNoCaseMessage() {
  return [
    "Nomor WhatsApp ini belum tercatat sebagai pihak atau kuasa pada perkara mana pun di Pengadilan Agama Donggala.",
    "",
    "Demi keamanan data, informasi perkara hanya dapat diberikan kepada nomor yang tercatat pada perkara tersebut.",
    "",
    "Bila Anda merasa seharusnya terdaftar, silakan hubungi PTSP pengadilan untuk memperbarui nomor telepon Anda.",
  ].join("\n");
}

/**
 * Menangani satu pesan masuk dari sudut pandang menu.
 *
 * @returns {{handled: boolean, reply?: string}} handled=false berarti pesan ini
 *   bukan urusan menu dan harus diteruskan ke penanganan perintah yang lama.
 *   Ini menjaga perintah lama seperti "akta#123.G.2026" tetap berfungsi.
 */
async function handleMenuMessage({ senderNumber, chatId, text, answerCommand } = {}) {
  const raw = String(text || "").trim();
  if (!raw) return { handled: false };

  const keyword = normalizeKeyword(raw);
  const key = chatId || senderNumber;
  const session = getSession(key);

  // 1. Permintaan berhenti / berlangganan kembali selalu didahulukan.
  if (optOutService.isOptOutKeyword(raw)) {
    const result = await optOutService.optOut(senderNumber, { source: "whatsapp_keyword" });
    clearSession(key);
    return { handled: true, reply: result.message || optOutService.OPT_OUT_CONFIRMATION, action: "opt_out" };
  }
  if (optOutService.isResumeKeyword(raw)) {
    const result = await optOutService.resume(senderNumber, { source: "whatsapp_keyword" });
    return { handled: true, reply: result.message || optOutService.RESUME_CONFIRMATION, action: "resume" };
  }

  const wantsMenu = MENU_KEYWORDS.has(keyword);
  const isGreeting = GREETING_KEYWORDS.has(keyword);
  const selection = parseSelection(raw);

  // 2. Angka hanya bermakna bila memang sedang ada menu terbuka. Tanpa sesi,
  //    angka dibiarkan lewat supaya tidak merebut alur lain.
  if (selection !== null && session) {
    return resolveSelection({ session, selection, key, senderNumber, answerCommand });
  }

  // 3. Sapaan dijawab menu HANYA bila pengirim benar-benar punya perkara.
  //    Bila tidak, biarkan sambutan lama yang menjawab.
  if (!wantsMenu && !isGreeting) return { handled: false };

  let cases = [];
  try {
    cases = await caseDirectoryService.listCasesForPhone(senderNumber);
  } catch {
    return { handled: false };
  }

  if (cases.length === 0) {
    // Pengguna yang menyebut "menu" berhak tahu mengapa menunya kosong;
    // sapaan biasa cukup dijawab sambutan lama.
    if (wantsMenu) return { handled: true, reply: renderNoCaseMessage(), action: "no_case" };
    return { handled: false };
  }

  // Satu perkara saja: lewati layar pemilihan perkara.
  if (cases.length === 1) {
    const options = infoOptionsFor(cases[0]);
    setSession(key, { state: "choosing_info", cases, selectedIndex: 0, options });
    return { handled: true, reply: renderInfoMenu(cases[0], options), action: "info_menu" };
  }

  setSession(key, { state: "choosing_case", cases });
  return { handled: true, reply: renderCaseMenu(cases), action: "case_menu" };
}

async function resolveSelection({ session, selection, key, senderNumber, answerCommand }) {
  // 0 selalu berarti kembali ke daftar perkara.
  if (selection === 0) {
    if (session.cases.length === 1) {
      const options = infoOptionsFor(session.cases[0]);
      setSession(key, { state: "choosing_info", cases: session.cases, selectedIndex: 0, options });
      return { handled: true, reply: renderInfoMenu(session.cases[0], options), action: "info_menu" };
    }
    setSession(key, { state: "choosing_case", cases: session.cases });
    return { handled: true, reply: renderCaseMenu(session.cases), action: "case_menu" };
  }

  if (session.state === "choosing_case") {
    const item = session.cases[selection - 1];
    if (!item) {
      return {
        handled: true,
        reply: `Pilihan tidak tersedia. Balas angka *1* sampai *${session.cases.length}*.`,
        action: "invalid_selection",
      };
    }
    const options = infoOptionsFor(item);
    setSession(key, { state: "choosing_info", cases: session.cases, selectedIndex: selection - 1, options });
    return { handled: true, reply: renderInfoMenu(item, options), action: "info_menu" };
  }

  if (session.state === "choosing_info") {
    const item = session.cases[session.selectedIndex];
    const options = session.options || infoOptionsFor(item);
    const option = options[selection - 1];
    if (!item || !option) {
      return {
        handled: true,
        reply: `Pilihan tidak tersedia. Balas angka *1* sampai *${options.length}*, atau ketik *MENU*.`,
        action: "invalid_selection",
      };
    }

    // Jawaban tetap ditempuh lewat jalur perintah lama, lengkap dengan
    // pemeriksaan hak akses di dalamnya. Hak akses SELALU dihitung ulang di
    // sana; potret hanya menyimpan isi jawaban per nomor perkara, tidak pernah
    // menyimpan keputusan boleh-tidaknya seseorang mengakses.
    const command = option.handler
      ? `${option.handler}#${item.nomorPerkara}`
      : `${resolveOptionCommand(option, item)}#${item.nomorPerkara}`;
    let answer = "";
    let sumberData = "fresh";
    let umurDataMs = 0;
    try {
      if (option.handler === "journey") {
        // Perjalanan perkara mengatur potretnya sendiri di dalam layanannya.
        answer = await caseJourneyService.getCaseJourney(item.nomorPerkara, { senderNumber });
      } else if (option.handler === "summons") {
        answer = await caseSummonsService.getSummonsStatus(item.nomorPerkara, { senderNumber });
      } else if (option.handler === "document") {
        answer = await caseDocumentService.requestDecisionDocument(item.nomorPerkara, { senderNumber });
      } else {
        const hasil = await caseSnapshotService.remember({
          kind: option.key,
          caseNumber: item.nomorPerkara,
          // Pendaftaran antrian sidang MENULIS ke data; tidak boleh dijawab dari
          // potret, sebab jawaban tersimpan akan membuat orang mengira sudah
          // terdaftar padahal pendaftarannya tidak pernah dijalankan.
          bypass: option.mutates === true,
          loader: () => answerCommand(command),
        });
        answer = hasil.value;
        sumberData = hasil.source;
        umurDataMs = hasil.ageMs;
      }
    } catch (error) {
      return {
        handled: true,
        reply: "Maaf, data sedang tidak dapat diambil. Silakan coba beberapa saat lagi atau hubungi PTSP pengadilan.",
        action: "answer_failed",
        optionKey: option.key,
        errorMessage: error.message,
      };
    }

    // Sesi dipertahankan supaya pengguna bisa langsung memilih informasi lain.
    setSession(key, { state: "choosing_info", cases: session.cases, selectedIndex: session.selectedIndex, options });

    const raw = String(answer || "").trim();
    if (!raw) {
      // Jawaban kosong tanpa sebab terbaca seperti sistem rusak, dan mengirim
      // orang menelepon PTSP untuk hal yang sebenarnya sudah bisa dijawab.
      return {
        handled: true,
        reply:
          `Belum ada data ${option.label.toLowerCase()} untuk perkara ${item.nomorPerkara}.\n\n` +
          `${explainEmptyAnswer(option.key)}\n\n` +
          "Ketik *MENU* untuk pilihan lain, atau pilih *Perjalanan perkara* untuk melihat tahapan yang sedang berjalan.",
        action: "empty_answer",
        optionKey: option.key,
      };
    }

    // Istilah hukum di dalam jawaban dijelaskan seperlunya. Istilah resminya
    // tetap utuh karena itulah yang tertulis pada dokumen yang dipegang pihak.
    const body = legalGlossaryService.explainTerms(raw);
    // Jawaban dari potret lama harus jujur menyebut umurnya. Data perkara yang
    // disajikan seolah-olah terkini padahal bukan jauh lebih berbahaya daripada
    // data yang diakui lawas.
    const catatanUmur =
      sumberData === "stale"
        ? `\n\n_Sumber data sedang bermasalah. Ini data terakhir yang tersimpan, diambil ${caseSnapshotService.describeAge(umurDataMs)}._`
        : "";

    return {
      handled: true,
      reply: `${body}${catatanUmur}\n\n_Ketik *MENU* untuk informasi lainnya._`,
      action: "answered",
      command,
      optionKey: option.key,
      dataSource: sumberData,
      dataAgeMs: umurDataMs,
    };
  }

  return { handled: false };
}

module.exports = {
  CASE_INFO_OPTIONS,
  GREETING_KEYWORDS,
  MENU_KEYWORDS,
  clearAllSessions,
  clearSession,
  getSession,
  handleMenuMessage,
  infoOptionsFor,
  parseSelection,
  renderCaseMenu,
  resolveOptionCommand,
  renderInfoMenu,
  explainEmptyAnswer,
  renderNoCaseMessage,
};
