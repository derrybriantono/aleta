// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { resolveVariablesForTemplate } from "@/server/modules/judicia/legal-form/documents/jlf-variable-resolver-service";
import { JlfSippProviderRegistry } from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";

describe("JLF ABT SQL dependency resolution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes raw multi-sidang dependency values into legacy ABT SQL", async () => {
    const actor: UserPersona = {
      id: "usr-test-super",
      username: "super",
      password: "",
      name: "Super Admin",
      nip: "",
      email: "super@example.test",
      whatsappNumber: "",
      roleId: "super-admin",
      positionId: "pos-admin",
      additionalRoleIds: [],
      isActive: true,
    };
    const capturedPlaceholderValues: Array<Record<string, unknown>> = [];
    const mappings = [
      {
        template_variable_id: "map-sidang-date",
        template_id: "tpl-abt-dep",
        variable_id: "var-sidang-date",
        placeholder: "#9333#",
        mapping_required: 0,
        sort_order: 0,
        legacy_code: "9333",
        key: "tgl_sidang_abt",
        label: "Tgl Sidang",
        description: "",
        data_type: "date",
        source_type: "sipp_jadwal_sidang",
        source_key: "sidang.terpilih.tanggal_sidang",
        transform_key: "tanggal_indonesia_panjang",
        fallback_value: "",
        sipp_query_preview: "",
        legacy_abt_type: "multi_sidang",
        field_mode: "",
        ai_enabled: 0,
        manual_override_allowed: 1,
        variable_required: 0,
        example_value: "",
      },
      {
        template_variable_id: "map-abt-sql",
        template_id: "tpl-abt-dep",
        variable_id: "var-abt-sql",
        placeholder: "#9261#",
        mapping_required: 0,
        sort_order: 1,
        legacy_code: "9261",
        key: "pengadilan_tsb_bas",
        label: "Pengadilan tsb BAS",
        description: "",
        data_type: "text",
        source_type: "abt_sql",
        source_key: "legacy_sql.9261",
        transform_key: "",
        fallback_value: "",
        sipp_query_preview: 'select "#9333#" as data from perkara_jadwal_sidang where perkara_id=#perkara_id#',
        legacy_abt_type: "data_sql",
        field_mode: "",
        ai_enabled: 0,
        manual_override_allowed: 1,
        variable_required: 0,
        example_value: "",
      },
    ];
    const variablesByLegacy = new Map(mappings.map((item) => [item.legacy_code, {
      variable_id: item.variable_id,
      legacy_code: item.legacy_code,
      key: item.key,
      label: item.label,
      description: item.description,
      data_type: item.data_type,
      source_type: item.source_type,
      source_key: item.source_key,
      transform_key: item.transform_key,
      fallback_value: item.fallback_value,
      sipp_query_preview: item.sipp_query_preview,
      legacy_abt_type: item.legacy_abt_type,
      field_mode: item.field_mode,
      ai_enabled: item.ai_enabled,
      manual_override_allowed: item.manual_override_allowed,
      variable_required: item.variable_required,
      example_value: item.example_value,
    }]));
    const fakeDb = {
      prepare(sql: string) {
        if (sql.includes("FROM jlf_template_variables")) {
          return { all: () => mappings };
        }
        if (sql.includes("FROM jlf_template_versions")) {
          return { get: () => undefined };
        }
        if (sql.includes("FROM jlf_variables")) {
          return { get: (legacyCode: string) => variablesByLegacy.get(legacyCode) };
        }
        if (sql.includes("FROM jlf_manual_values")) {
          return { all: () => [] };
        }
        throw new Error(`Unexpected SQL in fake DB: ${sql}`);
      },
    } as unknown as AletaDatabase;

    vi.spyOn(JlfSippProviderRegistry, "getProvider").mockReturnValue({
      key: "aleta_bot_bridge",
      checkConnection: async () => ({ ok: true, provider: "aleta_bot_bridge", status: "connected", message: "ok" }),
      getSatkerConfig: async () => ({}),
      searchCasesByNumber: async () => [],
      searchCasesByPartyName: async () => [],
      getCaseDetail: async () => ({ perkaraId: "9797", nomorPerkara: "302/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak" }),
      getCaseParties: async () => [],
      getCaseWitnesses: async () => [],
      getCaseSchedule: async () => ([{ id: "19160", sidangId: "19160", urutan: "1", tanggalSidang: "2026-06-08", tanggal_sidang: "2026-06-08", agenda: "Sidang Pertama" }]),
      getLastHearing: async () => null,
      getNextHearing: async () => null,
      getJudges: async () => [],
      getPanitera: async () => [],
      getJurusita: async () => [],
      getMediator: async () => [],
      getDecisionData: async () => null,
      executeLegacySqlValue: async (input) => {
        capturedPlaceholderValues.push(input.placeholderValues ?? {});
        return { value: input.placeholderValues?.["9333"] ?? null, rowCount: 1, queryHash: "hash" };
      },
      findSippUserByUsername: async () => null,
      findSippUserByNip: async () => null,
      findSippUserByEmail: async () => null,
      searchSippUsers: async () => [],
      getSippUserById: async () => null,
    });

    const resolved = await resolveVariablesForTemplate(fakeDb, actor, {
      templateId: "tpl-abt-dep",
      nomorPerkara: "302/Pdt.G/2026/PA.Dgl",
      options: {
        selectedHearing: { id: "19160", sidangId: "19160", urutan: "1", tanggalSidang: "2026-06-08", tanggal_sidang: "2026-06-08", agenda: "Sidang Pertama" },
      },
    });

    expect(resolved.variables.find((item) => item.key === "tgl_sidang_abt")?.value).toBe("8 Juni 2026");
    expect(capturedPlaceholderValues.at(-1)?.["9333"]).toBe("2026-06-08");
    expect(resolved.variables.find((item) => item.key === "pengadilan_tsb_bas")?.value).toBe("2026-06-08");
  });

  it("does not auto-fill multi-sidang variables until a hearing is selected", async () => {
    const actor: UserPersona = {
      id: "usr-test-super",
      username: "super",
      password: "",
      name: "Super Admin",
      nip: "",
      email: "super@example.test",
      whatsappNumber: "",
      roleId: "super-admin",
      positionId: "pos-admin",
      additionalRoleIds: [],
      isActive: true,
    };
    const mappings = [{
      template_variable_id: "map-sidang-date",
      template_id: "tpl-abt-no-auto",
      variable_id: "var-sidang-date",
      placeholder: "#0033#",
      mapping_required: 0,
      sort_order: 0,
      legacy_code: "0033",
      key: "tanggal_sidang_terpilih",
      label: "Tanggal Sidang Terpilih",
      description: "",
      data_type: "date",
      source_type: "sipp_jadwal_sidang",
      source_key: "sidang.terpilih.tanggal_sidang",
      transform_key: "tanggal_indonesia_panjang",
      fallback_value: "",
      sipp_query_preview: "",
      legacy_abt_type: "multi_sidang",
      field_mode: "",
      ai_enabled: 0,
      manual_override_allowed: 1,
      variable_required: 0,
      example_value: "",
    }];
    const fakeDb = {
      prepare(sql: string) {
        if (sql.includes("FROM jlf_template_variables")) return { all: () => mappings };
        if (sql.includes("FROM jlf_template_versions")) return { get: () => undefined };
        if (sql.includes("FROM jlf_variables")) return { get: () => undefined };
        if (sql.includes("FROM jlf_manual_values")) return { all: () => [] };
        throw new Error(`Unexpected SQL in fake DB: ${sql}`);
      },
    } as unknown as AletaDatabase;

    vi.spyOn(JlfSippProviderRegistry, "getProvider").mockReturnValue({
      key: "aleta_bot_bridge",
      checkConnection: async () => ({ ok: true, provider: "aleta_bot_bridge", status: "connected", message: "ok" }),
      getSatkerConfig: async () => ({}),
      searchCasesByNumber: async () => [],
      searchCasesByPartyName: async () => [],
      getCaseDetail: async () => ({ perkaraId: "9797", nomorPerkara: "302/Pdt.G/2026/PA.Dgl" }),
      getCaseParties: async () => [],
      getCaseWitnesses: async () => [],
      getCaseSchedule: async () => ([{ id: "19160", urutan: "1", tanggalSidang: "2026-06-08", tanggal_sidang: "2026-06-08" }]),
      getLastHearing: async () => ({ id: "19160", urutan: "1", tanggalSidang: "2026-06-08" }),
      getNextHearing: async () => null,
      getJudges: async () => [],
      getPanitera: async () => [],
      getJurusita: async () => [],
      getMediator: async () => [],
      getDecisionData: async () => null,
      executeLegacySqlValue: async () => ({ value: null, rowCount: 0, queryHash: "" }),
      findSippUserByUsername: async () => null,
      findSippUserByNip: async () => null,
      findSippUserByEmail: async () => null,
      searchSippUsers: async () => [],
      getSippUserById: async () => null,
    });

    const resolved = await resolveVariablesForTemplate(fakeDb, actor, {
      templateId: "tpl-abt-no-auto",
      nomorPerkara: "302/Pdt.G/2026/PA.Dgl",
    });

    const variable = resolved.variables.find((item) => item.key === "tanggal_sidang_terpilih");
    expect(variable?.value).toBeNull();
    expect(variable?.warnings?.join(" ")).toContain("Pilih sidang");
  });

  it("uses ABT urutan_data when reading legacy data_sipp columns", async () => {
    const actor: UserPersona = {
      id: "usr-test-super",
      username: "super",
      password: "",
      name: "Super Admin",
      nip: "",
      email: "super@example.test",
      whatsappNumber: "",
      roleId: "super-admin",
      positionId: "pos-admin",
      additionalRoleIds: [],
      isActive: true,
    };
    const capturedSql: string[] = [];
    const mappings = [{
      template_variable_id: "map-sidang-ii",
      template_id: "tpl-abt-urutan",
      variable_id: "var-sidang-ii",
      placeholder: "#0193#",
      mapping_required: 0,
      sort_order: 0,
      legacy_code: "0193",
      key: "tanggal_sidang_ii",
      label: "Tgl. Sidang II",
      description: "",
      data_type: "date",
      source_type: "sipp_jadwal_sidang",
      source_key: "perkara_jadwal_sidang.tanggal_sidang?urutan=2",
      transform_key: "tanggal_indonesia_panjang",
      fallback_value: "",
      sipp_query_preview: "",
      legacy_abt_type: "data_sipp",
      field_mode: "",
      ai_enabled: 0,
      manual_override_allowed: 1,
      variable_required: 0,
      example_value: "",
    }];
    const fakeDb = {
      prepare(sql: string) {
        if (sql.includes("FROM jlf_template_variables")) return { all: () => mappings };
        if (sql.includes("FROM jlf_template_versions")) return { get: () => undefined };
        if (sql.includes("FROM jlf_variables")) return { get: () => undefined };
        if (sql.includes("FROM jlf_manual_values")) return { all: () => [] };
        throw new Error(`Unexpected SQL in fake DB: ${sql}`);
      },
    } as unknown as AletaDatabase;

    vi.spyOn(JlfSippProviderRegistry, "getProvider").mockReturnValue({
      key: "aleta_bot_bridge",
      checkConnection: async () => ({ ok: true, provider: "aleta_bot_bridge", status: "connected", message: "ok" }),
      getSatkerConfig: async () => ({}),
      searchCasesByNumber: async () => [],
      searchCasesByPartyName: async () => [],
      getCaseDetail: async () => ({ perkaraId: "9797", nomorPerkara: "302/Pdt.G/2026/PA.Dgl" }),
      getCaseParties: async () => [],
      getCaseWitnesses: async () => [],
      getCaseSchedule: async () => [],
      getLastHearing: async () => null,
      getNextHearing: async () => null,
      getJudges: async () => [],
      getPanitera: async () => [],
      getJurusita: async () => [],
      getMediator: async () => [],
      getDecisionData: async () => null,
      executeLegacySqlValue: async (input) => {
        capturedSql.push(input.sql);
        return { value: "2026-06-15", rowCount: 1, queryHash: "hash" };
      },
      findSippUserByUsername: async () => null,
      findSippUserByNip: async () => null,
      findSippUserByEmail: async () => null,
      searchSippUsers: async () => [],
      getSippUserById: async () => null,
    });

    const resolved = await resolveVariablesForTemplate(fakeDb, actor, {
      templateId: "tpl-abt-urutan",
      nomorPerkara: "302/Pdt.G/2026/PA.Dgl",
    });

    expect(capturedSql.at(-1)).toContain("`urutan`=2");
    expect(resolved.variables.find((item) => item.key === "tanggal_sidang_ii")?.value).toBe("15 Juni 2026");
  });
});
