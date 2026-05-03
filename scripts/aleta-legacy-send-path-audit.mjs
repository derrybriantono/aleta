import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const APP_JS = path.join(BOT_DIR, "app.js");
const RUNTIME_CONFIG = path.join(BOT_DIR, "config", "aleta-runtime.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-legacy-send-path-audit-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-legacy-send-path-audit-latest.md");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function lineMatches(source, pattern) {
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ lineNumber: index + 1, line: line.trim() }))
    .filter((item) => pattern.test(item.line));
}

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const runtime = readJson(RUNTIME_CONFIG);
  const source = readFileSync(APP_JS, "utf8");
  const cron = lineMatches(source, /cron\.schedule\(/);
  const clientSend = lineMatches(source, /client\.sendMessage\(/);
  const safeSend = lineMatches(source, /safeSendMessage\(/);
  const safeTracked = lineMatches(source, /safeSendTrackedMessage\(/);
  const result = {
    generatedAt: new Date().toISOString(),
    overall: runtime.productionAutomationGuard?.legacyDirectSendEnabled === false ? "WARN" : "FAIL",
    legacyDirectSendEnabled: Boolean(runtime.productionAutomationGuard?.legacyDirectSendEnabled),
    cronScheduleCount: cron.length,
    clientSendMessageCount: clientSend.length,
    safeSendMessageCount: safeSend.length,
    safeSendTrackedCount: safeTracked.length,
    guardStatus: runtime.productionAutomationGuard?.legacyDirectSendEnabled === false
      ? "legacy_direct_send_blocked_by_guard"
      : "legacy_direct_send_not_blocked",
    cronSchedules: cron,
    directSendCalls: clientSend,
    safeSendCalls: safeSend,
    remediation: [
      "Legacy direct-send is blocked by productionGuardService while legacyDirectSendEnabled=false.",
      "Long-term: migrate each cron to production notification registry with idempotency, cap, and approval gates.",
      "Do not enable legacyDirectSendEnabled for production.",
    ],
  };
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA Legacy Send Path Audit",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: **${result.overall}**`,
    `Legacy direct send enabled: ${result.legacyDirectSendEnabled}`,
    `Cron schedule count: ${result.cronScheduleCount}`,
    `client.sendMessage calls: ${result.clientSendMessageCount}`,
    `safeSendMessage calls: ${result.safeSendMessageCount}`,
    "",
    "## Guard",
    result.guardStatus,
    "",
    "## Remediation",
    ...result.remediation.map((item) => `- ${item}`),
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
  console.log(`Legacy send path audit: ${result.overall}. Report: ${REPORT_JSON}`);
}

main();
