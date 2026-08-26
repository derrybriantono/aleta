// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildJlfVariableCatalog,
  JLF_ABT_COMPATIBLE_VARIABLE_TARGET,
  JLF_VARIABLE_CATALOG_MIN_EXPECTED,
  JLF_VARIABLE_CATALOG_SOURCE_TYPES,
} from "@/server/modules/judicia/legal-form/seed/jlf-variable-catalog";
import { resolveJlfVariableQueryPreview } from "@/lib/judicia-legal-form-query-preview";

describe("JLF variable catalog seed", () => {
  it("contains at least 500 relevant unique variables", () => {
    const catalog = buildJlfVariableCatalog();
    const keys = new Set(catalog.map((item) => item.key));

    expect(catalog.length).toBeGreaterThanOrEqual(JLF_VARIABLE_CATALOG_MIN_EXPECTED);
    expect(keys.size).toBe(catalog.length);
  });

  it("adds the requested ABT-compatible candidate layer", () => {
    const abtCompatible = buildJlfVariableCatalog().filter((item) => item.key.startsWith("abt_"));

    expect(abtCompatible.length).toBe(JLF_ABT_COMPATIBLE_VARIABLE_TARGET);
    expect(abtCompatible.some((item) => item.adminNote?.includes("Raw SQL legacy tidak dipakai"))).toBe(true);
  });

  it("does not duplicate legacy codes in the curated seed", () => {
    const legacyCodes = buildJlfVariableCatalog()
      .map((item) => item.legacyCode)
      .filter((item): item is string => Boolean(item));

    expect(new Set(legacyCodes).size).toBe(legacyCodes.length);
  });

  it("uses only source types supported by the JLF registry", () => {
    const allowed = new Set<string>(JLF_VARIABLE_CATALOG_SOURCE_TYPES);

    for (const item of buildJlfVariableCatalog()) {
      expect(allowed.has(item.sourceType), item.key).toBe(true);
    }
  });

  it("generates query preview metadata for seeded SIPP variables", () => {
    const catalog = buildJlfVariableCatalog();
    const hakimVariable = catalog.find((item) => item.key.includes("hakim") && item.sourceType === "sipp_hakim");
    const sidangVariable = catalog.find((item) => item.sourceType === "sipp_jadwal_sidang" && item.adminNote?.includes("sipp.sidang.by_id"));

    expect(hakimVariable).toBeDefined();
    expect(sidangVariable).toBeDefined();

    const hakimPreview = resolveJlfVariableQueryPreview({
      sourceType: hakimVariable?.sourceType ?? "",
      sourceKey: hakimVariable?.sourceKey,
      key: hakimVariable?.key,
      adminNote: hakimVariable?.adminNote,
    });
    const sidangPreview = resolveJlfVariableQueryPreview({
      sourceType: sidangVariable?.sourceType ?? "",
      sourceKey: sidangVariable?.sourceKey,
      key: sidangVariable?.key,
      adminNote: sidangVariable?.adminNote,
    });

    expect(hakimPreview.queryKey).toBe("sipp.hakim.majelis");
    expect(hakimPreview.sqlPreview).toContain("perkara_hakim_pn");
    expect(sidangPreview.queryKey).toBe("sipp.sidang.by_id");
  });
});
