// @vitest-environment node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildJlfLegacyAbtDryRunReport,
  importJlfLegacyAbtSqlVariables,
  parseCsvContent,
} from "@/server/modules/judicia/legal-form/legacy-import/jlf-legacy-abt-xls-dry-run";
import {
  getJlfSippQueryDefinition,
  validateJlfSippQueryRequest,
} from "@/server/modules/judicia/legal-form/sipp/jlf-sipp-query-registry";

describe("JLF legacy ABT XLS/CSV dry-run importer", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "jlf-abt-dry-run-"));
  });

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("parses CSV safely without executing legacy SQL", () => {
    const file = path.join(tempDir, "abt_variabel.csv");
    const parsed = parseCsvContent(
      file,
      [
        '"no_var","nama","data_type","data_tabel","data_kolom","sql_query","default_data"',
        '"0001","No Perkara","data_sipp","perkara","nomor_perkara","",""',
        '"0005","Panitera Sidang","data_sql","","","SELECT nama FROM users WHERE id=#0001#",""',
      ].join("\n")
    );

    expect(parsed.sheets[0]?.rows).toHaveLength(2);
    expect(parsed.sheets[0]?.rows[1]?.sql_query).toContain("SELECT");
  });

  it("builds a dry-run report with read-only SQL, legacy conflicts, BAS mapping, and skipped sensitive data", async () => {
    await writeFile(
      path.join(tempDir, "abt_variabel.xls"),
      [
        '"no_var","nama","data_type","data_tabel","data_kolom","sql_query","default_data"',
        '"0001","No Perkara","data_sipp","perkara","nomor_perkara","",""',
        '"0005","Panitera Sidang","data_sql","","","SELECT nama FROM perkara WHERE perkara_id=#0001#",""',
      ].join("\n")
    );
    await writeFile(
      path.join(tempDir, "abt_variabel donggala.csv"),
      [
        '"no_var","nama","data_type","data_tabel","data_kolom","sql_query","default_data"',
        '"0005","Agama Fasakh T","data_teks","","","","Kristen"',
      ].join("\n")
    );
    await writeFile(
      path.join(tempDir, "abt_tanyajawab_id.xls"),
      ['"id","jenis_perkara_id","kode","nama"', '"1","347","04","Keterangan Saksi"'].join("\n")
    );
    await writeFile(
      path.join(tempDir, "abt_tanyajawab_template.xls"),
      [
        '"kode_tanyajawab","urutan_pertanyaan","pertanyaan","jawaban"',
        '"04","1","Apakah saksi kenal dengan #0046# dan #0047#?","Ya, saya kenal dengan #0046# dan #0047#;"',
        '"04","2","Apakah saksi tahu #9999#?","..."',
      ].join("\n")
    );
    await writeFile(path.join(tempDir, "abt_data_teks.xls"), ['"no_var","perkara_id","data"', '"0007","123","telah dikaruniai anak"'].join("\n"));
    await writeFile(path.join(tempDir, "abt_data_tanggal.xls"), ['"no_var","perkara_id","data"', '"0303","123","2026-05-24"'].join("\n"));
    await writeFile(
      path.join(tempDir, "abt_keterangan_saksi.xls"),
      ['"id","perkara_id","sidang_id","saksi_id","pertanyaan","jawaban"', '"1","123","456","789","Apakah kenal?","Kenal."'].join("\n")
    );

    const report = await buildJlfLegacyAbtDryRunReport(tempDir);

    expect(report.importExecution.executed).toBe(false);
    expect(report.totals.variablesRead).toBe(3);
    expect(report.totals.legacySqlQueriesFound).toBe(1);
    expect(report.legacySqlFindings[0]?.status).toBe("read_only_ready");
    expect(report.conflicts.map((item) => item.legacyCode)).toContain("0005");
    expect(report.totals.basQaTemplates).toBe(1);
    expect(report.totals.basQaItems).toBe(2);
    expect(report.basQaTemplates[0]?.modernPlaceholderRecommendations).toMatchObject({
      "#0046#": "{{nama_penggugat}}",
      "#0047#": "{{nama_tergugat}}",
    });
    expect(report.unknownPlaceholders).toContain("9999");
    expect(report.manualValues.reduce((sum, item) => sum + item.rows, 0)).toBe(2);
    expect(report.sensitiveData[0]?.status).toBe("skipped_sensitive");
  });

  it("keeps SIPP query registry as read-only allowlist and rejects raw SQL payloads", () => {
    expect(getJlfSippQueryDefinition("sipp.sidang.list")).toMatchObject({
      readOnly: true,
      bridgeOperation: "case.schedule",
    });

    expect(() => validateJlfSippQueryRequest("sipp.perkara.by_nomor", { nomorPerkara: "123/Pdt.G/2026/PA.Dgl" })).not.toThrow();
    expect(() => validateJlfSippQueryRequest("sipp.perkara.by_nomor", { sql: "SELECT * FROM perkara" })).toThrow("Parameter SIPP tidak dikenal");
    expect(() => validateJlfSippQueryRequest("sipp.perkara.search", { query: "DROP TABLE perkara" })).toThrow(
      "Parameter SIPP tidak boleh berisi SQL"
    );
  });

  it("preserves ABT urutan_data in imported data_sipp source keys", async () => {
    await writeFile(
      path.join(tempDir, "abt_variabel.xls"),
      [
        '"no_var","nama","data_type","data_tabel","data_kolom","urutan_data","sql_query","default_data"',
        '"0193","Tgl. Sidang II","data_sipp","perkara_jadwal_sidang","tanggal_sidang","2","",""',
      ].join("\n")
    );

    const report = await buildJlfLegacyAbtDryRunReport(tempDir);
    const mapping = report.variableMappings.find((item) => item.legacyCode === "0193");

    expect(mapping?.sourceKey).toBe("perkara_jadwal_sidang.tanggal_sidang?urutan=2");
    expect(mapping?.notes.join(" ")).toContain("urutan_data ABT 2");
  });

  it("can import ABT data_sql variables into the JLF catalog as read-only resolver rows", async () => {
    await writeFile(
      path.join(tempDir, "abt_variabel.xls"),
      [
        '"no_var","nama","data_type","data_tabel","data_kolom","sql_query","default_data"',
        '"0999","Redaksi Putusan SQL","data_sql","","","SELECT amar AS data FROM perkara_putusan WHERE perkara_id=#perkara_id#",""',
      ].join("\n")
    );

    const storedRows: Array<Record<string, unknown>> = [];
    const fakeDb = {
      prepare(sql: string) {
        if (sql.includes('SELECT "key" FROM jlf_variables WHERE legacy_code')) {
          return {
            get(legacyCode: string) {
              const existing = storedRows.find((row) => row.legacy_code === legacyCode);
              return existing ? { key: existing.key } : undefined;
            },
          };
        }
        if (sql.includes("INSERT INTO jlf_variables")) {
          return {
            run(...args: unknown[]) {
              storedRows.push({
                id: args[0],
                legacy_code: args[1],
                key: args[2],
                label: args[3],
                data_type: args[5],
                source_type: args[6],
                source_key: args[7],
                transform_key: args[8],
                legacy_abt_type: "data_sql",
                field_mode: args[9],
                admin_note: args[10],
                sipp_query_preview: args[11],
                sipp_query_preview_status: "read_only_ready",
                sipp_query_preview_key: args[12],
              });
            },
          };
        }
        throw new Error(`Unexpected SQL in fake DB: ${sql}`);
      },
    };

    const report = await buildJlfLegacyAbtDryRunReport(tempDir);
    const imported = await importJlfLegacyAbtSqlVariables(fakeDb as never, report);
    const row = storedRows.find((item) => String(item.key).startsWith("abt_sql_0999_"));

    expect(imported.insertedOrUpdated).toBe(1);
    expect(row?.legacy_code).toBe("0999");
    expect(row?.source_type).toBe("abt_sql");
    expect(row?.legacy_abt_type).toBe("data_sql");
    expect(row?.field_mode).toBeTruthy();
    expect(row?.sipp_query_preview_status).toBe("read_only_ready");
    expect(row?.sipp_query_preview).toContain("SELECT amar AS data");
  }, 20_000);
});
