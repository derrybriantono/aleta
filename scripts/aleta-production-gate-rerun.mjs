import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-production-gate-rerun-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-production-gate-rerun-latest.md");

const SOURCES = {
  preflight: "aleta-preflight-latest.json",
  smoke: "aleta-smoke-dry-run-latest.json",
  numberQuality: "aleta-whatsapp-number-quality-latest.json",
  productionRegistry: "aleta-notification-production-registry-latest.json",
  legacyAudit: "aleta-legacy-send-path-audit-latest.json",
  risk: "aleta-whatsapp-production-risk-check-latest.json",
  shadow: "aleta-whatsapp-production-shadow-run-latest.json",
  canary: "aleta-whatsapp-production-canary-latest.json",
  launch: "aleta-whatsapp-production-automation-launch-latest.json",
};

function readJson(name) {
  try {
    return JSON.parse(readFileSync(path.join(REPORT_DIR, name), "utf8"));
  } catch {
    return null;
  }
}

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const reports = Object.fromEntries(Object.entries(SOURCES).map(([key, file]) => [key, readJson(file)]));
  const workflowPasses = reports.shadow?.workflows?.filter((workflow) => workflow.decision === "PASS") || [];
  const workflowFailures = reports.shadow?.workflows?.filter((workflow) => workflow.decision === "FAIL") || [];
  const result = {
    generatedAt: new Date().toISOString(),
    overall: reports.launch?.overall || "NO_GO",
    partialGoAvailable: workflowPasses.length > 0 && reports.risk?.riskGates?.runtime === "PASS" && reports.risk?.riskGates?.queue === "PASS",
    productionAutomationEnabled: Boolean(reports.launch?.productionAutomationEnabled),
    botEnabledFinal: Boolean(reports.launch?.botEnabledFinal),
    schedulerProductionEnabled: Boolean(reports.launch?.schedulerProductionEnabled),
    reminderProductionEnabled: Boolean(reports.launch?.reminderProductionEnabled),
    summary: {
      preflight: reports.preflight?.overall || "missing",
      smoke: reports.smoke?.overall || "missing",
      numberQuality: reports.numberQuality?.overall || "missing",
      productionRegistry: reports.productionRegistry?.overall || "missing",
      legacyAudit: reports.legacyAudit?.overall || "missing",
      risk: reports.risk?.overall || "missing",
      shadow: reports.shadow?.overall || "missing",
      canary: reports.canary?.overall || "missing",
      launch: reports.launch?.overall || "missing",
    },
    workflowPasses,
    workflowFailures,
    blockers: reports.launch?.blockers || [],
    warnings: [
      ...(reports.risk?.warnings || []),
      ...(reports.shadow?.warnings || []),
    ],
    reports: Object.values(SOURCES).map((file) => path.join(REPORT_DIR, file)),
  };
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA Production Gate Rerun",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: **${result.overall}**`,
    `Partial GO available: **${result.partialGoAvailable ? "yes" : "no"}**`,
    `Production automation enabled: **${result.productionAutomationEnabled ? "yes" : "no"}**`,
    "",
    "## Summary",
    ...Object.entries(result.summary).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Workflow PASS",
    ...(workflowPasses.length ? workflowPasses.map((item) => `- ${item.name}`) : ["- Tidak ada."]),
    "",
    "## Workflow FAIL",
    ...(workflowFailures.length ? workflowFailures.map((item) => `- ${item.name}: ${item.reason}`) : ["- Tidak ada."]),
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
  console.log(`Production gate rerun: ${result.overall}. Report: ${REPORT_JSON}`);
}

main();
