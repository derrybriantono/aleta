import { describe, expect, it } from "vitest";

import { getCourtDirectoryEntryByName, searchCourtDirectory } from "@/lib/court-catalog";

describe("court catalog search", () => {
  it("returns multiple Palu satker results for a broad city query", () => {
    const paluMatches = searchCourtDirectory("palu").map((item) => item.id);

    expect(paluMatches).toEqual(
      expect.arrayContaining(["pa-palu", "pn-palu", "pta-palu", "pt-sulteng"])
    );
  });

  it("returns Donggala for partial query and aliases", () => {
    const partialMatches = searchCourtDirectory("donggala");
    const aliasMatches = searchCourtDirectory("pa donggala");

    expect(partialMatches.some((item) => item.id === "pa-donggala")).toBe(true);
    expect(aliasMatches.some((item) => item.id === "pa-donggala")).toBe(true);
  });

  it("resolves exact alias lookup to the same satker", () => {
    const exact = getCourtDirectoryEntryByName("pengadilan agama donggala");

    expect(exact?.id).toBe("pa-donggala");
    expect(exact?.identity.courtShortName).toBe("PA Donggala");
  });

  it("supports court type plus region queries for Palu satker", () => {
    expect(searchCourtDirectory("pa palu")[0]?.id).toBe("pa-palu");
    expect(searchCourtDirectory("pn palu")[0]?.id).toBe("pn-palu");
    expect(getCourtDirectoryEntryByName("pengadilan negeri palu")?.id).toBe("pn-palu");
  });

  it("provides complete structured identity payloads without inheriting social fields from other satker", () => {
    const paPalu = getCourtDirectoryEntryByName("pa palu");
    const pnPalu = getCourtDirectoryEntryByName("pn palu");

    expect(paPalu?.identity.address).toContain("WR. Supratman");
    expect(paPalu?.identity.website).toBe("https://pa-palu.go.id");
    expect(paPalu?.identity.instagram).toBe("");

    expect(pnPalu?.identity.address).toContain("Samratulangi");
    expect(pnPalu?.identity.email).toBe("pnpalu@gmail.com");
    expect(pnPalu?.identity.instagram).toBe("@pengadilan_negeri_palu");
  });
});
