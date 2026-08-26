import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";

let db: AletaDatabase | null = null;

async function makeDb() {
  db = await createAletaDatabase({ useInMemory: true, seed: true, runMigrations: false });
  return db;
}

describe("audit payload sanitizer", () => {
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("redacts direct and field/value secret payloads before storing audit logs", async () => {
    const database = await makeDb();

    await appendAuditLog(database, {
      id: "adt-mask-test",
      actorUserId: "usr-super",
      action: "TEST_AUDIT_MASK",
      entityType: "security",
      entityId: "masking",
      payload: {
        password: "Password123",
        apiKey: "sk-test",
        note: "token = 'raw-token' and status = ok",
        changes: [
          { column: "password", oldValue: "old-password", newValue: "new-password" },
          { key: "api_key", value: "raw-api-key" },
          { field: "displayName", value: "Nama Aman" },
        ],
      },
    });

    const row = await database.queryOne<{ payload_json: string }>(
      "SELECT payload_json FROM audit_logs WHERE id = ?",
      ["adt-mask-test"]
    );
    const payload = JSON.parse(row?.payload_json ?? "{}") as {
      password?: string;
      apiKey?: string;
      note?: string;
      changes?: Array<Record<string, unknown>>;
    };

    expect(payload.password).toBe("[redacted]");
    expect(payload.apiKey).toBe("[redacted]");
    expect(payload.note).toContain("token=[redacted]");
    expect(payload.note).not.toContain("raw-token");
    expect(payload.changes?.[0].oldValue).toBe("[redacted]");
    expect(payload.changes?.[0].newValue).toBe("[redacted]");
    expect(payload.changes?.[1].value).toBe("[redacted]");
    expect(payload.changes?.[2].value).toBe("Nama Aman");
  });
});
