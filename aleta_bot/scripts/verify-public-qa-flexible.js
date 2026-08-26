#!/usr/bin/env node
"use strict";

/**
 * Membuktikan pertanyaan publik dikenali walau kalimatnya tidak persis, dan
 * jawabannya diambil dari blangko yang disusun admin.
 *
 *   node scripts/verify-public-qa-flexible.js
 *
 * Dua keluhan yang diperbaiki:
 *   1. pencocokan kaku - hanya kalimat yang mirip contoh yang dikenali,
 *      dan aturan buatan admin tidak pernah dapat bantuan kata kunci karena
 *      daftarnya dipaku di kode untuk aturan bawaan saja,
 *   2. jawaban tidak mengikuti blangko yang sudah dibuat admin.
 *
 * Yang TIDAK boleh ikut longgar: pertanyaan yang jelas beda topik tidak boleh
 * dipaksa cocok, karena itu justru membuat pihak menerima jawaban salah.
 */
const runtimeConfigModule = require("../config/runtime-config");

const INTENTS = [
  {
    key: "cek_akta_cerai",
    name: "Akta Cerai",
    audience: "party",
    isActive: true,
    status: "active",
    responseMode: "static_template",
    exactTriggers: ["akta cerai"],
    exampleQuestions: ["kapan akta cerai bisa diambil", "syarat pengambilan akta cerai"],
    answerTemplate: "Akta cerai dapat diambil 14 hari setelah putusan berkekuatan hukum tetap. Bawa KTP asli ke PTSP.",
    confidenceThreshold: 0.65,
  },
  {
    key: "sisa_panjar",
    name: "Biaya Perkara",
    audience: "party",
    isActive: true,
    status: "active",
    responseMode: "static_template",
    exactTriggers: ["biaya perkara"],
    exampleQuestions: ["berapa sisa panjar saya", "biaya pendaftaran perkara"],
    answerTemplate: "Sisa panjar dapat dilihat di aplikasi e-Court atau ditanyakan ke Meja I.",
    confidenceThreshold: 0.65,
  },
  {
    key: "layanan_posbakum",
    name: "Posbakum",
    audience: "party",
    isActive: true,
    status: "active",
    responseMode: "static_template",
    exactTriggers: ["posbakum"],
    exampleQuestions: ["bantuan hukum gratis"],
    // Aturan buatan admin: kata kuncinya diisi sendiri, bukan dari kode.
    matchKeywords: ["posbakum", "bantuan hukum", "pengacara gratis"],
    answerTemplate: "Posbakum melayani konsultasi hukum gratis setiap hari kerja pukul 08.00-15.00 di ruang PTSP.",
    confidenceThreshold: 0.65,
  },
];

runtimeConfigModule.readRuntimeConfig = () => ({
  botEnabled: true,
  publicQaEnabled: true,
  publicQaIntents: INTENTS,
  employeeRecipients: [],
});

const intentService = require("../services/publicQaIntentService");

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

function cocokkan(kalimat) {
  const hasil = intentService.matchAliasOrExample(kalimat);
  return hasil ? hasil.intent.key : "";
}

console.log("\n== Kalimat berbeda tetap dikenali ==");
const kasusAkta = [
  "kapan akta cerai saya bisa diambil",
  "akte cerai sudah jadi belum",
  "sy mau ambil akte cerai",
  "syarat ambil akta cerai apa saja",
];
for (const kalimat of kasusAkta) {
  periksa(`"${kalimat}" -> akta cerai`, cocokkan(kalimat), "cek_akta_cerai");
}

const kasusBiaya = [
  "berapa sisa panjar saya",
  "brp biaya perkaranya",
  "sisa panjer masih ada tidak",
  "biaya pendaftaran berapa",
];
for (const kalimat of kasusBiaya) {
  periksa(`"${kalimat}" -> biaya`, cocokkan(kalimat), "sisa_panjar");
}

console.log("\n== Salah ketik dimaafkan ==");
periksa('"akta cerei" tetap dikenali', cocokkan("kapan akta cerei bisa diambil"), "cek_akta_cerai");
periksa('"panajr" tetap dikenali', cocokkan("sisa panajr saya berapa"), "sisa_panjar");

console.log("\n== Kata kunci buatan admin ikut dipakai ==");
periksa(
  "aturan buatan admin dikenali lewat kata kuncinya",
  cocokkan("saya mau minta bantuan hukum gratis"),
  "layanan_posbakum"
);
periksa("kata kunci tunggal juga bekerja", cocokkan("ada posbakum tidak di sini"), "layanan_posbakum");

console.log("\n== Yang beda topik TIDAK dipaksa cocok ==");
for (const kalimat of ["saya mau pesan makanan siang ini", "tolong kirim foto liburan kemarin"]) {
  periksa(`"${kalimat}" tidak dicocokkan`, cocokkan(kalimat), "");
}

console.log("\n== Jawaban memakai blangko yang dibuat admin ==");
const aktaIntent = intentService.getRuntimeIntents().find((item) => item.key === "cek_akta_cerai");
periksa("blangko terbaca dari konfigurasi", Boolean(aktaIntent.answerTemplate), true);

const hasilAkta = intentService.executeIntent(aktaIntent, {});
periksa("status terjawab", hasilAkta.status, "answered");
periksa(
  "isi jawaban persis blangko admin",
  hasilAkta.answer,
  "Akta cerai dapat diambil 14 hari setelah putusan berkekuatan hukum tetap. Bawa KTP asli ke PTSP."
);

const posbakumIntent = intentService.getRuntimeIntents().find((item) => item.key === "layanan_posbakum");
periksa(
  "aturan buatan admin juga menjawab dengan blangkonya",
  intentService.executeIntent(posbakumIntent, {}).answer,
  "Posbakum melayani konsultasi hukum gratis setiap hari kerja pukul 08.00-15.00 di ruang PTSP."
);

console.log("\n== Tanpa blangko, perilaku lama dipertahankan ==");
const tanpaBlangko = {
  ...aktaIntent,
  answerTemplate: "",
  fallbackMessage: "Silakan hubungi PTSP.",
  responseMode: "static_template",
};
periksa(
  "jatuh ke kalimat bawaan bila blangko kosong",
  intentService.executeIntent(tanpaBlangko, {}).answer,
  "Silakan hubungi PTSP."
);

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
console.log("SEMUA PERIKSAAN LULUS.");
process.exit(0);
