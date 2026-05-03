import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const RUNTIME_CONFIG = path.join(BOT_DIR, "config", "aleta-runtime.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-notification-production-registry-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-notification-production-registry-latest.md");
const productionGuardService = require(path.join(BOT_DIR, "services", "productionGuardService.js"));

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const runtime = readJson(RUNTIME_CONFIG);
  const templates = runtime.templates || [];
  const registry = runtime.productionNotificationRegistry || [];
  const items = registry.map((item) => {
    const template = templates.find((entry) => entry.id === item.templateId);
    const templateValidation = item.templateId
      ? productionGuardService.validateProductionTemplateSafety(template, {
          nama_pegawai: "Contoh Pegawai",
          judul_notifikasi: "Contoh Notifikasi",
          ringkasan: "Ringkasan aman.",
          perihal: "Contoh Surat",
          deadline: "2026-05-03",
        })
      : { valid: item.requiresApproval === true, errors: item.requiresApproval ? [] : ["template_not_configured"] };
    const gateOk = item.productionEligible === true
      ? templateValidation.valid && item.enabled === false && item.maxRecipientsPerEvent <= 5
      : item.requiresApproval === true && item.enabled === false;
    return {
      ...item,
      templateValidation,
      decision: gateOk ? "PASS" : "WARN",
      productionActivationState: item.enabled ? "active" : "locked_or_disabled",
    };
  });
  const result = {
    generatedAt: new Date().toISOString(),
    overall: items.every((item) => item.decision === "PASS") ? "PASS" : "WARN",
    total: items.length,
    productionEligibleCount: items.filter((item) => item.productionEligible === true).length,
    enabledCount: items.filter((item) => item.enabled === true).length,
    highRiskLockedCount: items.filter((item) => item.riskLevel === "high" && item.enabled === false && item.requiresApproval === true).length,
    items,
  };
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA Notification Production Registry",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: **${result.overall}**`,
    `Total registry items: ${result.total}`,
    `Production eligible: ${result.productionEligibleCount}`,
    `Enabled: ${result.enabledCount}`,
    "",
    "## Items",
    ...items.map((item) => `- ${item.decision} - ${item.workflowName}: eligible=${item.productionEligible}, enabled=${item.enabled}, mode=${item.mode}, approval=${item.requiresApproval}, template=${item.templateId || "-"}`),
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
  console.log(`Production registry: ${result.overall}. Report: ${REPORT_JSON}`);
}

main();
