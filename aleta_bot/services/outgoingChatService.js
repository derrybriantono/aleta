"use strict";

/**
 * Satu pintu keluar untuk SELURUH balasan chat.
 *
 * Perbaikan yang dibangun bertahap — pembersihan nama kolom mentah, kamus
 * istilah, pencatatan corong layanan — semula hanya menempel pada jalur menu
 * baru. Padahal balasan chat keluar dari banyak tempat: perintah lama seperti
 * "akta#123.G.2026", perintah "detail#", jawaban AI, pendaftaran antrian, dan
 * jawaban atas pertanyaan bebas. Akibatnya warga yang mengetik perintah lama
 * mendapat mutu jawaban yang berbeda dari warga yang memakai menu — padahal
 * keduanya bertanya hal yang sama ke bot yang sama.
 *
 * Menaruh perbaikan di satu titik keluar menyelesaikan itu sekaligus mencegah
 * masalah yang sama terulang: perintah chat baru apa pun yang ditambahkan
 * nanti otomatis ikut mendapat seluruh perlakuan ini, tanpa perlu diingat
 * satu per satu.
 *
 * Urutannya disengaja:
 *   1. BERSIHKAN dulu — sisa placeholder dan nama kolom mentah dibuang.
 *   2. BARU jelaskan istilah — supaya kamus membaca teks yang sudah rapi,
 *      bukan teks yang masih memuat jejak kode.
 */

const { sanitizeOutgoingMessage } = require("./humanTextService");
const legalGlossaryService = require("./legalGlossaryService");

/** Balasan yang lebih panjang dari ini tidak lagi ditempeli kamus istilah. */
const MAX_LENGTH_FOR_GLOSSARY = 3000;

/**
 * Menyiapkan satu teks balasan sebelum dikirim.
 *
 * @param {string} text isi balasan mentah dari penangan mana pun
 * @param {object} options
 * @param {boolean} options.withGlossary tempelkan penjelasan istilah hukum
 * @returns {string} teks siap kirim
 */
function prepareReply(text, { withGlossary = true } = {}) {
  const raw = typeof text === "string" ? text : String(text ?? "");
  if (!raw.trim()) return raw;

  const bersih = sanitizeOutgoingMessage(raw);

  // Balasan yang sudah sangat panjang (mis. daftar perkara sepanjang halaman)
  // tidak ditambahi lagi; keterbacaan lebih penting daripada kelengkapan.
  if (!withGlossary || bersih.length > MAX_LENGTH_FOR_GLOSSARY) return bersih;

  return legalGlossaryService.explainTerms(bersih);
}

/**
 * Layanan pemendek tautan yang paling sering dipakai penipu.
 *
 * Penyaring WhatsApp memperlakukan tautan pemendek dengan curiga karena
 * tujuannya tidak terlihat sebelum diklik — dan itu salah satu pemicu
 * pemblokiran yang paling sering. Domain resmi seperti go.id justru sebaliknya:
 * menaikkan kepercayaan.
 */
const SHORTENER_HOSTS = [
  "s.id",
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "cutt.ly",
  "shorturl.at",
  "rb.gy",
  "linktr.ee",
];

/**
 * Menemukan tautan pemendek di dalam sebuah pesan.
 *
 * Sengaja hanya MELAPORKAN, tidak membuang. Tautan itu mungkin memang sengaja
 * dipasang admin dan membuangnya diam-diam akan menghasilkan pesan yang
 * kehilangan isi tanpa ada yang tahu. Yang dibutuhkan adalah admin melihat
 * bahwa tautannya berisiko, lalu memutuskan sendiri.
 */
function findShortenerLinks(text) {
  const body = String(text || "");
  const found = [];
  for (const host of SHORTENER_HOSTS) {
    const pattern = new RegExp(`https?://(?:www\\.)?${host.replace(/\./g, "\\.")}/\\S+`, "gi");
    const matches = body.match(pattern);
    if (matches) found.push(...matches);
  }
  return found;
}

module.exports = {
  MAX_LENGTH_FOR_GLOSSARY,
  SHORTENER_HOSTS,
  findShortenerLinks,
  prepareReply,
};
