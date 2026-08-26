"use strict";

const { readRuntimeConfig } = require("../config/runtime-config");
const externalDbService = require("./externalDbService");
const logService = require("./logService");
const { renderTemplate } = require("./templateService");
const { rowToHumanText } = require("./humanTextService");
const { validateQuery, normalizeSqlForExecution } = require("./queryValidatorService");
const {
  getLegacyNotifikasiQueryCatalog,
  legacyNotifikasiLabel,
  legacyNotifikasiQueryId,
  parseLegacyNotifikasiRefs,
  resolveLegacyNotifikasiFunctions,
} = require("./legacy/legacyQueryCatalog");

const DIRECT_COMMANDS = new Set([
  "query",
  "sumber data",
  "sumber-data",
  "aleta query",
  "aleta sumber data",
  "notifikasi",
]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s#./:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .replace(/^legacy:notifikasi[.:]/, "notifikasi.")
    .replace(/^legacy-notifikasi-/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function splitCommand(message) {
  return String(message || "")
    .split("#")
    .map((item) => item.trim());
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getQueryId(query = {}) {
  return String(query.id || query.key || query.name || "").trim();
}

function getTemplateId(template = {}) {
  return String(template.id || template.key || "").trim();
}

function getSqlText(query = {}) {
  return String(query.sqlText || query.sql_text || "").trim();
}

function getOutputColumns(query = {}) {
  if (Array.isArray(query.outputColumns)) return query.outputColumns;
  if (Array.isArray(query.output_columns)) return query.output_columns;
  return normalizeArray(query.outputColumns || query.output_columns_json);
}

function getIntentKey(intent = {}) {
  return String(intent.key || intent.id || "").trim();
}

function isIntentActive(intent = {}) {
  return Boolean(intent.isActive ?? intent.is_active ?? true) && String(intent.status || "active") !== "archived";
}

function getIntentQueryKey(intent = {}) {
  return String(intent.queryKey || intent.query_key || "").trim();
}

function getIntentTemplateKey(intent = {}) {
  return String(intent.templateKey || intent.template_key || "").trim();
}

function getIntentResponseMode(intent = {}) {
  return String(intent.responseMode || intent.response_mode || "").trim();
}

function getIntentAudience(intent = {}) {
  return String(intent.audience || "public").trim().toLowerCase();
}

function getIntentTriggers(intent = {}) {
  return normalizeArray(intent.exactTriggers || intent.exact_triggers_json);
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

function phoneMatches(left, right) {
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

function isAuthorizedSender(runtimeConfig, context = {}) {
  const sender = context.senderNumber || context.from || "";
  if (!sender) return false;
  if (phoneMatches(sender, runtimeConfig.adminWhatsappChatId) || phoneMatches(sender, runtimeConfig.adminWhatsappNumber)) {
    return true;
  }
  return (runtimeConfig.employeeRecipients || []).some((recipient) =>
    phoneMatches(sender, recipient.whatsappChatId || recipient.whatsapp_chat_id || recipient.whatsappNumber || recipient.whatsapp_number)
  );
}

function isEmployeeOrAdminAudience(intent = {}) {
  return ["employee", "admin", "internal", "pegawai"].includes(getIntentAudience(intent));
}

function buildLegacyCatalogQueries() {
  return getLegacyNotifikasiQueryCatalog().map((query) => ({
    ...query,
    key: query.id,
  }));
}

function listRuntimeQueries(runtimeConfig = {}) {
  const configured = Array.isArray(runtimeConfig.queries) ? runtimeConfig.queries : [];
  const byId = new Map();
  for (const query of [...configured, ...buildLegacyCatalogQueries()]) {
    const id = getQueryId(query);
    if (!id || byId.has(id)) continue;
    byId.set(id, query);
  }
  return [...byId.values()];
}

function findQuery(runtimeConfig, queryKey) {
  const raw = String(queryKey || "").trim();
  if (!raw) return null;
  const wanted = normalizeKey(raw);
  const queries = listRuntimeQueries(runtimeConfig);
  const found = queries.find((query) => {
    const sqlText = getSqlText(query);
    const refs = parseLegacyNotifikasiRefs(sqlText);
    const names = [
      query.id,
      query.key,
      query.name,
      query.label,
      query.exportName,
      sqlText,
      ...refs,
      ...refs.map((name) => `notifikasi.${name}`),
      ...refs.map(legacyNotifikasiQueryId),
    ];
    return names.some((name) => normalizeKey(name) === wanted);
  });
  if (found) return found;

  const exportName = raw.replace(/^notifikasi\./i, "").replace(/^legacy:notifikasi[.:]/i, "");
  if (/^get[A-Za-z0-9_]+$/.test(exportName)) {
    return {
      id: legacyNotifikasiQueryId(exportName),
      key: legacyNotifikasiQueryId(exportName),
      name: `notifikasi.${exportName}`,
      exportName,
      sqlText: `legacy:notifikasi.${exportName}`,
      outputColumns: ["judul_notifikasi", "ringkasan", "waktu", "mode"],
      category: "employee",
    };
  }

  return null;
}

function findTemplate(runtimeConfig = {}, templateKey = "") {
  const wanted = normalizeKey(templateKey);
  if (!wanted) return null;
  return (runtimeConfig.templates || []).find((template) =>
    [template.id, template.key, template.name].some((value) => normalizeKey(value) === wanted)
  ) || null;
}

/**
 * Baris data -> teks balasan chat. Sama seperti notifikasi terjadwal, jawaban
 * perintah juga tidak boleh menampilkan nama kolom mentah ke penanya.
 */
function rowToText(row) {
  return rowToHumanText(row);
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
    return value.map((row) => rowToText(row)).filter(Boolean).join("\n\n");
  }
  if (typeof value === "object") {
    const arrays = Object.values(value).filter(Array.isArray);
    if (arrays.length > 0) {
      return arrays.flat().map((row) => rowToText(row)).filter(Boolean).join("\n\n");
    }
    return rowToText(value);
  }
  return String(value);
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

function buildParameter(parts, context = {}) {
  const explicit = parts.slice(2).join("#").trim();
  return explicit || context.parameter || context.senderName || "";
}

async function runLegacyNotifikasiQuery(query, parameter = "") {
  const refs = resolveLegacyNotifikasiFunctions(getSqlText(query));
  const rows = [];
  const sections = [];

  for (const ref of refs) {
    if (ref.arity > 0 && !parameter) {
      sections.push({
        exportName: ref.exportName,
        title: legacyNotifikasiLabel(ref.exportName),
        count: 0,
        text: `Sumber data ini membutuhkan parameter. Contoh: query#notifikasi.${ref.exportName}#Nama Pegawai`,
      });
      continue;
    }

    const value = await ref.fn(...(ref.arity > 0 ? [parameter] : []));
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

async function runSqlQuery(query) {
  const sqlText = getSqlText(query);
  const validation = validateQuery(sqlText, {
    category: query.category || "system",
    recipientColumn: query.recipientColumn || query.recipient_column || "",
    outputColumns: getOutputColumns(query),
  });
  if (!validation.valid || !validation.safeForPreview) {
    throw new Error(`Query SQL tidak valid untuk balasan dinamis: ${validation.errors.join(", ") || validation.warnings.join(", ")}`);
  }
  const rows = await externalDbService.query(query.connectionKey || query.connection_key || "sipp_primary", validation.previewSql || sqlText);
  return {
    text: (Array.isArray(rows) ? rows : []).map((row) => rowToText(row)).filter(Boolean).join("\n\n"),
    rows: Array.isArray(rows) ? rows : [],
    sections: [],
  };
}

async function runQuery(query, parameter = "") {
  const sqlText = getSqlText(query);
  const normalizedSql = normalizeSqlForExecution(sqlText).sql;
  if (/^legacy:notifikasi[.:]/i.test(sqlText)) return runLegacyNotifikasiQuery(query, parameter);
  if (/^\s*(select|with)\b/i.test(normalizedSql)) return runSqlQuery(query);
  throw new Error(`Sumber data belum didukung query.js: ${sqlText.slice(0, 80)}`);
}

function renderAnswer({ template, query, intent, result, context = {}, parameter = "" }) {
  const firstRow = Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : {};
  const values = {
    ...firstRow,
    judul_notifikasi: intent?.name || query.name || query.label || "Sumber Data ALETA",
    nama_pegawai: firstRow.nama_pegawai || context.senderName || parameter || "Pegawai",
    nama_pihak: firstRow.nama_pihak || firstRow.nama || context.senderName || parameter || "Bapak/Ibu",
    ringkasan: result.text || "Tidak ada data",
    waktu: new Date().toLocaleString("id-ID"),
    mode: "balasan_whatsapp",
  };

  if (template && String(template.body || "").trim()) {
    try {
      return renderTemplate(template, values);
    } catch (error) {
      return `*_Hai, saya Aleta, berikut data keadaan perkara:_*\n\n${values.ringkasan}`;
    }
  }

  return `*_Hai, saya Aleta, berikut data keadaan perkara:_*\n\n${values.ringkasan}`;
}

function findIntentForMessage(runtimeConfig, message, context = {}) {
  const command = normalizeText(splitCommand(message)[0]);
  if (!command) return null;

  const intents = (runtimeConfig.publicQaIntents || [])
    .filter(isIntentActive)
    .filter((intent) => getIntentResponseMode(intent) === "query_template")
    .filter((intent) => getIntentQueryKey(intent));

  for (const intent of intents) {
    const triggerMatches = getIntentTriggers(intent).some((trigger) => normalizeText(trigger) === command);
    const keyMatches = normalizeText(getIntentKey(intent)) === command;
    const commandMatches = normalizeText(intent.legacyCommand || intent.legacy_command || "") === command;
    if (!triggerMatches && !keyMatches && !commandMatches) continue;
    if (isEmployeeOrAdminAudience(intent) && !isAuthorizedSender(runtimeConfig, context)) {
      return { intent, unauthorized: true };
    }
    return { intent, unauthorized: false };
  }
  return null;
}

async function executeQueryKey(runtimeConfig, queryKey, { templateKey = "", intent = null, parameter = "", context = {} } = {}) {
  const query = findQuery(runtimeConfig, queryKey);
  if (!query) return `Sumber data tidak ditemukan: ${queryKey}`;

  const template = findTemplate(runtimeConfig, templateKey);
  const result = await runQuery(query, parameter);
  return renderAnswer({ template, query, intent, result, context, parameter });
}

async function resolveDynamicQueryCommand(message, context = {}) {
  const runtimeConfig = readRuntimeConfig();
  const parts = splitCommand(message);
  const command = normalizeText(parts[0]);
  if (!command) return null;

  const intentMatch = findIntentForMessage(runtimeConfig, message, context);
  if (intentMatch?.unauthorized) {
    return "Perintah sumber data internal hanya dapat digunakan oleh nomor pegawai yang terdaftar.";
  }
  if (intentMatch?.intent) {
    const queryKey = getIntentQueryKey(intentMatch.intent);
    try {
      return await executeQueryKey(runtimeConfig, queryKey, {
        templateKey: getIntentTemplateKey(intentMatch.intent),
        intent: intentMatch.intent,
        parameter: buildParameter(parts, context),
        context,
      });
    } catch (error) {
      await logService.logQueryError({
        eventType: "dynamic_query_intent_failed",
        message: "Eksekusi intent sumber data dinamis dari query.js gagal.",
        metadata: {
          queryKey,
          intentKey: getIntentKey(intentMatch.intent),
          errorMessage: error.message,
        },
      }).catch(() => null);
      return `Sumber data gagal dijalankan: ${error.message}`;
    }
  }

  if (!DIRECT_COMMANDS.has(command)) return null;
  if (!context.allowDynamicQuery && !isAuthorizedSender(runtimeConfig, context)) {
    return "Perintah sumber data hanya dapat digunakan oleh nomor admin/pegawai yang terdaftar.";
  }

  const queryKey = command === "notifikasi" && parts[1] && !/^notifikasi\./i.test(parts[1])
    ? `notifikasi.${parts[1]}`
    : parts[1];
  if (!queryKey) {
    return "Format perintah sumber data: query#notifikasi.NamaFungsi atau query#id_sumber_data.";
  }

  try {
    return await executeQueryKey(runtimeConfig, queryKey, {
      templateKey: context.dynamicTemplateKey || getIntentTemplateKey(context.publicQaIntent || {}),
      intent: context.publicQaIntent || null,
      parameter: buildParameter(parts, context),
      context,
    });
  } catch (error) {
    await logService.logQueryError({
      eventType: "dynamic_query_command_failed",
      message: "Eksekusi sumber data dinamis dari query.js gagal.",
      metadata: {
        queryKey,
        legacyFunctions: parseLegacyNotifikasiRefs(String(queryKey || "")),
        errorMessage: error.message,
      },
    }).catch(() => null);
    return `Sumber data gagal dijalankan: ${error.message}`;
  }
}

module.exports = {
  resolveDynamicQueryCommand,
};
