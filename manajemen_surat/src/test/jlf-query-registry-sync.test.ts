// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createAletaDatabase } from "@/server/db/client";
import { validateReadOnlySql } from "@/server/modules/aleta-sipp/aleta-sipp-sql-validator";
import {
  assertJlfSippQueryRegisteredInDatabase,
  listJlfCanonicalQueryRegistrySeeds,
  syncJlfQueryRegistry,
} from "@/server/modules/judicia/legal-form/sipp/jlf-query-registry-sync";

describe("JLF query registry sync", () => {
  it("keeps the required jadwal sidang query database-ready and parameterized", () => {
    const seed = listJlfCanonicalQueryRegistrySeeds().find((item) => item.queryKey === "jlf.jadwal_sidang.by_perkara_id");

    expect(seed).toBeDefined();
    expect(seed?.originalSql).toContain("perkara_jadwal_sidang");
    expect(seed?.originalSql).toContain(":perkara_id");
    expect(seed?.originalSql).not.toContain("#perkara_id#");
    expect(seed?.parameters.map((item) => item.name)).toContain("perkara_id");
    expect(validateReadOnlySql(seed?.originalSql ?? "").ok).toBe(true);
  });

  it("syncs JLF registry seeds idempotently into the Portal database", async () => {
    const db = await createAletaDatabase({
      useInMemory: true,
      seed: false,
      runMigrations: false,
    });

    try {
      const first = await syncJlfQueryRegistry(db, { actorUserId: null });
      const second = await syncJlfQueryRegistry(db, { actorUserId: null });
      const row = await db.queryOne<{ query_key: string; parameterized_sql: string; security_status: string }>(
        "SELECT query_key, parameterized_sql, security_status FROM aleta_sipp_query_registry WHERE query_key = ? LIMIT 1",
        ["jlf.jadwal_sidang.by_perkara_id"]
      );

      expect(first.discovered).toBeGreaterThan(10);
      expect(first.failed).toBe(0);
      expect(first.inserted + first.updated + first.unchanged).toBeGreaterThan(0);
      expect(second.failed).toBe(0);
      expect(second.inserted).toBe(0);
      expect(row?.security_status).toBe("SAFE_READ_ONLY");
      expect(row?.parameterized_sql).toContain("?");
      await expect(assertJlfSippQueryRegisteredInDatabase(db, "jlf.jadwal_sidang.by_perkara_id")).resolves.toMatchObject({
        queryKey: "jlf.jadwal_sidang.by_perkara_id",
        securityStatus: "SAFE_READ_ONLY",
      });
    } finally {
      await db.close();
    }
  });
});
