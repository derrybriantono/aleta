"use strict";

/**
 * ============================================================================
 * MODE KEMBARAN - ALETA berjalan di laptop selagi server kantor mati
 * ============================================================================
 *
 * Penandanya satu: ALETA_MODE=kembaran (env bot, juga env portal). Di mode
 * ini bot menghadapi salinan SIPP/ABT di laptop, BUKAN yang asli:
 *
 *   - tulisan ke SIPP/ABT/antrian tidak dijalankan; masuk antrean "menunggu
 *     sinkron" (lihat penjagaKembaran + kembaranAntrean);
 *   - WhatsApp dan e-Court dimatikan (sesi WhatsApp yang sama tidak boleh
 *     menyala di dua tempat, dan e-Court adalah sistem Mahkamah Agung);
 *   - data berasal dari tarikan terakhir (scripts/kembaran/tarik.mjs), yang
 *     dicatat di berkas cap tarik. Pita "Mode kembaran - data per ..." di
 *     portal dan keterangan status bot membacanya dari sini.
 *
 * Berkas ini sengaja tanpa ketergantungan: dipanggil paling awal oleh
 * db_config*.js, sebelum apa pun lain dimuat.
 */

const fs = require("fs");
const path = require("path");

/** Folder kerja kembaran di laptop - drive D:, bukan C:. */
function folderKembaran() {
  return process.env.ALETA_KEMBARAN_DIR || "D:/Aplikasi/aleta/kembaran";
}

function aktif(env = process.env) {
  return String((env && env.ALETA_MODE) || "").trim().toLowerCase() === "kembaran";
}

function jalurCapTarik() {
  return process.env.ALETA_KEMBARAN_CAP_TARIK || path.join(folderKembaran(), "tarik.json");
}

/**
 * Cap tarikan terakhir: { tarikPada, bundel, bundelDibuat, versiAplikasi, sumber[] }.
 * null bila belum pernah ditarik (atau berkasnya rusak - dibaca sebagai belum).
 */
function bacaCapTarik() {
  try {
    const isi = JSON.parse(fs.readFileSync(jalurCapTarik(), "utf8"));
    if (isi && typeof isi === "object" && isi.tarikPada) return isi;
  } catch {
    /* belum ada / rusak */
  }
  return null;
}

/** "19 Okt 2026 07.15 WITA" dari ISO - jam pengadilan (Asia/Makassar). */
function formatWaktuPengadilan(iso) {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return "";
  const bagian = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(t))
    .reduce((h, p) => ({ ...h, [p.type]: p.value }), {});
  return `${bagian.day} ${bagian.month} ${bagian.year} ${bagian.hour}.${bagian.minute} WITA`;
}

/** Kalimat pita. Waktu yang dipakai = saat DATA dibuat di server (bundelDibuat), bukan saat ditarik. */
function kalimatPita(cap = bacaCapTarik()) {
  if (!cap) return "Mode kembaran - data belum pernah ditarik dari server";
  const data = formatWaktuPengadilan(cap.bundelDibuat || cap.tarikPada);
  return `Mode kembaran - data per ${data || "waktu tidak diketahui"}`;
}

function ringkasan() {
  const cap = bacaCapTarik();
  return {
    aktif: aktif(),
    pita: aktif() ? kalimatPita(cap) : "",
    cap,
  };
}

/** Melempar bila mode kembaran menyala - untuk jalur yang HARUS mati di laptop (WhatsApp, e-Court). */
function tolakBilaKembaran(sebutan) {
  if (!aktif()) return;
  const galat = new Error(`${sebutan} dimatikan di mode kembaran (laptop).`);
  galat.code = "KEMBARAN_DIMATIKAN";
  throw galat;
}

module.exports = {
  aktif,
  folderKembaran,
  jalurCapTarik,
  bacaCapTarik,
  formatWaktuPengadilan,
  kalimatPita,
  ringkasan,
  tolakBilaKembaran,
};
