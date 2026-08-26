#!/usr/bin/env node
"use strict";

/**
 * Membuktikan pesan sejenis TIDAK berangkat serentak.
 *
 *   node scripts/verify-sending-pace.js
 *
 * Yang diperiksa: jarak antar pesan berurutan, jeda per nomor yang sama,
 * pemindahan pesan malam ke jam kirim berikutnya, dan pengecualian untuk pesan
 * interaktif yang memang harus langsung dijawab.
 */
const {
  computeScheduledAt,
  isPacedCategory,
  shiftIntoSendingWindow,
} = require("../services/sendingPaceService");

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

const paceMinimal = { enabled: true, minGapMs: 20000, maxGapMs: 40000, perRecipientCooldownMs: 30 * 60 * 1000 };
const jamKerja = { enabled: true, start: "08:00", end: "16:00" };
const tanpaJam = { enabled: false, start: "00:00", end: "23:59" };

/** Selasa 22 Agustus 2026 pukul 10:00 — di dalam jam kerja. */
function siangHari() {
  return new Date(2026, 7, 22, 10, 0, 0, 0);
}

console.log("\n== Satu batch notifikasi: tiap pesan punya jadwal sendiri ==");
{
  const now = siangHari();
  const jadwal = [];
  let lastMs = 0;
  for (let i = 0; i < 12; i += 1) {
    const hasil = computeScheduledAt({
      now,
      lastQueuedMs: lastMs,
      recipientLastMs: 0,
      paceConfig: paceMinimal,
      window: jamKerja,
    });
    jadwal.push(hasil.scheduledAt.getTime());
    lastMs = hasil.scheduledAt.getTime();
  }

  const selisih = jadwal.slice(1).map((value, index) => value - jadwal[index]);
  const semuaBeda = new Set(jadwal).size === jadwal.length;
  const minSelisih = Math.min(...selisih);
  const maksSelisih = Math.max(...selisih);

  periksa(`12 pesan mendapat 12 waktu berbeda (bukan serentak)`, semuaBeda);
  periksa(`jarak terkecil >= 20 dtk (${Math.round(minSelisih / 1000)} dtk)`, minSelisih >= 20000);
  periksa(`jarak terbesar <= 40 dtk (${Math.round(maksSelisih / 1000)} dtk)`, maksSelisih <= 40000);
  periksa(`jarak bervariasi, bukan interval tetap`, new Set(selisih).size > 1);
  periksa(`pesan pertama tetap dikirim sekarang (tidak ditunda)`, jadwal[0] === now.getTime());
}

console.log("\n== Nomor yang sama tidak diberondong ==");
{
  const now = siangHari();
  const barusanMs = now.getTime() - 60 * 1000;
  const hasil = computeScheduledAt({
    now,
    lastQueuedMs: 0,
    recipientLastMs: barusanMs,
    paceConfig: paceMinimal,
    window: jamKerja,
  });
  const jarakMenit = (hasil.scheduledAt.getTime() - barusanMs) / 60000;
  periksa(`pesan kedua ke nomor sama digeser >= 30 menit (${Math.round(jarakMenit)} menit)`, jarakMenit >= 30);
  periksa("alasan penggeseran tercatat", hasil.reasons.includes("recipient_cooldown"));
}

console.log("\n== Notifikasi malam dipindah ke jam kirim berikutnya ==");
{
  // Notifikasi cron pukul 19:00, sedangkan jam kirim aman 08:00-16:00.
  const malam = new Date(2026, 7, 22, 19, 0, 0, 0);
  const hasil = computeScheduledAt({
    now: malam,
    lastQueuedMs: 0,
    recipientLastMs: 0,
    paceConfig: paceMinimal,
    window: jamKerja,
  });
  const jadwal = hasil.scheduledAt;
  periksa("pesan malam tidak dikirim malam itu juga", jadwal.getTime() > malam.getTime());
  periksa(`dijadwalkan pukul 08:00 (${jadwal.getHours()}:${String(jadwal.getMinutes()).padStart(2, "0")})`, jadwal.getHours() === 8 && jadwal.getMinutes() === 0);
  periksa("dijadwalkan keesokan harinya", jadwal.getDate() === 23);
  periksa("alasan jam kirim tercatat", hasil.reasons.includes("sending_window"));
}

console.log("\n== Antrean tertahan semalam tidak meledak serentak saat jam buka ==");
{
  const malam = new Date(2026, 7, 22, 19, 0, 0, 0);
  const jadwal = [];
  let lastMs = 0;
  for (let i = 0; i < 8; i += 1) {
    const hasil = computeScheduledAt({
      now: malam,
      lastQueuedMs: lastMs,
      recipientLastMs: 0,
      paceConfig: paceMinimal,
      window: jamKerja,
    });
    jadwal.push(hasil.scheduledAt.getTime());
    lastMs = hasil.scheduledAt.getTime();
  }
  const selisih = jadwal.slice(1).map((value, index) => value - jadwal[index]);
  periksa("8 pesan malam mendapat 8 waktu berbeda", new Set(jadwal).size === 8);
  periksa(`tetap berjarak >= 20 dtk saat jam buka (${Math.round(Math.min(...selisih) / 1000)} dtk)`, Math.min(...selisih) >= 20000);
  periksa("semuanya berangkat pada pagi hari, bukan malam", jadwal.every((ms) => new Date(ms).getHours() >= 8 && new Date(ms).getHours() <= 16));
}

console.log("\n== Pesan interaktif tidak ikut ditunda ==");
{
  periksa("balasan chat manual dikirim langsung", isPacedCategory("manual") === false);
  periksa("pesan sistem dikirim langsung", isPacedCategory("system") === false);
  periksa("pesan kritis dikirim langsung", isPacedCategory("critical") === false);
  periksa("notifikasi pihak tetap dijadwalkan", isPacedCategory("party") === true);
  periksa("notifikasi pegawai tetap dijadwalkan", isPacedCategory("employee") === true);
}

console.log("\n== Jam kirim melewati tengah malam tetap benar ==");
{
  const malamHari = { enabled: true, start: "22:00", end: "06:00" };
  const pukul23 = new Date(2026, 7, 22, 23, 0, 0, 0);
  const pukul3 = new Date(2026, 7, 22, 3, 0, 0, 0);
  const pukul12 = new Date(2026, 7, 22, 12, 0, 0, 0);
  periksa("pukul 23:00 dianggap di dalam jam 22:00-06:00", shiftIntoSendingWindow(pukul23, malamHari).getTime() === pukul23.getTime());
  periksa("pukul 03:00 dianggap di dalam jam 22:00-06:00", shiftIntoSendingWindow(pukul3, malamHari).getTime() === pukul3.getTime());
  periksa("pukul 12:00 digeser ke 22:00", shiftIntoSendingWindow(pukul12, malamHari).getHours() === 22);
}

console.log("\n== Antrean rusak/menumpuk tidak wajar tetap tidak menciptakan ledakan ==");
{
  const now = siangHari();
  // Jadwal terakhir di antrean melompat jauh ke depan (mis. data rusak).
  const jauhKeDepan = now.getTime() + 400 * 24 * 60 * 60 * 1000;
  const hasil = [];
  for (let i = 0; i < 6; i += 1) {
    hasil.push(
      computeScheduledAt({
        now,
        lastQueuedMs: jauhKeDepan,
        recipientLastMs: 0,
        paceConfig: paceMinimal,
        window: tanpaJam,
      })
    );
  }
  const batasMs = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  periksa("jadwal dipangkas ke batas maksimum 7 hari", hasil.every((item) => item.scheduledAt.getTime() <= batasMs));
  periksa("pemangkasan tercatat alasannya", hasil.every((item) => item.reasons.includes("defer_capped")));
  periksa(
    "hasil pemangkasan TIDAK menumpuk di satu waktu yang sama",
    new Set(hasil.map((item) => item.scheduledAt.getTime())).size > 1
  );
}

console.log("\n== Aman untuk konfigurasi lama ==");
{
  const now = siangHari();
  const mati = { enabled: false, minGapMs: 0, maxGapMs: 0, perRecipientCooldownMs: 0 };
  const hasil = computeScheduledAt({ now, lastQueuedMs: now.getTime(), recipientLastMs: now.getTime(), paceConfig: mati, window: jamKerja });
  periksa("pace dimatikan -> kirim sekarang juga", hasil.scheduledAt.getTime() === now.getTime());

  const tanpaBatasJam = computeScheduledAt({
    now: new Date(2026, 7, 22, 23, 30, 0, 0),
    lastQueuedMs: 0,
    recipientLastMs: 0,
    paceConfig: paceMinimal,
    window: tanpaJam,
  });
  periksa("jam kirim dimatikan -> tidak digeser", tanpaBatasJam.deferredMs === 0);
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
console.log("SEMUA PERIKSAAN LULUS.");
process.exit(0);
