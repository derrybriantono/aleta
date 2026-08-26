// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { getAletaBotSnapshot } from "@/server/modules/aleta-bot/service";
import { runSystemPreflight } from "@/server/modules/system/preflight";

describe("system preflight", () => {
  let db: AletaDatabase | null = null;
  let uploadDir: string | null = null;
  const previousUploadDir = process.env.ALETA_PDF_UPLOAD_DIR;
  const previousRuntimeMode = process.env.WHATSAPP_RUNTIME_MODE;

  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(os.tmpdir(), "aleta-preflight-upload-"));
    process.env.ALETA_PDF_UPLOAD_DIR = uploadDir;
    process.env.WHATSAPP_RUNTIME_MODE = "disabled";
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    const superAdmin = await db
      .prepare("SELECT id FROM users WHERE role_id = 'super-admin' AND is_active = 1 LIMIT 1")
      .get<{ id: string }>();
    await getAletaBotSnapshot(db, superAdmin!.id);
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO aleta_sipp_query_registry (
        id, query_key, name, category, source, source_type,
        original_sql, normalized_sql, parameterized_sql,
        execution_mode, security_status, review_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "preflight-aleta-sipp-query",
      "preflight.aleta_sipp.safe_select",
      "Preflight ALETA x SIPP safe select",
      "Preflight",
      "test",
      "PRELIGHT_TEST",
      "SELECT perkara_id FROM perkara WHERE perkara_id = :perkara_id",
      "SELECT perkara_id FROM perkara WHERE perkara_id = :perkara_id",
      "SELECT perkara_id FROM perkara WHERE perkara_id = :perkara_id",
      "READY_READ_ONLY",
      "SAFE_READ_ONLY",
      "APPROVED",
      now,
      now
    );
    await db.prepare(
      `INSERT INTO aleta_sipp_query_registry (
        id, query_key, name, category, source, source_type,
        original_sql, normalized_sql, parameterized_sql,
        execution_mode, security_status, review_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "preflight-jlf-query",
      "preflight.jlf.safe_select",
      "Preflight JLF safe select",
      "Preflight",
      "test",
      "JLF_CANONICAL",
      "SELECT nomor_perkara FROM perkara WHERE perkara_id = :perkara_id",
      "SELECT nomor_perkara FROM perkara WHERE perkara_id = :perkara_id",
      "SELECT nomor_perkara FROM perkara WHERE perkara_id = :perkara_id",
      "READY_READ_ONLY",
      "SAFE_READ_ONLY",
      "APPROVED",
      now,
      now
    );
  });

  afterEach(async () => {
    if (db) {
      await db.close();
      db = null;
    }
    if (uploadDir) {
      await rm(uploadDir, { recursive: true, force: true });
      uploadDir = null;
    }

    if (previousUploadDir === undefined) {
      delete process.env.ALETA_PDF_UPLOAD_DIR;
    } else {
      process.env.ALETA_PDF_UPLOAD_DIR = previousUploadDir;
    }

    if (previousRuntimeMode === undefined) {
      delete process.env.WHATSAPP_RUNTIME_MODE;
    } else {
      process.env.WHATSAPP_RUNTIME_MODE = previousRuntimeMode;
    }
  });

  it("checks database-driven runtime prerequisites without requiring WhatsApp live", async () => {
    const report = await runSystemPreflight(db!);

    expect(report.status).not.toBe("error");
    expect(report.checks.find((check) => check.key === "database_connection")?.status).toBe("ok");
    expect(report.checks.find((check) => check.key === "users")?.status).toBe("ok");
    expect(report.checks.find((check) => check.key === "aleta_bot_templates")?.status).toBe("ok");
    expect(report.checks.find((check) => check.key === "aleta_sipp_query_registry")?.status).toBe("ok");
    expect(report.checks.find((check) => check.key === "jlf_query_registry")?.status).toBe("ok");
    expect(report.checks.find((check) => check.key === "unsafe_active_query_registry")?.status).toBe("ok");
    expect(report.checks.find((check) => check.key === "aleta_bot_dry_run")?.message).toMatch(/Dry-run aktif/i);
    expect(report.checks.find((check) => check.key === "mock_runtime_guard")?.status).toBe("ok");
  });
});
