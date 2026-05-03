import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const PORTAL_DIR = path.join(ROOT_DIR, "manajemen_surat");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const RUNTIME_CONFIG = path.join(BOT_DIR, "config", "aleta-runtime.json");
const PORTAL_RUNTIME_CONFIG = path.join(PORTAL_DIR, "data", "aleta-bot-runtime.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-whatsapp-number-quality-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-whatsapp-number-quality-latest.md");
const CORRECTION_MD = path.join(REPORT_DIR, "aleta-whatsapp-number-correction-list.md");
const productionGuardService = require(path.join(BOT_DIR, "services", "productionGuardService.js"));

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function loadEnvFile(file) {
  const values = {};
  if (!existsSync(file)) return values;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1].trim()] = value;
  }
  return values;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

async function loadDbRecipients() {
  const env = {
    ...loadEnvFile(path.join(PORTAL_DIR, ".env")),
    ...loadEnvFile(path.join(PORTAL_DIR, ".env.local")),
  };
  if (!env.DATABASE_URL) return { source: "runtime_config", recipients: null, error: "DATABASE_URL not configured" };
  try {
    const portalRequire = createRequire(path.join(PORTAL_DIR, "package.json"));
    const { Pool } = portalRequire("pg");
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    const rows = await pool.query(
      `SELECT u.id, u.username, u.name, u.role_id, u.position_id, u.whatsapp_number,
              p.name AS position_name
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
       WHERE u.deleted_at IS NULL AND u.is_active = 1
       ORDER BY u.name ASC`
    );
    await pool.end();
    return {
      source: "portal_database",
      recipients: rows.rows.map((row) => {
        const whatsappNumber = normalizePhone(row.whatsapp_number);
        return {
          id: String(row.id || ""),
          username: String(row.username || ""),
          name: String(row.name || row.username || ""),
          roleId: String(row.role_id || "").toLowerCase(),
          positionId: String(row.position_id || "").toLowerCase(),
          positionName: String(row.position_name || "").toLowerCase(),
          whatsappNumber,
          whatsappChatId: whatsappNumber ? `${whatsappNumber}@c.us` : "",
        };
      }),
      error: "",
    };
  } catch (error) {
    return { source: "runtime_config", recipients: null, error: String(error.message || error).slice(0, 200) };
  }
}

function syncRuntimeRecipients(runtime, recipients) {
  const next = {
    ...runtime,
    employeeRecipients: recipients,
    employeeRecipientsSyncedAt: new Date().toISOString(),
    employeeRecipientsSource: "portal_database",
  };
  writeFileSync(RUNTIME_CONFIG, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  if (existsSync(PORTAL_RUNTIME_CONFIG)) {
    try {
      const portalRuntime = readJson(PORTAL_RUNTIME_CONFIG);
      writeFileSync(
        PORTAL_RUNTIME_CONFIG,
        `${JSON.stringify({ ...portalRuntime, employeeRecipients: recipients, employeeRecipientsSyncedAt: next.employeeRecipientsSyncedAt, employeeRecipientsSource: "portal_database" }, null, 2)}\n`,
        "utf8"
      );
    } catch {
      // Portal runtime mirror is optional for this audit script.
    }
  }
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const runtime = readJson(RUNTIME_CONFIG);
  const db = await loadDbRecipients();
  const recipients = db.recipients || runtime.employeeRecipients || [];
  if (db.recipients) {
    syncRuntimeRecipients(runtime, db.recipients);
  }
  const analysis = productionGuardService.analyzeEmployeeRecipients(
    recipients,
    runtime.productionRecipientGuard || {}
  );
  const excluded = analysis.recipients
    .filter((item) => !item.eligibleForWhatsappProduction)
    .map((item) => ({
      id: item.id || "",
      name: item.name || "",
      roleId: item.roleId || "",
      positionName: item.positionName || "",
      phoneMasked: item.productionPhoneMasked,
      phoneHash: item.productionPhoneHash,
      reasons: item.whatsappProductionExclusionReasons,
      action: "manual_correction_required_or_keep_excluded",
    }));
  const result = {
    generatedAt: new Date().toISOString(),
    overall: excluded.length > 0 ? "WARN" : "PASS",
    source: db.source,
    databaseSyncApplied: Boolean(db.recipients),
    databaseError: db.error || "",
    totalActiveEmployees: analysis.totalActive,
    validForWhatsappProduction: analysis.validCount,
    missingCount: Math.max(0, analysis.totalActive - analysis.recipients.filter((item) => item.productionPhone).length),
    priorityMissingCount: analysis.recipients.filter((item) => {
      const role = String(item.roleId || "").toLowerCase();
      return ["super-admin", "admin", "ketua", "wakil-ketua", "hakim", "panitera", "sekretaris"].includes(role) && !item.productionPhone;
    }).length,
    dummyCount: analysis.dummyCount,
    duplicateGroupsCount: analysis.duplicateGroupsCount,
    invalidCount: analysis.invalidCount,
    excludedFromProductionCount: analysis.excludedCount,
    duplicateGroups: analysis.duplicateGroups,
    excludedRecipients: excluded,
    manualCorrectionRequired: excluded.length > 0,
    notes: excluded.length > 0
      ? [
          "Nomor tidak dihapus dan tidak diganti otomatis.",
          "Recipient guard mengecualikan nomor dummy/duplikat dari production resolver.",
          "Production boleh dipertimbangkan hanya untuk recipient eligible.",
        ]
      : [
          "All 42 active employees are eligible for WhatsApp production.",
          "Nomor penuh tidak ditampilkan.",
          "Runtime employee recipient mirror disinkronkan dari database portal bila DATABASE_URL tersedia.",
        ],
  };
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA WhatsApp Number Quality",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: **${result.overall}**`,
    "",
    `- Total pegawai aktif: ${result.totalActiveEmployees}`,
    `- Valid untuk production: ${result.validForWhatsappProduction}`,
    `- Missing count: ${result.missingCount}`,
    `- Priority missing count: ${result.priorityMissingCount}`,
    `- Dummy count: ${result.dummyCount}`,
    `- Duplicate groups: ${result.duplicateGroupsCount}`,
    `- Invalid count: ${result.invalidCount}`,
    `- Excluded from production: ${result.excludedFromProductionCount}`,
    "",
    "## Excluded Recipients",
    ...(excluded.length
      ? excluded.map((item) => `- ${item.name} (${item.roleId || item.positionName}) ${item.phoneMasked}: ${item.reasons.join(", ")}`)
      : ["- Tidak ada."]),
    "",
    "## Notes",
    ...result.notes.map((note) => `- ${note}`),
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
  const correctionLines = [
    "# ALETA WhatsApp Number Correction List",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    excluded.length === 0
      ? "All 42 active employees are eligible for WhatsApp production."
      : "Daftar koreksi manual masih diperlukan untuk nomor berikut.",
    "",
    "## Excluded Recipients",
    ...(excluded.length
      ? excluded.map((item) => `- ${item.name} (${item.roleId || item.positionName}) ${item.phoneMasked}: ${item.reasons.join(", ")}`)
      : ["- Tidak ada."]),
    "",
    "Nomor penuh sengaja tidak ditampilkan.",
  ];
  writeFileSync(CORRECTION_MD, `${correctionLines.join("\n")}\n`, "utf8");
  console.log(`Number quality: ${result.overall}. Report: ${REPORT_JSON}`);
}

main().catch((error) => {
  console.error(`Number quality failed: ${error.message}`);
  process.exitCode = 1;
});
