import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

import { Pool, type PoolClient } from "pg";

import { getDatabaseUrl } from "../src/server/db/client";
import { getPdfStorageDirectories } from "../src/server/shared/pdf-storage";

type CleanupMode = "dry-run" | "execute";

type CleanupSummary = {
  mode: CleanupMode;
  database: {
    host: string;
    database: string;
  };
  matched: {
    users: number;
    letters: number;
  };
  deleted: Record<string, number>;
  skipped: {
    userIdsStillReferenced: string[];
  };
  files: {
    deleted: string[];
    failed: Array<{ path: string; error: string }>;
  };
};

const TEST_FILE_MARKERS = ["CODEX-UAT", "codex-uat", "codexuat", "test_"];

function parseMode(): CleanupMode {
  const args = new Set(process.argv.slice(2));
  if (args.has("--execute")) return "execute";
  return "dry-run";
}

function assertSafeDatabaseUrl(databaseUrl: string, mode: CleanupMode) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cleanup UAT ditolak karena NODE_ENV=production.");
  }

  const parsed = new URL(databaseUrl);
  const safeHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
  const allowRemote = process.env.ALETA_ALLOW_UAT_CLEANUP === "1";

  if (!safeHosts.has(parsed.hostname) && !allowRemote) {
    throw new Error(
      `Cleanup UAT ditolak untuk host database non-local (${parsed.hostname}). Set ALETA_ALLOW_UAT_CLEANUP=1 hanya bila benar-benar environment dev/staging aman.`
    );
  }

  if (mode === "execute" && /prod|production/i.test(parsed.pathname)) {
    throw new Error(`Cleanup UAT ditolak karena nama database tampak production: ${parsed.pathname}`);
  }

  return {
    host: parsed.hostname,
    database: parsed.pathname.replace(/^\//, ""),
  };
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function queryIds(client: PoolClient, sql: string) {
  const result = await client.query<{ id: string }>(sql);
  return result.rows.map((row) => row.id);
}

async function deleteCount(client: PoolClient, summary: CleanupSummary, key: string, sql: string, params: unknown[]) {
  const result = await client.query(sql, params);
  summary.deleted[key] = result.rowCount ?? 0;
}

async function collectPhysicalTestPdfs() {
  const candidates: string[] = [];

  for (const directory of getPdfStorageDirectories()) {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.toLowerCase().endsWith(".pdf")) continue;
        if (!TEST_FILE_MARKERS.some((marker) => entry.name.includes(marker))) continue;

        candidates.push(path.join(directory, entry.name));
      }
    } catch {
      // Directory upload boleh belum ada pada environment baru.
    }
  }

  return Array.from(new Set(candidates));
}

async function deletePhysicalFiles(mode: CleanupMode, summary: CleanupSummary) {
  const files = await collectPhysicalTestPdfs();
  if (mode !== "execute") {
    summary.files.deleted = files;
    return;
  }

  for (const filePath of files) {
    try {
      await unlink(filePath);
      summary.files.deleted.push(filePath);
    } catch (error) {
      summary.files.failed.push({ path: filePath, error: toErrorMessage(error) });
    }
  }
}

async function runCleanup(client: PoolClient, mode: CleanupMode, databaseInfo: CleanupSummary["database"]) {
  const summary: CleanupSummary = {
    mode,
    database: databaseInfo,
    matched: {
      users: 0,
      letters: 0,
    },
    deleted: {},
    skipped: {
      userIdsStillReferenced: [],
    },
    files: {
      deleted: [],
      failed: [],
    },
  };

  const testUserIds = await queryIds(
    client,
    `SELECT id
     FROM users
     WHERE username ILIKE 'codex%'
        OR username ILIKE 'test\\_%' ESCAPE '\\'
        OR email ILIKE '%@aleta.local'
        OR nip ILIKE 'UAT-CODEX%'
        OR name ILIKE '[UAT]%'`
  );
  const testLetterIds = await queryIds(
    client,
    `SELECT id
     FROM letters
     WHERE nomor_surat ILIKE '%CODEX-UAT%'
        OR nomor_urut ILIKE 'CODEX-UAT%'
        OR perihal ILIKE '[UAT CODEX]%'
        OR ringkasan ILIKE '%CODEX-UAT%'
        OR document_file_name ILIKE '%CODEX-UAT%'
        OR document_file_path ILIKE '%CODEX-UAT%'`
  );

  summary.matched.users = testUserIds.length;
  summary.matched.letters = testLetterIds.length;

  await deleteCount(
    client,
    summary,
    "aleta_bot_notification_logs",
    `DELETE FROM aleta_bot_notification_logs
     WHERE entity_id = ANY($1::text[])
        OR message_preview ILIKE '%CODEX-UAT%'
        OR recipient_name ILIKE '[UAT]%'`,
    [testLetterIds]
  );
  await deleteCount(
    client,
    summary,
    "aleta_bot_logs",
    `DELETE FROM aleta_bot_logs
     WHERE actor_user_id = ANY($1::text[])
        OR message ILIKE '%CODEX-UAT%'
        OR metadata_json ILIKE '%CODEX-UAT%'`,
    [testUserIds]
  );
  await deleteCount(
    client,
    summary,
    "disposition_whatsapp_deliveries",
    `DELETE FROM disposition_whatsapp_deliveries
     WHERE disposition_id IN (
       SELECT id FROM dispositions
       WHERE surat_id = ANY($1::text[])
          OR instruksi ILIKE '%CODEX-UAT%'
     )`,
    [testLetterIds]
  );
  await deleteCount(
    client,
    summary,
    "letter_whatsapp_deliveries",
    `DELETE FROM letter_whatsapp_deliveries
     WHERE letter_id = ANY($1::text[])`,
    [testLetterIds]
  );
  await deleteCount(
    client,
    summary,
    "dispositions",
    `DELETE FROM dispositions
     WHERE surat_id = ANY($1::text[])
        OR instruksi ILIKE '%CODEX-UAT%'`,
    [testLetterIds]
  );
  await deleteCount(
    client,
    summary,
    "letter_attachments",
    `DELETE FROM letter_attachments WHERE letter_id = ANY($1::text[])`,
    [testLetterIds]
  );
  await deleteCount(
    client,
    summary,
    "letter_classification_tags",
    `DELETE FROM letter_classification_tags WHERE letter_id = ANY($1::text[])`,
    [testLetterIds]
  );
  await deleteCount(
    client,
    summary,
    "letter_tags",
    `DELETE FROM letter_tags WHERE letter_id = ANY($1::text[])`,
    [testLetterIds]
  );
  await deleteCount(
    client,
    summary,
    "letters",
    `DELETE FROM letters WHERE id = ANY($1::text[])`,
    [testLetterIds]
  );
  await deleteCount(
    client,
    summary,
    "sessions",
    `DELETE FROM sessions WHERE user_id = ANY($1::text[])`,
    [testUserIds]
  );
  await deleteCount(
    client,
    summary,
    "accounts",
    `DELETE FROM accounts WHERE user_id = ANY($1::text[])`,
    [testUserIds]
  );
  await deleteCount(
    client,
    summary,
    "acting_assignments",
    `DELETE FROM acting_assignments
     WHERE user_id_pengganti = ANY($1::text[])
        OR assigned_by_user_id = ANY($1::text[])
        OR authorized_by_user_id = ANY($1::text[])`,
    [testUserIds]
  );
  await deleteCount(
    client,
    summary,
    "audit_logs",
    `DELETE FROM audit_logs
     WHERE actor_user_id = ANY($1::text[])
        OR entity_id = ANY($2::text[])
        OR payload_json ILIKE '%CODEX-UAT%'`,
    [testUserIds, testLetterIds]
  );

  const fallbackActor = await client.query<{ id: string }>(
    `SELECT id
     FROM users
     WHERE role_id = 'super-admin'
       AND is_active = 1
       AND deleted_at IS NULL
       AND id <> ALL($1::text[])
     ORDER BY created_at ASC
     LIMIT 1`,
    [testUserIds]
  );
  const fallbackActorId = fallbackActor.rows[0]?.id ?? null;

  if (fallbackActorId) {
    await deleteCount(
      client,
      summary,
      "employee_profiles_created_by_reassigned",
      `UPDATE employee_profiles
       SET created_by = $2
       WHERE created_by = ANY($1::text[])`,
      [testUserIds, fallbackActorId]
    );
    await deleteCount(
      client,
      summary,
      "employee_profiles_updated_by_reassigned",
      `UPDATE employee_profiles
       SET updated_by = $2
       WHERE updated_by = ANY($1::text[])`,
      [testUserIds, fallbackActorId]
    );
  }

  await deleteCount(
    client,
    summary,
    "employee_profiles",
    `DELETE FROM employee_profiles ep
     WHERE ep.user_id = ANY($1::text[])
       AND NOT EXISTS (
         SELECT 1
         FROM employee_profiles child
         WHERE child.supervisor_employee_id = ep.id
            OR child.approval_officer_employee_id = ep.id
       )
       AND NOT EXISTS (
         SELECT 1
         FROM hr_public_submissions public_submission
         WHERE public_submission.employee_id = ep.id
       )`,
    [testUserIds]
  );

  const deletedUsers = await client.query<{ id: string }>(
    `DELETE FROM users u
     WHERE u.id = ANY($1::text[])
       AND NOT EXISTS (SELECT 1 FROM letters l WHERE l.target_user_id = u.id OR l.created_by_user_id = u.id OR l.submitted_by_user_id = u.id OR l.approved_by_user_id = u.id OR l.sent_by_user_id = u.id OR l.rejected_by_user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM dispositions d WHERE d.pengirim_id = u.id OR d.penerima_id = u.id OR d.read_by_user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.actor_user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM employee_profiles ep WHERE ep.user_id = u.id)
     RETURNING id`,
    [testUserIds]
  );
  summary.deleted.users = deletedUsers.rowCount ?? 0;
  const deletedUserIds = new Set(deletedUsers.rows.map((row) => row.id));
  summary.skipped.userIdsStillReferenced = testUserIds.filter((id) => !deletedUserIds.has(id));

  return summary;
}

async function main() {
  const mode = parseMode();
  const databaseUrl = getDatabaseUrl();
  const databaseInfo = assertSafeDatabaseUrl(databaseUrl, mode);
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  let summary: CleanupSummary | null = null;

  try {
    await client.query("BEGIN");
    summary = await runCleanup(client, mode, databaseInfo);

    if (mode === "execute") {
      await client.query("COMMIT");
      await deletePhysicalFiles(mode, summary);
    } else {
      await client.query("ROLLBACK");
      await deletePhysicalFiles(mode, summary);
    }

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[ALETA] Cleanup UAT gagal.", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[ALETA] Cleanup UAT gagal.", error);
  process.exit(1);
});
