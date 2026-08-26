"use strict";

const { readRuntimeConfig } = require("../config/runtime-config");
const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");

/**
 * Menahan pengiriman WhatsApp ke akun yang DIBLOKIR di portal ALETA.
 *
 * Daftar penerima pegawai yang dikirim portal memang sudah menyaring akun
 * nonaktif. Tetapi sebagian besar notifikasi mengambil nama DAN nomor langsung
 * dari SIPP, dan SIPP tidak tahu apa-apa soal pemblokiran di ALETA. Tanpa
 * pemeriksaan ini, orang yang sudah diblokir tetap menerima WhatsApp begitu
 * namanya muncul di hasil query - persis keluhan "tidak dikirim whatsappnya
 * walaupun ada namanya di situ".
 *
 * Pencocokan memakai dua kunci:
 *   - NOMOR: tepat, dan inilah yang menentukan pesan benar-benar tidak sampai.
 *   - NAMA:  cadangan untuk data SIPP yang nomornya berbeda dari yang tercatat
 *            di portal.
 *
 * Catatan penting soal nama: nama tidak unik. Bila ada dua pegawai bernama sama
 * dan salah satunya diblokir, keduanya ikut tertahan. Itu pilihan yang disengaja
 * - untuk data perkara, lebih baik pesan tidak terkirim daripada terkirim ke
 * orang yang aksesnya sudah dicabut. Alasan pemblokiran selalu dicatat di log
 * supaya admin bisa melihat dan memperbaiki datanya.
 */

/**
 * Harus sama dengan normalizeBlockedName di
 * manajemen_surat/src/server/modules/aleta-bot/service.ts.
 */
function normalizeBlockedName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(s\.?h|s\.?ag|s\.?hi|m\.?h|m\.?ag|m\.?si|lc|dr|drs|h|hj)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readBlockList(runtimeConfig) {
  const config = runtimeConfig || readRuntimeConfig();
  const blocked = (config && config.blockedRecipients) || {};
  return {
    numbers: new Set(Array.isArray(blocked.numbers) ? blocked.numbers.map((item) => String(item || "").replace(/\D/g, "")) : []),
    names: new Set(Array.isArray(blocked.names) ? blocked.names.map((item) => normalizeBlockedName(item)).filter(Boolean) : []),
  };
}

/**
 * Mengembalikan alasan penolakan, atau "" bila penerima boleh dikirimi pesan.
 */
function getBlockReason({ number, name } = {}, runtimeConfig) {
  const daftar = readBlockList(runtimeConfig);
  if (daftar.numbers.size === 0 && daftar.names.size === 0) return "";

  const normalizedNumber = normalizeIndonesianPhoneNumber(number || "");
  if (normalizedNumber && daftar.numbers.has(normalizedNumber)) {
    return "akun_diblokir_nomor";
  }

  const normalizedName = normalizeBlockedName(name);
  if (normalizedName && daftar.names.has(normalizedName)) {
    return "akun_diblokir_nama";
  }

  return "";
}

function isBlockedRecipient(input, runtimeConfig) {
  return getBlockReason(input, runtimeConfig) !== "";
}

module.exports = {
  normalizeBlockedName,
  getBlockReason,
  isBlockedRecipient,
};
