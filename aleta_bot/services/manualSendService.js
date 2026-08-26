"use strict";

// Service preview Kirim Manual ALETA Bot.
// Menjalankan sumber data (query) read-only dengan parameter binding,
// merender template {{placeholder}} dengan data nyata, dan mengekstrak
// kandidat nomor penerima dari hasil query. Tidak pernah mengirim pesan.

const externalDbService = require("./externalDbService");
const dynamicNotificationSchedulerService = require("./dynamicNotificationSchedulerService");
const { validateQuery } = require("./queryValidatorService");
const { extractPlaceholders, renderTemplate, formatTemplateValue } = require("./templateService");
const { toTitleCaseName } = require("./humanTextService");
const { analyzeRecipientNumber } = require("./recipientValidationService");
const { runWithReferenceDate } = require("./legacyDateContext");

const MAX_PREVIEW_ROWS = 1000;
// Berapa query SIPP boleh berjalan serentak saat pratinjau sumber data pegawai.
// Cukup besar agar puluhan pegawai selesai cepat, cukup kecil agar SIPP (yang
// dipakai bersama aplikasi lain) tidak terbebani.
const EMPLOYEE_QUERY_CONCURRENCY = Math.max(
  1,
  Math.min(16, Number(process.env.ALETA_BOT_EMPLOYEE_QUERY_CONCURRENCY || 6))
);
const RECIPIENT_NAME_COLUMNS = [
  "recipient_name",
  "nama_pihak",
  "nama_pegawai",
  "nama",
  "name",
  "nama_penerima",
];
const RECIPIENT_NUMBER_FALLBACK_COLUMNS = [
  "recipient_number",
  "nomor_whatsapp",
  "whatsapp",
  "no_whatsapp",
  "telepon",
  "no_hp",
  "nomor_hp",
];

function extractQueryParameters(sqlText) {
  return extractPlaceholders(String(sqlText || ""));
}

// Cocokkan placeholder {{nama}} SEKALIGUS penanda tanggal hari ini milik MySQL.
// Keduanya diproses dalam SATU lintasan kiri-ke-kanan supaya urutan nilai terikat
// tetap sejajar dengan urutan tanda tanya pada SQL.
const POLA_PLACEHOLDER_ATAU_TANGGAL = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\bCURDATE\s*\(\s*\)|\bCURRENT_DATE\b(?:\s*\(\s*\))?/gi;

/**
 * Apakah sumber data ini bisa memakai tanggal acuan pilihan operator?
 *
 * Semua bisa:
 *  - SQL yang memuat CURDATE()/CURRENT_DATE -> digantikan saat binding.
 *  - SQL yang punya parameter bernuansa tanggal -> diisi tanggal acuan.
 *  - Jalur lama (legacy:) -> CURDATE() di dalamnya digantikan tepat saat query
 *    dieksekusi (db_config.js + legacyDateContext.js), jadi notifikasi.js tidak
 *    perlu ditulis ulang dan fungsinya tidak berisiko hilang.
 */
function supportsReferenceDate(sqlText) {
  const teks = String(sqlText || "").trim();
  if (!teks) return false;
  if (/^(portal|runtime):/i.test(teks)) return false;
  if (/^legacy:/i.test(teks)) return true;
  if (/\bCURDATE\s*\(\s*\)|\bCURRENT_DATE\b/i.test(teks)) return true;
  return extractQueryParameters(teks).some((key) => /tanggal|tgl|date/i.test(key));
}

/**
 * Ikat parameter {{...}} dan, bila operator memilih tanggal acuan, gantikan
 * CURDATE()/CURRENT_DATE dengan tanggal itu sebagai nilai terikat.
 *
 * Efeknya: memilih tanggal berarti "anggap hari ini adalah tanggal tersebut",
 * sehingga berlaku untuk seluruh query SQL — termasuk yang relatif seperti
 * DATE_ADD(CURDATE(), INTERVAL 3 DAY) yang ikut bergeser mengikuti pilihan.
 */
function bindQueryParameters(sqlText, params = {}, referenceDate = "") {
  const values = [];
  const missing = [];
  const tanggalAcuan = String(referenceDate || "").trim();

  const boundSql = String(sqlText || "").replace(POLA_PLACEHOLDER_ATAU_TANGGAL, (match, key) => {
    if (key) {
      const value = params[key];
      if (value === undefined || value === null || String(value).trim() === "") {
        missing.push(key);
        return "?";
      }
      values.push(String(value).trim());
      return "?";
    }
    // Penanda tanggal MySQL. Tanpa pilihan operator, biarkan apa adanya agar
    // perilaku bawaan (hari ini menurut server) tidak berubah.
    if (!tanggalAcuan) return match;
    values.push(tanggalAcuan);
    return "?";
  });

  return { boundSql, values, missing };
}

function buildBoundedSelect(sqlText, maxRows) {
  const safeLimit = Math.max(1, Math.min(MAX_PREVIEW_ROWS + 1, Number(maxRows || 20) + 1));
  return `SELECT * FROM (${sqlText}) AS aleta_manual_send LIMIT ${safeLimit}`;
}

function sanitizeRow(row) {
  const result = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (value === null || value === undefined) {
      result[key] = "";
    } else if (value instanceof Date) {
      result[key] = value.toISOString().slice(0, 19).replace("T", " ");
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

function findColumnValue(row, candidates) {
  const lowered = new Map(Object.keys(row || {}).map((key) => [key.toLowerCase(), key]));
  for (const candidate of candidates) {
    const actualKey = lowered.get(String(candidate).toLowerCase());
    if (actualKey && String(row[actualKey] || "").trim()) {
      return String(row[actualKey]).trim();
    }
  }
  return "";
}

async function runLegacyManualQuery(query, options = {}) {
  const maxRows = Math.max(1, Math.min(MAX_PREVIEW_ROWS, Number(options.maxRows || 20)));
  const startMs = Date.now();
  // Fungsi legacy per-pegawai (mis. getDataJadwalSidangPerdataHakim) berarity 1:
  // scheduler mengoper nama penerima sebagai filter. Kirim Manual dulu mengoper
  // null sehingga filternya jadi "Pegawai" dan hasilnya selalu 0 baris.
  // Tanggal acuan berlaku selama eksekusi query legacy ini saja, sehingga
  // scheduler notifikasi yang berjalan bersamaan tidak terpengaruh.
  const result = await runWithReferenceDate(options.referenceDate || "", () =>
    dynamicNotificationSchedulerService.runSourceQuery(query, options.recipient || null, new Map(), { maxRows })
  );
  const durationMs = Date.now() - startMs;
  const allRows = Array.isArray(result.rows) ? result.rows : [];
  const legacyText = String(result.text || "").trim();
  return {
    ok: true,
    legacy: true,
    legacyText,
    neededParams: [],
    missingParams: [],
    rows: allRows.slice(0, maxRows).map(sanitizeRow),
    rowCount: allRows.length > maxRows ? maxRows : allRows.length,
    truncated: allRows.length > maxRows,
    durationMs,
  };
}

/** Tanggal hari ini (YYYY-MM-DD) menurut zona waktu pengadilan, bukan zona host. */
function todayInCourtTimezone(timeZone = process.env.ALETA_BOT_CRON_TIMEZONE || "Asia/Makassar") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Parameter tanggal yang dibiarkan kosong berarti "hari ini".
 *
 * Dengan begitu operator cukup menekan Jalankan Sumber Data untuk melihat sidang
 * hari ini, dan hanya perlu mengisi tanggal bila ingin hari lain. Sebelumnya
 * tanggal kosong dianggap parameter hilang sehingga query menolak berjalan.
 */
function applyDefaultDateParams(sqlText, params = {}, referenceDate = "") {
  const bawaan = String(referenceDate || "").trim() || todayInCourtTimezone();
  const hasil = { ...params };
  for (const key of extractQueryParameters(sqlText)) {
    if (!/tanggal|tgl|date/i.test(key)) continue;
    if (String(hasil[key] ?? "").trim()) continue;
    hasil[key] = bawaan;
  }
  return hasil;
}

async function runManualQuery(query, params = {}, options = {}) {
  const sqlText = String(query.sqlText || query.sql_text || "").trim();
  if (!sqlText) {
    throw new Error("Sumber data tidak memiliki SQL.");
  }
  if (/^(portal|runtime):/i.test(sqlText)) {
    throw new Error(
      "Sumber data ini dieksekusi oleh layanan khusus portal dan tidak dapat dijalankan dari Kirim Manual. " +
      "Pilih sumber data SQL atau jalur lama (legacy), atau gunakan simulasi notifikasinya langsung."
    );
  }
  if (/^legacy:/i.test(sqlText)) {
    return runLegacyManualQuery(query, options);
  }

  const neededParams = extractQueryParameters(sqlText);
  // Tanggal acuan pilihan operator dipakai untuk mengisi parameter tanggal yang
  // dikosongkan SEKALIGUS menggantikan CURDATE() di dalam SQL. Tanpa pilihan,
  // keduanya jatuh ke hari ini menurut server.
  const tanggalAcuan = String(options.referenceDate || "").trim();
  const effectiveParams = applyDefaultDateParams(sqlText, params, tanggalAcuan);
  const { boundSql, values, missing } = bindQueryParameters(sqlText, effectiveParams, tanggalAcuan);
  if (missing.length > 0) {
    return {
      ok: false,
      error: "missing_parameters",
      neededParams,
      missingParams: missing,
      rows: [],
      rowCount: 0,
    };
  }

  const validation = validateQuery(boundSql, {
    category: query.category || "system",
    recipientColumn: query.recipientColumn || query.recipient_column || "",
    outputColumns: Array.isArray(query.outputColumns) ? query.outputColumns : [],
  });
  if (!validation.valid) {
    throw new Error(`Query SQL tidak valid/aman (hanya SELECT read-only yang diizinkan): ${validation.errors.join(", ")}`);
  }

  const maxRows = Math.max(1, Math.min(MAX_PREVIEW_ROWS, Number(options.maxRows || 20)));
  const startMs = Date.now();
  const rawRows = await externalDbService.query(
    query.connectionKey || query.connection_key || "sipp_primary",
    buildBoundedSelect(validation.executableSql || boundSql, maxRows),
    values
  );
  const durationMs = Date.now() - startMs;
  const allRows = Array.isArray(rawRows) ? rawRows : [];
  const truncated = allRows.length > maxRows;
  const rows = allRows.slice(0, maxRows).map(sanitizeRow);

  return {
    ok: true,
    neededParams,
    missingParams: [],
    rows,
    rowCount: rows.length,
    truncated,
    durationMs,
  };
}

function extractRecipientsFromRows(query, rows) {
  const recipientColumn = String(query.recipientColumn || query.recipient_column || "").trim();
  const candidates = recipientColumn
    ? [recipientColumn, ...RECIPIENT_NUMBER_FALLBACK_COLUMNS]
    : RECIPIENT_NUMBER_FALLBACK_COLUMNS;
  const seen = new Set();
  const recipients = [];

  for (const [index, row] of rows.entries()) {
    const rawNumber = findColumnValue(row, candidates);
    if (!rawNumber) continue;
    const analysis = analyzeRecipientNumber(rawNumber, {
      recipientType: String(query.category || "manual"),
      strict: false,
    });
    const dedupeKey = analysis.normalized || rawNumber;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    recipients.push({
      rowIndex: index,
      raw: rawNumber,
      normalized: analysis.normalized || "",
      valid: Boolean(analysis.allowed),
      reason: analysis.allowed ? "" : (analysis.reason || (analysis.issues || []).join(", ") || "invalid"),
      name: findColumnValue(row, RECIPIENT_NAME_COLUMNS),
    });
  }
  return recipients;
}

function rowsToRingkasan(rows) {
  return rows
    .map((row) =>
      Object.entries(row)
        .filter(([, value]) => String(value || "").trim() !== "")
        .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`)
        .join("\n")
    )
    .filter(Boolean)
    .join("\n\n");
}

// Kolom SIPP tidak konsisten (nama vs nama_pihak, no_perkara vs nomor_perkara).
// Scheduler notifikasi sudah menormalkannya; Kirim Manual dulu tidak, sehingga
// template dengan {{nama_pihak}} selalu dilaporkan "placeholder belum terisi"
// padahal barisnya punya kolom "nama".
const TEMPLATE_VALUE_ALIASES = {
  nama_pihak: ["nama_pihak", "nama", "nama_penerima", "recipient_name", "name"],
  nama_pegawai: ["nama_pegawai", "nama", "recipient_name", "name"],
  nomor_perkara: ["nomor_perkara", "no_perkara", "nomorperkara"],
  jenis_perkara: ["jenis_perkara_nama", "jenis_perkara"],
  tanggal_sidang: ["tanggal_sidang", "tgl_sidang"],
  agenda: ["agenda", "agenda_sidang"],
  ruangan: ["ruangan", "ruang_sidang", "ruang"],
  telepon: ["telepon", "nomor_hp", "no_hp", "nomor_whatsapp"],
};

function applyTemplateValueAliases(row = {}) {
  const derived = {};
  for (const [target, candidates] of Object.entries(TEMPLATE_VALUE_ALIASES)) {
    const existing = String(row[target] ?? "").trim();
    if (existing) continue;
    const value = findColumnValue(row, candidates);
    if (value) derived[target] = value;
  }
  return derived;
}

function buildTemplateValues({
  rows = [],
  selectedRowIndex = 0,
  params = {},
  manualValues = {},
  ringkasanOverride = "",
  extraValues = {},
}) {
  const index = Math.max(0, Math.min(rows.length > 0 ? rows.length - 1 : 0, Number(selectedRowIndex || 0)));
  const selectedRow = rows[index] || {};
  return {
    waktu: new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" }),
    ringkasan: String(ringkasanOverride || "").trim() || rowsToRingkasan(rows),
    ...selectedRow,
    ...applyTemplateValueAliases(selectedRow),
    // Nilai yang disuntikkan runtime (nama_pegawai, judul_notifikasi) — sama
    // seperti normalizeNotificationValues pada scheduler notifikasi.
    ...extraValues,
    ...params,
    ...manualValues,
  };
}

/**
 * Jabatan pegawai untuk variabel {{jabatan}} pada isi pesan internal.
 *
 * Harus selalu menghasilkan teks: isi pesan pegawai memakai {{jabatan}} di baris
 * pertama, dan placeholder kosong akan membuat pratinjau ditandai belum lengkap
 * sehingga pesan tidak bisa dikirim. Sama seperti scheduler notifikasi, pegawai
 * tanpa jabatan memakai kata netral "Pegawai".
 */
function employeePositionLabel(employee) {
  const raw =
    employee?.positionName ||
    employee?.position_name ||
    employee?.roleId ||
    employee?.role_id ||
    "";
  return toTitleCaseName(raw) || "Pegawai";
}

function renderTemplatePreview(template, values) {
  const placeholders = extractPlaceholders(String(template.body || ""));
  const missingPlaceholders = placeholders.filter((key) => {
    const value = values[key];
    return value === undefined || value === null || String(value).trim() === "";
  });

  if (missingPlaceholders.length > 0) {
    // Render versi longgar untuk ditampilkan, tapi tandai placeholder yang kosong.
    const looseMessage = String(template.body || "").replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_, key) => {
        const value = values[key];
        if (value === undefined || value === null || String(value).trim() === "") {
          return `⟪${key} KOSONG⟫`;
        }
        return formatTemplateValue(key, value);
      }
    );
    return { ok: false, message: looseMessage, missingPlaceholders, placeholders };
  }

  return { ok: true, message: renderTemplate(template, values), missingPlaceholders: [], placeholders };
}

/**
 * Pratinjau Kirim Manual untuk sumber data PEGAWAI.
 * Query dijalankan sekali per pegawai dengan namanya sebagai filter, lalu
 * pesannya dirender memakai hasil milik pegawai itu sendiri. Pegawai yang tidak
 * punya data (mis. hakim tanpa sidang hari ini) sengaja dilewati agar tidak
 * menerima pesan kosong.
 */
async function previewEmployeeManualSend({
  query,
  template,
  params,
  manualValues,
  maxRows,
  employeeRecipients,
  notificationName,
  referenceDate,
}) {
  const result = { ok: true, query: null, template: null, recipientMessages: [] };
  const perEmployee = [];
  const gabunganRows = [];
  let durationMs = 0;
  let lastError = "";

  // Query dijalankan PARALEL dengan batas serentak. Berurutan terlalu lambat:
  // satu query SIPP bisa ~1 detik, dikali puluhan pegawai membuat pratinjau
  // melewati batas waktu portal. Batasnya dijaga agar SIPP tidak dibanjiri.
  const daftar = employeeRecipients
    .map((employee) => ({ employee, nama: String(employee.name || employee.username || "").trim() }))
    .filter((item) => item.nama);

  const hasilPerPegawai = new Array(daftar.length).fill(null);
  let cursor = 0;
  async function pekerja() {
    for (;;) {
      const index = cursor++;
      if (index >= daftar.length) return;
      const { employee, nama } = daftar[index];
      try {
        const queryResult = await runManualQuery(query, params, { maxRows, recipient: { name: nama }, referenceDate });
        if (!queryResult.ok) {
          lastError = queryResult.error || lastError;
          continue;
        }
        const ringkasan = String(queryResult.legacyText || "").trim() || rowsToRingkasan(queryResult.rows);
        // Tanpa data, pesan hanya berisi judul tanpa isi — lebih baik dilewati.
        if (!ringkasan) continue;
        hasilPerPegawai[index] = {
          employee,
          nama,
          rows: queryResult.rows,
          ringkasan,
          durationMs: queryResult.durationMs || 0,
        };
      } catch (error) {
        lastError = error.message;
      }
    }
  }

  const mulaiMs = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(EMPLOYEE_QUERY_CONCURRENCY, daftar.length || 1) }, () => pekerja())
  );
  durationMs = Date.now() - mulaiMs;

  // Urutan pegawai dijaga tetap sesuai daftar asli agar tampilan tidak acak.
  for (const item of hasilPerPegawai) {
    if (!item) continue;
    gabunganRows.push(...item.rows);
    perEmployee.push(item);
  }

  result.query = {
    id: String(query.id || ""),
    name: String(query.name || ""),
    neededParams: extractQueryParameters(String(query.sqlText || query.sql_text || "")),
    missingParams: [],
    rows: gabunganRows,
    rowCount: gabunganRows.length,
    truncated: false,
    durationMs,
    legacy: /^legacy:/i.test(String(query.sqlText || query.sql_text || "")),
    legacyText: "",
    empty: perEmployee.length === 0,
    // Pesan spesifik: kosong di sini BUKAN salah konfigurasi placeholder,
    // melainkan memang tidak ada pegawai yang punya data hari itu.
    error:
      perEmployee.length === 0
        ? lastError ||
          `Tidak ada data untuk ${employeeRecipients.length} pegawai yang ditargetkan. ` +
            "Kemungkinan memang tidak ada jadwal/tugas hari ini, atau penulisan nama di Manajemen Akun " +
            "berbeda dengan nama di SIPP sehingga tidak cocok saat pencarian."
        : undefined,
    // Penerima = pegawai yang PUNYA data, bukan hasil ekstraksi kolom telepon.
    recipients: perEmployee.map((item, index) => ({
      rowIndex: index,
      raw: String(item.employee.whatsappNumber || ""),
      normalized: String(item.employee.whatsappNumber || ""),
      valid: Boolean(item.employee.whatsappNumber),
      reason: item.employee.whatsappNumber ? "" : "Pegawai belum punya nomor WhatsApp.",
      name: item.nama,
    })),
  };

  if (template && typeof template === "object") {
    const contoh = perEmployee[0];
    const nilaiContoh = buildTemplateValues({
      rows: contoh?.rows ?? [],
      selectedRowIndex: 0,
      params,
      manualValues,
      ringkasanOverride: contoh?.ringkasan ?? "",
      extraValues: {
        nama_pegawai: contoh?.nama ?? "",
        jabatan: employeePositionLabel(contoh?.employee),
        judul_notifikasi: notificationName || String(template.title || ""),
      },
    });
    const renderContoh = renderTemplatePreview(template, nilaiContoh);
    result.template = {
      id: String(template.id || ""),
      title: String(template.title || ""),
      placeholders: renderContoh.placeholders,
      missingPlaceholders: renderContoh.missingPlaceholders,
      message: renderContoh.message,
      complete: renderContoh.ok,
      values: nilaiContoh,
    };
    if (!renderContoh.ok) result.ok = false;

    result.recipientMessages = perEmployee.map((item, index) => {
      const nilai = buildTemplateValues({
        rows: item.rows,
        selectedRowIndex: 0,
        params,
        manualValues,
        ringkasanOverride: item.ringkasan,
        extraValues: {
          nama_pegawai: item.nama,
          jabatan: employeePositionLabel(item.employee),
          judul_notifikasi: notificationName || String(template.title || ""),
        },
      });
      const render = renderTemplatePreview(template, nilai);
      return {
        rowIndex: index,
        normalized: String(item.employee.whatsappNumber || ""),
        message: render.message,
        complete: render.ok,
        missingPlaceholders: render.missingPlaceholders,
      };
    });
  }

  return result;
}

async function previewManualSend(payload = {}) {
  const {
    query,
    template,
    params = {},
    manualValues = {},
    selectedRowIndex = 0,
    maxRows = 20,
    employeeRecipients = [],
    notificationName = "",
    referenceDate = "",
  } = payload;
  const result = {
    ok: true,
    query: null,
    template: null,
  };

  // Sumber data pegawai difilter per nama penerima, jadi harus dijalankan
  // SEKALI UNTUK TIAP PEGAWAI — persis seperti scheduler notifikasi.
  const isEmployeeQuery = String(query?.category || "").toLowerCase() === "employee";
  if (query && isEmployeeQuery && Array.isArray(employeeRecipients) && employeeRecipients.length > 0) {
    return previewEmployeeManualSend({
      query,
      template,
      params,
      manualValues,
      maxRows,
      employeeRecipients,
      notificationName,
      referenceDate,
    });
  }

  let rows = [];
  let ringkasanOverride = "";
  if (query && typeof query === "object") {
    const queryResult = await runManualQuery(query, params, { maxRows, referenceDate });
    result.query = {
      id: String(query.id || ""),
      name: String(query.name || ""),
      neededParams: queryResult.neededParams,
      missingParams: queryResult.missingParams,
      rows: queryResult.rows,
      rowCount: queryResult.rowCount,
      truncated: Boolean(queryResult.truncated),
      durationMs: queryResult.durationMs || 0,
      legacy: Boolean(queryResult.legacy),
      legacyText: queryResult.legacyText || "",
      empty: queryResult.ok
        ? (queryResult.legacy ? !queryResult.legacyText && queryResult.rowCount === 0 : queryResult.rowCount === 0)
        : false,
      recipients: queryResult.ok ? extractRecipientsFromRows(query, queryResult.rows) : [],
    };
    if (!queryResult.ok) {
      result.ok = false;
      result.query.error = queryResult.error;
      return result;
    }
    rows = queryResult.rows;
    ringkasanOverride = queryResult.legacyText || "";
  }

  if (template && typeof template === "object") {
    const values = buildTemplateValues({ rows, selectedRowIndex, params, manualValues, ringkasanOverride });
    const rendered = renderTemplatePreview(template, values);
    result.template = {
      id: String(template.id || ""),
      title: String(template.title || ""),
      placeholders: rendered.placeholders,
      missingPlaceholders: rendered.missingPlaceholders,
      message: rendered.message,
      complete: rendered.ok,
      values,
    };
    if (!rendered.ok) {
      result.ok = false;
    }

    // Render SATU PESAN PER PENERIMA memakai baris datanya masing-masing.
    // Tanpa ini seluruh penerima menerima pesan berisi nama/perkara milik satu
    // baris yang kebetulan terpilih — salah kirim sekaligus bocor data pihak lain.
    const recipients = result.query?.recipients ?? [];
    result.recipientMessages = recipients.map((recipient) => {
      const rowIndex = Number.isInteger(recipient.rowIndex) ? recipient.rowIndex : -1;
      const perRecipientValues =
        rowIndex >= 0
          ? buildTemplateValues({ rows, selectedRowIndex: rowIndex, params, manualValues, ringkasanOverride })
          : values;
      const perRecipientRendered = renderTemplatePreview(template, perRecipientValues);
      return {
        rowIndex,
        normalized: recipient.normalized || "",
        message: perRecipientRendered.message,
        complete: perRecipientRendered.ok,
        missingPlaceholders: perRecipientRendered.missingPlaceholders,
      };
    });
  }

  return result;
}

module.exports = {
  extractQueryParameters,
  bindQueryParameters,
  applyDefaultDateParams,
  supportsReferenceDate,
  todayInCourtTimezone,
  runManualQuery,
  extractRecipientsFromRows,
  buildTemplateValues,
  employeePositionLabel,
  renderTemplatePreview,
  previewManualSend,
  MAX_PREVIEW_ROWS,
};
