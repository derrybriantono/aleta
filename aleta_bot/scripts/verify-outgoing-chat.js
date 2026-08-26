#!/usr/bin/env node
"use strict";

/**
 * Membuktikan SELURUH balasan chat mendapat perlakuan yang sama.
 *
 *   node scripts/verify-outgoing-chat.js
 *
 * Masalah yang diperbaiki: perbaikan mutu jawaban semula hanya menempel pada
 * jalur menu baru. Warga yang mengetik perintah lama seperti "akta#123.G.2026"
 * mendapat jawaban yang belum dibersihkan dan tanpa penjelasan istilah, padahal
 * bertanya hal yang sama ke bot yang sama.
 *
 * Pemeriksaan di sini menguji pintu keluar itu sendiri, DAN memastikan setiap
 * titik balasan di app.js benar-benar melewatinya.
 */

const fs = require("fs");
const path = require("path");

const outgoing = require("../services/outgoingChatService");
const glossary = require("../services/legalGlossaryService");
const { findCodeArtifacts } = require("../services/humanTextService");

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

console.log("\n== Pintu keluar membersihkan jejak kode ==");
{
  const kotor = "Perkara Anda:\nnomor_perkara: 531/Pdt.G/2026/PA.Dgl\ntanggal_sidang: 2026-09-08";
  const siap = outgoing.prepareReply(kotor);
  periksa("nama kolom mentah dinaikkan jadi label", siap.includes("Nomor Perkara:") && siap.includes("Tanggal Sidang:"));
  periksa("tidak menyisakan jejak kode", findCodeArtifacts(siap).length === 0);
  periksa("nilai datanya tidak hilang", siap.includes("531/Pdt.G/2026/PA.Dgl"));

  const adaPlaceholder = outgoing.prepareReply("Halo {{nama_pihak}}, perkara Anda terdaftar.");
  periksa("placeholder tak terisi dibuang", !adaPlaceholder.includes("{{"));
}

console.log("\n== Pintu keluar menjelaskan istilah hukum ==");
{
  const siap = outgoing.prepareReply("Putusan Anda dijatuhkan dengan verstek.");
  periksa("istilah asli tetap utuh", siap.includes("verstek"));
  periksa("penjelasan ditempel", siap.includes("tidak pernah hadir"));

  const tanpaKamus = outgoing.prepareReply("Putusan Anda dijatuhkan dengan verstek.", { withGlossary: false });
  periksa("dapat dimatikan bila tidak perlu", !tanpaKamus.includes("Arti istilah"));
  periksa("tetapi tetap dibersihkan", tanpaKamus.includes("verstek"));
}

console.log("\n== Aman dilewati dua kali ==");
{
  const sekali = outgoing.prepareReply("Putusan verstek sudah berkekuatan hukum tetap.");
  const dua = outgoing.prepareReply(sekali);
  periksa("hasilnya tidak berubah", sekali === dua);
  periksa("penjelasan tidak tertempel ganda", (dua.match(new RegExp(glossary.GLOSSARY_HEADING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length === 1);
}

console.log("\n== Balasan panjang tidak ditambahi lagi ==");
{
  const panjang = `Putusan verstek.\n${"x".repeat(outgoing.MAX_LENGTH_FOR_GLOSSARY)}`;
  const siap = outgoing.prepareReply(panjang);
  periksa("kamus dilewati agar tetap terbaca", !siap.includes("Arti istilah"));
}

console.log("\n== Masukan kosong dan tidak wajar ==");
{
  periksa("teks kosong dikembalikan apa adanya", outgoing.prepareReply("") === "");
  periksa("spasi saja tidak diutak-atik", outgoing.prepareReply("   ") === "   ");
  periksa("null tidak melempar galat", typeof outgoing.prepareReply(null) === "string");
  periksa("angka diubah jadi teks", outgoing.prepareReply(123) === "123");
}

console.log("\n== SELURUH balasan di app.js melewati pintu keluar ==");
{
  const isi = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

  // msg.reply() hanya boleh muncul di dalam pembantu balasChat.
  const barisReply = isi
    .split("\n")
    .map((baris, index) => ({ baris: baris.trim(), nomor: index + 1 }))
    .filter((item) => item.baris.includes("msg.reply(") && !item.baris.startsWith("//"));

  periksa(`hanya satu titik msg.reply yang tersisa (${barisReply.length})`, barisReply.length === 1);
  periksa(
    "titik itu berada di dalam pembantu balasChat",
    barisReply.length === 1 && isi.slice(0, isi.indexOf(barisReply[0].baris)).includes("async function balasChat")
  );

  const jumlahBalasChat = (isi.match(/await balasChat\(/g) || []).length;
  periksa(`seluruh jalur memanggil balasChat (${jumlahBalasChat} pemanggilan)`, jumlahBalasChat >= 8);

  periksa("pembantu memakai pintu keluar", /outgoingChatService\.prepareReply\(/.test(isi));
  periksa("pembantu mencatat corong layanan", /serviceAnalyticsService\.record\(/.test(isi));
}

console.log("\n== Jalur yang wajib ikut tercakup ==");
{
  const isi = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
  const jalur = [
    ["menu baru", /balasChat\(msg, menuResult\.reply/],
    ["perintah detail#", /optionKey: "detail"/],
    ["perintah ai# dan bot#", /optionKey: "ai"/],
    ["pendaftaran antrian", /optionKey: "antrian"/],
    ["penolakan hak akses", /action: "no_case"/],
    ["perintah lama dan tanya bebas", /perintah_lama/],
  ];
  for (const [nama, pola] of jalur) {
    periksa(`${nama} ikut dialirkan`, pola.test(isi));
  }
}

console.log("\n== Pemberitahuan ke pihak ikut dijelaskan istilahnya ==");
{
  const isi = fs.readFileSync(
    path.resolve(__dirname, "..", "services", "dynamicNotificationSchedulerService.js"),
    "utf8"
  );
  periksa("penyiap isi pemberitahuan dipakai", /prepareNotificationBody\(renderMessage\(/.test(isi));
  periksa("kamus istilah dipanggil di dalamnya", /return explainTerms\(withFooter\)/.test(isi));
  periksa(
    "hanya untuk pihak, bukan pegawai",
    /if \(normalized !== "party"\) return withFooter;/.test(isi)
  );
  periksa("ajakan berhenti tetap ditempel", /appendOptOutFooter\(message, normalized\)/.test(isi));
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
console.log("SEMUA PERIKSAAN LULUS.");
process.exit(0);
