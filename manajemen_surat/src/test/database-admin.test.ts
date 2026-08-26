import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  getDatabaseAdminSnapshot,
  runReadOnlyDatabaseQuery,
  updateDatabaseTableRow,
} from "@/server/modules/database-admin/service";

let db: AletaDatabase | null = null;

async function makeDb() {
  db = await createAletaDatabase({ useInMemory: true, seed: true, runMigrations: false });
  return db;
}

describe("database admin service", () => {
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("lists real tables and reads rows with table metadata", async () => {
    const database = await makeDb();
    const snapshot = await getDatabaseAdminSnapshot(database, {
      tableName: "institution_identity",
      page: 1,
      pageSize: 10,
    });

    expect(snapshot.database.activeMode).toBe("fallback");
    expect(snapshot.tables.some((table) => table.name === "institution_identity")).toBe(true);
    expect(snapshot.selectedTable?.primaryKeyColumns).toContain("id");
    expect(snapshot.rows.length).toBeGreaterThan(0);
  });

  it("runs only read SQL from the query panel", async () => {
    const database = await makeDb();
    const result = await runReadOnlyDatabaseQuery(
      database,
      "usr-super",
      "SELECT court_name FROM institution_identity"
    );

    expect(result.columns).toContain("court_name");
    expect(result.rowCount).toBeGreaterThan(0);
    await expect(
      runReadOnlyDatabaseQuery(database, "user-superadmin", "UPDATE institution_identity SET court_name = 'x'")
    ).rejects.toThrow(/hanya mengizinkan SELECT/i);
  });

  it("updates one row through primary key and records changed columns", async () => {
    const database = await makeDb();
    const result = await updateDatabaseTableRow(database, "usr-super", {
      tableName: "institution_identity",
      primaryKey: { id: 1 },
      patch: { court_short_name: "PA Test" },
    });
    const row = await database.queryOne<{ court_short_name: string }>(
      "SELECT court_short_name FROM institution_identity WHERE id = ?",
      [1]
    );

    expect(result.changes).toBe(1);
    expect(result.updatedColumns).toEqual(["court_short_name"]);
    expect(row?.court_short_name).toBe("PA Test");
  });

  it("allows Super Admin database editor to update sensitive tables through the guarded route flow", async () => {
    const database = await makeDb();
    const snapshot = await getDatabaseAdminSnapshot(database, {
      tableName: "users",
      page: 1,
      pageSize: 10,
    });
    const nextName = "Super Admin Database Editor Test";

    expect(snapshot.selectedTable?.columns.every((column) => column.protected === false)).toBe(true);
    const result = await updateDatabaseTableRow(database, "usr-super", {
      tableName: "users",
      primaryKey: { id: "usr-super" },
      patch: { name: nextName },
    });
    const row = await database.queryOne<{ name: string }>("SELECT name FROM users WHERE id = ?", ["usr-super"]);

    expect(result.changes).toBe(1);
    expect(result.updatedColumns).toEqual(["name"]);
    expect(row?.name).toBe(nextName);
  });
});
