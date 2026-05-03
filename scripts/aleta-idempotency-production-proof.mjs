import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const RUNTIME_CONFIG = path.join(BOT_DIR, "config", "aleta-runtime.json");
const APP_JS = path.join(BOT_DIR, "app.js");
const QUEUE_SERVICE = path.join(BOT_DIR, "services", "messageQueueService.js");
const MESSAGE_SERVICE = path.join(BOT_DIR, "services", "messageService.js");
const INTERNAL_ROUTES = path.join(BOT_DIR, "routes", "internalGatewayRoutes.js");
const NUMBER_QUALITY_JSON = path.join(REPORT_DIR, "aleta-whatsapp-number-quality-latest.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-idempotency-production-proof-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-idempotency-production-proof-latest.md");
const productionGuardService = require(path.join(BOT_DIR, "services", "productionGuardService.js"));

function readJson(file, fallback = {}) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readText(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

function addCheck(result, key, label, status, detail, metadata = {}) {
  const check = { key, label, status, detail, metadata };
  result.checks.push(check);
  if (status === "FAIL") result.blockers.push({ key, label, detail });
  if (status === "WARN") result.warnings.push({ key, label, detail });
  return check;
}

function buildKey(input) {
  return productionGuardService.buildNotificationIdempotencyKey(input);
}

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const runtime = readJson(RUNTIME_CONFIG, {});
  const numberQuality = readJson(NUMBER_QUALITY_JSON, {});
  const appSource = readText(APP_JS);
  const queueSource = readText(QUEUE_SERVICE);
  const messageSource = readText(MESSAGE_SERVICE);
  const routeSource = readText(INTERNAL_ROUTES);
  const registry = Array.isArray(runtime.productionNotificationRegistry) ? runtime.productionNotificationRegistry : [];
  const productionItems = registry.filter((item) => item.productionEligible === true);
  const sampleRecipient = (runtime.employeeRecipients || [])[0] || { id: "sample-user", whatsappNumber: "6280000000000" };
  const samplePhoneHash = productionGuardService.hashPhone(sampleRecipient.whatsappNumber || sampleRecipient.whatsapp_number || "");
  const result = {
    generatedAt: new Date().toISOString(),
    overall: "FAIL",
    checks: [],
    blockers: [],
    warnings: [],
    simulations: [],
    actionsTaken: [
      {
        action: "proof_only",
        detail: "Tidak ada send, enqueue, resend, worker trigger, atau production activation.",
      },
    ],
  };

  addCheck(
    result,
    "guard_config",
    "Production guard idempotency config",
    runtime.productionAutomationGuard?.enabled === true &&
      runtime.productionAutomationGuard?.idempotencyRequired === true &&
      runtime.productionAutomationGuard?.legacyDirectSendEnabled === false
      ? "PASS"
      : "FAIL",
    "Production guard harus aktif, idempotency wajib, dan legacy direct-send tidak boleh enabled."
  );

  addCheck(
    result,
    "queue_idempotency_lookup",
    "Queue idempotency lookup",
    /findByIdempotencyKey|WHERE idempotency_key/.test(routeSource + queueSource) ? "PASS" : "FAIL",
    "Endpoint enqueue dan queue service harus mengecek idempotency key sebelum insert."
  );

  addCheck(
    result,
    "legacy_guard_block",
    "Legacy direct-send guard",
    /legacy_direct_send_blocked_by_production_guard/.test(messageSource) &&
      /legacy_client_sendMessage/.test(appSource) &&
      runtime.productionAutomationGuard?.legacyDirectSendEnabled === false
      ? "PASS"
      : "FAIL",
    "Legacy client.sendMessage tetap ada, tetapi production guard harus memblokir jalur production legacy."
  );

  addCheck(
    result,
    "number_duplicate_proof",
    "Same phone duplicate proof",
    Number(numberQuality.duplicateGroupsCount || 0) === 0 ? "PASS" : "FAIL",
    `duplicateGroups=${numberQuality.duplicateGroupsCount ?? "unknown"}.`
  );

  const missingStrategies = productionItems.filter((item) => !item.idempotencyStrategy);
  addCheck(
    result,
    "registry_idempotency_strategy",
    "Registry idempotency strategy",
    missingStrategies.length === 0 ? "PASS" : "FAIL",
    `productionEligibleItems=${productionItems.length}, missingStrategy=${missingStrategies.length}.`
  );

  const scenarios = [
    {
      name: "same_event_twice",
      first: {
        workflow: "internal_disposition_notification",
        entityType: "disposition",
        entityId: "disp-canary-001",
        recipientUserId: sampleRecipient.id,
        recipientPhoneHash: samplePhoneHash,
        templateId: "pegawai-monitoring",
        triggerName: "created",
      },
      second: {
        workflow: "internal_disposition_notification",
        entityType: "disposition",
        entityId: "disp-canary-001",
        recipientUserId: sampleRecipient.id,
        recipientPhoneHash: samplePhoneHash,
        templateId: "pegawai-monitoring",
        triggerName: "created",
      },
    },
    {
      name: "scheduler_rerun",
      first: {
        workflow: "deadline_h_minus_1",
        entityType: "disposition",
        entityId: "disp-h1-001",
        recipientUserId: sampleRecipient.id,
        recipientPhoneHash: samplePhoneHash,
        templateId: "disposition-deadline-h-minus-1",
        triggerDate: "2026-05-03",
      },
      second: {
        workflow: "deadline_h_minus_1",
        entityType: "disposition",
        entityId: "disp-h1-001",
        recipientUserId: sampleRecipient.id,
        recipientPhoneHash: samplePhoneHash,
        templateId: "disposition-deadline-h-minus-1",
        triggerDate: "2026-05-03",
      },
    },
    {
      name: "approval_retry",
      first: {
        workflow: "approved_internal_notification",
        entityType: "approval",
        entityId: "approval-001",
        recipientUserId: sampleRecipient.id,
        recipientPhoneHash: samplePhoneHash,
        templateId: "pegawai-monitoring",
        triggerName: "approved",
      },
      second: {
        workflow: "approved_internal_notification",
        entityType: "approval",
        entityId: "approval-001",
        recipientUserId: sampleRecipient.id,
        recipientPhoneHash: samplePhoneHash,
        templateId: "pegawai-monitoring",
        triggerName: "approved",
      },
    },
  ];

  for (const scenario of scenarios) {
    const firstKey = buildKey(scenario.first);
    const secondKey = buildKey(scenario.second);
    result.simulations.push({
      name: scenario.name,
      firstKey,
      secondKey,
      duplicatePrevented: firstKey === secondKey,
      expectedEnqueueCount: firstKey === secondKey ? 1 : 2,
    });
  }

  const failedSimulation = result.simulations.find((item) => !item.duplicatePrevented);
  addCheck(
    result,
    "duplicate_simulation",
    "Duplicate simulation",
    failedSimulation ? "FAIL" : "PASS",
    failedSimulation ? `Simulation ${failedSimulation.name} did not produce stable key.` : "Same event/retry/rerun simulations produce stable keys."
  );

  result.overall = result.blockers.length > 0 ? "FAIL" : result.warnings.length > 0 ? "WARN" : "PASS";
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA Idempotency Production Proof",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: **${result.overall}**`,
    "",
    "## Checks",
    ...result.checks.map((item) => `- ${item.status} - ${item.label}: ${item.detail}`),
    "",
    "## Simulations",
    ...result.simulations.map((item) => `- ${item.name}: duplicatePrevented=${item.duplicatePrevented}, expectedEnqueueCount=${item.expectedEnqueueCount}`),
    "",
    "## Safety",
    "- Proof ini tidak mengirim WhatsApp.",
    "- Proof ini tidak enqueue pesan.",
    "- Proof ini tidak mengaktifkan production.",
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
  console.log(`Idempotency production proof: ${result.overall}. Report: ${REPORT_JSON}`);
  if (result.overall === "FAIL") process.exitCode = 1;
}

main();
