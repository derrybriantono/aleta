import { createAletaDatabase } from "../src/server/db/client";
import type { UserPersona } from "../src/lib/types";
import { AletaSippService } from "../src/server/modules/aleta-sipp/aleta-sipp-service";
import { syncJlfQueryRegistry } from "../src/server/modules/judicia/legal-form/sipp/jlf-query-registry-sync";

type ModuleTarget = "all" | "aleta-sipp" | "jlf";

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function moduleTarget(): ModuleTarget {
  const value = (getArg("module") || "all").trim().toLowerCase();
  if (value === "aleta_sipp") return "aleta-sipp";
  if (value === "aleta-sipp" || value === "jlf" || value === "all") return value;
  throw new Error("Module target tidak dikenal. Gunakan --module=all, --module=aleta-sipp, atau --module=jlf.");
}

type SyncUserRow = {
  id: string;
  username: string;
  name: string;
  nip: string | null;
  email: string | null;
  whatsapp_number: string | null;
  role_id: UserPersona["roleId"];
  position_id: string | null;
  is_active: number | boolean;
};

async function resolveSyncActor(db: Awaited<ReturnType<typeof createAletaDatabase>>): Promise<UserPersona> {
  const row = await db.queryOne<SyncUserRow>(
    `SELECT id, username, name, nip, email, whatsapp_number, role_id, position_id, is_active
     FROM users
     WHERE is_active = 1
       AND role_id IN ('super-admin', 'admin')
     ORDER BY CASE WHEN role_id = 'super-admin' THEN 0 ELSE 1 END, username ASC
     LIMIT 1`
  );
  if (!row) {
    throw new Error("Tidak ada user super-admin/admin aktif untuk mencatat audit job sync query registry.");
  }
  return {
    id: row.id,
    username: row.username,
    password: "",
    name: row.name,
    nip: row.nip ?? "",
    email: row.email ?? "",
    whatsappNumber: row.whatsapp_number ?? "",
    roleId: row.role_id,
    positionId: row.position_id ?? "",
    isActive: Boolean(row.is_active),
  };
}

async function syncAletaSipp(db: Awaited<ReturnType<typeof createAletaDatabase>>, actor: UserPersona) {
  const batchSize = Math.max(1, Math.min(2000, Number(getArg("batch-size") || 500)));
  let continueToken: string | undefined;
  const batches = [];
  do {
    const result = await AletaSippService.importAletaSippQueryRegistry(db, actor, {
      batchSize,
      continueToken,
    });
    batches.push(result);
    continueToken = result.continueToken ?? undefined;
  } while (continueToken && !hasFlag("single-batch"));

  return {
    batches: batches.length,
    totalCandidates: batches.at(-1)?.totalCandidates ?? 0,
    processed: batches.reduce((sum, item) => sum + item.processed, 0),
    imported: batches.reduce((sum, item) => sum + item.imported, 0),
    rejected: batches.reduce((sum, item) => sum + item.rejected, 0),
    failed: batches.reduce((sum, item) => sum + item.failed, 0),
    finished: batches.at(-1)?.finished ?? false,
    continueToken: batches.at(-1)?.continueToken ?? null,
    sourceCounts: batches.at(-1)?.sourceCounts ?? {},
    scanned: batches.at(-1)?.scanned ?? {},
    failures: batches.flatMap((item) => item.failures ?? []).slice(0, 30),
  };
}

async function deactivateUnsafeRegistryRows(db: Awaited<ReturnType<typeof createAletaDatabase>>) {
  const result = await db.run(
    "UPDATE aleta_sipp_query_registry SET is_active = 0, updated_at = ? WHERE security_status IN ('REJECTED_WRITE_QUERY', 'UNSAFE_RAW_SQL') AND is_active = 1",
    [new Date().toISOString()]
  );
  return { deactivated: result.changes };
}

async function main() {
  const target = moduleTarget();
  const db = await createAletaDatabase({
    runMigrations: false,
  });

  try {
    const syncActor = await resolveSyncActor(db);
    const result: Record<string, unknown> = {
      target,
      dryRun: false,
      note: "Sinkronisasi hanya menulis ke database Portal ALETA. Tidak ada write ke database SIPP live.",
      actor: {
        id: syncActor.id,
        username: syncActor.username,
        roleId: syncActor.roleId,
      },
    };

    if (target === "all" || target === "aleta-sipp") {
      result.aletaSipp = await syncAletaSipp(db, syncActor);
    }
    if (target === "all" || target === "jlf") {
      result.jlf = await syncJlfQueryRegistry(db, {
        actorUserId: syncActor.id,
      });
    }
    result.unsafeRegistryRows = await deactivateUnsafeRegistryRows(db);

    console.log(JSON.stringify(result, null, 2));
    const failed = Number((result.aletaSipp as { failed?: number } | undefined)?.failed ?? 0) +
      Number((result.jlf as { failed?: number } | undefined)?.failed ?? 0);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("[ALETA] Query registry sync failed.", error);
  process.exit(1);
});
