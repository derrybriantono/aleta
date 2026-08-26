// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { AletaBotSippBridgeProvider } from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";

describe("JLF SIPP bridge provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses allowlisted bridge operation names instead of raw SQL payloads", async () => {
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

  it("surfaces bridge failures instead of returning empty search results", async () => {
    vi.stubEnv("JLF_SIPP_BRIDGE_BASE_URL", "http://aleta-bot.test");
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: "runtime belum siap" }), { status: 503 })
    ));

    const provider = new AletaBotSippBridgeProvider();

    await expect(provider.searchCasesByNumber("123/Pdt.G/2026/PA.Tes", { limit: 5 })).rejects.toThrow(
      "Bridge SIPP JLF menolak operasi"
    );
  });

  it("sends the legacy ALETA_BOT_INTERNAL_TOKEN when API token env is not set", async () => {
    const headersSeen: Array<Record<string, string>> = [];
    vi.stubEnv("JLF_SIPP_BRIDGE_BASE_URL", "https://bridge.example.test");
    vi.stubEnv("ALETA_BOT_INTERNAL_TOKEN", "legacy-token-123");
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      headersSeen.push((init as RequestInit).headers as Record<string, string>);
      return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
    }));

    const provider = new AletaBotSippBridgeProvider();
    await provider.searchCasesByNumber("123/Pdt.G/2026/PA.Tes", { limit: 5 });

    expect(headersSeen[0]?.["x-aleta-internal-token"]).toBe("legacy-token-123");
  });

  it("explains the localhost fallback problem clearly for Docker deployments", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("fetch failed");
    }));

    const provider = new AletaBotSippBridgeProvider();

    await expect(provider.searchCasesByNumber("123/Pdt.G/2026/PA.Tes", { limit: 5 })).rejects.toThrow(
      "fallback localhost"
    );
  });
});
