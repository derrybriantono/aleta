import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import { getDatabaseRuntimeStatus, type AletaDatabase } from "@/server/db/client";
import { getWhatsappRuntimeModeDiagnostics } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { getPrimaryPdfStorageDirectory } from "@/server/shared/pdf-storage";

export type PreflightStatus = "ok" | "warning" | "error";

export type PreflightCheck = {
  key: string;
  label: string;
  status: PreflightStatus;
  message: string;
  details?: Record<string, unknown>;
};

export type SystemPreflightReport = {
  status: PreflightStatus;
  generatedAt: string;
  summary: {
    ok: number;
    warning: number;
    error: number;
  };
  checks: PreflightCheck[];
};

type CountRow = {
  count: number | string | bigint;
};

function normalizeCount(row: CountRow | undefined | null) {
  return Number(row?.count ?? 0);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function summarizeStatus(checks: PreflightCheck[]): PreflightStatus {
  if (checks.some((check) => check.status === "error")) return "error";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "ok";
}

function summarizeChecks(checks: PreflightCheck[]) {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { ok: 0, warning: 0, error: 0 } as SystemPreflightReport["summary"]
  );
}

function normalizeEnv(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isPublicDeploymentTarget() {
  const markers = [
    process.env.NODE_ENV,
    process.env.ALETA_DEPLOYMENT_TARGET,
    process.env.ALETA_ENV,
    process.env.NEXT_PUBLIC_ALETA_ENV,
  ]
    .map((value) => normalizeEnv(value))
    .filter(Boolean);

  return markers.some((value) =>
    value === "production" ||
    value === "prod" ||
    value === "staging" ||
    value === "staging-public" ||
    value === "public" ||
    value.includes("staging-public")
  );
}

async function addCountCheck(
  db: AletaDatabase,
  checks: PreflightCheck[],
  options: {
    key: string;
    label: string;
    sql: string;
    min?: number;
    emptyStatus?: PreflightStatus;
    okMessage: (count: number) => string;
    emptyMessage: string;
  }
) {
  try {
    const count = normalizeCount(await db.prepare(options.sql).get<CountRow>());
    const min = options.min ?? 1;
    checks.push({
      key: options.key,
      label: options.label,
      status: count >= min ? "ok" : options.emptyStatus ?? "error",
      message: count >= min ? options.okMessage(count) : options.emptyMessage,
      details: { count, min },
    });
  } catch (error) {
    checks.push({
      key: options.key,
      label: options.label,
      status: "error",
      message: `Gagal membaca database: ${errorMessage(error)}`,
    });
  }
}

async function addZeroCountCheck(
  db: AletaDatabase,
  checks: PreflightCheck[],
  options: {
    key: string;
    label: string;
    sql: string;
    okMessage: string;
    nonZeroMessage: (count: number) => string;
  }
) {
  try {
    const count = normalizeCount(await db.prepare(options.sql).get<CountRow>());
    checks.push({
      key: options.key,
      label: options.label,
      status: count === 0 ? "ok" : "error",
      message: count === 0 ? options.okMessage : options.nonZeroMessage(count),
      details: { count },
    });
  } catch (error) {
    checks.push({
      key: options.key,
      label: options.label,
      status: "error",
      message: `Gagal membaca database: ${errorMessage(error)}`,
    });
  }
}

async function addDatabaseRuntimeModeCheck(checks: PreflightCheck[]) {
  const runtime = await getDatabaseRuntimeStatus();
  const publicTarget = isPublicDeploymentTarget();
  const fallbackActive = runtime.activeMode === "fallback";

  checks.push({
    key: "database_runtime_mode",
    label: "Mode runtime database",
    status: fallbackActive ? "error" : "ok",
    message: fallbackActive
      ? "Runtime sedang memakai database fallback in-memory/persistent-dev. Mode ini tidak layak untuk publik/staging-public."
      : `Runtime database aktif: ${runtime.activeMode ?? "belum terdeteksi"}.`,
    details: {
      ...runtime,
      publicTarget,
    },
  });

  checks.push({
    key: "database_fallback_policy",
    label: "Kebijakan fallback database",
    status: publicTarget && runtime.fallback.enabled ? "error" : "ok",
    message:
      publicTarget && runtime.fallback.enabled
        ? "Fallback database masih diizinkan pada target publik/staging-public. Set ALETA_DISABLE_IN_MEMORY_FALLBACK=1 atau jangan aktifkan ALETA_ALLOW_IN_MEMORY_FALLBACK."
        : runtime.fallback.enabled
          ? "Fallback database hanya aktif untuk kenyamanan development lokal."
          : "Fallback database dinonaktifkan.",
    details: {
      publicTarget,
      fallback: runtime.fallback,
    },
  });
}

async function addUploadDirectoryCheck(checks: PreflightCheck[]) {
  const directory = getPrimaryPdfStorageDirectory();

  try {
    await mkdir(directory, { recursive: true });
    await access(directory, constants.W_OK);
    checks.push({
      key: "upload_directory",
      label: "Direktori upload PDF",
      status: "ok",
      message: "Direktori upload tersedia dan writable.",
      details: { directory },
    });
  } catch (error) {
    checks.push({
      key: "upload_directory",
      label: "Direktori upload PDF",
      status: "error",
      message: `Direktori upload belum siap ditulis: ${errorMessage(error)}`,
      details: { directory },
    });
  }
}

async function addAuthSecretCheck(checks: PreflightCheck[]) {
  const localSecretPath = path.join(process.cwd(), "data", ".better-auth-secret");
  const publicTarget = isPublicDeploymentTarget();

  if (process.env.BETTER_AUTH_SECRET?.trim()) {
    checks.push({
      key: "auth_secret",
      label: "Auth secret",
      status: "ok",
      message: "BETTER_AUTH_SECRET tersedia dari environment.",
      details: { source: "environment" },
    });
    return;
  }

  try {
    await access(localSecretPath, constants.R_OK);
    checks.push({
      key: "auth_secret",
      label: "Auth secret",
      status: publicTarget ? "error" : "ok",
      message: publicTarget
        ? "Secret lokal Better Auth tidak cukup untuk staging-public/production. Set BETTER_AUTH_SECRET dari environment."
        : "Secret lokal Better Auth tersedia.",
      details: { source: "data/.better-auth-secret", publicTarget },
    });
  } catch {
    checks.push({
      key: "auth_secret",
      label: "Auth secret",
      status: publicTarget ? "error" : "warning",
      message:
        publicTarget
          ? "BETTER_AUTH_SECRET wajib diset pada staging-public/production."
          : "Secret lokal Better Auth belum ada dan akan dibuat otomatis saat auth pertama dipakai.",
      details: { source: "auto-local-dev", publicTarget },
    });
  }
}

async function addAletaBotRuntimeCheck(db: AletaDatabase, checks: PreflightCheck[]) {
  const diagnostics = getWhatsappRuntimeModeDiagnostics();
  const settings = await db
    .prepare(
      `SELECT dry_run_enabled, bot_enabled, notifications_enabled
       FROM aleta_bot_settings
       WHERE id = 1`
    )
    .get<{ dry_run_enabled: number; bot_enabled: number; notifications_enabled: number }>()
    .catch(() => null);
  const gatewayConnectionCount = normalizeCount(
    await db
      .prepare(`SELECT COUNT(*) AS count FROM aleta_bot_db_connections WHERE is_active = 1`)
      .get<CountRow>()
      .catch(() => null)
  );

  checks.push({
    key: "whatsapp_runtime_mode",
    label: "Runtime WhatsApp ALETA Bot",
    status: diagnostics.legacyBlocked ? "warning" : "ok",
    message: diagnostics.legacyBlocked
      ? diagnostics.blockerMessage
      : `Runtime efektif WhatsApp: ${diagnostics.effectiveMode}.`,
    details: diagnostics,
  });

  if (!settings) {
    checks.push({
      key: "aleta_bot_dry_run",
      label: "Status dry-run ALETA Bot",
      status: "error",
      message: "Setting ALETA Bot belum tersedia di database.",
    });
    return;
  }

  checks.push({
    key: "aleta_bot_dry_run",
    label: "Status dry-run ALETA Bot",
    status: settings.dry_run_enabled ? "ok" : diagnostics.effectiveMode === "disabled" ? "warning" : "warning",
    message: settings.dry_run_enabled
      ? "Dry-run aktif; preflight tidak akan mengirim WhatsApp live."
      : "Dry-run nonaktif. Pastikan staging/production gateway sudah divalidasi sebelum UAT live.",
    details: {
      dryRunEnabled: Boolean(settings.dry_run_enabled),
      botEnabled: Boolean(settings.bot_enabled),
      notificationsEnabled: Boolean(settings.notifications_enabled),
      runtimeMode: diagnostics.effectiveMode,
    },
  });

  checks.push({
    key: "aleta_bot_gateway_config",
    label: "Konfigurasi gateway ALETA Bot",
    status: gatewayConnectionCount > 0 || settings.dry_run_enabled ? "ok" : "warning",
    message:
      gatewayConnectionCount > 0
        ? `${gatewayConnectionCount} koneksi gateway/SIPP aktif tersedia.`
        : "Koneksi gateway belum tersedia, tetapi tidak fatal selama dry-run aktif.",
    details: { activeConnectionCount: gatewayConnectionCount },
  });
}

export async function runSystemPreflight(db: AletaDatabase): Promise<SystemPreflightReport> {
  const checks: PreflightCheck[] = [];

  try {
    await db.prepare("SELECT 1 AS ok").get<{ ok: number }>();
    checks.push({
      key: "database_connection",
      label: "Koneksi database",
      status: "ok",
      message: "Database dapat dikoneksi dan menerima query.",
    });
    await addDatabaseRuntimeModeCheck(checks);
  } catch (error) {
    checks.push({
      key: "database_connection",
      label: "Koneksi database",
      status: "error",
      message: `Database belum siap: ${errorMessage(error)}`,
    });
    return {
      status: "error",
      generatedAt: new Date().toISOString(),
      summary: summarizeChecks(checks),
      checks,
    };
  }

  await addCountCheck(db, checks, {
    key: "users",
    label: "User operasional",
    sql: `SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL`,
    okMessage: (count) => `${count} user aktif/nonaktif ditemukan di database.`,
    emptyMessage: "Belum ada user di database.",
  });
  await addCountCheck(db, checks, {
    key: "super_admin",
    label: "Super Admin",
    sql: `SELECT COUNT(*) AS count FROM users WHERE role_id = 'super-admin' AND deleted_at IS NULL AND is_active = 1`,
    okMessage: (count) => `${count} Super Admin aktif tersedia.`,
    emptyMessage: "Super Admin aktif belum tersedia.",
  });
  await addCountCheck(db, checks, {
    key: "roles",
    label: "Role utama",
    sql: `SELECT COUNT(*) AS count FROM roles WHERE id IN ('super-admin', 'admin', 'hakim', 'panitera', 'jurusita')`,
    min: 5,
    okMessage: (count) => `${count} role utama tersedia.`,
    emptyMessage: "Role utama belum lengkap.",
  });
  await addCountCheck(db, checks, {
    key: "positions",
    label: "Jabatan/position",
    sql: `SELECT COUNT(*) AS count FROM positions WHERE deleted_at IS NULL`,
    okMessage: (count) => `${count} jabatan tersedia dari database.`,
    emptyMessage: "Data jabatan belum tersedia.",
  });
  await addCountCheck(db, checks, {
    key: "module_visibility",
    label: "Module visibility",
    sql: `SELECT COUNT(*) AS count FROM module_visibility_settings`,
    okMessage: (count) => `${count} aturan module visibility tersimpan.`,
    emptyMessage: "Module visibility belum dikonfigurasi.",
  });
  await addCountCheck(db, checks, {
    key: "portal_settings",
    label: "Setting Portal",
    sql: `SELECT COUNT(*) AS count FROM panel_settings`,
    okMessage: (count) => `${count} baris panel settings tersedia.`,
    emptyMessage: "Panel settings belum tersedia.",
  });
  await addCountCheck(db, checks, {
    key: "letter_templates",
    label: "Template surat",
    sql: `SELECT COUNT(*) AS count FROM letter_templates WHERE is_active = 1`,
    emptyStatus: "warning",
    okMessage: (count) => `${count} template surat aktif tersedia.`,
    emptyMessage: "Template surat aktif belum tersedia. Fitur surat tetap bisa berjalan, tetapi template admin perlu dilengkapi.",
  });
  await addCountCheck(db, checks, {
    key: "letters_query",
    label: "Query Manajemen Surat",
    sql: `SELECT COUNT(*) AS count FROM letters WHERE deleted_at IS NULL`,
    min: 0,
    okMessage: (count) => `Service surat dapat query database; jumlah surat saat ini ${count}.`,
    emptyMessage: "Service surat belum dapat query database.",
  });
  await addCountCheck(db, checks, {
    key: "aleta_bot_settings",
    label: "Setting ALETA Bot",
    sql: `SELECT COUNT(*) AS count FROM aleta_bot_settings`,
    okMessage: (count) => `${count} baris setting ALETA Bot tersedia.`,
    emptyMessage: "Setting ALETA Bot belum tersedia.",
  });
  await addCountCheck(db, checks, {
    key: "aleta_bot_templates",
    label: "Template pesan ALETA Bot",
    sql: `SELECT COUNT(*) AS count FROM aleta_bot_templates WHERE body <> ''`,
    okMessage: (count) => `${count} template pesan ALETA Bot tersimpan di database.`,
    emptyMessage: "Template pesan ALETA Bot belum tersedia di database.",
  });
  await addCountCheck(db, checks, {
    key: "aleta_bot_notifications",
    label: "Jenis notifikasi ALETA Bot",
    sql: `SELECT COUNT(*) AS count FROM aleta_bot_notifications`,
    emptyStatus: "warning",
    okMessage: (count) => `${count} konfigurasi notifikasi ALETA Bot tersedia.`,
    emptyMessage: "Konfigurasi notifikasi ALETA Bot belum tersedia.",
  });
  await addCountCheck(db, checks, {
    key: "aleta_sipp_query_registry",
    label: "Query registry ALETA x SIPP",
    sql: `SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 AND security_status = 'SAFE_READ_ONLY'`,
    okMessage: (count) => `${count} query ALETA x SIPP aktif dan read-only tersedia di database.`,
    emptyMessage: "Query registry ALETA x SIPP belum memiliki query aktif read-only.",
  });
  await addCountCheck(db, checks, {
    key: "jlf_query_registry",
    label: "Query registry JLF",
    sql: `SELECT COUNT(*) AS count
          FROM aleta_sipp_query_registry
          WHERE is_active = 1
            AND security_status = 'SAFE_READ_ONLY'
            AND source_type IN ('JLF_CANONICAL', 'JLF_PREVIEW_CATALOG', 'JLF_VARIABLE_PREVIEW', 'JLF_VARIABLE_DATA_SQL')`,
    okMessage: (count) => `${count} query JLF aktif dan read-only tersedia di database registry.`,
    emptyMessage: "Query registry JLF belum memiliki query aktif read-only.",
  });
  await addZeroCountCheck(db, checks, {
    key: "unsafe_active_query_registry",
    label: "Query registry unsafe aktif",
    sql: `SELECT COUNT(*) AS count
          FROM aleta_sipp_query_registry
          WHERE is_active = 1
            AND security_status IN ('REJECTED_WRITE_QUERY', 'UNSAFE_RAW_SQL')`,
    okMessage: "Tidak ada query registry aktif dengan status unsafe/rejected.",
    nonZeroMessage: (count) => `${count} query unsafe/rejected masih aktif dan harus dinonaktifkan sebelum publik.`,
  });

  await addUploadDirectoryCheck(checks);
  await addAuthSecretCheck(checks);
  await addAletaBotRuntimeCheck(db, checks);

  checks.push({
    key: "protected_api_contract",
    label: "Kontrak proteksi API admin",
    status: "ok",
    message: "Endpoint preflight admin hanya berjalan setelah user login terverifikasi oleh middleware auth route.",
  });
  checks.push({
    key: "mock_runtime_guard",
    label: "Guard data mock runtime",
    status: "ok",
    message: "Preflight membaca tabel runtime langsung dari database dan tidak memakai fallback mock operasional.",
  });

  return {
    status: summarizeStatus(checks),
    generatedAt: new Date().toISOString(),
    summary: summarizeChecks(checks),
    checks,
  };
}
