// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  approveSuggestedLink,
  calculateLinkConfidence,
  createManualLink,
  suggestAccountLinks,
  unlinkAccount,
} from "@/server/modules/judicia/legal-form/jlf-account-sync-service";
import { searchJlfCases } from "@/server/modules/judicia/legal-form/cases/jlf-case-service";
import {
  AletaBotSippBridgeProvider,
  DisabledSippProvider,
  JlfSippProviderRegistry,
  type JlfSippProvider,
  type SippUserSummary,
} from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";
import {
  angkaTerbilang,
  escapeDocxText,
  escapeRtfText,
  formatHariIndonesia,
  formatRupiah,
  formatTanggalIndonesiaPanjang,
  sanitizeTextForDocument,
} from "@/server/modules/judicia/legal-form/documents/jlf-transform-service";
import {
  detectAllPlaceholders,
  detectLegacyPlaceholders,
  detectModernPlaceholders,
  listDuplicatePlaceholders,
  normalizePlaceholder,
} from "@/server/modules/judicia/legal-form/templates/jlf-placeholder-service";

function buildFakeProvider(overrides: Partial<JlfSippProvider> = {}): JlfSippProvider {
  const base = new DisabledSippProvider();
  return {
    ...base,
    key: "aleta_bot_bridge",
    checkConnection: async () => ({ ok: true, provider: "aleta_bot_bridge", status: "connected", message: "mock" }),
    getSatkerConfig: async () => ({}),
    searchCasesByNumber: async () => [],
    searchCasesByPartyName: async () => [],
    getCaseDetail: async () => null,
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
    executeLegacySqlValue: async () => ({ value: null, rowCount: 0, queryHash: "" }),
    findSippUserByUsername: async () => null,
    findSippUserByNip: async () => null,
    findSippUserByEmail: async () => null,
    searchSippUsers: async () => [],
    getSippUserById: async () => null,
    ...overrides,
  };
}

describe("JLF parser, SIPP guard, account sync, and transform regression", () => {
  let db: AletaDatabase | null = null;

  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await db?.close();
    db = null;
  });

  it("detects legacy, modern, duplicate, empty, and invalid placeholders safely", () => {
    const content = "Nomor {{nomor_perkara}} legacy #0001# #0048# ulang {{nomor_perkara}} invalid #12# {{1bad}}";
    const all = detectAllPlaceholders(content);

    expect(detectLegacyPlaceholders(content).map((item) => item.placeholder)).toEqual(["#0001#", "#0048#"]);
    expect(detectModernPlaceholders(content).find((item) => item.normalizedKey === "nomor_perkara")?.count).toBe(2);
    expect(listDuplicatePlaceholders(all).map((item) => item.normalizedKey)).toContain("nomor_perkara");
    expect(detectAllPlaceholders("Tidak ada placeholder.")).toHaveLength(0);
    expect(all.map((item) => item.placeholder)).not.toContain("#12#");
    expect(all.map((item) => item.placeholder)).not.toContain("{{1bad}}");
    expect(normalizePlaceholder("{{Nama.Pihak-1}}")).toBe("nama_pihak_1");
  });

  it("formats and escapes document values consistently", () => {
    expect(formatTanggalIndonesiaPanjang("2026-05-24")).toBe("24 Mei 2026");
    expect(formatHariIndonesia("2026-05-24")).toBe("Minggu");
    expect(formatRupiah(1500000)).toBe("Rp1.500.000");
    expect(angkaTerbilang(1205)).toBe("seribu dua ratus lima");
    expect(sanitizeTextForDocument("A\u0000 \n B")).toBe("A B");
    expect(escapeRtfText("A {B}\\C")).toBe("A \\{B\\}\\\\C");
    expect(escapeDocxText("A <B> & C")).toBe("A &lt;B&gt; &amp; C");
  });

  it("keeps disabled SIPP provider safe and rejects raw SQL patterns", async () => {
    const disabled: JlfSippProvider = new DisabledSippProvider();
    await expect(disabled.searchCasesByNumber("123/Pdt.G/2026/PA.X", { limit: 10 })).resolves.toEqual([]);
    await expect(disabled.checkConnection()).resolves.toMatchObject({ ok: false, status: "disabled" });

    for (const sql of ["SELECT * FROM perkara", "INSERT INTO users", "UPDATE perkara", "DELETE FROM perkara", "DROP TABLE perkara"]) {
      expect(() => JlfSippProviderRegistry.assertNoRawSql(sql)).toThrow("Input SIPP tidak boleh berisi SQL");
    }

    const actor = await requireActorUser(db!, "usr-super");
    await expect(searchJlfCases(db!, actor, { mode: "party", query: "DROP TABLE perkara" })).rejects.toThrow("Input SIPP tidak boleh berisi SQL");
  });

  it("applies search limit even if a bridge provider returns too many rows", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const provider = buildFakeProvider({
      searchCasesByNumber: async () => Array.from({ length: 10 }, (_, index) => ({
        perkaraId: `perkara-${index}`,
        nomorPerkara: `${index}/Pdt.G/2026/PA.Tes`,
      })),
    });
    vi.spyOn(JlfSippProviderRegistry, "getProvider").mockReturnValue(provider);

    const result = await searchJlfCases(db!, actor, { mode: "number", query: "123/Pdt.G/2026/PA.Tes", limit: 3 });

    expect(result.items).toHaveLength(3);
    expect(result.rawSqlEndpoint).toBe(false);
  });

  it("uses bridge operation names instead of raw SQL payloads", async () => {
    const calls: unknown[] = [];
    vi.stubEnv("JLF_SIPP_BRIDGE_BASE_URL", "https://bridge.example.test");
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      calls.push(JSON.parse(String((init as RequestInit).body)));
      return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
    }));

    const provider = new AletaBotSippBridgeProvider();
    await provider.searchCasesByNumber("123/Pdt.G/2026/PA.Tes", { limit: 5 });

    expect(calls[0]).toMatchObject({ operation: "case.searchByNumber" });
    expect(JSON.stringify(calls[0])).not.toMatch(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b/i);
  });

  it("detects account-link confidence, conflicts, manual link, unlink, and avoids SIPP password fields", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const candidateOne: SippUserSummary = {
      id: "sipp-1",
      username: actor.username,
      fullname: actor.name,
      nip: actor.nip,
      email: "candidate-one@example.test",
      groupId: "hakim",
      groupName: "Hakim",
    };
    const candidateTwo: SippUserSummary = {
      id: "sipp-2",
      username: actor.username,
      fullname: actor.name,
      nip: actor.nip,
      email: actor.email,
      groupId: "hakim",
      groupName: "Hakim",
    };
    const provider = buildFakeProvider({
      findSippUserByNip: async () => candidateOne,
      findSippUserByEmail: async () => candidateTwo,
      findSippUserByUsername: async () => null,
      searchSippUsers: async () => [candidateOne, candidateTwo],
      getSippUserById: async (id: string) => (id === "sipp-1" ? candidateOne : candidateTwo),
    });
    vi.spyOn(JlfSippProviderRegistry, "getProvider").mockReturnValue(provider);

    expect(calculateLinkConfidence(actor, candidateOne).score).toBeGreaterThanOrEqual(70);
    const suggested = await suggestAccountLinks(db!, actor, actor.id);
    expect(suggested.items.map((item) => item.linkStatus)).toContain("conflict");

    const linked = await createManualLink(db!, actor, { aletaUserId: actor.id, sippUserId: "sipp-1" });
    expect(linked?.linkStatus).toBe("linked");

    const unlinked = await unlinkAccount(db!, actor, linked!.id, "rotasi jabatan");
    expect(unlinked?.linkStatus).toBe("unlinked");

    const approved = await approveSuggestedLink(db!, actor, suggested.items[1]!.id);
    expect(approved?.linkStatus).toBe("linked");

    const row = await db!.prepare("SELECT * FROM jlf_sipp_account_links WHERE id = ?").get<Record<string, unknown>>(linked!.id);
    expect(JSON.stringify(row).toLowerCase()).not.toContain("password");
    expect(JSON.stringify(row).toLowerCase()).not.toContain("hash");
  });
});
