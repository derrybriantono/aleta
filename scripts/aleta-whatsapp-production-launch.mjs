import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PORTAL_DIR = path.join(ROOT_DIR, "manajemen_surat");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");

const RUNTIME_CONFIG_PATHS = [
  path.join(BOT_DIR, "config", "aleta-runtime.json"),
  path.join(PORTAL_DIR, "data", "aleta-bot-runtime.json"),
];
const PREFLIGHT_JSON = path.join(REPORT_DIR, "aleta-preflight-latest.json");
const SMOKE_JSON = path.join(REPORT_DIR, "aleta-smoke-dry-run-latest.json");
const RISK_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-risk-check-latest.json");
const SHADOW_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-shadow-run-latest.json");
const CANARY_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-canary-latest.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-automation-launch-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-whatsapp-production-automation-launch-latest.md");
const FULL_READINESS_JSON = path.join(REPORT_DIR, "aleta-whatsapp-full-production-readiness-latest.json");
const FULL_READINESS_MD = path.join(REPORT_DIR, "aleta-whatsapp-full-production-readiness-latest.md");
const POST_LAUNCH_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-post-launch-latest.json");
const POST_LAUNCH_MD = path.join(REPORT_DIR, "aleta-whatsapp-production-post-launch-latest.md");
const AUDIT_JSONL = path.join(REPORT_DIR, "aleta-whatsapp-production-automation-audit.jsonl");
const ROLLBACK_MD = path.join(REPORT_DIR, "aleta-whatsapp-production-rollback-plan.md");
const MONITORING_MD = path.join(REPORT_DIR, "aleta-whatsapp-production-day-one-monitoring.md");

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

const PRODUCTION_WORKFLOW_IDS = new Set([
  "prod-internal-disposition-notification",
  "prod-internal-incoming-letter-notification",
  "prod-disposition-deadline-h-minus-1",
]);

const portalEnv = loadEnvFiles([path.join(PORTAL_DIR, ".env"), path.join(PORTAL_DIR, ".env.local")]);

function loadEnvFiles(files) {
  const values = { ...process.env };
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    }
  }
  return values;
}

const APPROVAL_GATED_CAPABILITY_IDS = new Set([
  "prod-broadcast-capability",
  "prod-external-party-capability",
  "prod-mass-resend-capability",
]);

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !["qr", "lastQrString", "qrString", "rawQr", "stack", "sessionPath"].includes(key))
        .map(([key, child]) => [key, sanitizeValue(child)])
    );
  }
  if (typeof value === "string") {
    return value
      .replace(/62\d{7,15}/g, (match) => {
        const digits = String(match).replace(/\D/g, "");
        return digits.length >= 8 ? `${digits.slice(0, 3)}****${digits.slice(-4)}` : "[masked-phone]";
      })
      .replace(/\.wwebjs_auth[^\s"'<>]*/gi, "[session-path]")
      .replace(/session-[a-z0-9_-]+/gi, "[session-name]")
      .replace(/(token|password|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]");
  }
  return value;
}

function readRuntimeConfigFiles() {
  return RUNTIME_CONFIG_PATHS.filter((file) => existsSync(file)).map((file) => ({
    file,
    parsed: JSON.parse(readFileSync(file, "utf8")),
  }));
}

function buildProductionRegistry(registry = [], now) {
  return (Array.isArray(registry) ? registry : []).map((item) => {
    if (PRODUCTION_WORKFLOW_IDS.has(item.notificationId)) {
      return {
        ...item,
        productionEligible: true,
        enabled: true,
        mode: "production",
        productionApprovedAt: item.productionApprovedAt || now,
        productionApprovedBy: item.productionApprovedBy || "aleta-whatsapp-production-launch.mjs",
        notes: "Production automation enabled after risk-check, shadow-run, and canary PASS.",
      };
    }
    if (APPROVAL_GATED_CAPABILITY_IDS.has(item.notificationId)) {
      return {
        ...item,
        productionEligible: true,
        enabled: true,
        mode: "approval_gated_production",
        requiresApproval: true,
        productionApprovedAt: item.productionApprovedAt || now,
        productionApprovedBy: item.productionApprovedBy || "aleta-whatsapp-production-launch.mjs",
        notes: "Capability available only behind dry-run preview, approval gate, cap, and audit. No free-send.",
      };
    }
    return item;
  });
}

function buildProductionConfig(runtime = {}, now) {
  const reminder = runtime.dispositionDeadlineReminder || {};
  const scheduler = reminder.scheduler || {};
  return {
    ...runtime,
    updatedAt: now,
    productionAutomationEnabled: true,
    botEnabled: true,
    notificationsEnabled: true,
    dryRunEnabled: false,
    useRegistryNotifications: true,
    registryPilotMode: false,
    registryDryRunDefault: false,
    manualSendEnabled: false,
    publicQaProductionSafeMode: true,
    publicQaRequireApproval: true,
    productionAutomationGuard: {
      ...(runtime.productionAutomationGuard || {}),
      enabled: true,
      legacyDirectSendEnabled: false,
      recipientEligibilityRequired: true,
      templateProductionSafetyRequired: true,
      idempotencyRequired: true,
      capEnforcementRequired: true,
      outlierRequiresApproval: true,
      updatedAt: now,
    },
    productionRecipientGuard: {
      ...(runtime.productionRecipientGuard || {}),
      enabled: true,
      excludeDummyNumbers: true,
      excludeDuplicateNumbers: true,
      excludeInactiveUsers: true,
      requireInternalEmployee: true,
      updatedAt: now,
    },
    productionAutomationCaps: {
      ...CAPS,
      updatedAt: now,
    },
    rateLimit: {
      ...(runtime.rateLimit || {}),
      maxRecipientsPerEvent: CAPS.maxRecipientsPerEvent,
      maxMessagesPerBatch: CAPS.maxMessagesPerBatch,
      maxMessagesPerMinute: CAPS.maxMessagesPerMinute,
      maxMessagesPerHour: CAPS.maxMessagesPerHour,
      maxMessagesPerDay: CAPS.maxMessagesPerDay,
      maxPerMinute: CAPS.maxMessagesPerMinute,
      maxPerHour: CAPS.maxMessagesPerHour,
      maxPerDay: CAPS.maxMessagesPerDay,
    },
    productionApprovalPolicy: {
      ...(runtime.productionApprovalPolicy || {}),
      broadcastRequiresApproval: true,
      externalNotificationRequiresApproval: true,
      massResendRequiresApproval: true,
      outlierRequiresApproval: true,
      schedulerBacklogRequiresApproval: true,
      manualOverrideRequiresApproval: true,
      autoApprove: false,
      auditRequired: true,
      updatedAt: now,
    },
    productionNotificationRegistry: buildProductionRegistry(runtime.productionNotificationRegistry, now),
    dispositionDeadlineReminder: {
      ...reminder,
      enabled: true,
      mode: "production",
      approvedAt: reminder.approvedAt || now,
      approvedBy: reminder.approvedBy || "aleta-whatsapp-production-launch.mjs",
      killSwitch: false,
      defaultDryRun: false,
      backlogPolicy: "requires_review",
      scheduler: {
        ...scheduler,
        enabled: true,
        mode: "production",
        time: scheduler.time || "08:00:00",
        backlogPolicy: "requires_review",
        lastMessage: scheduler.lastMessage || "Production enabled after full gate PASS.",
      },
    },
    productionLaunchAudit: {
      changedBy: "aleta-whatsapp-production-launch.mjs",
      changedAt: now,
      launchName: "ALETA WhatsApp Full Production Automation Launch",
      canaryRequired: true,
      canaryPassed: true,
      productionGuardActive: true,
      caps: CAPS,
    },
  };
}

function writeProductionConfigFiles(configs) {
  const now = new Date().toISOString();
  for (const config of configs) {
    const next = buildProductionConfig(config.parsed, now);
    writeFileSync(config.file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
  appendFileSync(
    AUDIT_JSONL,
    `${JSON.stringify({
      at: now,
      action: "production_launch_enabled",
      botEnabled: true,
      notificationsEnabled: true,
      dryRunEnabled: false,
      schedulerProductionEnabled: true,
      reminderProductionEnabled: true,
      caps: CAPS,
    })}\n`,
    "utf8"
  );
}

async function updatePortalProductionSettings(now) {
  const databaseUrl = portalEnv.DATABASE_URL;
  if (!databaseUrl) {
    return { status: "WARN", detail: "DATABASE_URL portal tidak tersedia; runtime config tetap sudah diaktifkan." };
  }

  let pool = null;
  try {
    const portalRequire = createRequire(path.join(PORTAL_DIR, "package.json"));
    const { Pool } = portalRequire("pg");
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(
      `INSERT INTO aleta_bot_settings (
         id, bot_enabled, notifications_enabled, message_delay_ms, retry_limit, dry_run_enabled,
         disposition_deadline_reminder_enabled, disposition_deadline_reminder_mode,
         disposition_deadline_reminder_approved_at, disposition_deadline_reminder_approved_by,
         disposition_deadline_reminder_scheduler_enabled, disposition_deadline_reminder_scheduler_mode,
         disposition_deadline_reminder_scheduler_time, disposition_deadline_reminder_scheduler_last_message,
         disposition_deadline_reminder_kill_switch, updated_at
       ) VALUES (
         1, 1, 1, 1500, 2, 0,
         1, 'production',
         $1, 'aleta-whatsapp-production-launch.mjs',
         1, 'production',
         '08:00:00', 'Production enabled after full gate PASS. Backlog requires review.',
         0, $1
       )
       ON CONFLICT (id) DO UPDATE SET
         bot_enabled = 1,
         notifications_enabled = 1,
         dry_run_enabled = 0,
         disposition_deadline_reminder_enabled = 1,
         disposition_deadline_reminder_mode = 'production',
         disposition_deadline_reminder_approved_at = COALESCE(aleta_bot_settings.disposition_deadline_reminder_approved_at, EXCLUDED.disposition_deadline_reminder_approved_at),
         disposition_deadline_reminder_approved_by = COALESCE(aleta_bot_settings.disposition_deadline_reminder_approved_by, EXCLUDED.disposition_deadline_reminder_approved_by),
         disposition_deadline_reminder_scheduler_enabled = 1,
         disposition_deadline_reminder_scheduler_mode = 'production',
         disposition_deadline_reminder_scheduler_time = '08:00:00',
         disposition_deadline_reminder_scheduler_last_message = 'Production enabled after full gate PASS. Backlog requires review.',
         disposition_deadline_reminder_kill_switch = 0,
         updated_at = EXCLUDED.updated_at`,
      [now]
    );
    return { status: "PASS", detail: "Portal DB aleta_bot_settings disinkronkan ke production automation." };
  } catch (error) {
    return {
      status: "FAIL",
      detail: String(error?.message || error)
        .replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[path]")
        .slice(0, 240),
    };
  } finally {
    await pool?.end();
  }
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const configs = readRuntimeConfigFiles();
  const runtime = configs[0]?.parsed || {};
  const preflight = readJson(PREFLIGHT_JSON, {});
  const smoke = readJson(SMOKE_JSON, {});
  const risk = readJson(RISK_JSON, {});
  const shadow = readJson(SHADOW_JSON, {});
  const canary = readJson(CANARY_JSON, {});
  const riskPass = risk.overall === "PASS";
  const shadowPass = shadow.overall === "PASS";
  const canaryPass =
    canary.overall === "PASS" &&
    canary.canaryExecuted === true &&
    Number(canary.sentCount || 0) > 0 &&
    Number(canary.failedCount || 0) === 0 &&
    Number(canary.duplicateCount || 0) === 0 &&
    Number(canary.outOfWhitelistRecipients || 0) === 0 &&
      Number(canary.deadLetterActiveAfter || 0) === 0;
  const productionGo = riskPass && shadowPass && canaryPass;
  const activationAt = new Date().toISOString();
  let portalSettingsUpdate = { status: "SKIPPED", detail: "Production launch belum GO." };

  if (productionGo) {
    writeProductionConfigFiles(configs);
    portalSettingsUpdate = await updatePortalProductionSettings(activationAt);
  }

  const finalRuntime = readRuntimeConfigFiles()[0]?.parsed || runtime;
  const runtimeSummary = preflight.summary?.runtime || smoke.summary?.runtime || {};
  const queue = preflight.summary?.queue || smoke.summary?.queue || {};
  const worker = preflight.summary?.worker || smoke.summary?.worker || runtimeSummary.worker || {};
  const reminder = finalRuntime.dispositionDeadlineReminder || {};
  const scheduler = reminder.scheduler || {};
  const productionRegistry = Array.isArray(finalRuntime.productionNotificationRegistry)
    ? finalRuntime.productionNotificationRegistry
    : [];

  const result = {
    generatedAt: new Date().toISOString(),
    overall: productionGo ? "GO" : "NO_GO",
    launchName: "ALETA WhatsApp Production Automation Launch",
    productionAutomationEnabled: Boolean(finalRuntime.productionAutomationEnabled),
    botEnabledFinal: Boolean(finalRuntime.botEnabled),
    notificationsEnabledFinal: Boolean(finalRuntime.notificationsEnabled),
    schedulerProductionEnabled: Boolean(scheduler.enabled && scheduler.mode === "production"),
    reminderProductionEnabled: Boolean(reminder.enabled && reminder.mode === "production"),
    broadcastEnabledWithApprovalGate: productionRegistry.some(
      (item) => item.notificationId === "prod-broadcast-capability" && item.enabled === true && item.requiresApproval === true
    ),
    externalNotificationEnabledWithApprovalGate: productionRegistry.some(
      (item) => item.notificationId === "prod-external-party-capability" && item.enabled === true && item.requiresApproval === true
    ),
    massResendEnabledWithApprovalGate: productionRegistry.some(
      (item) => item.notificationId === "prod-mass-resend-capability" && item.enabled === true && item.requiresApproval === true
    ),
    publicQaProductionSafeMode: Boolean(finalRuntime.publicQaProductionSafeMode) || risk.riskGates?.publicQa === "PASS",
    riskGates: risk.riskGates || {},
    shadowRun: {
      overall: shadow.overall || "missing",
      workflows: shadow.workflows || [],
    },
    canary: {
      overall: canary.overall || "missing",
      sentCount: Number(canary.sentCount || 0),
      failedCount: Number(canary.failedCount || 0),
      duplicateCount: Number(canary.duplicateCount || 0),
      outOfWhitelistRecipients: Number(canary.outOfWhitelistRecipients || 0),
      deadLetterActiveAfter: Number(canary.deadLetterActiveAfter || 0),
      executed: Boolean(canary.canaryExecuted),
      recipients: canary.recipients || [],
    },
    caps: CAPS,
    runtime: {
      whatsappStatus: runtimeSummary.whatsappStatus || "unknown",
      workerActive: Boolean(worker.enabled && worker.activeTimer && !worker.paused),
      queuePending: Number(queue.pending || 0),
      queueProcessing: Number(queue.processing || 0),
      queueFailed: Number(queue.failed || 0),
      deadLetterActive: Number(queue.activeDeadLetters || 0),
      approvalPending: Number(preflight.summary?.approvals?.pending || 0),
      botEnabled: Boolean(finalRuntime.botEnabled),
      notificationsEnabled: Boolean(finalRuntime.notificationsEnabled),
    },
    guards: {
      schedulerProductionActive: Boolean(scheduler.enabled && scheduler.mode === "production"),
      reminderProductionActive: Boolean(reminder.enabled && reminder.mode === "production"),
      broadcastEnabledWithApprovalGate: false,
      externalNotificationEnabledWithApprovalGate: false,
      massResendEnabledWithApprovalGate: false,
    },
    workflowProductionActive: productionRegistry
      .filter((item) => item.enabled === true)
      .map((item) => ({
        notificationId: item.notificationId,
        workflowName: item.workflowName,
        mode: item.mode,
        requiresApproval: Boolean(item.requiresApproval),
      })),
    blockers: [],
    warnings: [],
    portalSettingsUpdate,
    actionsTaken: [],
    rollback: [
      "Set botEnabled=false di runtime config resmi.",
      "Set notificationsEnabled=false di runtime config resmi.",
      "Set dryRunEnabled=true untuk menahan direct safeSend non-queue.",
      "Set dispositionDeadlineReminder.enabled=false dan scheduler.enabled=false.",
      "Pause worker melalui Admin ALETA Bot bila queue failed/dead-letter muncul.",
      "Jangan resend dead-letter tanpa review manual.",
    ],
    reports: [
      REPORT_JSON,
      REPORT_MD,
      FULL_READINESS_JSON,
      FULL_READINESS_MD,
      POST_LAUNCH_JSON,
      POST_LAUNCH_MD,
      ROLLBACK_MD,
      MONITORING_MD,
      RISK_JSON,
      SHADOW_JSON,
      CANARY_JSON,
    ],
  };

  result.guards.broadcastEnabledWithApprovalGate = result.broadcastEnabledWithApprovalGate;
  result.guards.externalNotificationEnabledWithApprovalGate = result.externalNotificationEnabledWithApprovalGate;
  result.guards.massResendEnabledWithApprovalGate = result.massResendEnabledWithApprovalGate;

  if (!riskPass) result.blockers.push({ key: "risk_check_not_pass", detail: `Risk check=${risk.overall || "missing"}.` });
  if (!shadowPass) result.blockers.push({ key: "shadow_run_not_pass", detail: `Shadow-run=${shadow.overall || "missing"}.` });
  if (!canaryPass) {
    result.blockers.push({
      key: "canary_not_pass_or_not_run",
      detail: `Canary=${canary.overall || "missing"}, executed=${Boolean(canary.canaryExecuted)}, sent=${Number(canary.sentCount || 0)}.`,
    });
  }
  if (productionGo) {
    if (portalSettingsUpdate.status === "FAIL") {
      result.blockers.push({ key: "portal_settings_update_failed", detail: portalSettingsUpdate.detail });
      result.overall = "NO_GO";
      result.productionAutomationEnabled = false;
    }
    result.actionsTaken.push({
      action: "production_launch_enabled",
      detail: `Semua gate PASS; botEnabled, notifications, registry production, scheduler/reminder H-1 production, cap, approval gate, audit, dan rollback diaktifkan. Portal settings: ${portalSettingsUpdate.status}.`,
    });
  } else {
    result.actionsTaken.push({
      action: "production_launch_blocked",
      detail: "Production automation tidak diaktifkan karena gate belum lengkap.",
    });
  }

  appendFileSync(
    AUDIT_JSONL,
    `${JSON.stringify({
      at: result.generatedAt,
      action: result.actionsTaken[0].action,
      overall: result.overall,
      productionAutomationEnabled: result.productionAutomationEnabled,
      botEnabledFinal: result.botEnabledFinal,
      notificationsEnabledFinal: result.notificationsEnabledFinal,
      schedulerProductionEnabled: result.schedulerProductionEnabled,
      reminderProductionEnabled: result.reminderProductionEnabled,
      blockers: result.blockers.map((item) => item.key),
    })}\n`,
    "utf8"
  );

  const safe = sanitizeValue(result);
  writeFileSync(REPORT_JSON, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  writeFileSync(FULL_READINESS_JSON, `${JSON.stringify({
    ...safe,
    reportName: "ALETA WhatsApp Full Production Readiness",
    fullProductionSucceeded: safe.overall === "GO" && safe.productionAutomationEnabled === true,
  }, null, 2)}\n`, "utf8");
  writeFileSync(POST_LAUNCH_JSON, `${JSON.stringify({
    ...safe,
    reportName: "ALETA WhatsApp Production Post Launch",
    postLaunchValidation: {
      riskCheck: risk.overall || "missing",
      shadowRun: shadow.overall || "missing",
      canary: canary.overall || "missing",
      queueHealthy: safe.runtime.queuePending === 0 && safe.runtime.queueProcessing === 0 && safe.runtime.queueFailed === 0,
      deadLetterActive: safe.runtime.deadLetterActive,
      approvalPending: safe.runtime.approvalPending,
    },
  }, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA WhatsApp Production Automation Launch",
    "",
    `Generated: ${safe.generatedAt}`,
    "",
    `Decision: **${safe.overall}**`,
    `Production automation enabled: **${safe.productionAutomationEnabled ? "yes" : "no"}**`,
    `botEnabled final: **${safe.botEnabledFinal}**`,
    `notificationsEnabled final: **${safe.notificationsEnabledFinal}**`,
    `Scheduler production enabled: **${safe.schedulerProductionEnabled}**`,
    `Reminder production enabled: **${safe.reminderProductionEnabled}**`,
    "",
    "## Risk Gates",
    ...Object.entries(safe.riskGates).map(([gate, status]) => `- ${status} - ${gate}`),
    "",
    "## Shadow Run",
    `Overall: ${safe.shadowRun.overall}`,
    ...(safe.shadowRun.workflows || []).map(
      (workflow) => `- ${workflow.decision} - ${workflow.name}: ${workflow.reason}`
    ),
    "",
    "## Canary",
    `Overall: ${safe.canary.overall}`,
    `Executed: ${safe.canary.executed}`,
    `Sent count: ${safe.canary.sentCount}`,
    `Failed count: ${safe.canary.failedCount}`,
    "",
    "## Enabled Workflows",
    ...(safe.workflowProductionActive.length
      ? safe.workflowProductionActive.map((item) => `- ${item.workflowName}: ${item.mode}, approval=${item.requiresApproval}`)
      : ["- Tidak ada workflow production aktif."]),
    "",
    "## Blockers",
    ...(safe.blockers.length ? safe.blockers.map((item) => `- ${item.key}: ${item.detail}`) : ["- Tidak ada blocker."]),
    "",
    "## Final State",
    `- WhatsApp: ${safe.runtime.whatsappStatus}`,
    `- Worker active: ${safe.runtime.workerActive}`,
    `- Queue: pending=${safe.runtime.queuePending}, processing=${safe.runtime.queueProcessing}, failed=${safe.runtime.queueFailed}`,
    `- Dead-letter active: ${safe.runtime.deadLetterActive}`,
    `- Approval pending: ${safe.runtime.approvalPending}`,
    `- notificationsEnabled: ${safe.runtime.notificationsEnabled}`,
    "",
    "## Important",
    "Broadcast, external notification, and mass resend remain approval-gated. Full production does not mean free-send.",
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
  writeFileSync(
    FULL_READINESS_MD,
    `# ALETA WhatsApp Full Production Readiness\n\n${md.replace("# ALETA WhatsApp Production Automation Launch\n\n", "")}\n`,
    "utf8"
  );
  writeFileSync(
    POST_LAUNCH_MD,
    `# ALETA WhatsApp Production Post Launch\n\n${md.replace("# ALETA WhatsApp Production Automation Launch\n\n", "")}\n`,
    "utf8"
  );

  writeFileSync(
    ROLLBACK_MD,
    [
      "# ALETA WhatsApp Production Rollback Plan",
      "",
      "## Fast Safe Mode",
      "",
      "1. Set `botEnabled=false`.",
      "2. Set `notificationsEnabled=false`.",
      "3. Set `dryRunEnabled=true`.",
      "4. Set `dispositionDeadlineReminder.enabled=false`.",
      "5. Set `dispositionDeadlineReminder.scheduler.enabled=false`.",
      "6. Pause queue worker if queue failed grows.",
      "7. Do not resend dead-letter automatically.",
      "8. Run preflight and smoke dry-run.",
      "",
      "## Rollback Triggers",
      "",
      "- queue failed > 0",
      "- active dead-letter > 0",
      "- duplicate send suspected",
      "- wrong recipient suspected",
      "- scheduler sends outside approved scope",
      "- WhatsApp browser_locked or stuck initializing",
    ].join("\n"),
    "utf8"
  );

  writeFileSync(
    MONITORING_MD,
    [
      "# ALETA WhatsApp Production Day-One Monitoring",
      "",
      "## Monitor Every 15 Minutes For First 2 Hours",
      "",
      "- WhatsApp status",
      "- worker enabled / active timer / paused",
      "- queue pending / processing / failed",
      "- active dead-letter",
      "- approval pending",
      "- policy skip",
      "- sent count per hour",
      "- recipient outliers",
      "",
      "## Rollback Thresholds",
      "",
      "- queue failed > 0",
      "- active dead-letter > 0",
      "- sent count exceeds approved cap",
      "- any external send without approval",
      "- any duplicate idempotency pattern",
      "- botEnabled true while scheduler/reminder gate is not approved",
    ].join("\n"),
    "utf8"
  );

  console.log(`Production launch decision: ${result.overall}. Report: ${REPORT_JSON}`);
  if (result.overall === "NO_GO") process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Production launch failed: ${String(error?.message || error).slice(0, 240)}`);
  process.exitCode = 1;
});
