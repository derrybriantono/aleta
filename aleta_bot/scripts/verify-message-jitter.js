#!/usr/bin/env node
"use strict";

/**
 * Membuktikan jeda antar pesan memakai JITTER (acak) dalam rentang yang diatur
 * Slider Risiko, dan aman untuk konfigurasi lama (jeda tetap).
 *
 *   node scripts/verify-message-jitter.js
 *
 * Interval yang persis sama tiap pesan adalah ciri bot yang paling mudah
 * dikenali WhatsApp. Jitter membuat pola lebih manusiawi.
 */
const { resolveJitteredDelayMs } = require("../services/messageService");

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

console.log("\n== Jitter aktif: min < max ==");
const cfg = { messageDelayMs: 5000, messageDelayMaxMs: 8000 };
const sampel = Array.from({ length: 400 }, () => resolveJitteredDelayMs(cfg, null));
const min = Math.min(...sampel);
const maks = Math.max(...sampel);
const unik = new Set(sampel).size;

periksa(`semua nilai >= min (${min} >= 5000)`, min >= 5000);
periksa(`semua nilai <= max (${maks} <= 8000)`, maks <= 8000);
periksa(`nilai bervariasi (bukan tetap): ${unik} nilai unik dari 400`, unik > 50);
periksa("menyentuh sekitar batas bawah", min < 5100);
periksa("menyentuh sekitar batas atas", maks > 7900);

console.log("\n== Aman untuk konfigurasi lama ==");
periksa("max = 0 -> jeda tetap = min", resolveJitteredDelayMs({ messageDelayMs: 3000, messageDelayMaxMs: 0 }, null) === 3000);
periksa("max <= min -> jeda tetap = min", resolveJitteredDelayMs({ messageDelayMs: 3000, messageDelayMaxMs: 2000 }, null) === 3000);
periksa("tanpa knob apa pun -> 0", resolveJitteredDelayMs({}, null) === 0);

console.log("\n== delay eksplisit dari pemanggil dihormati apa adanya ==");
periksa("delay eksplisit 1234 dipakai", resolveJitteredDelayMs(cfg, 1234) === 1234);
periksa("delay eksplisit 0 dipakai", resolveJitteredDelayMs(cfg, 0) === 0);

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
console.log("SEMUA PERIKSAAN LULUS.");
process.exit(0);
