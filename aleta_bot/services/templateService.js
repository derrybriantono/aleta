const { sanitizeOutgoingMessage } = require("./humanTextService");

function extractPlaceholders(body) {
  const placeholders = new Set();
  String(body || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    placeholders.add(key);
    return "";
  });
  return [...placeholders];
}

function validateTemplate(template = {}, { outputColumns = [], requiredPlaceholders = [], category = "" } = {}) {
  const body = String(template.body || "");
  const placeholders = extractPlaceholders(body);
  const errors = [];
  const warnings = [];

  if (!template.key && !template.id) errors.push("template_key_required");
  if (!body.trim()) errors.push("template_body_required");

  for (const placeholder of requiredPlaceholders) {
    if (!placeholders.includes(placeholder)) {
      errors.push(`required_placeholder_missing_${placeholder}`);
    }
  }

  for (const placeholder of placeholders) {
    if (Array.isArray(outputColumns) && outputColumns.length > 0 && !outputColumns.includes(placeholder)) {
      warnings.push(`placeholder_not_in_query_output_${placeholder}`);
    }
  }

  if ((category === "party" || category === "pihak") && !/ptsp|whatsapp|kontak|layanan|resmi|pengadilan|notifikasi/i.test(body)) {
    warnings.push("party_template_missing_external_disclaimer_or_contact");
  }

  return {
    valid: errors.length === 0,
    placeholders,
    errors,
    warnings,
  };
}

function looksLikeListKey(key) {
  return /(ringkasan|detail|daftar|data|hasil|items?|list|informasi)/i.test(String(key || ""));
}

function normalizeListItem(value) {
  return String(value || "")
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeFieldDetailLines(lines) {
  if (lines.length <= 1) return false;
  const fieldLikeCount = lines
    .map(normalizeListItem)
    .filter((line) => /^[A-Za-z_ /().-]{2,45}:\s+\S/.test(line)).length;
  return fieldLikeCount >= Math.ceil(lines.length * 0.6);
}

function formatTemplateValue(key, value) {
  if (Array.isArray(value)) {
    const items = value.map(normalizeListItem).filter(Boolean);
    return items.length > 1 ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : (items[0] || "");
  }

  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (String(key || "").toLowerCase() === "ringkasan") return text;
  if (!text || !looksLikeListKey(key)) return text;
  if (/^\s*\d+[.)]\s+/m.test(text)) return text;

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const separator = text.includes("\n\n")
    ? /\n{2,}/
    : text.includes(" | ")
        ? /\s+\|\s+/
        : text.includes("\n") && !looksLikeFieldDetailLines(lines)
          ? /\n+/
          : null;
  if (!separator) return text;

  const items = text.split(separator).map(normalizeListItem).filter(Boolean);
  return items.length > 1 ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : text;
}

/**
 * Kelompok kalimat pembuka yang saling setara.
 *
 * Ratusan pesan yang kerangkanya sama persis meninggalkan sidik jari yang sama
 * pula. Nilai variasi ini SEDANG saja, bukan besar - isi pesan ALETA sebenarnya
 * sudah berbeda antar penerima karena memuat nama, nomor perkara, dan tanggal
 * masing-masing, sehingga tidak pernah identik kata per kata. Yang tersisa
 * adalah kesamaan kerangka, dan itulah yang diringankan di sini.
 *
 * Penggantiannya sengaja dibatasi pada bentuk yang SEMUANYA baku dan pantas.
 * Variasi yang membuat pesan pengadilan terlihat asal-asalan merugikan lebih
 * banyak daripada keuntungan penyamarannya.
 */
const DEFAULT_OPENING_VARIANTS = [
  [
    "Assalamualaikum Warahmatullahi Wabarakatuh,",
    "Assalamu'alaikum Warahmatullahi Wabarakatuh,",
    "Assalamualaikum Wr. Wb.,",
  ],
  [
    "Halo, saya Aleta, Bot Pengadilan.",
    "Saya Aleta, asisten pesan Pengadilan Agama Donggala.",
    "Pesan ini dikirim Aleta, layanan pesan Pengadilan Agama Donggala.",
  ],
];

function loadOpeningVariants(runtimeConfig) {
  const extra = runtimeConfig && runtimeConfig.openingVariants;
  if (!Array.isArray(extra) || extra.length === 0) return DEFAULT_OPENING_VARIANTS;
  const groups = [];
  for (const group of extra) {
    if (!Array.isArray(group)) continue;
    const variants = group.map((item) => String(item || "").trim()).filter(Boolean);
    // Kelompok berisi satu kalimat tidak punya arti sebagai variasi.
    if (variants.length > 1) groups.push(variants);
  }
  return groups.length > 0 ? groups : DEFAULT_OPENING_VARIANTS;
}

/**
 * Mengganti kalimat pembuka dengan salah satu bentuk setara, dipilih acak.
 *
 * Hanya baris yang PERSIS sama dengan salah satu anggota kelompok yang diganti.
 * Pencocokan longgar akan merusak isi pesan yang sudah disunting admin - dan
 * merusak pesan pengadilan jauh lebih berbahaya daripada kesamaan kerangka.
 */
function varyOpening(message, runtimeConfig = {}) {
  const body = String(message == null ? "" : message);
  if (!body.trim()) return body;
  if (runtimeConfig.openingVariationEnabled === false) return body;

  const groups = loadOpeningVariants(runtimeConfig);
  const lines = body.split("\n");
  const sudahDiganti = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const baris = lines[i].trim();
    if (!baris) continue;
    for (let g = 0; g < groups.length; g += 1) {
      if (sudahDiganti.has(g)) continue;
      const group = groups[g];
      if (!group.includes(baris)) continue;
      lines[i] = group[Math.floor(Math.random() * group.length)];
      sudahDiganti.add(g);
      break;
    }
    // Kalimat pembuka ada di bagian atas pesan. Berhenti setelah beberapa baris
    // supaya kalimat yang kebetulan sama di tengah pesan tidak ikut diganti.
    if (i > 6) break;
  }

  return lines.join("\n");
}

function renderTemplate(template = {}, values = {}) {
  const rendered = String(template.body || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = values[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Template placeholder tidak terisi: ${key}`);
    }
    return formatTemplateValue(key, value);
  });
  // Pengaman terakhir: pesan yang sampai ke penerima tidak boleh memuat nama
  // kolom mentah atau sisa placeholder, termasuk bila nilainya sendiri berisi
  // teks berformat `nama_kolom: nilai` dari data lama.
  return sanitizeOutgoingMessage(rendered);
}

module.exports = {
  DEFAULT_OPENING_VARIANTS,
  extractPlaceholders,
  formatTemplateValue,
  validateTemplate,
  renderTemplate,
  varyOpening,
};
