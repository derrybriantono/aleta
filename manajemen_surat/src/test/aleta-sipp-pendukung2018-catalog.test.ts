import { describe, expect, it } from "vitest";

import { PENDUKUNG2018_FEATURES } from "@/server/modules/aleta-sipp/aleta-sipp-pendukung2018-catalog";
import { validateReadOnlySql } from "@/server/modules/aleta-sipp/aleta-sipp-sql-validator";

describe("ALETA x SIPP pendukung2018 catalog", () => {
  it("maps the audited legacy features into granular catalog items", () => {
    expect(PENDUKUNG2018_FEATURES.length).toBeGreaterThanOrEqual(90);
    expect(PENDUKUNG2018_FEATURES.some((feature) => feature.sourceFiles.includes("delegasi_masuk.php"))).toBe(true);
    expect(PENDUKUNG2018_FEATURES.some((feature) => feature.sourceFiles.includes("pembagian_perkara_js.php"))).toBe(true);
    expect(PENDUKUNG2018_FEATURES.some((feature) => feature.sourceFiles.includes("dok_sapm_register_gugatan_sederhana.php"))).toBe(true);
    expect(PENDUKUNG2018_FEATURES.some((feature) => feature.sourceFiles.includes("laporan_lipa_6.php"))).toBe(true);
  });

  it("keeps feature keys, query keys, and indicator keys unique", () => {
    const featureKeys = PENDUKUNG2018_FEATURES.map((feature) => feature.featureKey);
    const indicatorKeys = PENDUKUNG2018_FEATURES.map((feature) => feature.relatedIndicatorKey);
    const queryKeys = PENDUKUNG2018_FEATURES.map((feature) => feature.query?.queryKey).filter(Boolean);

    expect(new Set(featureKeys).size).toBe(featureKeys.length);
    expect(new Set(indicatorKeys).size).toBe(indicatorKeys.length);
    expect(new Set(queryKeys).size).toBe(queryKeys.length);
  });

  it("only stores SELECT-only candidates for executable legacy queries", () => {
    const unsafeQueries = PENDUKUNG2018_FEATURES
      .flatMap((feature) => (feature.query ? [{ featureKey: feature.featureKey, sql: feature.query.sql }] : []))
      .filter((item) => !validateReadOnlySql(item.sql).ok);

    expect(unsafeQueries).toEqual([]);
  });

  it("marks schema-sensitive legacy query candidates for admin review", () => {
    const sensitiveSources = ["delegasi_masuk.php", "pembagian_perkara_js.php", "register_eksekusi.php", "register_sita.php"];
    for (const source of sensitiveSources) {
      const feature = PENDUKUNG2018_FEATURES.find((item) => item.sourceFiles.includes(source));
      expect(feature, source).toBeTruthy();
      expect(feature?.query?.securityStatus).toBe("NEEDS_REVIEW");
      expect(feature?.query?.executionMode).toBe("PENDUKUNG2018_REFERENCE_ONLY");
    }
  });
});
