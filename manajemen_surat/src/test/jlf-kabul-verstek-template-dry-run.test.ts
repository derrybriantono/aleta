// @vitest-environment node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildJlfKabulVerstekTemplateDryRunReport,
  KABUL_VERSTEK_MODERN_TEMPLATE_DRAFT,
} from "@/server/modules/judicia/legal-form/legacy-import/jlf-kabul-verstek-template-dry-run";
import { detectAllPlaceholders } from "@/server/modules/judicia/legal-form/templates/jlf-placeholder-service";

describe("JLF Kabul Verstek ABT template dry-run importer", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "jlf-kabul-verstek-"));
  });

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("maps legacy template placeholders to JLF variables without executing legacy SQL", async () => {
    const templatePath = path.join(tempDir, "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf");
    const generatedPath = path.join(tempDir, "218_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai (Format Lengkap).rtf");
    const variableXlsPath = path.join(tempDir, "abt_variabel.xls");

    await writeFile(
      templatePath,
      [
        "{\\rtf1 Putusan Nomor #0001#}",
        "Bahwa #0046# melawan #0047#.",
        "Saksi #1197# memberi keterangan #2021#.",
        "Pertimbangan hukum #8521# dan #8526#.",
      ].join("\\par\n")
    );
    await writeFile(generatedPath, "{\\rtf1 Putusan Nomor 218/Pdt.G/2026/PA.Dgl sudah terisi.}");
    await writeFile(
      variableXlsPath,
      [
        '"no_var","nama","data_type","data_tabel","data_kolom","sql_query","default_data","referensi"',
        '"0001","No Perkara","data_sipp","perkara","nomor_perkara","","",""',
        '"0046","Pemohon/Penggugat","data_sql","","","select case when alur_perkara_id=16 then Pemohon else Penggugat end as data from perkara where perkara_id=#perkara_id#","",""',
        '"0047","Termohon/Tergugat","data_sql","","","select case when alur_perkara_id=16 then Termohon else Tergugat end as data from perkara where perkara_id=#perkara_id#","",""',
        '"1197","Nama Saksi 1 P","data_sql","","","select nama as data from perkara_pihak5 where perkara_id=#perkara_id#","",""',
        '"2021","Keterangan Saksi 1 P","tanya_jawab","","","","","1197"',
        '"8521","Pertimbangan Fakta Hukum Perceraian","data_sql","","","select case when #8503# regexp F then narasi end as data","",""',
        '"8526","Pertimbangan Hukum Ghaib/Biasa","data_sql","","","select case when ghaib=1 then narasi_ghaib end as data","",""',
      ].join("\n")
    );

    const report = await buildJlfKabulVerstekTemplateDryRunReport({
      templatePath,
      generatedPath,
      variableXlsPath,
    });

    expect(report.importExecution.executed).toBe(false);
    expect(report.template.uniqueLegacyPlaceholders).toBe(7);
    expect(report.generated.unresolvedLegacyPlaceholders).toBe(0);
    expect(report.totals.legacySqlFound).toBeGreaterThan(0);
    expect(report.variableMappings.find((item) => item.legacyCode === "0001")).toMatchObject({
      key: "nomor_perkara",
      sourceType: "sipp_perkara",
      status: "ready",
    });
    expect(report.variableMappings.find((item) => item.legacyCode === "0046")?.metadata.legacySqlExecutable).toBe(false);
    expect(report.variableMappings.find((item) => item.legacyCode === "8521")).toMatchObject({
      status: "needs_review",
      metadata: { legalKnowledgeBaseRequired: true },
    });
    expect(report.variableMappings.find((item) => item.legacyCode === "1197")?.queryPreview.queryKey).toBe("sipp.saksi.list");
    expect(report.seedDraft.templateVariables.map((item) => item.placeholder)).toContain("{{nomor_perkara}}");
    expect(report.sippQueryRegistry.map((item) => item.key)).toContain("sipp.satker.config");
  });

  it("keeps modern semantic placeholders parseable", () => {
    const placeholders = detectAllPlaceholders(KABUL_VERSTEK_MODERN_TEMPLATE_DRAFT);
    expect(placeholders.map((item) => item.normalizedKey)).toContain("nomor_perkara");
    expect(placeholders.map((item) => item.normalizedKey)).toContain("identitas_penggugat_lengkap");
    expect(placeholders.map((item) => item.normalizedKey)).toContain("pertimbangan_verstek_ghaib");
  });
});
