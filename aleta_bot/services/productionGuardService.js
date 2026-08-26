const crypto = require("crypto");

const DEFAULT_PRODUCTION_CAPS = {
  maxRecipientsPerEvent: 5,
  maxMessagesPerBatch: 10,
  maxMessagesPerMinute: 5,
  maxMessagesPerHour: 20,
  maxMessagesPerDay: 50,
  broadcastRequiresApproval: true,
  externalNotificationRequiresApproval: true,
  massResendRequiresApproval: true,
  outlierRequiresApproval: true,
};

const HIGH_RISK_CATEGORIES = new Set(["party", "external", "broadcast", "mass_resend"]);
const INTERNAL_CATEGORIES = new Set(["employee", "pegawai", "notification", "disposition", "letter", "task"]);
const TEMPLATE_CONTRACT_SOURCES = new Set([
  "portal_template_renderer",
  "dynamic_notification_scheduler",
  "notification_registry",
]);
const DRY_RUN_WORDING = /\b(simulasi|dry-run|dry run|validation only|do not send|pesan test|uji coba)\b/i;

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function maskPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length < 8) return "";
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function hashPhone(value) {
  const phone = normalizePhone(value);
  if (!phone) return "";
  return crypto.createHash("sha256").update(phone).digest("hex").slice(0, 16);
}

function isValidIndonesianPhone(value) {
  return /^62\d{8,15}$/.test(normalizePhone(value));
}

function isDummyPhone(value) {
  const digits = normalizePhone(value);
  if (!digits) return true;
  if (/^62812345\d{4}$/.test(digits)) return true;
  if (/^628123456789\d*$/.test(digits)) return true;
  if (/^62123456789\d*$/.test(digits)) return true;
  if (/^62(0{8,}|1{8,}|2{8,}|8{8,}|9{8,})$/.test(digits)) return true;
  if (/^(62)?(\d)\2{8,}$/.test(digits)) return true;
  return false;
}

function isActiveInternalUser(user = {}) {
  if (user.deletedAt || user.deleted_at) return false;
  if (user.blockedAt || user.blocked_at) return false;
  if (user.isActive === false || user.is_active === false || user.is_active === 0) return false;
  const status = String(user.status || "").toLowerCase();
  if (["inactive", "blocked", "deleted", "disabled"].includes(status)) return false;
  return true;
}

function getProductionCaps(runtimeConfig = {}) {
  const configured = runtimeConfig.productionAutomationCaps || runtimeConfig.rateLimit || {};
  return {
    maxRecipientsPerEvent: Math.max(1, Number(configured.maxRecipientsPerEvent || DEFAULT_PRODUCTION_CAPS.maxRecipientsPerEvent)),
    maxMessagesPerBatch: Math.max(1, Number(configured.maxMessagesPerBatch || DEFAULT_PRODUCTION_CAPS.maxMessagesPerBatch)),
    maxMessagesPerMinute: Math.max(1, Number(configured.maxMessagesPerMinute || configured.maxPerMinute || DEFAULT_PRODUCTION_CAPS.maxMessagesPerMinute)),
    maxMessagesPerHour: Math.max(1, Number(configured.maxMessagesPerHour || configured.maxPerHour || DEFAULT_PRODUCTION_CAPS.maxMessagesPerHour)),
    maxMessagesPerDay: Math.max(1, Number(configured.maxMessagesPerDay || configured.maxPerDay || DEFAULT_PRODUCTION_CAPS.maxMessagesPerDay)),
    broadcastRequiresApproval: configured.broadcastRequiresApproval !== false,
    externalNotificationRequiresApproval: configured.externalNotificationRequiresApproval !== false,
    massResendRequiresApproval: configured.massResendRequiresApproval !== false,
    outlierRequiresApproval: configured.outlierRequiresApproval !== false,
  };
}

function analyzeEmployeeRecipients(recipients = [], options = {}) {
  const sharedExceptions = new Set(
    (options.allowSharedNumberExceptions || []).map((value) => normalizePhone(value)).filter(Boolean)
  );
  const activeRecipients = (Array.isArray(recipients) ? recipients : []).filter(isActiveInternalUser);
  const byPhone = new Map();
  const rows = activeRecipients.map((recipient) => {
    const phone = normalizePhone(recipient.whatsappNumber || recipient.whatsapp_number);
    if (phone) {
      if (!byPhone.has(phone)) byPhone.set(phone, []);
      byPhone.get(phone).push(recipient);
    }
    return {
      ...recipient,
      productionPhone: phone,
      productionPhoneMasked: maskPhone(phone),
      productionPhoneHash: hashPhone(phone),
    };
  });
  const duplicatePhones = new Set(
    Array.from(byPhone.entries())
      .filter(([phone, owners]) => owners.length > 1 && !sharedExceptions.has(phone))
      .map(([phone]) => phone)
  );

  const evaluated = rows.map((recipient) => {
    const reasons = [];
    if (!recipient.productionPhone) reasons.push("missing_number");
    if (recipient.productionPhone && !isValidIndonesianPhone(recipient.productionPhone)) reasons.push("invalid_format");
    if (recipient.productionPhone && isDummyPhone(recipient.productionPhone)) reasons.push("dummy_number");
    if (recipient.productionPhone && duplicatePhones.has(recipient.productionPhone)) reasons.push("duplicate_number");
    return {
      ...recipient,
      eligibleForWhatsappProduction: reasons.length === 0,
      whatsappProductionExclusionReasons: reasons,
    };
  });

  return {
    totalActive: activeRecipients.length,
    validCount: evaluated.filter((item) => item.eligibleForWhatsappProduction).length,
    invalidCount: evaluated.filter((item) => item.whatsappProductionExclusionReasons.includes("invalid_format")).length,
    dummyCount: evaluated.filter((item) => item.whatsappProductionExclusionReasons.includes("dummy_number")).length,
    duplicateGroupsCount: duplicatePhones.size,
    excludedCount: evaluated.filter((item) => !item.eligibleForWhatsappProduction).length,
    duplicateGroups: Array.from(duplicatePhones).map((phone) => ({
      phoneMasked: maskPhone(phone),
      phoneHash: hashPhone(phone),
      owners: (byPhone.get(phone) || []).map((owner) => ({
        id: owner.id || "",
        name: owner.name || owner.username || "",
        roleId: owner.roleId || owner.role_id || "",
        positionName: owner.positionName || owner.position_name || "",
      })),
    })),
    recipients: evaluated,
  };
}

function isHighRiskCategory(category) {
  return HIGH_RISK_CATEGORIES.has(String(category || "").toLowerCase());
}

function isInternalCategory(category) {
  return INTERNAL_CATEGORIES.has(String(category || "").toLowerCase());
}

function isNotificationContext(category) {
  const normalized = String(category || "").toLowerCase();
  return normalized === "party" || normalized === "notification" || isHighRiskCategory(normalized) || isInternalCategory(normalized);
}

function ensureRecipientEligibility({ recipient = {}, category = "employee", analysis } = {}) {
  if (!isInternalCategory(category) && !isHighRiskCategory(category)) {
    return { eligible: false, reasons: ["unknown_recipient_scope"] };
  }

  if (isHighRiskCategory(category)) {
    return { eligible: false, reasons: ["requires_high_risk_approval_gate"] };
  }

  const phone = normalizePhone(recipient.whatsappNumber || recipient.whatsapp_number || recipient.recipientNumber);
  const matched = analysis?.recipients?.find((item) => item.productionPhone === phone || item.id === recipient.id);
  if (matched) {
    return {
      eligible: Boolean(matched.eligibleForWhatsappProduction),
      reasons: matched.whatsappProductionExclusionReasons || [],
      phoneHash: matched.productionPhoneHash,
      phoneMasked: matched.productionPhoneMasked,
    };
  }

  const reasons = [];
  if (!phone) reasons.push("missing_number");
  if (phone && !isValidIndonesianPhone(phone)) reasons.push("invalid_format");
  if (phone && isDummyPhone(phone)) reasons.push("dummy_number");
  return {
    eligible: reasons.length === 0,
    reasons,
    phoneHash: hashPhone(phone),
    phoneMasked: maskPhone(phone),
  };
}

function dedupeRecipientsForEvent(recipients = [], analysis) {
  const seen = new Set();
  const selected = [];
  const excluded = [];
  for (const recipient of recipients) {
    const eligibility = ensureRecipientEligibility({ recipient, category: "employee", analysis });
    const phoneHash = eligibility.phoneHash || hashPhone(recipient.whatsappNumber || recipient.whatsapp_number);
    if (!eligibility.eligible) {
      excluded.push({ recipient, reasons: eligibility.reasons, phoneMasked: eligibility.phoneMasked });
      continue;
    }
    if (seen.has(phoneHash)) {
      excluded.push({ recipient, reasons: ["duplicate_in_event"], phoneMasked: eligibility.phoneMasked });
      continue;
    }
    seen.add(phoneHash);
    selected.push({ ...recipient, productionPhoneHash: phoneHash, productionPhoneMasked: eligibility.phoneMasked });
  }
  return { selected, excluded };
}

function checkRecipientCaps(recipients = [], runtimeConfig = {}) {
  const caps = getProductionCaps(runtimeConfig);
  const count = Array.isArray(recipients) ? recipients.length : 0;
  if (count > caps.maxRecipientsPerEvent) {
    return {
      allowed: false,
      reason: "max_recipients_per_event_exceeded",
      count,
      caps,
      requiresApproval: true,
    };
  }
  return { allowed: true, reason: "", count, caps, requiresApproval: false };
}

function validateProductionTemplateSafety(template = {}, sample = {}) {
  const body = String(template.body || "");
  const placeholders = Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1]);
  const allowed = new Set((template.placeholders || []).map((item) => String(item)));
  const unknown = placeholders.filter((placeholder) => !allowed.has(placeholder));
  const missing = placeholders.filter((placeholder) => sample[placeholder] === undefined || sample[placeholder] === "");
  const errors = [];
  if (!body.trim()) errors.push("empty_template");
  if (unknown.length) errors.push("unknown_placeholder");
  if (missing.length) errors.push("missing_sample_placeholder");
  if (DRY_RUN_WORDING.test(body)) errors.push("dry_run_or_test_wording");
  if (/api[_-]?key|password|token|qr|\.wwebjs_auth|session/i.test(body)) errors.push("sensitive_wording");
  if (/\[object Object\]|\{".+"\}/.test(body)) errors.push("raw_object_or_json");
  return {
    valid: errors.length === 0,
    errors,
    placeholders,
    unknown,
    missing,
  };
}

function stablePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9@._:-]/g, "");
}

function buildNotificationIdempotencyKey({
  workflow,
  entityType,
  entityId,
  recipientUserId,
  recipientPhoneHash,
  recipientNumber,
  templateId,
  triggerDate,
  triggerName,
} = {}) {
  const phoneHash = recipientPhoneHash || hashPhone(recipientNumber);
  const source = [
    stablePart(workflow),
    stablePart(entityType),
    stablePart(entityId),
    stablePart(recipientUserId || phoneHash),
    stablePart(phoneHash),
    stablePart(templateId),
    stablePart(triggerDate),
    stablePart(triggerName),
  ].join("|");
  const digest = crypto.createHash("sha256").update(source).digest("hex").slice(0, 32);
  return `prod:${digest}`;
}

function productionGuardEnabled(runtimeConfig = {}) {
  return runtimeConfig.productionAutomationGuard?.enabled !== false;
}

function legacyDirectSendAllowed(runtimeConfig = {}) {
  return runtimeConfig.productionAutomationGuard?.legacyDirectSendEnabled === true;
}

function legacyNotificationSchedulerAllowed(runtimeConfig = {}) {
  return (
    runtimeConfig.productionAutomationGuard?.legacyNotificationSchedulerEnabled === true ||
    process.env.ALETA_BOT_LEGACY_NOTIFICATION_SCHEDULER_ENABLED === "true"
  );
}

function gatewayTemplateContractRequired(runtimeConfig = {}) {
  return runtimeConfig.productionAutomationGuard?.requireGatewayMessageContract !== false;
}

function getMetadataValue(metadata = {}, ...keys) {
  for (const key of keys) {
    if (metadata && metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== "") {
      return metadata[key];
    }
  }
  return "";
}

function normalizeSourceFeature(value) {
  return String(value || "").trim().toLowerCase();
}

function hasTemplateMessageContract(metadata = {}) {
  const contractVersion = getMetadataValue(metadata, "messageContractVersion", "message_contract_version");
  const contractSource = normalizeSourceFeature(getMetadataValue(metadata, "messageContractSource", "message_contract_source"));
  const templateId = getMetadataValue(metadata, "templateId", "template_id", "templateKey", "template_key");
  const registryPilot = metadata.registryPilot === true || metadata.registry_pilot === true;

  if (contractVersion && contractSource && TEMPLATE_CONTRACT_SOURCES.has(contractSource)) return true;
  if (templateId && contractSource && TEMPLATE_CONTRACT_SOURCES.has(contractSource)) return true;
  if (registryPilot && templateId) return true;
  return false;
}

function isLegacyMessagePath({ sourceApp = "", sourceFeature = "", metadata = {} } = {}) {
  const source = normalizeSourceFeature(getMetadataValue(metadata, "source", "sourceFeature", "source_feature") || sourceFeature);
  const feature = normalizeSourceFeature(sourceFeature);
  const app = normalizeSourceFeature(sourceApp || getMetadataValue(metadata, "sourceApp", "source_app"));

  return (
    metadata.legacyQueued === true ||
    metadata.legacySendPath === true ||
    metadata.legacy_send_path === true ||
    metadata.legacySourceFile === "app.js" ||
    metadata.legacy_source_file === "app.js" ||
    source.startsWith("legacy_") ||
    source.includes("legacy_safe") ||
    source.includes("legacy_client") ||
    feature.startsWith("legacy_") ||
    feature.includes("legacy") ||
    app === "legacy_portal"
  );
}

function shouldBlockLegacyQueueMessage({ sourceApp = "", sourceFeature = "", category = "", metadata = {} } = {}, runtimeConfig = {}) {
  if (!productionGuardEnabled(runtimeConfig)) return { blocked: false, reason: "" };
  if (!isNotificationContext(category)) return { blocked: false, reason: "" };
  if (legacyDirectSendAllowed(runtimeConfig)) return { blocked: false, reason: "" };

  if (isLegacyMessagePath({ sourceApp, sourceFeature, metadata })) {
    return { blocked: true, reason: "legacy_message_path_blocked" };
  }

  const normalizedApp = normalizeSourceFeature(sourceApp || getMetadataValue(metadata, "sourceApp", "source_app"));
  const normalizedFeature = normalizeSourceFeature(sourceFeature || getMetadataValue(metadata, "sourceFeature", "source_feature"));
  const looksLikeTemplateRuntime = normalizedApp !== "aleta_bot_gateway" && normalizedFeature !== "test_message";

  if (gatewayTemplateContractRequired(runtimeConfig) && looksLikeTemplateRuntime && !hasTemplateMessageContract(metadata)) {
    return { blocked: true, reason: "missing_template_message_contract" };
  }

  return { blocked: false, reason: "" };
}

module.exports = {
  DEFAULT_PRODUCTION_CAPS,
  normalizePhone,
  maskPhone,
  hashPhone,
  isValidIndonesianPhone,
  isDummyPhone,
  isActiveInternalUser,
  analyzeEmployeeRecipients,
  ensureRecipientEligibility,
  dedupeRecipientsForEvent,
  checkRecipientCaps,
  getProductionCaps,
  validateProductionTemplateSafety,
  buildNotificationIdempotencyKey,
  productionGuardEnabled,
  legacyDirectSendAllowed,
  legacyNotificationSchedulerAllowed,
  gatewayTemplateContractRequired,
  hasTemplateMessageContract,
  isNotificationContext,
  isLegacyMessagePath,
  shouldBlockLegacyQueueMessage,
};
