"use strict";

/**
 * Resolusi berkas e-Court yang sudah diunduh jembatan, untuk dilampirkan ke
 * pesan WhatsApp.
 *
 * --- Kenapa tidak memakai sippDocumentService.js saja ---
 *
 * Keduanya terlihat mirip, tetapi asal berkasnya berbeda secara mendasar.
 * sippDocumentService menerima path MENTAH dari kolom database SIPP - path
 * yang ditulis aplikasi lain, bisa berbentuk apa saja, dan karenanya perlu
 * pembersihan ketat serta pencarian di beberapa root sekaligus.
 *
 * Berkas e-Court sebaliknya: JEMBATAN SENDIRI yang menentukan letaknya saat
 * mengunduh. Kita tahu persis di mana berkasnya, di bawah satu folder yang
 * kita kuasai. Menyalurkannya lewat pembersih SIPP justru akan ditolak, karena
 * pembersih itu memang dirancang menolak apa pun di luar root SIPP.
 *
 * Yang tetap dipertahankan dari pola SIPP adalah penjagaan terpentingnya:
 * berkas TIDAK BOLEH keluar dari folder yang diizinkan, sekalipun nama
 * berkasnya mengandung "..".
 */

const fs = require("fs");
const path = require("path");

/**
 * Folder tempat jembatan menyimpan unduhan.
 *
 * Dapat diubah lewat env karena tempat jembatan berjalan belum ditentukan -
 * bisa di server yang sama dengan ALETA, bisa di komputer petugas lalu
 * disalin ke server.
 */
const ECOURT_DOCUMENT_ROOT = String(
  process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT ||
  path.resolve(__dirname, "..", "data", "ecourt")
);

/** Hanya berkas yang memang bisa dikirim sebagai lampiran WhatsApp. */
const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".rtf", ".odt"]);

/** Batas ukuran lampiran. WhatsApp menolak berkas yang jauh lebih besar. */
const MAX_ATTACHMENT_BYTES = Number(process.env.ALETA_BOT_ECOURT_MAX_BYTES || 16 * 1024 * 1024);

function resolveRoot() {
  return path.resolve(ECOURT_DOCUMENT_ROOT);
}

/**
 * Memastikan sebuah path benar-benar berada di dalam folder unduhan.
 *
 * Perbandingan dilakukan setelah kedua sisi diresolusi penuh, sehingga
 * "../../etc/passwd" tidak bisa lolos hanya karena awalannya terlihat benar.
 * Pemisah folder ditambahkan agar "/data/ecourt-lain" tidak dianggap berada di
 * dalam "/data/ecourt".
 */
function isInsideRoot(absolutePath) {
  const root = resolveRoot();
  const target = path.resolve(absolutePath);
  if (target === root) return false;
  return target.startsWith(root + path.sep);
}

/** Jalur tersimpan -> jalur absolut (relatif terhadap folder unduhan bila tidak absolut). */
function jalurAbsolut(raw) {
  return path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(resolveRoot(), raw);
}

/**
 * Jalur absolut sebuah berkas arsip bila jalurnya AMAN (di dalam folder unduhan
 * dan berekstensi dokumen) - tanpa menuntut berkasnya masih ada. null bila
 * tidak aman. Dipakai pembersih masa simpan: berkas yang sudah hilang tetap
 * boleh "dihapus" (unlink ENOENT dianggap selesai), tetapi jalur di luar folder
 * tidak pernah boleh disentuh.
 */
function jalurDiDalamArsip(storedPath) {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;
  const absolutePath = jalurAbsolut(raw);
  if (!isInsideRoot(absolutePath)) return null;
  if (!ALLOWED_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) return null;
  return absolutePath;
}

/**
 * Memeriksa dan menyiapkan satu berkas e-Court.
 *
 * ============================================================================
 * BATAS UKURAN HANYA UNTUK LAMPIRAN WHATSAPP (U5, 9 Okt 2026)
 * ============================================================================
 *
 * Dulu batas 16 MB lampiran WhatsApp berlaku untuk SEMUA pemanggil - termasuk
 * unduhan portal/ekstensi (sippKonteksService.getBerkas), penghitung "berkas
 * hilang" arsip, dan pembersih masa simpan - padahal jembatan menyimpan berkas
 * sampai 64 MB. Berkas 17 MB yang sah tersimpan jadi tidak dapat diunduh,
 * terhitung "hilang", dan tidak pernah dapat dibersihkan.
 *
 * Kini tanpa batas bawaan; yang mengirim lewat WhatsApp menyebut
 * `{ batasByte: MAX_ATTACHMENT_BYTES }` (pickBestAttachment, pekerja
 * pemberitahuan).
 *
 * @param {string} storedPath
 * @param {{ batasByte?: number }} [pilihan]
 * @returns {{ ok: boolean, reason?: string, absolutePath?: string, fileName?: string, size?: number }}
 */
function describeEcourtDocument(storedPath, { batasByte = Infinity } = {}) {
  const raw = String(storedPath || "").trim();
  if (!raw) return { ok: false, reason: "Path berkas kosong." };

  // Path tersimpan boleh relatif terhadap folder unduhan maupun absolut;
  // keduanya diresolusi ke bentuk absolut sebelum diperiksa.
  const absolutePath = jalurAbsolut(raw);

  if (!isInsideRoot(absolutePath)) {
    return {
      ok: false,
      reason: `Berkas berada di luar folder unduhan e-Court (${resolveRoot()}).`,
    };
  }

  const extension = path.extname(absolutePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, reason: `Ekstensi berkas tidak didukung: ${extension || "tanpa ekstensi"}.` };
  }

  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    return { ok: false, reason: "Berkas belum ada di server. Jalankan sinkronisasi e-Court lebih dulu." };
  }

  if (!stat.isFile()) return { ok: false, reason: "Path bukan berkas." };
  if (stat.size === 0) return { ok: false, reason: "Berkas kosong (0 byte), kemungkinan unduhan gagal." };
  if (stat.size > batasByte) {
    return {
      ok: false,
      reason: `Berkas terlalu besar untuk dikirim (${Math.round(stat.size / 1024 / 1024)} MB).`,
    };
  }

  try {
    fs.accessSync(absolutePath, fs.constants.R_OK);
  } catch {
    return { ok: false, reason: "Berkas ada tetapi tidak dapat dibaca (izin akses)." };
  }

  return { ok: true, absolutePath, fileName: path.basename(absolutePath), size: stat.size };
}

/**
 * Memilih berkas terbaik untuk dilampirkan.
 *
 * PDF didahulukan daripada Word: PDF terbuka di semua ponsel tanpa aplikasi
 * tambahan, sedangkan berkas Word sering tidak bisa dibuka penerima. Word
 * dipakai hanya bila PDF-nya tidak tersedia.
 */
function pickBestAttachment({ berkasPdf, berkasWord } = {}) {
  const kandidat = [
    { path: berkasPdf, jenis: "pdf" },
    { path: berkasWord, jenis: "word" },
  ];
  const alasan = [];

  for (const item of kandidat) {
    if (!item.path) continue;
    // Lampiran WhatsApp: batas 16 MB berlaku di sini.
    const hasil = describeEcourtDocument(item.path, { batasByte: MAX_ATTACHMENT_BYTES });
    if (hasil.ok) return { ok: true, jenis: item.jenis, ...hasil };
    alasan.push(`${item.jenis}: ${hasil.reason}`);
  }

  return {
    ok: false,
    reason: alasan.length > 0 ? alasan.join(" | ") : "Tidak ada berkas yang tersimpan untuk dokumen ini.",
  };
}

/** Folder unduhan untuk satu perkara. Dipakai jembatan saat menyimpan. */
function caseFolder(folderName) {
  const bersih = String(folderName || "").replace(/[\\/]/g, "").trim();
  if (!bersih) throw new Error("Nama folder perkara kosong.");
  const target = path.resolve(resolveRoot(), bersih);
  if (!isInsideRoot(target)) throw new Error("Nama folder perkara tidak aman.");
  return target;
}

module.exports = {
  ALLOWED_EXTENSIONS,
  ECOURT_DOCUMENT_ROOT,
  MAX_ATTACHMENT_BYTES,
  caseFolder,
  describeEcourtDocument,
  isInsideRoot,
  jalurDiDalamArsip,
  pickBestAttachment,
  resolveRoot,
};
