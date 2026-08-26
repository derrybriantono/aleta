"use strict";

const crypto = require("crypto");
const path = require("path");
const cron = require("node-cron");
const { readRuntimeConfig } = require("../config/runtime-config");

// Scheduler dinamis wajib memakai zona waktu WITA agar jadwal dari portal konsisten
// walaupun timezone host/container berbeda.
const DYNAMIC_CRON_TIMEZONE = String(process.env.ALETA_BOT_CRON_TIMEZONE || "Asia/Makassar").trim() || "Asia/Makassar";
const { buildIdempotencyKey } = require("./idempotencyService");
const externalDbService = require("./externalDbService");
const logService = require("./logService");
const messageQueueService = require("./messageQueueService");
const { extractPlaceholders, renderTemplate, validateTemplate, varyOpening } = require("./templateService");
const { rowToHumanText, toTitleCaseName } = require("./humanTextService");
const { OPT_OUT_FOOTER } = require("./optOutService");
const { explainTerms } = require("./legalGlossaryService");
const { findShortenerLinks } = require("./outgoingChatService");
const sidangAgendaService = require("./sidangAgendaService");
const { validateQuery, normalizeSqlForExecution } = require("./queryValidatorService");
const { normalizeLegacyEmployeeName } = require("./employeeNameUtil");
const { validateWhatsappNumber } = require("../utils/phoneFormatter");
const { analyzeRecipientNumber, buildRecipientNumberIndex } = require("./recipientValidationService");
const {
  legacyNotifikasiLabel,
  parseLegacyNotifikasiRefs,
  resolveLegacyNotifikasiFunctions,
} = require("./legacy/legacyQueryCatalog");

const scheduledTasks = new Map();
let refreshTimer = null;
let lastRefreshAt = null;
let lastError = "";
const DEFAULT_MAX_RECIPIENTS_PER_RUN = 500;
const STANDARD_COLUMN_ALIASES = {
  recipient_number: ["recipient_number", "nomor_whatsapp", "nomor_wa", "whatsapp", "nomor_hp", "no_hp", "telepon", "phone", "mobile"],
  recipient_name: ["recipient_name", "nama_penerima", "nama_pihak", "nama_pegawai", "nama", "penerima"],
  recipient_role: ["recipient_role", "role", "role_id", "jabatan", "jabatan_unit", "posisi", "kategori_pihak", "jenis_pihak"],
  nomor_perkara: ["nomor_perkara", "no_perkara", "perkara_nomor", "nomor", "case_number"],
  agenda: ["agenda", "agenda_sidang", "acara_sidang", "agenda_terakhir"],
  event_key: ["event_key", "event_type", "jenis_event", "jenis_notifikasi", "agenda", "status_event"],
  event_date: ["event_date", "tanggal_event", "tanggal_sidang", "tanggal_upload", "tanggal_putusan", "tanggal", "created_at"],
  ringkasan: ["ringkasan", "summary", "keterangan", "detail", "informasi", "message", "pesan"],
  source_updated_at: ["source_updated_at", "updated_at", "modified_at", "last_update", "tanggal_update", "tanggal_upload"],
  file_path: ["file_path", "attachment_path", "attachment_source", "document_path", "dokumen_path", "petitum_dok", "file_dokumen", "path_file"],
  file_name: ["file_name", "attachment_name", "document_name", "nama_file", "dokumen_nama"],
  file_type: ["file_type", "mime_type", "attachment_mime_type", "jenis_file", "ekstensi_file"],
  file_hash: ["file_hash", "file_checksum", "checksum", "sha256", "attachment_checksum"],
};

function listCronExpressions(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeArray(parsed);
    } catch {
      // Fallback ke pemisah teks biasa.
    }
  }
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLowerArray(value) {
  return normalizeArray(value).map((item) => item.toLowerCase());
}

function getScheduleConfig(notification) {
  return notification.scheduleConfig || notification.schedule_config || {};
}

function getRecipientMapping(notification) {
  return notification.recipientMapping || notification.recipient_mapping || {};
}

function getNotificationId(notification) {
  return String(notification.id || notification.key || "");
}

function getNotificationQueryId(notification) {
  return String(notification.queryId || notification.query_id || notification.query_key || "");
}

function getNotificationTemplateId(notification) {
  return String(notification.templateId || notification.template_id || notification.template_key || "");
}

function getNotificationName(notification) {
  return String(notification.name || notification.title || getNotificationId(notification) || "Notifikasi ALETA Bot");
}

function getMaxRecipientsPerRun(runtimeConfig, notification) {
  const raw =
    notification.maxRecipientsPerRun ??
    notification.max_recipients_per_run ??
    runtimeConfig.maxRecipientsPerRun ??
    runtimeConfig.max_recipients_per_run ??
    process.env.ALETA_BOT_MAX_RECIPIENTS_PER_RUN ??
    DEFAULT_MAX_RECIPIENTS_PER_RUN;
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_MAX_RECIPIENTS_PER_RUN;
  return Math.max(1, Math.min(5000, Math.floor(value)));
}

function getQueryId(query) {
  return String(query.id || query.key || query.name || "");
}

function getTemplateId(template) {
  return String(template.id || template.key || "");
}

function getSqlText(query) {
  return String(query.sqlText || query.sql_text || "");
}

function getOutputColumns(query) {
  return Array.isArray(query.outputColumns)
    ? query.outputColumns
    : Array.isArray(query.output_columns)
      ? query.output_columns
      : normalizeArray(query.outputColumns || query.output_columns_json);
}

function firstExistingValue(source, keys) {
  if (!source || typeof source !== "object") return "";
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function stableHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function hashMessageBody(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function normalizeDateLike(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function basenameFromPath(value) {
  const normalized = String(value || "").replace(/\\/g, "/");
  return normalized ? path.posix.basename(normalized) : "";
}

function fileTypeFromValues(filePath, fileName, explicitType) {
  const explicit = String(explicitType || "").trim();
  if (explicit) return explicit;
  const extension = path.extname(String(fileName || filePath || "")).replace(/^\./, "").toLowerCase();
  return extension || "";
}

function outputColumnsHaveAny(outputColumns, keys) {
  const lowered = new Set((outputColumns || []).map((item) => String(item || "").toLowerCase()));
  return keys.some((key) => lowered.has(String(key).toLowerCase()));
}

function getRequiredTemplatePlaceholders(template) {
  return extractPlaceholders(template.body || template.message || "");
}

function hasValue(values, key) {
  return values[key] !== undefined && values[key] !== null && String(values[key]).trim() !== "";
}

function assertTemplateValues(template, values) {
  const missing = getRequiredTemplatePlaceholders(template).filter((key) => !hasValue(values, key));
  if (missing.length > 0) {
    throw new Error(`Placeholder isi pesan belum terisi: ${missing.join(", ")}`);
  }
}

function buildBatchRecipientKey(recipientNumber, values, notification) {
  const normalizedNumber = validateWhatsappNumber(recipientNumber).normalized || String(recipientNumber || "").trim();
  const entity =
    values.nomor_perkara ||
    values.perkara_id ||
    values.id_perkara ||
    values.entity_id ||
    values.nama_pihak ||
    values.nama_pegawai ||
    getNotificationId(notification);
  const eventKey = values.event_key || getNotificationId(notification);
  const eventDate = values.event_date || values.source_updated_at || "";
  const fileHash = values.file_hash || "no-file";
  return `${normalizedNumber}:${String(entity || "").trim().toLowerCase()}:${eventKey}:${eventDate}:${fileHash}`;
}

async function logSchedulerSkip({ notification, query, reason, recipientType, recipientCount = 1, metadata = {} }) {
  await logService.logPolicySkip({
    notificationKey: getNotificationId(notification),
    notificationId: getNotificationId(notification),
    category: notification.category || "",
    reason,
    sourceFeature: "dynamic_notification_scheduler",
    entityType: "notification",
    entityId: getNotificationId(notification),
    recipientType,
    recipientCount,
    metadata: {
      queryId: query ? getQueryId(query) : "",
      ...metadata,
    },
  });
}

function splitLegacyText(value) {
  const text = String(value || "").trim();
  if (!text || /^tidak ada data$/i.test(text)) return [];
  return text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function countLegacyItems(value) {
  return splitLegacyText(value).length;
}

function resultToText(value) {
  if (!value) return "";
  if (typeof value === "string") return /^tidak ada data$/i.test(value.trim()) ? "" : value.trim();
  if (Array.isArray(value)) {
    return value
      .map((row) => rowToText(row))
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof value === "object") {
    const arrays = Object.values(value).filter(Array.isArray);
    if (arrays.length > 0) {
      return arrays
        .flat()
        .map((row) => rowToText(row))
        .filter(Boolean)
        .join("\n\n");
    }
    return rowToText(value);
  }
  return String(value);
}

/**
 * Baris data -> teks siap baca penerima.
 *
 * Wajib lewat humanTextService: penerima tidak boleh melihat nama kolom mentah
 * seperti `tanggal_sidang:` di dalam pesan WhatsApp-nya.
 */
function rowToText(row, options = {}) {
  return rowToHumanText(row, options);
}

function maskSensitiveSampleValue(key, value) {
  if (/password|passwd|token|secret|api[_-]?key|connection|string|dsn/i.test(String(key || ""))) {
    return value ? "[masked]" : "";
  }
  return value;
}

function sampleRow(row) {
  if (!row || typeof row !== "object") return {};
  return Object.fromEntries(
    Object.entries(row)
      .slice(0, 18)
      .map(([key, value]) => [key, maskSensitiveSampleValue(key, value)])
  );
}

function flattenRows(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (typeof value === "object") {
    const arrays = Object.values(value).filter(Array.isArray);
    if (arrays.length > 0) return arrays.flat().filter((item) => item && typeof item === "object");
    return [value];
  }
  return [];
}

/**
 * Role yang secara jabatan MELEKAT pada role lain.
 *
 * Ketua dan Wakil Ketua Pengadilan adalah HAKIM juga: mereka memegang perkara
 * dan bersidang, jadi wajib ikut menerima notifikasi jadwal sidang.
 * Aplikasi lama menyatakan ini dengan mendaftarkan nomor yang sama di hakimIds
 * DAN ketuaId (aleta_bot/whatsapp.js).
 *
 * Harus sama dengan IMPLICIT_ROLE_IDS di
 * manajemen_surat/src/server/modules/aleta-bot/service.ts.
 */
const IMPLICIT_ROLE_IDS = {
  ketua: ["hakim"],
  "wakil-ketua": ["hakim"],
};

function expandRoleIds(roleId) {
  const normalized = String(roleId || "").trim().toLowerCase();
  if (!normalized) return [];
  return [normalized, ...(IMPLICIT_ROLE_IDS[normalized] || [])];
}

function recipientMatchesHints(recipient, mapping) {
  const roleHints = normalizeLowerArray(mapping.roleHints || mapping.role_hints);
  const positionHints = normalizeLowerArray(mapping.positionHints || mapping.position_hints);
  const nameHints = normalizeLowerArray(mapping.nameHints || mapping.name_hints);
  const additionalRoleIds = Array.isArray(recipient.additionalRoleIds || recipient.additional_role_ids)
    ? (recipient.additionalRoleIds || recipient.additional_role_ids).join(" ")
    : "";
  // Role melekat ikut dimasukkan supaya Ketua/Wakil Ketua juga cocok dengan
  // roleHints ["hakim"], sama seperti perilaku aplikasi lama.
  const expandedRoles = expandRoleIds(recipient.roleId || recipient.role_id).join(" ");
  const haystack = `${recipient.id || ""} ${expandedRoles} ${recipient.positionId || recipient.position_id || ""} ${recipient.positionName || recipient.position_name || ""} ${recipient.unitKerja || recipient.unit_kerja || ""} ${additionalRoleIds} ${recipient.name || ""} ${recipient.username || ""}`.toLowerCase();
  const matches = (hints) => hints.length === 0 || hints.some((hint) => haystack.includes(hint));
  return matches(roleHints) && matches(positionHints) && matches(nameHints);
}

function getEmployeeRecipients(runtimeConfig, notification) {
  const mapping = getRecipientMapping(notification);
  return (Array.isArray(runtimeConfig.employeeRecipients) ? runtimeConfig.employeeRecipients : [])
    .filter((recipient) => recipient.whatsappChatId || recipient.whatsapp_chat_id || recipient.whatsappNumber || recipient.whatsapp_number)
    .filter((recipient) => recipientMatchesHints(recipient, mapping));
}

function getPartyRecipientNumber(row, query, notification) {
  const mapping = getRecipientMapping(notification);
  const primary = String(mapping.recipientColumn || mapping.recipient_column || query.recipientColumn || query.recipient_column || "telepon");
  const fallbacks = normalizeArray(mapping.fallbackColumns || mapping.fallback_columns || STANDARD_COLUMN_ALIASES.recipient_number);
  for (const key of [primary, ...fallbacks]) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function getRecipientNumber(recipient) {
  return recipient.whatsappChatId || recipient.whatsapp_chat_id || recipient.whatsappNumber || recipient.whatsapp_number || "";
}

function getRecipientName(recipient) {
  return recipient.name || recipient.username || recipient.id || "Pegawai";
}


function normalizeNotificationValues({ row = {}, recipient = null, notification, query, recipientNumber, recipientName }) {
  const nowMinute = new Date().toISOString().slice(0, 16);
  const filePath = firstExistingValue(row, STANDARD_COLUMN_ALIASES.file_path);
  const fileName = firstExistingValue(row, STANDARD_COLUMN_ALIASES.file_name) || basenameFromPath(filePath);
  const fileType = fileTypeFromValues(filePath, fileName, firstExistingValue(row, STANDARD_COLUMN_ALIASES.file_type));
  const sourceUpdatedAt = normalizeDateLike(firstExistingValue(row, STANDARD_COLUMN_ALIASES.source_updated_at), "");
  const eventDate = normalizeDateLike(
    firstExistingValue(row, STANDARD_COLUMN_ALIASES.event_date) || sourceUpdatedAt,
    nowMinute
  );
  const nomorPerkara = firstExistingValue(row, STANDARD_COLUMN_ALIASES.nomor_perkara);
  const recipientRole =
    firstExistingValue(row, STANDARD_COLUMN_ALIASES.recipient_role) ||
    String(recipient?.positionName || recipient?.position_name || recipient?.roleId || recipient?.role_id || "").trim();
  const recipientNumberStandard = firstExistingValue(row, STANDARD_COLUMN_ALIASES.recipient_number) || recipientNumber || "";
  const recipientNameStandard = firstExistingValue(row, STANDARD_COLUMN_ALIASES.recipient_name) || recipientName || "";
  // Isi pesan sudah mencetak nama & nomor perkara di bagian atas, jadi ringkasan
  // otomatis tidak mengulangnya lagi — cukup rincian peristiwanya.
  const ringkasan = firstExistingValue(row, STANDARD_COLUMN_ALIASES.ringkasan) || rowToText(row, { omitIdentity: true });
  const eventKey =
    firstExistingValue(row, STANDARD_COLUMN_ALIASES.event_key) ||
    query.eventKey ||
    query.event_key ||
    getNotificationId(notification);
  const fileHash =
    firstExistingValue(row, STANDARD_COLUMN_ALIASES.file_hash) ||
    (filePath ? stableHash(`${filePath}|${fileName}|${fileType}|${sourceUpdatedAt || eventDate}`) : "");
  // Agenda diterjemahkan menjadi daftar persiapan yang dapat dibaca orang awam.
  // Selalu terisi - bila agendanya tidak dikenali pun tetap ada nasihat dasar -
  // supaya isi pesan yang memakai {{persiapan_sidang}} tidak pernah gagal render.
  const agenda = firstExistingValue(row, STANDARD_COLUMN_ALIASES.agenda);
  const persiapanSidang = sidangAgendaService.formatPreparation(agenda);

  return {
    ...row,
    recipient_number: recipientNumberStandard,
    recipient_name: recipientNameStandard,
    recipient_role: recipientRole,
    nomor_perkara: nomorPerkara,
    event_key: eventKey,
    event_date: eventDate,
    ringkasan,
    source_updated_at: sourceUpdatedAt || eventDate,
    file_path: filePath,
    file_name: fileName,
    file_type: fileType,
    file_hash: fileHash,
    nama_pihak: row.nama_pihak || row.nama || recipientNameStandard || "Pihak",
    nama_pegawai: recipientNameStandard || getRecipientName(recipient || {}),
    // Jabatan pegawai untuk sapaan pesan internal. Selalu terisi supaya isi
    // pesan yang memakai {{jabatan}} tidak pernah gagal render; bila jabatan
    // tidak diketahui, dipakai kata netral "Pegawai".
    jabatan: toTitleCaseName(recipientRole) || "Pegawai",
    judul_notifikasi: getNotificationName(notification),
    agenda_sidang: agenda,
    persiapan_sidang: persiapanSidang,
    waktu: new Date().toLocaleString("id-ID"),
  };
}

function buildAttachmentFromValues(values) {
  if (!values.file_path) return null;
  return {
    source: values.file_path,
    name: values.file_name || basenameFromPath(values.file_path),
    mimeType: values.file_type || "",
    kind: "source_document",
    required: values.file_required === true || values.file_required === 1 || values.file_required === "true",
    checksum: values.file_hash || "",
  };
}

async function runLegacyQuery(query, recipient, cache) {
  const sqlText = getSqlText(query);
  const refs = resolveLegacyNotifikasiFunctions(sqlText);
  if (refs.length === 0) {
    return { text: "", rows: [], sections: [] };
  }

  const sections = [];
  const rows = [];
  for (const ref of refs) {
    const parameter = ref.arity > 0 ? normalizeLegacyEmployeeName(getRecipientName(recipient || {})) : "";
    const cacheKey = `${ref.exportName}:${parameter}`;
    let value;
    if (cache.has(cacheKey)) {
      value = cache.get(cacheKey);
    } else {
      value = await ref.fn(...(ref.arity > 0 ? [parameter] : []));
      cache.set(cacheKey, value);
    }

    const text = resultToText(value);
    if (text) {
      sections.push({
        exportName: ref.exportName,
        title: legacyNotifikasiLabel(ref.exportName),
        count: countLegacyItems(text),
        text,
      });
    }
    rows.push(...flattenRows(value));
  }

  return {
    text: sections.map((section) => `*${section.title}${section.count > 0 ? ` (${section.count})` : ""}* :\n${section.text}`).join("\n\n"),
    rows,
    sections,
  };
}

function buildBoundedSelect(sqlText, maxRows) {
  const safeLimit = Math.max(1, Math.min(5001, Number(maxRows || DEFAULT_MAX_RECIPIENTS_PER_RUN) + 1));
  return `SELECT * FROM (${sqlText}) AS aleta_source_data LIMIT ${safeLimit}`;
}

async function runSqlQuery(query, maxRows = DEFAULT_MAX_RECIPIENTS_PER_RUN) {
  const sqlText = getSqlText(query);
  const validation = validateQuery(sqlText, {
    category: query.category || "system",
    recipientColumn: query.recipientColumn || query.recipient_column || "",
    outputColumns: getOutputColumns(query),
  });
  if (!validation.valid || !validation.safeForPreview) {
    throw new Error(`Query SQL tidak valid untuk scheduler: ${validation.errors.join(", ") || validation.warnings.join(", ")}`);
  }
  const rows = await externalDbService.query(
    query.connectionKey || query.connection_key || "sipp_primary",
    buildBoundedSelect(validation.executableSql || sqlText, maxRows)
  );
  return Array.isArray(rows) ? rows : [];
}

async function validateNotificationContract(notification, query, template) {
  const category = notification.category || query.category || "system";
  const mapping = getRecipientMapping(notification);
  const outputColumns = getOutputColumns(query);
  const sqlText = getSqlText(query);
  const normalizedSql = normalizeSqlForExecution(sqlText).sql;
  const recipientColumn = String(mapping.recipientColumn || mapping.recipient_column || query.recipientColumn || query.recipient_column || "").trim();

  if (/^\s*(select|with)\b/i.test(normalizedSql)) {
    const queryValidation = validateQuery(sqlText, {
      category,
      recipientColumn,
      outputColumns,
    });
    if (!queryValidation.valid) {
      throw new Error(`Sumber data notifikasi tidak aman/valid: ${queryValidation.errors.join(", ")}`);
    }

    if (category === "party" && outputColumns.length > 0) {
      const fallbackColumns = normalizeArray(mapping.fallbackColumns || mapping.fallback_columns || STANDARD_COLUMN_ALIASES.recipient_number);
      const allowedRecipientColumns = [recipientColumn || "telepon", ...fallbackColumns, ...STANDARD_COLUMN_ALIASES.recipient_number].filter(Boolean);
      const hasRecipientOutput = outputColumnsHaveAny(outputColumns, allowedRecipientColumns);
      if (!hasRecipientOutput) {
        throw new Error(`Sumber data pihak belum memuat kolom nomor WhatsApp: ${allowedRecipientColumns.join(", ")}`);
      }
    }

    if (outputColumns.length > 0) {
      const missingStandardColumns = Object.entries(STANDARD_COLUMN_ALIASES)
        .filter(([key]) => !["file_path", "file_name", "file_type", "file_hash"].includes(key))
        .filter(([, aliases]) => !outputColumnsHaveAny(outputColumns, aliases))
        .map(([key]) => key);
      const hasAnyDocumentColumn = outputColumnsHaveAny(outputColumns, STANDARD_COLUMN_ALIASES.file_path);
      const missingDocumentColumns = hasAnyDocumentColumn
        ? ["file_name", "file_type"].filter((key) => !outputColumnsHaveAny(outputColumns, STANDARD_COLUMN_ALIASES[key]))
        : [];
      if (missingStandardColumns.length > 0 || missingDocumentColumns.length > 0) {
        await logService.logSystemEvent({
          eventType: "dynamic_notification_source_contract_warning",
          severity: "warning",
          message: "Sumber data notifikasi belum sepenuhnya memakai kontrak kolom standar.",
          metadata: {
            notificationId: getNotificationId(notification),
            queryId: getQueryId(query),
            missingStandardColumns,
            missingDocumentColumns,
          },
        });
      }
    }
  } else if (!/^legacy:notifikasi[.:]/i.test(sqlText)) {
    throw new Error(`Sumber data notifikasi belum didukung: ${sqlText.slice(0, 80)}`);
  }

  const commonPlaceholders = [
    "recipient_number",
    "recipient_name",
    "recipient_role",
    "nomor_perkara",
    "event_key",
    "event_date",
    "ringkasan",
    "source_updated_at",
    "file_path",
    "file_name",
    "file_type",
    "nama_pegawai",
    "nama_pihak",
    "jabatan",
    "judul_notifikasi",
    "waktu",
    "mode",
  ];
  const templateValidation = validateTemplate(template, {
    outputColumns: [...new Set([...outputColumns, ...commonPlaceholders])],
    category,
  });
  if (!templateValidation.valid) {
    throw new Error(`Isi pesan notifikasi belum valid: ${templateValidation.errors.join(", ")}`);
  }
  if (templateValidation.warnings.length > 0) {
    await logService.logSystemEvent({
      eventType: "dynamic_notification_template_warning",
      severity: "warning",
      message: "Isi pesan notifikasi memiliki peringatan validasi.",
      metadata: {
        notificationId: getNotificationId(notification),
        queryId: getQueryId(query),
        templateId: getTemplateId(template),
        warnings: templateValidation.warnings,
      },
    });
  }
}

async function runQuery(query, recipient, cache, options = {}) {
  const sqlText = getSqlText(query);
  const normalizedSql = normalizeSqlForExecution(sqlText).sql;
  if (/^legacy:notifikasi[.:]/i.test(sqlText)) return runLegacyQuery(query, recipient, cache);
  if (/^\s*(select|with)\b/i.test(normalizedSql)) {
    const rows = await runSqlQuery(query, options.maxRows);
    return {
      text: rows.map((row) => rowToText(row)).filter(Boolean).join("\n\n"),
      rows,
      sections: [],
    };
  }
  throw new Error(`Sumber data belum didukung scheduler dinamis: ${sqlText.slice(0, 80)}`);
}

async function healthCheckSourceQuery(query, options = {}) {
  const startedAt = new Date();
  const startMs = Date.now();
  const maxRows = Math.max(1, Math.min(200, Number(options.maxRows || 20)));
  const sampleLimit = Math.max(1, Math.min(10, Number(options.sampleLimit || 5)));
  const slowMs = Math.max(1000, Number(options.slowMs || 3000));

  try {
    const result = await runQuery(query, null, new Map(), { maxRows });
    const durationMs = Date.now() - startMs;
    const rows = Array.isArray(result.rows) ? result.rows : [];
    const sampleRows = rows.length > 0
      ? rows.slice(0, sampleLimit).map(sampleRow)
      : result.text
        ? [{ ringkasan: String(result.text).slice(0, 1000) }]
        : [];
    const rowCount = rows.length;
    const truncated = rowCount > maxRows;
    const status = durationMs > slowMs ? "warning" : "success";

    return {
      ok: true,
      status,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs,
      slow: durationMs > slowMs,
      rowCount: truncated ? maxRows : rowCount,
      truncated,
      sampleRows,
      message: truncated
        ? `Sumber data berhasil dibaca, tetapi hasil lebih dari ${maxRows} baris.`
        : rowCount === 0 && !result.text
          ? "Sumber data berhasil dibaca, tetapi tidak ada data."
          : "Sumber data berhasil dibaca.",
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      slow: false,
      rowCount: 0,
      truncated: false,
      sampleRows: [],
      message: "Sumber data gagal dibaca.",
      error: error && error.message ? error.message : String(error || "unknown error"),
    };
  }
}

function renderMessage(template, values) {
  assertTemplateValues(template, values);
  // Variasi kalimat pembuka ditempel setelah render, supaya berlaku juga pada
  // isi pesan yang sudah disunting admin - bukan hanya pada bawaan.
  return varyOpening(renderTemplate(template, values), readRuntimeConfig());
}

/**
 * Menempelkan ajakan berhenti berlangganan pada pemberitahuan ke PIHAK.
 *
 * Ditempel di sini, bukan ditulis ke dalam tiap isi pesan, karena dua alasan:
 * isi pesan yang sudah disesuaikan sendiri oleh admin ikut mendapatkannya, dan
 * kalimatnya cukup diubah di satu tempat bila perlu.
 *
 * Hanya untuk pihak berperkara. Pegawai tidak diberi pilihan ini karena
 * pemberitahuan internal adalah bagian dari pekerjaan mereka, bukan langganan.
 */
function appendOptOutFooter(message, category) {
  if (String(category || "").toLowerCase() !== "party") return message;
  const body = String(message || "");
  if (/\bberhenti\b/i.test(body)) return body;
  return `${body.trimEnd()}\n\n${OPT_OUT_FOOTER}`;
}

/**
 * Menyiapkan isi pemberitahuan sebelum masuk antrean.
 *
 * Pemberitahuan ke PIHAK diperlakukan sama dengan balasan chat: istilah hukum
 * di dalamnya dijelaskan. Justru di sinilah kebutuhannya paling besar — warga
 * menerima pemberitahuan tanpa pernah meminta, sering memuat kata seperti
 * "verstek" atau "berkekuatan hukum tetap", dan tidak ada petugas di sebelahnya
 * untuk ditanyai artinya.
 *
 * Pemberitahuan ke PEGAWAI tidak diberi kamus: mereka memang memahami
 * istilahnya, dan penjelasan tambahan hanya memanjangkan pesan kerja.
 */
function prepareNotificationBody(message, category, { notificationId = "" } = {}) {
  const normalized = String(category || "").toLowerCase();

  // Tautan pemendek adalah pemicu pemblokiran yang sering luput. Isinya tidak
  // diubah — mungkin memang sengaja dipasang admin — tetapi keberadaannya
  // dicatat supaya terlihat dan dapat diputuskan sendiri.
  const pemendek = findShortenerLinks(message);
  if (pemendek.length > 0) {
    void logService
      .logSystemEvent({
        eventType: "shortener_link_in_notification",
        severity: "warning",
        message: "Isi pesan memuat tautan pemendek, salah satu pemicu pemblokiran WhatsApp.",
        metadata: { notificationId, links: pemendek.slice(0, 3), saran: "Ganti dengan tautan pada domain resmi pengadilan." },
      })
      .catch(() => {});
  }

  const withFooter = appendOptOutFooter(message, normalized);
  if (normalized !== "party") return withFooter;
  return explainTerms(withFooter);
}

async function enqueueNotificationMessage({ runtimeConfig, notification, query, template, recipientNumber, recipientName, values, recipientValidation }) {
  const notificationKey = getNotificationId(notification);
  const numberValidation = validateWhatsappNumber(recipientNumber);
  if (!numberValidation.valid) {
    throw new Error(`Nomor WhatsApp tidak valid: ${numberValidation.reason}`);
  }
  const message = prepareNotificationBody(renderMessage(template, values), notification.category, {
    notificationId: notificationKey,
  });
  // Toggle kirim dokumen dari portal (kolom attach_document). Default aktif;
  // saat dimatikan, dokumen gugatan/permohonan tidak dilampirkan walau query
  // menyediakan petitum_dok — pesan tetap dikirim sebagai teks.
  const attachmentEnabled = notification.attachDocument !== false && notification.attach_document !== false;
  const attachment = attachmentEnabled ? buildAttachmentFromValues(values) : null;
  const eventKey = values.event_key || notificationKey;
  const eventDate = values.event_date || values.source_updated_at || new Date().toISOString().slice(0, 16);
  const fileHash = values.file_hash || (attachment ? stableHash(`${attachment.source}|${attachment.name || ""}`) : "no-file");
  const idempotencyKey = buildIdempotencyKey({
    notificationKey,
    recipientNumber: numberValidation.normalized,
    nomorPerkara: values.nomor_perkara || values.perkara_id || "",
    eventDate,
    messageType: `${eventKey}:${fileHash}`,
  });

  return messageQueueService.enqueueMessage({
    idempotencyKey,
    recipientNumber: numberValidation.chatId,
    recipientName,
    message,
    category: notification.category || "employee",
    notificationKey,
    maxRetries: Number(notification.retryLimit || notification.retry_limit || runtimeConfig.retryLimit || 2),
    priority: notification.category === "party" ? 6 : 5,
    sourceApp: "aleta_bot",
    sourceFeature: "dynamic_notification_scheduler",
    entityType: "notification",
    entityId: notificationKey,
    attachment,
    metadata: {
      sourceApp: "aleta_bot",
      sourceFeature: "dynamic_notification_scheduler",
      messageContractVersion: "aleta-template-v1",
      messageContractSource: "dynamic_notification_scheduler",
      messageContractTraceId: idempotencyKey,
      messageSha256: hashMessageBody(message),
      messageLength: message.length,
      renderedAt: new Date().toISOString(),
      notificationId: notificationKey,
      queryId: getQueryId(query),
      templateId: getTemplateId(template),
      recipientNumber: numberValidation.normalized,
      recipientName,
      recipientRole: values.recipient_role || "",
      recipientValidationScore: recipientValidation?.score ?? null,
      recipientValidationSeverity: recipientValidation?.severity || "",
      recipientValidationIssues: recipientValidation?.issues || [],
      recipientValidationWarnings: recipientValidation?.warnings || [],
      nomorPerkara: values.nomor_perkara || "",
      eventKey,
      eventDate,
      sourceUpdatedAt: values.source_updated_at || "",
      fileHash,
      hasAttachment: Boolean(attachment),
      recipientGroup: getRecipientMapping(notification).audienceGroup || getRecipientMapping(notification).recipientGroup || "",
      legacyFunctions: parseLegacyNotifikasiRefs(getSqlText(query)),
      dryRun: Boolean(runtimeConfig.dryRunEnabled),
    },
  });
}

async function runEmployeeNotification(runtimeConfig, notification, query, template) {
  const cache = new Map();
  const recipients = getEmployeeRecipients(runtimeConfig, notification);
  const maxRecipients = getMaxRecipientsPerRun(runtimeConfig, notification);
  const recipientIndex = buildRecipientNumberIndex(recipients);
  const strictRecipientValidation = runtimeConfig.strictRecipientValidation === true;
  const seen = new Set();
  let queuedCount = 0;
  let skippedCount = 0;

  for (const recipient of recipients) {
    const recipientNumber = getRecipientNumber(recipient);
    const recipientName = getRecipientName(recipient);
    const numberValidation = analyzeRecipientNumber(recipientNumber, {
      recipient,
      recipientType: "employee",
      recipientRole: recipient.positionName || recipient.position_name || recipient.roleId || recipient.role_id || "",
      numberIndex: recipientIndex,
      strict: strictRecipientValidation,
    });
    if (!numberValidation.allowed) {
      skippedCount += 1;
      await logSchedulerSkip({
        notification,
        query,
        reason: "recipient_validation_failed",
        recipientType: "employee",
        metadata: {
          recipientName,
          score: numberValidation.score,
          severity: numberValidation.severity,
          reason: numberValidation.reason,
          issues: numberValidation.issues,
          warnings: numberValidation.warnings,
        },
      });
      continue;
    }
    if (queuedCount >= maxRecipients) {
      skippedCount += 1;
      await logSchedulerSkip({
        notification,
        query,
        reason: "recipient_limit_reached",
        recipientType: "employee",
        metadata: { maxRecipients },
      });
      continue;
    }
    const result = await runQuery(query, recipient, cache, { maxRows: maxRecipients });
    if (!result.text) {
      skippedCount += 1;
      continue;
    }
    const values = {
      ...normalizeNotificationValues({
        row: {
          ringkasan: result.text,
          event_key: getNotificationId(notification),
        },
        recipient,
        notification,
        query,
        recipientNumber: numberValidation.normalized,
        recipientName,
      }),
      mode: runtimeConfig.dryRunEnabled ? "dry-run" : "live",
    };
    const batchKey = buildBatchRecipientKey(numberValidation.normalized, values, notification);
    if (seen.has(batchKey)) {
      skippedCount += 1;
      await logSchedulerSkip({
        notification,
        query,
        reason: "duplicate_recipient_in_batch",
        recipientType: "employee",
        metadata: { recipientName },
      });
      continue;
    }
    seen.add(batchKey);
    try {
      await enqueueNotificationMessage({
        runtimeConfig,
        notification,
        query,
        template,
        recipientNumber: numberValidation.chatId,
        recipientName,
        values,
        recipientValidation: numberValidation,
      });
      queuedCount += 1;
    } catch (error) {
      skippedCount += 1;
      await logSchedulerSkip({
        notification,
        query,
        reason: error.message.includes("Placeholder") ? "template_render_failed" : "enqueue_failed",
        recipientType: "employee",
        metadata: { recipientName, errorMessage: error.message },
      });
    }
  }

  return { totalTargets: recipients.length, queuedCount, skippedCount };
}

async function runPartyNotification(runtimeConfig, notification, query, template) {
  const cache = new Map();
  const maxRecipients = getMaxRecipientsPerRun(runtimeConfig, notification);
  const result = await runQuery(query, null, cache, { maxRows: maxRecipients });
  const rows = result.rows;
  const recipientIndex = buildRecipientNumberIndex(rows.map((row) => ({
    ...row,
    recipientNumber: getPartyRecipientNumber(row, query, notification),
    recipientName: row.nama_pihak || row.nama || "",
    recipientRole: firstExistingValue(row, STANDARD_COLUMN_ALIASES.recipient_role),
  })));
  const strictRecipientValidation = runtimeConfig.strictRecipientValidation === true;
  const seen = new Set();
  let queuedCount = 0;
  let skippedCount = 0;

  // Tahap pengingat (h3/h1) menentukan apakah sebuah agenda layak diingatkan
  // pada jarak hari ini. Notifikasi tanpa agendaStage berperilaku seperti
  // sebelumnya: seluruh baris dikirim.
  const agendaStage = String(getScheduleConfig(notification).agendaStage || "").trim();

  for (const row of rows) {
    if (agendaStage) {
      const agenda = firstExistingValue(row, STANDARD_COLUMN_ALIASES.agenda);
      if (!sidangAgendaService.shouldRemind(agenda, agendaStage, runtimeConfig)) {
        skippedCount += 1;
        await logSchedulerSkip({
          notification,
          query,
          reason: "agenda_tidak_perlu_diingatkan",
          recipientType: "party",
          metadata: {
            agendaStage,
            agenda,
            kelasAgenda: sidangAgendaService.reminderPlan(agenda, runtimeConfig).classes,
            nomorPerkara: firstExistingValue(row, STANDARD_COLUMN_ALIASES.nomor_perkara),
          },
        });
        continue;
      }
    }
    const recipientNumber = getPartyRecipientNumber(row, query, notification);
    if (!recipientNumber) {
      skippedCount += 1;
      await logSchedulerSkip({
        notification,
        query,
        reason: "missing_recipient_number",
        recipientType: "party",
        metadata: {
          rowPreview: rowToText(row).slice(0, 240),
        },
      });
      continue;
    }
    const numberValidation = analyzeRecipientNumber(recipientNumber, {
      recipient: row,
      recipientType: "party",
      recipientRole: firstExistingValue(row, STANDARD_COLUMN_ALIASES.recipient_role),
      nomorPerkara: firstExistingValue(row, STANDARD_COLUMN_ALIASES.nomor_perkara),
      numberIndex: recipientIndex,
      strict: strictRecipientValidation,
    });
    if (!numberValidation.allowed) {
      skippedCount += 1;
      await logSchedulerSkip({
        notification,
        query,
        reason: "recipient_validation_failed",
        recipientType: "party",
        metadata: {
          recipientName: row.nama_pihak || row.nama || "",
          score: numberValidation.score,
          severity: numberValidation.severity,
          reason: numberValidation.reason,
          issues: numberValidation.issues,
          warnings: numberValidation.warnings,
        },
      });
      continue;
    }
    if (queuedCount >= maxRecipients) {
      skippedCount += 1;
      await logSchedulerSkip({
        notification,
        query,
        reason: "recipient_limit_reached",
        recipientType: "party",
        metadata: { maxRecipients },
      });
      continue;
    }
    const values = {
      ...normalizeNotificationValues({
        row,
        recipient: null,
        notification,
        query,
        recipientNumber: numberValidation.normalized,
        recipientName: row.nama_pihak || row.nama || getNotificationName(notification),
      }),
      mode: runtimeConfig.dryRunEnabled ? "dry-run" : "live",
    };
    const batchKey = buildBatchRecipientKey(numberValidation.normalized, values, notification);
    if (seen.has(batchKey)) {
      skippedCount += 1;
      await logSchedulerSkip({
        notification,
        query,
        reason: "duplicate_recipient_in_batch",
        recipientType: "party",
        metadata: {
          recipientName: values.nama_pihak,
          nomorPerkara: values.nomor_perkara || values.perkara_id || "",
        },
      });
      continue;
    }
    seen.add(batchKey);
    try {
      await enqueueNotificationMessage({
        runtimeConfig,
        notification,
        query,
        template,
        recipientNumber: numberValidation.chatId,
        recipientName: values.nama_pihak,
        values,
        recipientValidation: numberValidation,
      });
      queuedCount += 1;
    } catch (error) {
      skippedCount += 1;
      await logSchedulerSkip({
        notification,
        query,
        reason: error.message.includes("Placeholder") ? "template_render_failed" : "enqueue_failed",
        recipientType: "party",
        metadata: {
          recipientName: values.nama_pihak,
          nomorPerkara: values.nomor_perkara || values.perkara_id || "",
          errorMessage: error.message,
        },
      });
    }
  }

  return { totalTargets: rows.length, queuedCount, skippedCount };
}

async function runDynamicNotification(notificationId) {
  const startedAt = new Date();
  const runtimeConfig = readRuntimeConfig();
  const notification = (runtimeConfig.notifications || []).find((item) => getNotificationId(item) === notificationId);
  if (!notification || !notification.isActive) return null;

  if (!runtimeConfig.botEnabled || !runtimeConfig.notificationsEnabled) {
    await logService.logNotificationRun({
      notificationKey: notificationId,
      category: notification.category || "employee",
      status: "skipped",
      startedAt,
      finishedAt: new Date(),
      skippedCount: 1,
      metadata: {
        reason: !runtimeConfig.botEnabled ? "bot_disabled" : "notifications_disabled",
        source: "dynamic_notification_scheduler",
      },
    });
    return null;
  }

  const queryId = getNotificationQueryId(notification);
  const templateId = getNotificationTemplateId(notification);
  const query = (runtimeConfig.queries || []).find((item) => getQueryId(item) === queryId || item.name === queryId);
  const template = (runtimeConfig.templates || []).find((item) => getTemplateId(item) === templateId);

  if (!query) throw new Error(`Sumber data notifikasi tidak ditemukan: ${queryId}`);
  if (!template) throw new Error(`Isi pesan notifikasi tidak ditemukan: ${templateId}`);
  await validateNotificationContract(notification, query, template);

  const result = notification.category === "party"
    ? await runPartyNotification(runtimeConfig, notification, query, template)
    : await runEmployeeNotification(runtimeConfig, notification, query, template);

  await logService.logNotificationRun({
    notificationKey: notificationId,
    category: notification.category || "employee",
    status: result.queuedCount > 0 ? "success" : "skipped",
    totalTargets: result.totalTargets,
    queuedCount: result.queuedCount,
    skippedCount: result.skippedCount,
    startedAt,
    finishedAt: new Date(),
    metadata: {
      source: "dynamic_notification_scheduler",
      queryId,
      templateId,
      recipientGroup: getRecipientMapping(notification).audienceGroup || getRecipientMapping(notification).recipientGroup || "",
    },
  });

  return result;
}

async function runDynamicNotificationSafely(notificationId) {
  try {
    return await runDynamicNotification(notificationId);
  } catch (error) {
    lastError = error.message;
    await logService.logNotificationRun({
      notificationKey: notificationId,
      category: "notification",
      status: "failed",
      startedAt: new Date(),
      finishedAt: new Date(),
      errorMessage: error.message,
      metadata: { source: "dynamic_notification_scheduler" },
    });
    await logService.logSystemEvent({
      eventType: "dynamic_notification_scheduler_failed",
      severity: "error",
      message: "Scheduler dinamis ALETA Bot gagal memproses notifikasi.",
      metadata: { notificationId, errorMessage: error.message },
    });
    return null;
  }
}

function buildScheduleSignature(notification) {
  const schedule = getScheduleConfig(notification);
  return JSON.stringify({
    id: getNotificationId(notification),
    active: Boolean(notification.isActive),
    category: notification.category || "employee",
    cron: schedule.cron || "",
    queryId: getNotificationQueryId(notification),
    templateId: getNotificationTemplateId(notification),
    mapping: getRecipientMapping(notification),
  });
}

function refreshSchedules() {
  const runtimeConfig = readRuntimeConfig();
  const notifications = Array.isArray(runtimeConfig.notifications) ? runtimeConfig.notifications : [];
  const desired = new Map();

  for (const notification of notifications) {
    const id = getNotificationId(notification);
    const schedule = getScheduleConfig(notification);
    if (!id || !notification.isActive || schedule.type !== "cron") continue;
    const cronExpressions = listCronExpressions(schedule.cron);
    for (const [index, cronExpression] of cronExpressions.entries()) {
      if (!cron.validate(cronExpression)) {
        lastError = `Cron tidak valid untuk ${id}: ${cronExpression}`;
        continue;
      }
      desired.set(`${id}:${index}:${cronExpression}`, {
        notificationId: id,
        cronExpression,
        signature: buildScheduleSignature(notification),
      });
    }
  }

  for (const [key, task] of scheduledTasks.entries()) {
    const next = desired.get(key);
    if (!next || next.signature !== task.signature) {
      task.task.stop();
      scheduledTasks.delete(key);
    }
  }

  for (const [key, item] of desired.entries()) {
    if (scheduledTasks.has(key)) continue;
    const task = cron.schedule(item.cronExpression, () => {
      void runDynamicNotificationSafely(item.notificationId);
    }, { timezone: DYNAMIC_CRON_TIMEZONE });
    scheduledTasks.set(key, { ...item, task });
  }

  lastRefreshAt = new Date().toISOString();
  return getSchedulerStatus();
}

function startDynamicNotificationScheduler() {
  if (refreshTimer) return getSchedulerStatus();
  refreshSchedules();
  refreshTimer = setInterval(() => {
    try {
      refreshSchedules();
    } catch (error) {
      lastError = error.message;
      void logService.logSystemEvent({
        eventType: "dynamic_notification_scheduler_refresh_failed",
        severity: "error",
        message: "Refresh scheduler dinamis ALETA Bot gagal.",
        metadata: { errorMessage: error.message },
      });
    }
  }, 30000);
  return getSchedulerStatus();
}

function stopDynamicNotificationScheduler() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  for (const task of scheduledTasks.values()) task.task.stop();
  scheduledTasks.clear();
  return getSchedulerStatus();
}

function getSchedulerStatus() {
  return {
    running: Boolean(refreshTimer),
    scheduledCount: scheduledTasks.size,
    lastRefreshAt,
    lastError,
    schedules: [...scheduledTasks.values()].map((item) => ({
      notificationId: item.notificationId,
      cron: item.cronExpression,
    })),
  };
}

module.exports = {
  startDynamicNotificationScheduler,
  stopDynamicNotificationScheduler,
  refreshSchedules,
  getSchedulerStatus,
  runDynamicNotificationSafely,
  healthCheckSourceQuery,
  // Dipakai Kirim Manual untuk menjalankan sumber data (termasuk legacy) secara read-only.
  runSourceQuery: runQuery,
  normalizeLegacyEmployeeName,
  // Diekspor untuk verifikasi pencocokan role (scripts/verify-role-mapping.js).
  recipientMatchesHints,
  expandRoleIds,
  IMPLICIT_ROLE_IDS,
};
