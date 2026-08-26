"use strict";

/**
 * Membuat isi pesan WhatsApp selalu berbahasa manusia — tidak pernah
 * menampilkan nama kolom/variabel mentah.
 *
 * Masalah yang diselesaikan: ketika sumber data tidak menyediakan kolom
 * `ringkasan`, isi pesan diisi otomatis dari baris data dan dulu ditulis apa
 * adanya sebagai `nama_kolom: nilai`, sehingga penerima membaca teks seperti:
 *
 *     nomor_perkara: 531/Pdt.G/2026/PA.Dgl
 *     tanggal_sidang: 08-09-2026
 *     ruangan: Ruang Sidang 1 Dalam Gedung
 *
 * Bagi pihak berperkara ini terlihat seperti kebocoran kode program. Modul ini
 * mengubahnya menjadi label yang wajar dibaca ("Tanggal Sidang: ..."), memformat
 * tanggal, dan sebagai pengaman terakhir membersihkan sisa placeholder yang
 * tidak sempat terisi sebelum pesan benar-benar dikirim.
 */

/** Label resmi untuk kolom yang sering dipakai notifikasi pengadilan. */
const FIELD_LABELS = {
  agenda: "Agenda",
  alamat: "Alamat",
  akta_cerai: "Akta Cerai",
  biaya: "Biaya",
  deadline: "Batas Waktu",
  hari_sidang: "Hari Sidang",
  jam_sidang: "Jam Sidang",
  jenis_perkara: "Jenis Perkara",
  jabatan: "Jabatan",
  judul_notifikasi: "Informasi",
  keterangan: "Keterangan",
  nama: "Nama",
  nama_pegawai: "Nama",
  nama_pihak: "Nama",
  nomor_akta: "Nomor Akta",
  nomor_perkara: "Nomor Perkara",
  panjar: "Panjar",
  penggugat: "Penggugat",
  perihal: "Perihal",
  pemohon: "Pemohon",
  putusan: "Putusan",
  ringkasan: "Ringkasan",
  ruangan: "Ruang Sidang",
  sisa_panjar: "Sisa Panjar",
  status: "Status",
  status_perkara: "Status Perkara",
  tanggal: "Tanggal",
  tanggal_akta: "Tanggal Akta",
  // Singkatan SIPP yang bila dirapikan otomatis akan terbaca aneh
  // ("Tanggal Bht"), jadi ditulis lengkap di sini.
  tanggal_bht: "Tanggal Berkekuatan Hukum Tetap",
  tanggal_pendaftaran: "Tanggal Pendaftaran",
  tanggal_minutasi: "Tanggal Minutasi",
  amar_putusan: "Amar Putusan",
  jenis_bantuan: "Jenis Bantuan",
  nomor_akta_cerai: "Nomor Akta Cerai",
  tanggal_daftar: "Tanggal Daftar",
  tanggal_putusan: "Tanggal Putusan",
  tanggal_sidang: "Tanggal Sidang",
  tergugat: "Tergugat",
  termohon: "Termohon",
  waktu: "Waktu",
};

/**
 * Kolom teknis yang tidak pernah pantas muncul di pesan penerima:
 * id internal, nomor telepon, jejak sistem, dan kolom berkas.
 */
const HIDDEN_FIELD_PATTERN =
  /^(id|.*_id|perkara_id|recipient_number|recipient_name|recipient_role|telepon|phone|no_hp|nomor_hp|nomor_wa|nomor_whatsapp|whatsapp|mobile|event_key|event_date|source_updated_at|file_path|file_name|file_type|file_hash|created_at|updated_at|modified_at|mode|password|token|secret)$/i;

/** Urutan tampil supaya pesan terbaca runtut, bukan acak sesuai kolom SQL. */
const FIELD_ORDER = [
  "nomor_perkara",
  "jenis_perkara",
  "nama",
  "nama_pihak",
  "nama_pegawai",
  "penggugat",
  "tergugat",
  "pemohon",
  "termohon",
  "hari_sidang",
  "tanggal_sidang",
  "jam_sidang",
  "agenda",
  "ruangan",
  "status",
  "status_perkara",
  "putusan",
  "tanggal_putusan",
  "sisa_panjar",
  "panjar",
  "biaya",
  "keterangan",
  "ringkasan",
];

/** Kolom identitas yang biasanya SUDAH dicetak di bagian atas isi pesan. */
const IDENTITY_FIELDS = ["nomor_perkara", "nama", "nama_pihak", "nama_pegawai"];

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Mengubah nama kolom apa pun menjadi label yang wajar dibaca.
 * `tanggal_sidang` -> "Tanggal Sidang", `noPerkara` -> "No Perkara".
 */
function humanizeFieldLabel(key) {
  const raw = String(key || "").trim();
  if (!raw) return "";
  const known = FIELD_LABELS[raw.toLowerCase()];
  if (known) return known;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

function isHiddenField(key) {
  return HIDDEN_FIELD_PATTERN.test(String(key || "").trim());
}

/** Kata sambung jabatan yang tetap huruf kecil di tengah kalimat. */
const TITLE_CASE_MINOR_WORDS = new Set(["dan", "di", "ke", "dari", "pada", "untuk", "atas", "yang"]);

/**
 * Merapikan nama jabatan menjadi bentuk yang pantas ditulis di pesan.
 *
 * Data jabatan pegawai disimpan huruf kecil semua oleh normalisasi runtime
 * ("wakil ketua pengadilan"), sedangkan pesan resmi menulisnya sebagai
 * "Wakil Ketua Pengadilan". Singkatan yang memang huruf besar (PA, PTSP)
 * dipertahankan.
 */
function toTitleCaseName(value) {
  const raw = String(value || "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!raw) return "";
  return raw
    .split(" ")
    .map((word, index) => {
      // Singkatan yang sudah kapital di sumber data dibiarkan apa adanya.
      if (/^[A-Z0-9.]{2,}$/.test(word)) return word;
      const lower = word.toLowerCase();
      if (index > 0 && TITLE_CASE_MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Tanggal ditulis seperti orang menulis, bukan format mesin. */
function formatDateValue(value) {
  const raw = String(value || "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}.*)?$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const monthName = MONTH_NAMES_ID[Number(month) - 1];
    if (monthName) return `${Number(day)} ${monthName} ${year}`;
  }
  const dmyMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const monthName = MONTH_NAMES_ID[Number(month) - 1];
    if (monthName) return `${Number(day)} ${monthName} ${year}`;
  }
  return raw;
}

function formatFieldValue(key, value) {
  const raw = String(value === null || value === undefined ? "" : value).trim();
  if (!raw) return "";
  if (/tanggal|date|deadline/i.test(String(key || ""))) return formatDateValue(raw);
  return raw;
}

/**
 * Mengubah satu baris data menjadi beberapa baris teks berlabel manusia.
 *
 * @param {object} row baris hasil query
 * @param {object} options
 * @param {boolean} options.omitIdentity buang kolom identitas yang sudah
 *   dicetak di bagian atas isi pesan, supaya tidak terbaca dobel.
 * @param {number} options.maxFields batas jumlah baris agar pesan tidak liar.
 */
function rowToHumanText(row, options = {}) {
  if (!row || typeof row !== "object") return String(row || "").trim();
  const { omitIdentity = false, maxFields = 12 } = options;

  const entries = Object.entries(row).filter(([key, value]) => {
    if (isHiddenField(key)) return false;
    if (omitIdentity && IDENTITY_FIELDS.includes(String(key).toLowerCase())) return false;
    return value !== undefined && value !== null && String(value).trim() !== "";
  });

  const orderIndex = (key) => {
    const index = FIELD_ORDER.indexOf(String(key).toLowerCase());
    return index === -1 ? FIELD_ORDER.length : index;
  };
  entries.sort((a, b) => orderIndex(a[0]) - orderIndex(b[0]));

  const seenValues = new Set();
  const lines = [];
  for (const [key, value] of entries) {
    if (lines.length >= maxFields) break;
    const formatted = formatFieldValue(key, value);
    if (!formatted) continue;
    // Kolom berbeda dengan nilai identik (mis. nama & nama_pihak) cukup sekali.
    const dedupeKey = formatted.toLowerCase();
    if (seenValues.has(dedupeKey)) continue;
    seenValues.add(dedupeKey);
    lines.push(`${humanizeFieldLabel(key)}: ${formatted}`);
  }

  return lines.join("\n");
}

/**
 * Pengaman terakhir sebelum pesan dikirim: tidak boleh ada jejak kode.
 *
 * Membersihkan placeholder yang tidak sempat terisi (`{{apa_pun}}`) dan
 * menaikkan sisa baris `nama_kolom: nilai` menjadi label manusia — termasuk isi
 * pesan lama yang sudah terlanjur tersimpan di database dengan format itu.
 */
function sanitizeOutgoingMessage(message) {
  if (typeof message !== "string" || !message) return message;

  let text = message
    // Placeholder yang tidak terisi dibuang, bukan dikirim apa adanya.
    .replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, "")
    // Baris "nama_kolom: nilai" -> "Nama Kolom: nilai".
    .replace(/^([ \t]*[-*•]?[ \t]*)([a-z][a-z0-9]*(?:_[a-z0-9]+)+)(\s*:\s*)/gm, (match, prefix, key, separator) =>
      `${prefix}${humanizeFieldLabel(key)}${separator}`
    )
    // Tanggal format mesin (2026-08-25) ditulis seperti orang menulis.
    // Jalur lama mengeluarkan tanggal apa adanya dari database, dan bentuk itu
    // tidak wajar dibaca warga. Penjagaan di kiri dan kanan mencegah potongan
    // angka di dalam nomor perkara atau tautan ikut terkena.
    .replace(/(?<![\d/\-])(\d{4})-(\d{2})-(\d{2})(?![\d/\-])/g, (match) => formatDateValue(match));

  // Rapikan sisa baris kosong akibat pembersihan placeholder.
  text = text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/** Apakah teks masih memuat jejak kode/variabel? Dipakai uji & diagnostik. */
function findCodeArtifacts(message) {
  const text = String(message || "");
  const artifacts = [];
  const placeholderMatches = text.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g);
  if (placeholderMatches) artifacts.push(...placeholderMatches);
  const snakeMatches = text.match(/^[ \t]*[-*•]?[ \t]*[a-z][a-z0-9]*(?:_[a-z0-9]+)+\s*:/gm);
  if (snakeMatches) artifacts.push(...snakeMatches.map((item) => item.trim()));
  return artifacts;
}

module.exports = {
  FIELD_LABELS,
  IDENTITY_FIELDS,
  findCodeArtifacts,
  formatDateValue,
  humanizeFieldLabel,
  isHiddenField,
  rowToHumanText,
  sanitizeOutgoingMessage,
  toTitleCaseName,
};
