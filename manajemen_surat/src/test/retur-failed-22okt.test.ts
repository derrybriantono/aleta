import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 22 Okt: relaas pos "FAILED TO DELIVERY ..." (651/Pdt.G/2026) berstatus_pos kosong tetapi harus dihitung retur.
const require_ = createRequire(import.meta.url);
const { relaasRetur, sqlRetur } = require_(path.resolve(process.cwd(), "..", "aleta_bot", "services", "returRelaas.js")) as {
  relaasRetur: (statusPos: unknown, hasil: unknown) => boolean;
  sqlRetur: (alias: string) => string;
};

describe("retur relaas: status pos 2, kata retur, atau kata failed", () => {
  it("menangkap FAILED TO DELIVERY walau status_pos kosong", () => {
    expect(relaasRetur(null, "FAILED TO DELIVERY, alamat pihak penerima tidak ditemukan")).toBe(true);
    expect(relaasRetur(null, "Surat RETUR ke pengirim")).toBe(true);
    expect(relaasRetur(2, "")).toBe(true);
    expect(relaasRetur("2", null)).toBe(true);
  });

  it("panggilan biasa dan sampai bukan retur", () => {
    expect(relaasRetur(null, "Panggilan sidang")).toBe(false);
    expect(relaasRetur(1, "Diterima langsung")).toBe(false);
    expect(relaasRetur(undefined, undefined)).toBe(false);
  });

  it("penggalan SQL tidak pernah NULL dan memuat ketiga syarat", () => {
    const s = sqlRetur("r");
    expect(s).toContain("COALESCE(r.status_pos, 0) = 2");
    expect(s).toContain("LIKE '%retur%'");
    expect(s).toContain("LIKE '%failed%'");
  });

  it("semua penghitung retur di bot memakai aturan bersama", async () => {
    const { readFileSync } = await import("node:fs");
    for (const berkas of [
      "analisaLanjutService.js",
      "checklistMilestoneService.js",
      "lapisanPetaService.js",
      "rekapPetugasService.js",
      "sippJadwalSidangService.js",
      "sippStatusPerkaraService.js",
      "tagPerkaraService.js",
    ]) {
      const isi = readFileSync(path.resolve(process.cwd(), "..", "aleta_bot", "services", berkas), "utf8");
      expect(isi, berkas).toContain('require("./returRelaas")');
      expect(isi, berkas).not.toMatch(/status_pos = 2 THEN|WHERE r\.status_pos = 2|statusPos\) === 2,/);
    }
  });
});
