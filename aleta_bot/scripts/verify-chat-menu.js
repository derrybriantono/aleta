#!/usr/bin/env node
"use strict";

/**
 * Membuktikan menu pilihan bernomor bekerja DAN tidak melonggarkan keamanan.
 *
 *   node scripts/verify-chat-menu.js
 *
 * Yang paling penting diperiksa di sini bukan tampilannya, melainkan bahwa menu
 * hanya menampilkan perkara milik nomor pengirim, dan bahwa jawabannya tetap
 * ditempuh lewat jalur perintah lama yang sudah menegakkan verifikasi.
 */

const Module = require("module");
const path = require("path");

// Sumber data perkara dipalsukan agar pengujian tidak menyentuh SIPP.
const DATA_PERKARA = {
  // Dua perkara.
  "6285242120977": [
    { perkaraId: 1, nomorPerkara: "531/Pdt.G/2026/PA.Dgl", nama: "Misbahudin", pihakKe: "1", recipientType: "pihak", jenisPerkara: "Gugatan" },
    { perkaraId: 2, nomorPerkara: "219/Pdt.P/2026/PA.Dgl", nama: "Misbahudin", pihakKe: "1", recipientType: "pihak", jenisPerkara: "Permohonan" },
  ],
  // Satu perkara.
  "6285750765694": [
    { perkaraId: 3, nomorPerkara: "530/Pdt.G/2026/PA.Dgl", nama: "Risna", pihakKe: "2", recipientType: "pihak", jenisPerkara: "Gugatan" },
  ],
  // Tidak punya perkara.
  "6281111111111": [],
};

const directoryPath = require.resolve("../services/caseDirectoryService");
const asliLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  const resolved = (() => {
    try {
      return require.resolve(request, { paths: [path.dirname(parent?.filename || __filename)] });
    } catch {
      return null;
    }
  })();
  if (resolved === directoryPath) {
    const asli = asliLoad.call(this, request, parent, isMain);
    return {
      ...asli,
      listCasesForPhone: async (nomor) => DATA_PERKARA[String(nomor || "").replace(/@c\.us$/, "")] || [],
    };
  }
  return asliLoad.call(this, request, parent, isMain);
};

// optOutService menyentuh database; untuk pengujian ini cukup dicatat di memori.
const optOutPath = require.resolve("../services/optOutService");
const berhenti = new Set();
const asliOptOut = require("../services/optOutService");
require.cache[optOutPath].exports = {
  ...asliOptOut,
  isOptedOut: async (nomor) => berhenti.has(String(nomor || "")),
  optOut: async (nomor) => {
    berhenti.add(String(nomor || ""));
    return { ok: true, message: asliOptOut.OPT_OUT_CONFIRMATION };
  },
  resume: async (nomor) => {
    berhenti.delete(String(nomor || ""));
    return { ok: true, message: asliOptOut.RESUME_CONFIRMATION };
  },
};

const journeyPath = require.resolve("../services/caseJourneyService");
require("../services/caseJourneyService");
require.cache[journeyPath].exports = {
  ...require("../services/caseJourneyService"),
  getCaseJourney: async (nomorPerkara) => `[perjalanan ${nomorPerkara}]`,
};

const chatMenu = require("../services/chatMenuService");
const caseSnapshot = require("../services/caseSnapshotService");

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

/** Mencatat perintah apa saja yang benar-benar dijalankan menu. */
function perekamPerintah() {
  const dipanggil = [];
  return {
    dipanggil,
    answerCommand: async (command) => {
      dipanggil.push(command);
      return `[hasil untuk ${command}]`;
    },
  };
}

function kirim(nomor, teks, perekam) {
  return chatMenu.handleMenuMessage({
    senderNumber: nomor,
    chatId: nomor,
    text: teks,
    answerCommand: perekam.answerCommand,
  });
}


/** Nomor urut sebuah pilihan menu, dihitung dari kuncinya. */
function nomorOpsi(kunci, item = { jenisPerkara: "Gugatan" }) {
  return String(chatMenu.infoOptionsFor(item).findIndex((o) => o.key === kunci) + 1);
}

async function jalankan() {
  const DUA = "6285242120977";
  const SATU = "6285750765694";
  const KOSONG = "6281111111111";

  console.log("\n== Sapaan membuka menu perkara milik pengirim ==");
  {
    chatMenu.clearAllSessions();
    const p = perekamPerintah();
    const hasil = await kirim(DUA, "Assalamualaikum", p);
    periksa("sapaan dilayani menu", hasil.handled === true);
    periksa("menampilkan daftar perkara", hasil.action === "case_menu");
    periksa("memuat perkara pertama", hasil.reply.includes("531/Pdt.G/2026/PA.Dgl"));
    periksa("memuat perkara kedua", hasil.reply.includes("219/Pdt.P/2026/PA.Dgl"));
    periksa("menyebut peran pihak", hasil.reply.includes("Penggugat"));
    periksa("menyertakan ajakan berhenti", hasil.reply.includes("BERHENTI"));
    periksa("belum menjalankan perintah apa pun", p.dipanggil.length === 0);
  }

  console.log("\n== Memilih perkara lalu memilih informasi ==");
  {
    chatMenu.clearAllSessions();
    const p = perekamPerintah();
    await kirim(DUA, "menu", p);
    const pilihPerkara = await kirim(DUA, "1", p);
    periksa("angka perkara diterima", pilihPerkara.action === "info_menu");
    periksa("menampilkan nomor perkara terpilih", pilihPerkara.reply.includes("531/Pdt.G/2026/PA.Dgl"));
    periksa("menawarkan jadwal sidang", pilihPerkara.reply.includes("Jadwal sidang"));
    periksa("menawarkan biaya", pilihPerkara.reply.includes("Biaya dan sisa panjar"));

    const pilihInfo = await kirim(DUA, nomorOpsi("jadwal"), p);
    periksa("informasi terjawab", pilihInfo.action === "answered");
    periksa(
      `perintah dijalankan dengan nomor perkara yang benar (${p.dipanggil[0]})`,
      p.dipanggil[0] === "jadwal#531/Pdt.G/2026/PA.Dgl"
    );
    periksa("jawaban ikut ditampilkan", pilihInfo.reply.includes("[hasil untuk jadwal#531/Pdt.G/2026/PA.Dgl]"));
    periksa("mengajak kembali ke menu", pilihInfo.reply.includes("MENU"));
  }

  console.log("\n== Perkara tunggal langsung ke daftar informasi ==");
  {
    chatMenu.clearAllSessions();
    const p = perekamPerintah();
    const hasil = await kirim(SATU, "halo", p);
    periksa("melewati layar pemilihan perkara", hasil.action === "info_menu");
    periksa("menyebut perkara satu-satunya", hasil.reply.includes("530/Pdt.G/2026/PA.Dgl"));
    periksa("peran tergugat terbaca", hasil.reply.includes("Tergugat"));
  }

  console.log("\n== KEAMANAN: hanya perkara milik nomor itu yang muncul ==");
  {
    chatMenu.clearAllSessions();
    const p = perekamPerintah();
    const hasil = await kirim(SATU, "menu", p);
    periksa("tidak membocorkan perkara nomor lain", !hasil.reply.includes("531/Pdt.G/2026/PA.Dgl"));
    periksa("tidak membocorkan perkara nomor lain (2)", !hasil.reply.includes("219/Pdt.P/2026/PA.Dgl"));

    // Angka di luar jumlah pilihan yang ditawarkan harus ditolak, bukan
    // menggeser ke perkara atau informasi milik orang lain.
    const luar = await kirim(SATU, "19", p);
    periksa("angka di luar daftar ditolak", luar.action === "invalid_selection");
    periksa("penolakan tidak menjalankan perintah", p.dipanggil.length === 0);

    // Apa pun pilihan yang sah, perintahnya HANYA boleh membawa nomor perkara
    // milik pengirim itu sendiri.
    const jumlahOpsi = chatMenu.infoOptionsFor({ jenisPerkara: "Gugatan" }).length;
    for (let pilihan = 1; pilihan <= jumlahOpsi; pilihan += 1) {
      await kirim(SATU, String(pilihan), p);
    }
    periksa(`semua pilihan dijalankan (${p.dipanggil.length} perintah)`, p.dipanggil.length > 0);
    periksa(
      "setiap perintah hanya memakai perkara milik pengirim",
      p.dipanggil.every((cmd) => cmd.endsWith("#530/Pdt.G/2026/PA.Dgl"))
    );
    periksa(
      "tidak satu pun perintah menyentuh perkara nomor lain",
      p.dipanggil.every((cmd) => !cmd.includes("531/") && !cmd.includes("219/"))
    );
  }

  console.log("\n== KEAMANAN: nomor tanpa perkara tidak mendapat menu ==");
  {
    chatMenu.clearAllSessions();
    const p = perekamPerintah();
    const sapa = await kirim(KOSONG, "halo", p);
    periksa("sapaan diteruskan ke sambutan lama", sapa.handled === false);

    const menu = await kirim(KOSONG, "menu", p);
    periksa("permintaan menu dijawab penjelasan", menu.action === "no_case");
    periksa("menjelaskan alasan keamanannya", menu.reply.includes("keamanan data"));
    periksa("mengarahkan ke PTSP", menu.reply.includes("PTSP"));
    periksa("tidak menjalankan perintah apa pun", p.dipanggil.length === 0);
  }

  console.log("\n== Perintah lama tetap berfungsi ==");
  {
    chatMenu.clearAllSessions();
    const p = perekamPerintah();
    const lama = await kirim(DUA, "akta#531.G.2026", p);
    periksa("perintah bersyarat tidak direbut menu", lama.handled === false);

    const bebas = await kirim(DUA, "berapa biaya perkara saya", p);
    periksa("pertanyaan bebas tidak direbut menu", bebas.handled === false);
  }

  console.log("\n== Angka tanpa sesi tidak direbut menu ==");
  {
    chatMenu.clearAllSessions();
    const p = perekamPerintah();
    const hasil = await kirim(DUA, "2", p);
    periksa("angka tanpa menu terbuka diteruskan", hasil.handled === false);
  }

  console.log("\n== Tombol BERHENTI ==");
  {
    chatMenu.clearAllSessions();
    const p = perekamPerintah();
    const stop = await kirim(DUA, "BERHENTI", p);
    periksa("permintaan berhenti dilayani", stop.action === "opt_out");
    periksa("dikonfirmasi ke penerima", stop.reply.includes("dihentikan"));
    periksa("menjelaskan panggilan resmi tetap jalan", stop.reply.includes("Jurusita"));
    periksa("memberi tahu cara mengaktifkan lagi", stop.reply.includes("LANJUT"));
    periksa("tercatat sebagai berhenti", berhenti.has(DUA));

    const stopKecil = await kirim(SATU, "berhenti", p);
    periksa("huruf kecil tetap dikenali", stopKecil.action === "opt_out");
    const stopTandaBaca = await kirim(KOSONG, "Stop.", p);
    periksa("tanda baca tetap dikenali", stopTandaBaca.action === "opt_out");

    const lanjut = await kirim(DUA, "LANJUT", p);
    periksa("berlangganan kembali dilayani", lanjut.action === "resume");
    periksa("tidak lagi tercatat berhenti", !berhenti.has(DUA));
  }

  console.log("\n== Berhenti didahulukan walau sedang di tengah menu ==");
  {
    chatMenu.clearAllSessions();
    const p = perekamPerintah();
    await kirim(DUA, "menu", p);
    const stop = await kirim(DUA, "berhenti", p);
    periksa("permintaan berhenti tetap menang", stop.action === "opt_out");
    periksa("sesi menu ditutup", chatMenu.getSession(DUA) === null);
  }

  console.log("\n== Pilihan informasi menyesuaikan jenis perkara ==");
  {
    const gugatan = chatMenu.infoOptionsFor({ jenisPerkara: "Gugatan" });
    const pidana = chatMenu.infoOptionsFor({ jenisPerkara: "Pidana Biasa" });
    periksa("akta cerai ditawarkan pada perkara gugatan", gugatan.some((o) => o.key === "akta"));
    periksa("akta cerai tidak ditawarkan pada perkara pidana", !pidana.some((o) => o.key === "akta"));
    periksa("jadwal sidang selalu tersedia", pidana.some((o) => o.key === "jadwal"));
  }

  console.log("\n== Pembacaan angka pilihan ==");
  {
    periksa('"3" dibaca sebagai pilihan 3', chatMenu.parseSelection("3") === 3);
    periksa('"3." tetap dibaca', chatMenu.parseSelection("3.") === 3);
    periksa('"12" dibaca', chatMenu.parseSelection("12") === 12);
    periksa("nomor perkara bukan pilihan", chatMenu.parseSelection("531/Pdt.G/2026/PA.Dgl") === null);
    periksa("teks biasa bukan pilihan", chatMenu.parseSelection("jadwal") === null);
    periksa("angka terlalu besar ditolak", chatMenu.parseSelection("999") === null);
  }

  console.log("\n== Potret perkara: jawaban kedua tidak menyentuh SIPP lagi ==");
  {
    chatMenu.clearAllSessions();
    caseSnapshot.reset();
    const p = perekamPerintah();
    await kirim(SATU, "menu", p);
    await kirim(SATU, nomorOpsi("jadwal"), p); // pengambilan pertama
    await kirim(SATU, nomorOpsi("jadwal"), p); // jadwal lagi
    await kirim(SATU, nomorOpsi("jadwal"), p); // dan lagi
    periksa(`SIPP dipanggil sekali untuk tiga permintaan jadwal (${p.dipanggil.length}x)`, p.dipanggil.length === 1);

    await kirim(SATU, nomorOpsi("biaya"), p); // informasi berbeda, harus diambil
    periksa("informasi berbeda tetap diambil", p.dipanggil.length === 2);
    periksa("perintahnya benar", p.dipanggil[1].startsWith("biaya#"));
  }

  console.log("\n== Pendaftaran antrian TIDAK pernah dijawab dari potret ==");
  {
    chatMenu.clearAllSessions();
    caseSnapshot.reset();
    const p = perekamPerintah();
    await kirim(SATU, "menu", p);
    const opsi = chatMenu.infoOptionsFor({ jenisPerkara: "Gugatan" });
    const nomorAntrian = nomorOpsi("antrian");

    await kirim(SATU, nomorAntrian, p);
    await kirim(SATU, nomorAntrian, p);
    await kirim(SATU, nomorAntrian, p);
    periksa(`setiap pendaftaran benar-benar dijalankan (${p.dipanggil.length}x)`, p.dipanggil.length === 3);
  }

  console.log("\n== Slot antrian mengikuti peran pihak ==");
  {
    const opsi = chatMenu.CASE_INFO_OPTIONS.find((o) => o.key === "antrian");
    periksa(
      "penggugat didaftarkan sebagai pihak_1",
      chatMenu.resolveOptionCommand(opsi, { pihakKe: "1" }) === "daftar antrian"
    );
    periksa(
      "tergugat didaftarkan sebagai pihak_2",
      chatMenu.resolveOptionCommand(opsi, { pihakKe: "2" }) === "antrian online"
    );

    // SATU adalah tergugat (pihakKe "2") menurut data uji di atas.
    chatMenu.clearAllSessions();
    caseSnapshot.reset();
    const p = perekamPerintah();
    await kirim(SATU, "menu", p);
    const daftar = chatMenu.infoOptionsFor({ jenisPerkara: "Gugatan" });
    await kirim(SATU, nomorOpsi("antrian"), p);
    periksa(`tergugat memakai perintah pihak_2 (${p.dipanggil[0]})`, p.dipanggil[0].startsWith("antrian online#"));
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

jalankan().catch((error) => {
  console.error("Gagal menjalankan pengujian:", error);
  process.exit(1);
});
