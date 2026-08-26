"use strict";

const { validateWhatsappNumber } = require("../utils/phoneFormatter");
const blockedRecipientService = require("./blockedRecipientService");

const BLOCKING_ISSUES = new Set([
  "empty_number",
  "invalid_indonesian_number",
  "too_short",
  "too_long",
  "dummy_number",
  "inactive_employee",
  "akun_diblokir_nomor",
  "akun_diblokir_nama",
]);

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getRecipientNumber(item) {
  if (!item || typeof item !== "object") return String(item || "");
  return (
    item.recipientNumber ||
    item.recipient_number ||
    item.whatsappChatId ||
    item.whatsapp_chat_id ||
    item.whatsappNumber ||
    item.whatsapp_number ||
    item.nomor_whatsapp ||
    item.nomor_wa ||
    item.no_hp ||
    item.telepon ||
    item.phone ||
    ""
  );
}

function getRecipientName(item) {
  if (!item || typeof item !== "object") return "";
  return String(item.recipientName || item.recipient_name || item.nama_pihak || item.nama_pegawai || item.name || item.nama || item.username || "");
}

function getRecipientRole(item) {
  if (!item || typeof item !== "object") return "";
  return String(
    item.recipientRole ||
      item.recipient_role ||
      item.roleId ||
      item.role_id ||
      item.positionName ||
      item.position_name ||
      item.jabatan ||
      item.jabatan_unit ||
      item.kategori_pihak ||
      item.jenis_pihak ||
      ""
  );
}

function getCaseNumber(item) {
  if (!item || typeof item !== "object") return "";
  return String(item.nomor_perkara || item.no_perkara || item.perkara_nomor || item.case_number || "");
}

function isInactiveRecipient(item) {
  if (!item || typeof item !== "object") return false;
  const value = item.isActive ?? item.is_active ?? item.active ?? item.enabled;
  if (value === undefined || value === null || value === "") return false;
  return value === false || value === 0 || value === "0" || normalizeText(value) === "false" || normalizeText(value) === "nonaktif";
}

function roleKind(role) {
  const value = normalizeText(role);
  if (!value) return "";
  if (value.includes("kuasa")) return "kuasa";
  if (value.includes("penggugat")) return "penggugat";
  if (value.includes("tergugat")) return "tergugat";
  if (value.includes("intervensi")) return "intervensi";
  if (value.includes("turut")) return "turut_tergugat";
  if (value.includes("pihak")) return "pihak";
  if (value.includes("hakim")) return "hakim";
  if (value.includes("panitera")) return "panitera";
  if (value.includes("jurusita") || value.includes("juru sita")) return "jurusita";
  if (value.includes("kasir")) return "kasir";
  if (value.includes("pegawai") || value.includes("admin")) return "pegawai";
  return value.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function isSequentialDummy(localNumber) {
  const digits = String(localNumber || "").replace(/\D/g, "");
  return (
    digits.includes("08123456789") ||
    digits.includes("08987654321") ||
    /^08?1234567890?$/.test(digits) ||
    /^6281234567890?$/.test(digits)
  );
}

function isDummyNumber(normalizedNumber) {
  const normalized = String(normalizedNumber || "");
  const local = normalized.startsWith("62") ? `0${normalized.slice(2)}` : normalized;
  const subscriber = local.replace(/^08/, "");

  if (!normalized) return false;
  if (isSequentialDummy(local)) return true;
  if (/^(.)\1{6,}$/.test(subscriber)) return true;
  if (/(0000000|1111111|2222222|3333333|4444444|5555555|6666666|7777777|8888888|9999999)$/.test(local)) return true;
  return false;
}

function buildRecipientNumberIndex(items = []) {
  const rows = (Array.isArray(items) ? items : []).map((item, index) => {
    const validation = validateWhatsappNumber(getRecipientNumber(item));
    return {
      index,
      item,
      valid: validation.valid,
      normalized: validation.normalized,
      chatId: validation.chatId,
      name: getRecipientName(item),
      role: getRecipientRole(item),
      roleKind: roleKind(getRecipientRole(item)),
      nomorPerkara: getCaseNumber(item),
      inactive: isInactiveRecipient(item),
    };
  });

  const byNumber = new Map();
  for (const row of rows) {
    if (!row.valid || !row.normalized) continue;
    const current = byNumber.get(row.normalized) || [];
    current.push(row);
    byNumber.set(row.normalized, current);
  }

  return { rows, byNumber };
}

function analyzeSharedNumber({ normalized, role, nomorPerkara, numberIndex }) {
  if (!numberIndex?.byNumber || !normalized) return { issues: [], warnings: [], duplicateCount: 0 };
  const matches = numberIndex.byNumber.get(normalized) || [];
  if (matches.length <= 1) return { issues: [], warnings: [], duplicateCount: matches.length };

  const roleKinds = new Set(matches.map((item) => item.roleKind).filter(Boolean));
  const caseNumbers = new Set(matches.map((item) => normalizeText(item.nomorPerkara)).filter(Boolean));
  const currentRoleKind = roleKind(role);
  const currentCase = normalizeText(nomorPerkara);
  const issues = ["shared_number"];
  const warnings = [];

  if (roleKinds.size > 1) {
    warnings.push("Nomor yang sama dipakai oleh lebih dari satu jenis penerima.");
  }
  if (roleKinds.has("kuasa") && [...roleKinds].some((item) => item && item !== "kuasa")) {
    issues.push("role_number_conflict");
    warnings.push("Nomor kuasa hukum terdeteksi sama dengan nomor pihak/pegawai lain.");
  }
  if (currentRoleKind && roleKinds.size > 0 && !roleKinds.has(currentRoleKind)) {
    issues.push("expected_role_mismatch");
  }
  if (currentCase && caseNumbers.size > 1) {
    warnings.push("Nomor yang sama dipakai pada lebih dari satu nomor perkara dalam batch ini.");
  }

  return { issues, warnings, duplicateCount: matches.length };
}

function analyzeRecipientNumber(input, context = {}) {
  const strict = context.strict === true;
  const recipient = context.recipient || {};
  const validation = validateWhatsappNumber(input);
  const issues = [];
  const warnings = [];
  let score = 100;

  if (!validation.valid) {
    const issue = validation.reason || "invalid_indonesian_number";
    return {
      valid: false,
      allowed: false,
      score: 0,
      severity: "blocked",
      normalized: "",
      chatId: "",
      reason: issue,
      issues: [issue],
      warnings,
    };
  }

  const normalized = validation.normalized;
  const localLength = normalized.startsWith("62") ? normalized.length - 2 : normalized.length;
  if (localLength < 9) {
    issues.push("too_short");
    score = 0;
  }
  if (normalized.length > 15) {
    issues.push("too_long");
    score = 0;
  }
  if (isDummyNumber(normalized)) {
    issues.push("dummy_number");
    score = 0;
  }
  if (context.recipientType === "employee" && isInactiveRecipient(recipient)) {
    issues.push("inactive_employee");
    score = 0;
  }

  // Akun yang diblokir di portal ditandai di sini juga, bukan hanya saat
  // pengiriman, supaya admin melihatnya lebih dulu di pratinjau Kirim Manual
  // dan tidak bingung kenapa jumlah terkirim lebih sedikit dari daftar.
  const alasanBlokir = blockedRecipientService.getBlockReason({
    number: normalized,
    name: context.recipientName || getRecipientName(recipient),
  });
  if (alasanBlokir) {
    issues.push(alasanBlokir);
    score = 0;
  }

  const shared = analyzeSharedNumber({
    normalized,
    role: context.recipientRole || getRecipientRole(recipient),
    nomorPerkara: context.nomorPerkara || getCaseNumber(recipient),
    numberIndex: context.numberIndex,
  });

  if (shared.duplicateCount > 1) {
    score -= Math.min(35, 10 * (shared.duplicateCount - 1));
    issues.push(...shared.issues);
    warnings.push(...shared.warnings);
  }

  const blocking = issues.some((issue) => BLOCKING_ISSUES.has(issue)) || (strict && issues.length > 0);
  const finalScore = Math.max(0, Math.min(100, score));
  const severity = blocking ? "blocked" : finalScore < 70 || warnings.length > 0 ? "warning" : "ok";

  return {
    valid: !blocking,
    allowed: !blocking,
    score: blocking ? 0 : finalScore,
    severity,
    normalized,
    chatId: validation.chatId,
    reason: blocking ? issues[0] || "recipient_validation_failed" : "",
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
  };
}

module.exports = {
  analyzeRecipientNumber,
  buildRecipientNumberIndex,
  isDummyNumber,
};
