import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const BOT_RUNTIME = path.join(ROOT_DIR, "aleta_bot", "config", "aleta-runtime.json");
const PORTAL_RUNTIME = path.join(ROOT_DIR, "manajemen_surat", "data", "aleta-bot-runtime.json");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-production-config-prepare-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-production-config-prepare-latest.md");

const CAPS = {
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

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function upsertById(items, keyName, item) {
  const list = Array.isArray(items) ? [...items] : [];
  const index = list.findIndex((entry) => entry[keyName] === item[keyName]);
  if (index >= 0) list[index] = { ...list[index], ...item };
  else list.push(item);
  return list;
}

function prepareRuntime(runtime, sourceRuntime) {
  const updatedAt = new Date().toISOString();
  let templates = Array.isArray(runtime.templates) ? [...runtime.templates] : [];
  templates = templates.map((template) => {
    if (template.id !== "disposition-deadline-h-minus-1") return template;
    return {
      ...template,
      body:
        'Assalamu\'alaikum {{nama_pegawai}}.\n\nPengingat disposisi: Surat "{{perihal}}" jatuh tempo pada {{deadline}}. Mohon segera ditindaklanjuti melalui Portal ALETA.\n\nPesan otomatis ALETA Bot.',
      productionEligible: true,
      updatedAt,
    };
  });

  const productionNotificationRegistry = [
    {
      notificationId: "prod-internal-disposition-notification",
      workflowName: "Internal disposition notification",
      productionEligible: true,
      enabled: false,
      mode: "production_ready_disabled",
      templateId: "pegawai-monitoring",
      resolverId: "internal_employee_disposition_assignee",
      queryId: "portal-disposition-deadline-h-minus-1",
      requiresApproval: false,
      maxRecipientsPerEvent: 5,
      idempotencyStrategy: "workflow_entity_recipient_template_trigger",
      allowedRecipientScope: "internal_employee",
      auditEventName: "whatsapp_internal_disposition_notification",
      riskLevel: "low",
      productionApprovedAt: null,
      productionApprovedBy: null,
      notes: "Ready for canary only; not active until production launch.",
    },
    {
      notificationId: "prod-internal-incoming-letter-notification",
      workflowName: "Internal incoming letter notification",
      productionEligible: true,
      enabled: false,
      mode: "production_ready_disabled",
      templateId: "pegawai-monitoring",
      resolverId: "internal_incoming_letter_configured_recipients",
      queryId: "portal-incoming-letter-internal-event",
      requiresApproval: false,
      maxRecipientsPerEvent: 5,
      idempotencyStrategy: "workflow_entity_recipient_template_trigger",
      allowedRecipientScope: "internal_employee",
      auditEventName: "whatsapp_internal_incoming_letter_notification",
      riskLevel: "medium",
      productionApprovedAt: null,
      productionApprovedBy: null,
      notes: "Ready for canary only; not active until production launch.",
    },
    {
      notificationId: "prod-disposition-deadline-h-minus-1",
      workflowName: "Deadline H-1 disposition reminder",
      productionEligible: true,
      enabled: false,
      mode: "production_ready_disabled",
      templateId: "disposition-deadline-h-minus-1",
      resolverId: "portal_disposition_deadline_h_minus_1",
      queryId: "portal-disposition-deadline-h-minus-1",
      requiresApproval: true,
      maxRecipientsPerEvent: 5,
      idempotencyStrategy: "disposition_recipient_deadline_date_template",
      allowedRecipientScope: "internal_employee",
      auditEventName: "whatsapp_disposition_deadline_h_minus_1",
      riskLevel: "medium",
      productionApprovedAt: null,
      productionApprovedBy: null,
      notes: "Requires approval/canary before scheduler production.",
    },
    {
      notificationId: "prod-broadcast-capability",
      workflowName: "Broadcast capability gate",
      productionEligible: true,
      enabled: false,
      mode: "approval_gated_capability",
      templateId: "",
      resolverId: "approved_broadcast_preview_only",
      queryId: "",
      requiresApproval: true,
      maxRecipientsPerEvent: 5,
      idempotencyStrategy: "approval_scope_recipient_template",
      allowedRecipientScope: "internal_employee_approved_only",
      auditEventName: "whatsapp_broadcast_approval_gated",
      riskLevel: "high",
      productionApprovedAt: null,
      productionApprovedBy: null,
      notes: "Capability available only behind approval/dry-run preview/caps; no free-send.",
    },
    {
      notificationId: "prod-external-party-capability",
      workflowName: "External party notification capability gate",
      productionEligible: true,
      enabled: false,
      mode: "approval_gated_capability",
      templateId: "pihak-layanan",
      resolverId: "approved_external_case_context_only",
      queryId: "",
      requiresApproval: true,
      maxRecipientsPerEvent: 5,
      idempotencyStrategy: "approval_case_party_template",
      allowedRecipientScope: "external_party_approved_only",
      auditEventName: "whatsapp_external_party_approval_gated",
      riskLevel: "high",
      productionApprovedAt: null,
      productionApprovedBy: null,
      notes: "Capability available only behind approval/template/case context; no free-send.",
    },
    {
      notificationId: "prod-mass-resend-capability",
      workflowName: "Mass resend capability gate",
      productionEligible: true,
      enabled: false,
      mode: "approval_gated_capability",
      templateId: "",
      resolverId: "reviewed_resend_items_only",
      queryId: "",
      requiresApproval: true,
      maxRecipientsPerEvent: 5,
      idempotencyStrategy: "approval_resend_original_queue_recipient",
      allowedRecipientScope: "reviewed_queue_items_only",
      auditEventName: "whatsapp_mass_resend_approval_gated",
      riskLevel: "high",
      productionApprovedAt: null,
      productionApprovedBy: null,
      notes: "Capability available only for reviewed items with approval/caps; no free resend.",
    },
  ];

  let notifications = Array.isArray(runtime.notifications) ? runtime.notifications : [];
  notifications = upsertById(notifications, "id", {
    id: "prod-internal-disposition-notification",
    name: "Production Internal Disposition Notification",
    category: "employee",
    queryId: "portal-disposition-deadline-h-minus-1",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { recipientColumn: "whatsapp_number", scope: "internal_employee" },
    scheduleConfig: { type: "event", cron: "" },
    isActive: false,
    dryRunEnabled: false,
    requiresApproval: false,
    productionEligible: true,
    mode: "production_ready_disabled",
    resolverId: "internal_employee_disposition_assignee",
    allowedRecipientScope: "internal_employee",
    riskLevel: "low",
    maxRecipientsPerEvent: 5,
    idempotencyStrategy: "workflow_entity_recipient_template_trigger",
    auditEventName: "whatsapp_internal_disposition_notification",
    notes: "Canary wajib sebelum active production.",
    updatedAt,
  });
  notifications = upsertById(notifications, "id", {
    id: "prod-internal-incoming-letter-notification",
    name: "Production Internal Incoming Letter Notification",
    category: "employee",
    queryId: "portal-incoming-letter-internal-event",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { recipientColumn: "whatsapp_number", scope: "internal_employee" },
    scheduleConfig: { type: "event", cron: "" },
    isActive: false,
    dryRunEnabled: false,
    requiresApproval: false,
    productionEligible: true,
    mode: "production_ready_disabled",
    resolverId: "internal_incoming_letter_configured_recipients",
    allowedRecipientScope: "internal_employee",
    riskLevel: "medium",
    maxRecipientsPerEvent: 5,
    idempotencyStrategy: "workflow_entity_recipient_template_trigger",
    auditEventName: "whatsapp_internal_incoming_letter_notification",
    notes: "Canary wajib sebelum active production.",
    updatedAt,
  });

  const publicQaIntents = (Array.isArray(runtime.publicQaIntents) ? runtime.publicQaIntents : []).map((intent) => ({
    ...intent,
    productionEligible: intent.approvedAt ? intent.productionEligible !== false : false,
    productionReviewStatus: intent.approvedAt ? intent.productionReviewStatus || "approved" : "review_required",
  }));

  return {
    ...runtime,
    version: runtime.version || sourceRuntime.version || 1,
    updatedAt,
    botEnabled: Boolean(runtime.botEnabled),
    notificationsEnabled: Boolean(runtime.notificationsEnabled),
    dryRunEnabled: runtime.dryRunEnabled !== false,
    useRegistryNotifications: true,
    registryPilotMode: true,
    registryDryRunDefault: true,
    templates,
    notifications,
    publicQaIntents,
    publicQaRequireApproval: true,
    manualSendEnabled: false,
    productionAutomationGuard: {
      enabled: true,
      legacyDirectSendEnabled: false,
      recipientEligibilityRequired: true,
      templateProductionSafetyRequired: true,
      idempotencyRequired: true,
      capEnforcementRequired: true,
      outlierRequiresApproval: true,
      blockHighRiskWithoutApproval: true,
      blockSchedulerBacklogWithoutReview: true,
      updatedAt,
    },
    productionAutomationCaps: {
      ...CAPS,
      updatedAt,
    },
    rateLimit: {
      ...(runtime.rateLimit || {}),
      maxPerMinute: 5,
      maxPerHour: 20,
      maxPerDay: 50,
    },
    productionApprovalPolicy: {
      broadcastRequiresApproval: true,
      externalNotificationRequiresApproval: true,
      massResendRequiresApproval: true,
      outlierRequiresApproval: true,
      manualIdempotencyOverrideRequiresApproval: true,
      schedulerBacklogRequiresApproval: true,
      recheckGateOnApproval: true,
      autoApprove: false,
      auditRequired: true,
      updatedAt,
    },
    productionRecipientGuard: {
      enabled: true,
      allowSharedNumberExceptions: [],
      excludeDummyNumbers: true,
      excludeDuplicateNumbers: true,
      excludeInactiveUsers: true,
      updatedAt,
    },
    productionNotificationRegistry,
    dispositionDeadlineReminder: {
      ...(runtime.dispositionDeadlineReminder || {}),
      enabled: false,
      mode: "dry_run",
      approvedAt: runtime.dispositionDeadlineReminder?.approvedAt || null,
      approvedBy: runtime.dispositionDeadlineReminder?.approvedBy || null,
      scheduler: {
        ...(runtime.dispositionDeadlineReminder?.scheduler || {}),
        enabled: false,
        mode: "dry_run",
        time: runtime.dispositionDeadlineReminder?.scheduler?.time || "08:00:00",
      },
      killSwitch: false,
      defaultDryRun: true,
    },
  };
}

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const botRuntime = readJson(BOT_RUNTIME);
  const prepared = prepareRuntime(botRuntime, botRuntime);
  writeFileSync(BOT_RUNTIME, `${JSON.stringify(prepared, null, 2)}\n`, "utf8");
  if (existsSync(PORTAL_RUNTIME)) {
    const portalRuntime = readJson(PORTAL_RUNTIME);
    const portalPrepared = prepareRuntime({ ...portalRuntime, employeeRecipients: prepared.employeeRecipients }, prepared);
    writeFileSync(PORTAL_RUNTIME, `${JSON.stringify(portalPrepared, null, 2)}\n`, "utf8");
  }
  const report = {
    generatedAt: new Date().toISOString(),
    overall: "PASS",
    botEnabled: prepared.botEnabled,
    notificationsEnabled: prepared.notificationsEnabled,
    useRegistryNotifications: prepared.useRegistryNotifications,
    productionRegistryCount: prepared.productionNotificationRegistry.length,
    caps: prepared.productionAutomationCaps,
    actionsTaken: [
      "Prepared production guard/caps/registry without enabling bot, notifications, scheduler, or reminder production.",
    ],
  };
  writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(
    REPORT_MD,
    [
      "# ALETA Production Config Prepare",
      "",
      `Generated: ${report.generatedAt}`,
      "",
      `Overall: **${report.overall}**`,
      `botEnabled: **${report.botEnabled}**`,
      `notificationsEnabled: **${report.notificationsEnabled}**`,
      `Production registry count: ${report.productionRegistryCount}`,
      "",
      "Tidak ada WhatsApp send, enqueue real, QR scan, logout/reset, atau production activation.",
    ].join("\n") + "\n",
    "utf8"
  );
  console.log(`Production config prepare: ${report.overall}. Report: ${REPORT_JSON}`);
}

main();
