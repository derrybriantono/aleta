#!/usr/bin/env node
"use strict";

/**
 * Membuktikan ALETA Bot MENERIMA konfigurasi AI dari portal saat API key
 * diteruskan langsung (bukan lewat env), dan tetap menolak bila memang tidak
 * ada key sama sekali.
 *
 *   node scripts/verify-ai-config-sync.js
 *
 * Latar: portal (v1.6.8+) meneruskan API key dari UI lewat jalur internal
 * bertoken bila env key kosong. Sebelum perbaikan ini, guard produksi bot hanya
 * memeriksa ENV KEY, sehingga key yang diteruskan ditolak dengan HTTP 400 dan
 * AI bot "tidak sinkron" walau portal sudah konek.
 */
const aiRuntime = require("../services/aiRuntimeConfigService");

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

function bersihkanEnv() {
  for (const key of ["GEMINI_API_KEY", "ALETA_BOT_ALLOW_VOLATILE_AI_SECRET", "ALETA_BOT_AI_API_KEY_ENV"]) {
    delete process.env[key];
  }
}

const nodeEnvAsli = process.env.NODE_ENV;
process.env.NODE_ENV = "production";

const dasar = { provider: "gemini", model: "gemini-2.5-flash", enabled: true };

console.log("\n== Produksi, key DITERUSKAN dari portal (env kosong, tanpa volatile) ==");
bersihkanEnv();
const diteruskan = aiRuntime.validateAiRuntimeConfig({ ...dasar, apiKey: "AIzaSyRealForwardedKey1234567890" });
periksa("konfigurasi DITERIMA (inti perbaikan)", diteruskan.valid, true);
periksa("tidak ada error", diteruskan.errors.length, 0);

console.log("\n== Produksi, key ADA di env (GEMINI_API_KEY) ==");
bersihkanEnv();
process.env.GEMINI_API_KEY = "AIzaSyEnvKey1234567890";
const dariEnv = aiRuntime.validateAiRuntimeConfig({ ...dasar });
periksa("konfigurasi diterima lewat env", dariEnv.valid, true);

console.log("\n== Produksi, TIDAK ADA key sama sekali ==");
bersihkanEnv();
const kosong = aiRuntime.validateAiRuntimeConfig({ ...dasar });
periksa("konfigurasi DITOLAK bila tidak ada key", kosong.valid, false);
periksa(
  "pesan menyebut cara mengisi key",
  kosong.errors.join(" ").includes("GEMINI_API_KEY") || kosong.errors.join(" ").includes("API key"),
  true
);

console.log("\n== Produksi, volatile diizinkan DAN key diteruskan ==");
bersihkanEnv();
process.env.ALETA_BOT_ALLOW_VOLATILE_AI_SECRET = "true";
const volatil = aiRuntime.validateAiRuntimeConfig({ ...dasar, apiKey: "AIzaSyVolatileForwardedKey123" });
periksa("volatile + key diteruskan diterima", volatil.valid, true);

console.log("\n== Volatile diizinkan tapi tetap tanpa key sama sekali ==");
bersihkanEnv();
process.env.ALETA_BOT_ALLOW_VOLATILE_AI_SECRET = "true";
const volatilKosong = aiRuntime.validateAiRuntimeConfig({ ...dasar });
// Volatile hanya mengizinkan jalur; key tetap wajib ADA (diteruskan/di env).
periksa("volatile tanpa key apa pun tetap ditolak", volatilKosong.valid, false);

console.log("\n== Key yang diteruskan benar-benar dipakai saat memanggil provider ==");
bersihkanEnv();
(async () => {
  await aiRuntime.updateAiRuntimeConfig(
    { ...dasar, apiKey: "AIzaSyRealForwardedKey1234567890", apiKeyConfigured: true },
    "manajemen_surat"
  );
  const clientConfig = await aiRuntime.getProviderClientConfig("gemini");
  periksa("apiKey terpasang untuk panggilan provider", clientConfig.apiKey, "AIzaSyRealForwardedKey1234567890");
  periksa("secret dianggap tersedia", clientConfig.secretAvailable, true);

  process.env.NODE_ENV = nodeEnvAsli;
  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
})().catch((galat) => {
  process.env.NODE_ENV = nodeEnvAsli;
  console.error("Verifikasi gagal dijalankan:", galat && galat.message ? galat.message : galat);
  process.exit(2);
});
