"use strict";

/**
 * Menjelaskan istilah hukum yang muncul di dalam jawaban bot.
 *
 * Membersihkan nama kolom mentah (v1.7.1) membuat pesan tidak lagi terlihat
 * seperti kebocoran kode. Tetapi masalah yang lebih dalam tetap ada: istilahnya
 * sendiri. Kata seperti "verstek", "gugur", atau "berkekuatan hukum tetap"
 * ditulis benar dan memang istilah resmi, namun bagi pihak berperkara sama
 * tidak berartinya dengan nama kolom database. Orang membaca putusannya, tidak
 * paham konsekuensinya, lalu tetap menelepon PTSP — dan itulah yang hendak
 * dikurangi oleh bot sejak awal.
 *
 * Penjelasan ditempel di BAWAH pesan, bukan menggantikan istilahnya. Istilah
 * resminya harus tetap utuh: itu yang tertulis pada dokumen pengadilan yang
 * mereka pegang, dan menggantinya justru membuat pihak bingung saat
 * mencocokkan.
 *
 * Daftarnya dapat ditambah dari portal lewat runtime config. Yang paling tahu
 * istilah mana yang membingungkan masyarakat adalah petugas PTSP yang setiap
 * hari ditanyai, bukan pengembang.
 */

const { readRuntimeConfig } = require("../config/runtime-config");

/** Penanda bagian kamus. Dipakai juga untuk mencegah penempelan ganda. */
const GLOSSARY_HEADING = "_Arti istilah di atas:_";

/** Paling banyak istilah yang dijelaskan pada satu pesan. */
const MAX_TERMS_PER_MESSAGE = 4;

/**
 * Istilah bawaan.
 *
 * `term` boleh memuat beberapa penulisan yang dipisah "|", sebab satu istilah
 * kerap ditulis berbeda-beda di SIPP (mis. "BHT" dan "berkekuatan hukum tetap").
 */
const DEFAULT_TERMS = [
  {
    term: "verstek",
    explanation: "putusan yang dijatuhkan karena pihak tergugat/termohon tidak pernah hadir meski sudah dipanggil secara resmi",
  },
  {
    term: "gugur",
    explanation: "perkara dihentikan karena pihak penggugat/pemohon tidak hadir tanpa alasan sah setelah dipanggil secara patut",
  },
  {
    term: "berkekuatan hukum tetap|bht|inkracht",
    explanation: "putusan sudah final dan tidak dapat diajukan banding lagi; sejak saat ini akta atau salinan resmi dapat diurus",
  },
  {
    term: "putusan sela",
    explanation: "putusan sementara di tengah proses, bukan putusan akhir; persidangan tetap berlanjut",
  },
  {
    term: "niet ontvankelijke|tidak dapat diterima|n.o.",
    explanation: "gugatan tidak diperiksa pokok perkaranya karena ada syarat formal yang belum terpenuhi; perkara dapat diajukan kembali setelah diperbaiki",
  },
  {
    term: "eksepsi",
    explanation: "keberatan pihak tergugat mengenai syarat formal gugatan, diperiksa lebih dahulu sebelum pokok perkara",
  },
  {
    term: "mediasi",
    explanation: "upaya damai yang wajib ditempuh lebih dulu dengan bantuan mediator sebelum perkara diperiksa lebih lanjut",
  },
  {
    term: "ikrar talak",
    explanation: "pengucapan talak oleh suami di hadapan majelis hakim; perceraian baru sah terhitung sejak diucapkan",
  },
  {
    term: "replik",
    explanation: "tanggapan penggugat atas jawaban tergugat",
  },
  {
    term: "duplik",
    explanation: "tanggapan balik tergugat atas replik penggugat",
  },
  {
    term: "amar putusan",
    explanation: "bagian putusan yang memuat keputusan akhir hakim",
  },
  {
    term: "panjar",
    explanation: "biaya perkara yang dititipkan di muka; sisanya dikembalikan bila proses selesai",
  },
  {
    term: "relaas|relas",
    explanation: "surat resmi bukti bahwa panggilan sidang sudah disampaikan kepada pihak",
  },
  {
    term: "jurusita",
    explanation: "petugas pengadilan yang menyampaikan panggilan dan pemberitahuan resmi ke alamat pihak",
  },
  {
    term: "banding",
    explanation: "upaya meminta perkara diperiksa ulang oleh Pengadilan Tinggi, diajukan dalam 14 hari setelah putusan diberitahukan",
  },
  {
    term: "kasasi",
    explanation: "upaya meminta pemeriksaan oleh Mahkamah Agung setelah putusan banding",
  },
  {
    term: "peninjauan kembali|pk",
    explanation: "upaya luar biasa setelah putusan berkekuatan hukum tetap, hanya dengan alasan tertentu seperti ditemukannya bukti baru",
  },
  {
    term: "penetapan majelis hakim|pmh",
    explanation: "penetapan yang menunjuk hakim yang akan memeriksa perkara",
  },
  {
    term: "penetapan hari sidang|phs",
    explanation: "penetapan yang menentukan tanggal sidang pertama",
  },
  {
    term: "dikabulkan",
    explanation: "permohonan atau gugatan diterima hakim",
  },
  {
    term: "ditolak",
    explanation: "gugatan diperiksa pokok perkaranya, tetapi tidak dikabulkan hakim",
  },
];

/** Istilah tambahan dari portal, digabung di atas bawaan. */
function loadExtraTerms(runtimeConfig) {
  const extra = runtimeConfig && runtimeConfig.legalGlossary;
  if (!Array.isArray(extra)) return [];
  return extra
    .map((item) => ({
      term: String((item && (item.term || item.istilah)) || "").trim(),
      explanation: String((item && (item.explanation || item.penjelasan)) || "").trim(),
    }))
    .filter((item) => item.term && item.explanation);
}

/** Seluruh istilah yang berlaku; istilah portal menimpa bawaan bernama sama. */
function listTerms(runtimeConfig = readRuntimeConfig()) {
  const byTerm = new Map();
  for (const item of [...DEFAULT_TERMS, ...loadExtraTerms(runtimeConfig)]) {
    byTerm.set(item.term.toLowerCase(), item);
  }
  return [...byTerm.values()];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mencari istilah di dalam teks.
 *
 * Pencocokan memakai batas kata supaya "pk" tidak ikut tersorot di dalam kata
 * lain, dan supaya "ditolak" tidak cocok pada "tidak ditolakkan".
 */
function findTerms(text, runtimeConfig = readRuntimeConfig()) {
  const body = String(text || "");
  if (!body.trim()) return [];

  const found = [];
  for (const item of listTerms(runtimeConfig)) {
    const variants = item.term.split("|").map((value) => value.trim()).filter(Boolean);
    const matched = variants.find((variant) => {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(variant)}([^a-z0-9]|$)`, "i");
      return pattern.test(body);
    });
    if (matched) {
      found.push({ matched, label: variants[0], explanation: item.explanation });
    }
    if (found.length >= MAX_TERMS_PER_MESSAGE) break;
  }
  return found;
}

/** Huruf pertama dikapitalkan untuk penulisan label istilah. */
function capitalizeFirst(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

/**
 * Menempelkan penjelasan istilah di bawah sebuah pesan.
 *
 * Pesan dikembalikan apa adanya bila tidak ada istilah yang dikenali, supaya
 * jawaban yang memang sudah sederhana tidak jadi panjang tanpa alasan.
 */
function explainTerms(message, runtimeConfig = readRuntimeConfig()) {
  const body = String(message || "");

  // Aman dipanggil berkali-kali. Sejak seluruh balasan chat melewati satu pintu
  // keluar, teks yang sudah dijelaskan bisa saja lewat lagi; tanpa penjagaan
  // ini penjelasannya akan tertempel dua kali pada pesan yang sama.
  if (body.includes(GLOSSARY_HEADING)) return body;

  const terms = findTerms(body, runtimeConfig);
  if (terms.length === 0) return body;

  const baris = terms.map((item) => `• *${capitalizeFirst(item.label)}*: ${item.explanation}.`);
  return `${body.trimEnd()}\n\n${GLOSSARY_HEADING}\n${baris.join("\n")}`;
}

module.exports = {
  DEFAULT_TERMS,
  GLOSSARY_HEADING,
  MAX_TERMS_PER_MESSAGE,
  explainTerms,
  findTerms,
  listTerms,
};
