import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const RUNTIME_CONFIG = path.join(BOT_DIR, "config", "aleta-runtime.json");
const APP_JS = path.join(BOT_DIR, "app.js");
const PREFLIGHT_JSON = path.join(REPORT_DIR, "aleta-preflight-latest.json");
const SMOKE_JSON = path.join(REPORT_DIR, "aleta-smoke-dry-run-latest.json");
const NUMBER_QUALITY_JSON = path.join(REPORT_DIR, "aleta-whatsapp-number-quality-latest.json");
const IDEMPOTENCY_PROOF_JSON = path.join(REPORT_DIR, "aleta-idempotency-production-proof-latest.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-risk-check-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-whatsapp-production-risk-check-latest.md");
const productionGuardService = require(path.join(BOT_DIR, "services", "productionGuardService.js"));

const CAPS = {
  maxRecipientsPerEvent: 5,
  maxMessagesPerBatch: 10,
  maxMessagesPerMinute: 5,
  maxMessagesPerHour: 20,
  maxMessagesPerDay: 50,
  broadcastRequiresApproval: true,
  externalNotificationRequiresApproval: true,
  massResendRequiresApproval: true,
};

const result = {
  generatedAt: new Date().toISOString(),
  overall: "FAIL",
  launchName: "ALETA WhatsApp Production Automation Launch",
  productionAutomationEligible: false,
  riskGates: {
    runtime: "PASS",
    queue: "PASS",
    data: "PASS",
    recipientResolver: "PASS",
    template: "PASS",
    idempotency: "PASS",
    massSendOutlier: "PASS",
    schedulerReminder: "PASS",
    approval: "PASS",
    publicQa: "PASS",
    rollback: "PASS",
  },
  caps: CAPS,
  checks: [],
  blockers: [],
  warnings: [],
  actionsTaken: [],
  summary: {},
};

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return "";
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/62\d{8,15}/g, (match) => maskPhone(match))
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[path]")
    .replace(/\.wwebjs_auth[^\s"'<>]*/gi, "[session-path]")
    .replace(/(token|password|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 1000);
}

function addCheck(gate, key, label, status, detail, metadata = {}) {
  const safeMetadata = JSON.parse(JSON.stringify(metadata, (_, value) => {
    if (typeof value === "string") return sanitizeText(value);
    return value;
  }));
  const entry = { gate, key, label, status, detail: sanitizeText(detail), metadata: safeMetadata };
  result.checks.push(entry);
  if (status === "FAIL") result.blockers.push({ key, label, detail: entry.detail });
  if (status === "WARN") result.warnings.push({ key, label, detail: entry.detail });
  return entry;
}

function setGate(gate, status) {
  const rank = { PASS: 0, WARN: 1, FAIL: 2 };
  const current = result.riskGates[gate] || "PASS";
  result.riskGates[gate] = rank[status] > rank[current] ? status : current;
}

function gateCheck(gate, key, label, status, detail, metadata) {
  setGate(gate, status);
  return addCheck(gate, key, label, status, detail, metadata);
}

function hasUnknownPlaceholders(template) {
  const body = String(template?.body || "");
  const placeholders = Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1]);
  const allowed = new Set((template?.placeholders || []).map((item) => String(item)));
  return placeholders.filter((placeholder) => !allowed.has(placeholder));
}

function writeReports() {
  mkdirSync(REPORT_DIR, { recursive: true });
  result.overall = Object.values(result.riskGates).some((status) => status === "FAIL")
    ? "FAIL"
    : Object.values(result.riskGates).some((status) => status === "WARN")
      ? "WARN"
      : "PASS";
  result.productionAutomationEligible = result.overall === "PASS";

  const jsonText = `${JSON.stringify(result, null, 2)}\n`;
  writeFileSync(REPORT_JSON, jsonText, "utf8");

  const md = [
    "# ALETA WhatsApp Production Risk Check",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: **${result.overall}**`,
    `Production automation eligible: **${result.productionAutomationEligible ? "yes" : "no"}**`,
    "",
    "## Risk Gates",
    "",
    ...Object.entries(result.riskGates).map(([gate, status]) => `- ${status} - ${gate}`),
    "",
    "## Blockers",
    ...(result.blockers.length
      ? result.blockers.map((item) => `- ${item.label}: ${item.detail}`)
      : ["- Tidak ada blocker."]),
    "",
    "## Warnings",
    ...(result.warnings.length
      ? result.warnings.map((item) => `- ${item.label}: ${item.detail}`)
      : ["- Tidak ada warning."]),
    "",
    "## Caps Required For Launch",
    `- maxRecipientsPerEvent: ${CAPS.maxRecipientsPerEvent}`,
    `- maxMessagesPerBatch: ${CAPS.maxMessagesPerBatch}`,
    `- maxMessagesPerHour: ${CAPS.maxMessagesPerHour}`,
    `- maxMessagesPerDay: ${CAPS.maxMessagesPerDay}`,
    "- broadcastRequiresApproval: true",
    "- externalNotificationRequiresApproval: true",
    "- massResendRequiresApproval: true",
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
}

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const runtime = readJson(RUNTIME_CONFIG, {});
  const preflight = readJson(PREFLIGHT_JSON, {});
  const smoke = readJson(SMOKE_JSON, {});
  const numberQuality = readJson(NUMBER_QUALITY_JSON, {});
  const idempotencyProof = readJson(IDEMPOTENCY_PROOF_JSON, {});
  const appSource = existsSync(APP_JS) ? readFileSync(APP_JS, "utf8") : "";
  const preflightSummary = preflight.summary || {};
  const runtimeSummary = preflightSummary.runtime || smoke.summary?.runtime || {};
  const worker = preflightSummary.worker || smoke.summary?.worker || runtimeSummary.worker || {};
  const queue = preflightSummary.queue || smoke.summary?.queue || {};
  const productionActive = runtime.productionAutomationEnabled === true;
  const reminder = productionActive
    ? runtime.dispositionDeadlineReminder || {}
    : preflightSummary.reminder || smoke.summary?.reminder || runtime.dispositionDeadlineReminder || {};
  const employees = Array.isArray(runtime.employeeRecipients) ? runtime.employeeRecipients : [];
  const templates = Array.isArray(runtime.templates) ? runtime.templates : [];
  const queries = Array.isArray(runtime.queries) ? runtime.queries : [];
  const intents = Array.isArray(runtime.publicQaIntents) ? runtime.publicQaIntents : [];

  gateCheck(
    "runtime",
    "preflight_smoke_runtime",
    "Runtime gate dasar",
    preflight.overall !== "FAIL" &&
      preflight.safeForLimitedWhatsAppPilot &&
      smoke.safeForLimitedWhatsAppPilot &&
      runtimeSummary.whatsappStatus === "connected" &&
      worker.enabled &&
      worker.activeTimer &&
      !worker.paused
      ? "PASS"
      : "FAIL",
    `preflight=${preflight.overall || "unknown"}, smoke=${smoke.overall || "unknown"}, whatsapp=${runtimeSummary.whatsappStatus || "unknown"}, worker enabled=${Boolean(worker.enabled)}, activeTimer=${Boolean(worker.activeTimer)}, paused=${Boolean(worker.paused)}.`
  );

  gateCheck(
    "queue",
    "queue_clean",
    "Queue gate",
    Number(queue.pending || 0) === 0 &&
      Number(queue.processing || 0) === 0 &&
      Number(queue.failed || 0) === 0 &&
      Number(queue.activeDeadLetters || 0) === 0 &&
      Number(preflightSummary.approvals?.pending || 0) === 0
      ? "PASS"
      : "FAIL",
    `pending=${queue.pending || 0}, processing=${queue.processing || 0}, failed=${queue.failed || 0}, activeDeadLetters=${queue.activeDeadLetters || 0}, approvalPending=${preflightSummary.approvals?.pending || 0}.`
  );

  const analysis = productionGuardService.analyzeEmployeeRecipients(
    employees,
    runtime.productionRecipientGuard || {}
  );
  const excludedRecipients = analysis.recipients.filter((item) => !item.eligibleForWhatsappProduction);
  const dataGateStatus =
    analysis.totalActive === 42 &&
    analysis.validCount === 42 &&
    analysis.invalidCount === 0 &&
    analysis.dummyCount === 0 &&
    analysis.duplicateGroupsCount === 0 &&
    analysis.excludedCount === 0 &&
    Number(numberQuality.missingCount || 0) === 0 &&
    Number(numberQuality.priorityMissingCount || 0) === 0 &&
    runtime.productionRecipientGuard?.enabled === true
      ? "PASS"
      : "FAIL";

  gateCheck(
    "data",
    "employee_phone_data",
    "Data nomor WhatsApp internal",
    dataGateStatus,
    `employees=${employees.length}, eligible=${analysis.validCount}, missing=${numberQuality.missingCount ?? "unknown"}, priorityMissing=${numberQuality.priorityMissingCount ?? "unknown"}, invalid=${analysis.invalidCount}, dummy=${analysis.dummyCount}, duplicateGroups=${analysis.duplicateGroupsCount}, excluded=${analysis.excludedCount}.`,
    {
      excludedRecipients: excludedRecipients.slice(0, 20).map((item) => ({
        id: item.id || "",
        name: item.name || "",
        roleId: item.roleId || "",
        positionName: item.positionName || "",
        phone: item.productionPhoneMasked,
        reasons: item.whatsappProductionExclusionReasons,
      })),
      duplicateNumbers: analysis.duplicateGroups.slice(0, 10),
    }
  );

  const productionRegistry = Array.isArray(runtime.productionNotificationRegistry)
    ? runtime.productionNotificationRegistry
    : [];
  const productionWorkflowStateOk = (item) =>
    productionActive
      ? item.enabled === true && item.mode === "production"
      : item.enabled === false;
  const internalReady = productionRegistry.some(
    (item) =>
      item.notificationId === "prod-internal-disposition-notification" &&
      item.productionEligible === true &&
      productionWorkflowStateOk(item) &&
      item.allowedRecipientScope === "internal_employee" &&
      item.templateId &&
      item.resolverId &&
      item.maxRecipientsPerEvent <= CAPS.maxRecipientsPerEvent
  );
  const incomingReady = productionRegistry.some(
    (item) =>
      item.notificationId === "prod-internal-incoming-letter-notification" &&
      item.productionEligible === true &&
      productionWorkflowStateOk(item) &&
      item.allowedRecipientScope === "internal_employee" &&
      item.templateId &&
      item.resolverId &&
      item.maxRecipientsPerEvent <= CAPS.maxRecipientsPerEvent
  );
  const highRiskLocked = ["prod-broadcast-capability", "prod-external-party-capability", "prod-mass-resend-capability"].every(
    (id) => {
      const item = productionRegistry.find((entry) => entry.notificationId === id);
      return item && item.requiresApproval === true && (productionActive ? item.enabled === true && /approval_gated/.test(String(item.mode || "")) : item.enabled === false);
    }
  );
  gateCheck(
    "recipientResolver",
    "recipient_resolver_proof",
    "Recipient resolver production",
    runtime.productionRecipientGuard?.enabled === true && internalReady && incomingReady && highRiskLocked
      ? "PASS"
      : "FAIL",
    productionActive
      ? "Resolver internal disposition dan surat masuk aktif production dengan guard eligibility; high-risk workflow aktif hanya sebagai approval-gated capability."
      : "Resolver internal disposition dan surat masuk tersedia untuk shadow-run dengan guard eligibility; high-risk workflow tetap terkunci."
  );

  const invalidTemplates = templates
    .map((template) => ({ id: template.id, unknown: hasUnknownPlaceholders(template), body: String(template.body || "") }))
    .filter((item) => item.unknown.length > 0);
  const productionTemplateIds = new Set(
    productionRegistry
      .filter((item) => item.productionEligible === true)
      .map((item) => item.templateId)
      .filter(Boolean)
  );
  const dryRunWordingTemplates = templates.filter(
    (template) => productionTemplateIds.has(template.id) && /mode simulasi|dry-run|validation only|do not send|uji coba/i.test(String(template.body || ""))
  );
  gateCheck(
    "template",
    "template_validity",
    "Template production",
    invalidTemplates.length === 0 && dryRunWordingTemplates.length === 0
      ? "PASS"
      : "FAIL",
    `unknownPlaceholderTemplates=${invalidTemplates.length}, dryRunWordingTemplates=${dryRunWordingTemplates.length}. Template production tidak boleh masih menyebut simulasi/dry-run.`,
    {
      invalidTemplates: invalidTemplates.slice(0, 10).map((item) => ({ id: item.id, unknown: item.unknown })),
      dryRunWordingTemplates: dryRunWordingTemplates.slice(0, 10).map((template) => template.id),
    }
  );

  const clientSendCount = (appSource.match(/client\.sendMessage\(/g) || []).length;
  const safeSendCount = (appSource.match(/safeSendMessage\(/g) || []).length;
  const buildIdempotencyCount = (appSource.match(/buildIdempotencyKey\(/g) || []).length;
  gateCheck(
    "idempotency",
    "legacy_send_idempotency",
    "Idempotency dan duplicate prevention",
    idempotencyProof.overall === "PASS" &&
      runtime.productionAutomationGuard?.legacyDirectSendEnabled === false &&
      runtime.productionAutomationGuard?.idempotencyRequired === true
      ? "PASS"
      : "FAIL",
    `legacy client.sendMessage calls=${clientSendCount}, safeSendMessage calls=${safeSendCount}, buildIdempotencyKey calls=${buildIdempotencyCount}, idempotencyProof=${idempotencyProof.overall || "missing"}. Legacy direct send diblokir production guard dan duplicate simulation harus PASS.`
  );

  const configuredRate = productionGuardService.getProductionCaps(runtime);
  const rateConservative =
    configuredRate.maxMessagesPerMinute <= 5 &&
    configuredRate.maxMessagesPerHour <= CAPS.maxMessagesPerHour &&
    configuredRate.maxMessagesPerDay <= CAPS.maxMessagesPerDay &&
    configuredRate.maxRecipientsPerEvent <= CAPS.maxRecipientsPerEvent &&
    configuredRate.broadcastRequiresApproval &&
    configuredRate.externalNotificationRequiresApproval &&
    configuredRate.massResendRequiresApproval;
  gateCheck(
    "massSendOutlier",
    "caps_enforced",
    "Mass-send/outlier cap",
    rateConservative && runtime.productionAutomationGuard?.capEnforcementRequired === true
      ? "PASS"
      : "FAIL",
    "Cap launch konservatif belum terbukti enforced penuh untuk maxRecipientsPerEvent, batch, hour/day, broadcast, external notification, dan mass resend."
  );

  const cronCount = (appSource.match(/cron\.schedule\(/g) || []).length;
  const reminderRegistry = productionRegistry.find((item) => item.notificationId === "prod-disposition-deadline-h-minus-1");
  const reminderTemplate = productionGuardService.validateProductionTemplateSafety(
    templates.find((template) => template.id === "disposition-deadline-h-minus-1"),
    { nama_pegawai: "Contoh Pegawai", perihal: "Contoh Surat", deadline: "2026-05-04" }
  );
  const reminderSchedulerEnabled = Boolean(reminder.schedulerEnabled ?? reminder.scheduler?.enabled);
  const reminderSchedulerMode = reminder.schedulerMode || reminder.scheduler?.mode || "unknown";
  const reminderApproved = Boolean(reminder.approved ?? reminder.approvedAt);
  const schedulerStateOk = productionActive
    ? reminder.enabled === true &&
      reminder.mode === "production" &&
      reminderSchedulerEnabled === true &&
      reminderSchedulerMode === "production" &&
      reminderRegistry?.enabled === true &&
      reminderRegistry?.mode === "production"
    : reminder.enabled === false &&
      reminder.mode === "dry_run" &&
      reminderSchedulerEnabled === false &&
      reminderSchedulerMode === "dry_run";
  gateCheck(
    "schedulerReminder",
    "scheduler_reminder_gate",
    "Scheduler/reminder production",
    runtime.productionAutomationGuard?.legacyDirectSendEnabled === false &&
      schedulerStateOk &&
      reminderRegistry?.productionEligible === true &&
      reminderRegistry?.requiresApproval === true &&
      runtime.productionApprovalPolicy?.schedulerBacklogRequiresApproval === true &&
      reminderTemplate.valid
      ? "PASS"
      : "FAIL",
    `reminder=${Boolean(reminder.enabled)}/${reminder.mode || "unknown"}, scheduler=${reminderSchedulerEnabled}/${reminderSchedulerMode}, approved=${reminderApproved}, legacyCronCount=${cronCount}. ${productionActive ? "Post-launch scheduler gate PASS bila H-1 registry/template/backlog approval aktif dan scheduler production sesuai gate." : "Pre-activation scheduler gate PASS bila H-1 registry/template/backlog approval siap dan scheduler masih dry_run sampai launch final."}`
  );

  gateCheck(
    "approval",
    "approval_high_risk",
    "Approval gate high-risk",
    runtime.productionApprovalPolicy?.broadcastRequiresApproval === true &&
      runtime.productionApprovalPolicy?.externalNotificationRequiresApproval === true &&
      runtime.productionApprovalPolicy?.massResendRequiresApproval === true &&
      runtime.manualSendEnabled === false &&
      runtime.productionApprovalPolicy?.autoApprove === false
      ? "PASS"
      : "FAIL",
    "Approval gate production untuk broadcast/external/mass resend belum terbukti enforced penuh. Manual send endpoint juga belum dinonaktifkan khusus production."
  );

  const activeUnapprovedIntents = intents.filter(
    (intent) => intent.isActive && intent.requiresApprovalBeforeActive && !intent.approvedAt && intent.productionEligible !== false
  );
  gateCheck(
    "publicQa",
    "public_qa_safe_mode",
    "Public Q&A production safe mode",
    activeUnapprovedIntents.length === 0 && runtime.publicQaRequireApproval !== false
      ? "PASS"
      : "FAIL",
    `activeUnapprovedIntents=${activeUnapprovedIntents.length}, publicQaRequireApproval=${runtime.publicQaRequireApproval !== false}.`
  );

  const rollbackDocs = [
    "aleta-sop-whatsapp-disconnected.md",
    "aleta-sop-dead-letter.md",
    "aleta-sop-queue-failed.md",
    "aleta-sop-rollback-safe-mode.md",
  ].map((file) => path.join(REPORT_DIR, file));
  gateCheck(
    "rollback",
    "rollback_docs",
    "Rollback/safe mode",
    rollbackDocs.every((file) => existsSync(file)) ? "PASS" : "FAIL",
    "SOP rollback/disconnected/dead-letter/queue failed tersedia."
  );

  result.summary = {
    runtime: {
      whatsappStatus: runtimeSummary.whatsappStatus || "unknown",
      workerEnabled: Boolean(worker.enabled),
      workerActiveTimer: Boolean(worker.activeTimer),
      workerPaused: Boolean(worker.paused),
      botEnabled: Boolean(runtime.botEnabled),
      notificationsEnabled: Boolean(runtime.notificationsEnabled),
    },
    queue: {
      pending: Number(queue.pending || 0),
      processing: Number(queue.processing || 0),
      failed: Number(queue.failed || 0),
      activeDeadLetters: Number(queue.activeDeadLetters || 0),
      approvalPending: Number(preflightSummary.approvals?.pending || 0),
    },
    data: {
      employeeRecipients: employees.length,
      dummyPhones: analysis.dummyCount,
      duplicateNumbers: analysis.duplicateGroupsCount,
      invalidPhones: analysis.invalidCount,
      excludedRecipients: analysis.excludedCount,
    },
    registry: {
      useRegistryNotifications: Boolean(runtime.useRegistryNotifications),
      notificationsCount: Array.isArray(runtime.notifications) ? runtime.notifications.length : 0,
      productionRegistryCount: productionRegistry.length,
      queriesCount: queries.length,
      templatesCount: templates.length,
    },
  };

  result.actionsTaken.push({
    action: "risk_check_only",
    detail: "Tidak ada botEnabled, scheduler, reminder, send, resend, atau production activation yang diubah.",
  });
  writeReports();
  console.log(`Production risk check: ${result.overall}. Report: ${REPORT_JSON}`);
  if (result.overall === "FAIL") process.exitCode = 1;
}

main();
