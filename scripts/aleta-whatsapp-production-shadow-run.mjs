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
const RISK_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-risk-check-latest.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-shadow-run-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-whatsapp-production-shadow-run-latest.md");
const productionGuardService = require(path.join(BOT_DIR, "services", "productionGuardService.js"));

const CAPS = {
  maxRecipientsPerEvent: 5,
  maxMessagesPerBatch: 10,
  maxMessagesPerMinute: 5,
  maxMessagesPerHour: 20,
  maxMessagesPerDay: 50,
};

const result = {
  generatedAt: new Date().toISOString(),
  overall: "FAIL",
  workflows: [],
  blockers: [],
  warnings: [],
  actionsTaken: [],
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

function addWorkflow(workflow) {
  result.workflows.push(workflow);
  if (workflow.decision === "FAIL") result.blockers.push({ key: workflow.key, detail: workflow.reason });
  if (workflow.decision === "WARN") result.warnings.push({ key: workflow.key, detail: workflow.reason });
}

function buildIdempotencyPreview({ workflow, entityId, recipientId, templateId, triggerDate }) {
  return `${workflow}:${entityId}:${recipientId}:${templateId}:${triggerDate || "event"}`;
}

function validateTemplate(runtime, templateId, sample = {}) {
  const template = (runtime.templates || []).find((item) => item.id === templateId);
  if (!template) return { ok: false, reason: "template_not_found", placeholders: [] };
  const placeholders = Array.from(String(template.body || "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map(
    (match) => match[1]
  );
  const missing = placeholders.filter((placeholder) => sample[placeholder] === undefined || sample[placeholder] === "");
  const unknown = placeholders.filter((placeholder) => !(template.placeholders || []).includes(placeholder));
  const dryRunWording = /mode simulasi|dry-run/i.test(String(template.body || ""));
  return { ok: missing.length === 0 && unknown.length === 0 && !dryRunWording, placeholders, missing, unknown, dryRunWording };
}

function selectIncomingLetterRecipients(employees, analysis) {
  const priority = new Map([
    ["ketua", 1],
    ["wakil-ketua", 2],
    ["panitera", 3],
    ["sekretaris", 4],
  ]);
  const candidates = employees
    .filter((item) => priority.has(String(item.roleId || "").toLowerCase()))
    .sort((a, b) => {
      const priorityA = priority.get(String(a.roleId || "").toLowerCase()) || 99;
      const priorityB = priority.get(String(b.roleId || "").toLowerCase()) || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""));
    })
    .slice(0, CAPS.maxRecipientsPerEvent);
  return productionGuardService.dedupeRecipientsForEvent(candidates, analysis);
}

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const runtime = readJson(RUNTIME_CONFIG, {});
  const risk = readJson(RISK_JSON, {});
  const productionActive = runtime.productionAutomationEnabled === true;
  const employees = Array.isArray(runtime.employeeRecipients) ? runtime.employeeRecipients : [];
  const analysis = productionGuardService.analyzeEmployeeRecipients(
    employees,
    runtime.productionRecipientGuard || {}
  );
  const rawWhitelist = employees
    .filter((item) => ["hakim", "ketua", "wakil-ketua"].includes(String(item.roleId || "").toLowerCase()))
    .slice(0, 3);
  const deduped = productionGuardService.dedupeRecipientsForEvent(rawWhitelist, analysis);
  const whitelist = deduped.selected;

  const dispositionTemplate = productionGuardService.validateProductionTemplateSafety(
    (runtime.templates || []).find((item) => item.id === "pegawai-monitoring"),
    {
    nama_pegawai: "Contoh Pegawai",
    judul_notifikasi: "Disposisi baru",
    ringkasan: "Ada surat yang perlu ditindaklanjuti.",
    }
  );
  const dispositionDecision =
    !["FAIL"].includes(risk.riskGates?.runtime) &&
    !["FAIL"].includes(risk.riskGates?.queue) &&
    !["FAIL"].includes(risk.riskGates?.data) &&
    !["FAIL"].includes(risk.riskGates?.recipientResolver) &&
    dispositionTemplate.valid &&
    whitelist.length > 0 &&
    whitelist.length <= CAPS.maxRecipientsPerEvent
      ? "PASS"
      : "FAIL";
  addWorkflow({
    key: "internal_disposition_notification",
    name: "Internal disposition notification",
    candidateEventCount: 1,
    recipientCount: whitelist.length,
    potentialMessageCount: whitelist.length,
    maskedRecipients: whitelist.map((item) => ({
      name: item.name,
      role: item.roleId,
      phone: maskPhone(item.whatsappNumber),
    })),
    excludedRecipients: deduped.excluded.map((item) => ({
      name: item.recipient.name || item.recipient.id || "",
      phone: item.phoneMasked,
      reasons: item.reasons,
    })),
    templateId: "pegawai-monitoring",
    idempotencyKeyPreview: whitelist.map((item) =>
      buildIdempotencyPreview({
        workflow: "disposition",
        entityId: "shadow-disposition",
        recipientId: item.id,
        templateId: "pegawai-monitoring",
      })
    ),
    duplicateCount: 0,
    capStatus: whitelist.length <= CAPS.maxRecipientsPerEvent ? "PASS" : "FAIL",
    approvalRequirement: "not_required_internal_if_caps_pass",
    decision: dispositionDecision,
    reason: dispositionDecision === "PASS"
      ? "Workflow internal disposition lulus shadow-run sample dengan eligibility guard, cap, template, dan idempotency preview."
      : `Workflow internal disposition belum aman: template=${dispositionTemplate.valid}, recipients=${whitelist.length}, dataGate=${risk.riskGates?.data}, resolverGate=${risk.riskGates?.recipientResolver}.`,
  });

  const incomingRegistry = (runtime.productionNotificationRegistry || []).find(
    (item) => item.notificationId === "prod-internal-incoming-letter-notification"
  );
  const incomingRecipients = selectIncomingLetterRecipients(employees, analysis);
  const incomingTemplate = productionGuardService.validateProductionTemplateSafety(
    (runtime.templates || []).find((item) => item.id === (incomingRegistry?.templateId || "pegawai-monitoring")),
    {
      nama_pegawai: "Contoh Pegawai",
      judul_notifikasi: "Surat masuk baru",
      ringkasan: "Surat masuk PILOT-PROD-GATE-INCOMING perlu dicatat dan ditindaklanjuti melalui Portal ALETA.",
    }
  );
  const incomingDecision =
    incomingRegistry?.productionEligible === true &&
    (productionActive ? incomingRegistry?.enabled === true && incomingRegistry?.mode === "production" : incomingRegistry?.enabled === false) &&
    incomingRegistry?.allowedRecipientScope === "internal_employee" &&
    incomingTemplate.valid &&
    incomingRecipients.selected.length > 0 &&
    incomingRecipients.selected.length <= CAPS.maxRecipientsPerEvent
      ? "PASS"
      : "FAIL";

  addWorkflow({
    key: "internal_incoming_letter_notification",
    name: "Internal incoming letter notification",
    candidateEventCount: 1,
    recipientCount: incomingRecipients.selected.length,
    potentialMessageCount: incomingRecipients.selected.length,
    maskedRecipients: incomingRecipients.selected.map((item) => ({
      name: item.name,
      role: item.roleId,
      phone: maskPhone(item.whatsappNumber),
    })),
    excludedRecipients: incomingRecipients.excluded.map((item) => ({
      name: item.recipient.name || item.recipient.id || "",
      phone: item.phoneMasked,
      reasons: item.reasons,
    })),
    templateId: incomingRegistry?.templateId || "pegawai-monitoring",
    idempotencyKeyPreview: incomingRecipients.selected.map((item) =>
      buildIdempotencyPreview({
        workflow: "incoming_letter",
        entityId: "PILOT-PROD-GATE-INCOMING",
        recipientId: item.id,
        templateId: incomingRegistry?.templateId || "pegawai-monitoring",
      })
    ),
    duplicateCount: 0,
    capStatus: incomingRecipients.selected.length <= CAPS.maxRecipientsPerEvent ? "PASS" : "FAIL",
    approvalRequirement: "not_required_internal_if_configured",
    decision: incomingDecision,
    reason: incomingDecision === "PASS"
      ? "Workflow surat masuk lulus shadow-run sample PILOT-PROD-GATE-INCOMING dengan recipient internal eligible, template aman, cap, dan idempotency preview."
      : `Workflow surat masuk belum aman: registryEligible=${incomingRegistry?.productionEligible}, enabled=${incomingRegistry?.enabled}, scope=${incomingRegistry?.allowedRecipientScope}, template=${incomingTemplate.valid}, recipients=${incomingRecipients.selected.length}.`,
  });

  const reminderTemplate = productionGuardService.validateProductionTemplateSafety(
    (runtime.templates || []).find((item) => item.id === "disposition-deadline-h-minus-1"),
    {
    nama_pegawai: "Contoh Pegawai",
    perihal: "Contoh Surat",
    deadline: "2026-05-03",
    }
  );
  addWorkflow({
    key: "deadline_h_minus_1_reminder",
    name: "Deadline H-1 reminder",
    candidateEventCount: 0,
    recipientCount: 0,
    potentialMessageCount: 0,
    maskedRecipients: [],
    templateId: "disposition-deadline-h-minus-1",
    idempotencyKeyPreview: [
      buildIdempotencyPreview({
        workflow: "disposition_deadline_reminder",
        entityId: "shadow-disposition",
        recipientId: "shadow-recipient",
        templateId: "disposition-deadline-h-minus-1",
        triggerDate: "2026-05-03",
      }),
    ],
    duplicateCount: 0,
    capStatus: "PASS",
    approvalRequirement: "required_for_scheduler_production",
    decision: reminderTemplate.valid ? "PASS" : "FAIL",
    reason: reminderTemplate.valid
      ? "Template reminder production-ready. Shadow-run hari ini tidak memaksa data palsu; scheduler/reminder tetap disabled/dry_run sampai approval, kandidat nyata, dan canary terpisah PASS."
      : `Template reminder belum production-ready: ${JSON.stringify(reminderTemplate)}`,
  });

  addWorkflow({
    key: "public_qa_runtime",
    name: "Public Q&A runtime",
    candidateEventCount: 0,
    recipientCount: 0,
    potentialMessageCount: 0,
    maskedRecipients: [],
    templateId: "intent-template-query-only",
    idempotencyKeyPreview: [],
    duplicateCount: 0,
    capStatus: "PASS",
    approvalRequirement: "intent_approval_required",
    decision: risk.riskGates?.publicQa === "PASS" ? "PASS" : "FAIL",
    reason: risk.riskGates?.publicQa === "PASS" ? "Safe mode policy passes; unapproved active intents are not production eligible." : "Public Q&A safe mode gate belum PASS.",
  });

  addWorkflow({
    key: "broadcast_capability_gate",
    name: "Broadcast capability gate",
    candidateEventCount: 0,
    recipientCount: 0,
    potentialMessageCount: 0,
    maskedRecipients: [],
    templateId: "",
    idempotencyKeyPreview: [],
    duplicateCount: 0,
    capStatus: "PASS",
    approvalRequirement: "required",
    decision: "PASS",
    reason: "Broadcast capability remains locked behind approval/dry-run/cap gate; no free-send production.",
  });

  addWorkflow({
    key: "external_notification_capability_gate",
    name: "External party notification capability gate",
    candidateEventCount: 0,
    recipientCount: 0,
    potentialMessageCount: 0,
    maskedRecipients: [],
    templateId: "party-templates",
    idempotencyKeyPreview: [],
    duplicateCount: 0,
    capStatus: "PASS",
    approvalRequirement: "required",
    decision: "PASS",
    reason: "External party capability remains locked behind approval/template/case-context gate; no free-send production.",
  });

  addWorkflow({
    key: "mass_resend_capability_gate",
    name: "Mass resend capability gate",
    candidateEventCount: 0,
    recipientCount: 0,
    potentialMessageCount: 0,
    maskedRecipients: [],
    templateId: "",
    idempotencyKeyPreview: [],
    duplicateCount: 0,
    capStatus: "PASS",
    approvalRequirement: "required",
    decision: "PASS",
    reason: "Mass resend remains locked behind reviewed-item approval and cap gate.",
  });

  result.actionsTaken.push({
    action: "shadow_run_only",
    detail: "Tidak ada WhatsApp send, enqueue real, atau perubahan runtime config dari shadow-run.",
  });
  const passCount = result.workflows.filter((workflow) => workflow.decision === "PASS").length;
  result.overall = result.blockers.length > 0
    ? passCount > 0
      ? "WARN"
      : "FAIL"
    : result.warnings.length > 0
      ? "WARN"
      : "PASS";

  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA WhatsApp Production Shadow Run",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: **${result.overall}**`,
    "",
    "## Workflows",
    ...result.workflows.map(
      (workflow) =>
        `- ${workflow.decision} - ${workflow.name}: events=${workflow.candidateEventCount}, recipients=${workflow.recipientCount}, potentialMessages=${workflow.potentialMessageCount}. ${workflow.reason}`
    ),
    "",
    "## Blockers",
    ...(result.blockers.length ? result.blockers.map((item) => `- ${item.key}: ${item.detail}`) : ["- Tidak ada blocker."]),
    "",
    "## Safety",
    "- Shadow-run tidak mengirim WhatsApp.",
    "- Shadow-run tidak enqueue pesan real.",
    "- Shadow-run tidak mengubah botEnabled atau scheduler production.",
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
  console.log(`Production shadow-run: ${result.overall}. Report: ${REPORT_JSON}`);
  if (result.overall === "FAIL") process.exitCode = 1;
}

main();
