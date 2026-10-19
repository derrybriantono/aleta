// @vitest-environment node

import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * "Belum diverifikasi Majelis/Hakim" memuat kata "diverifikasi" dan dahulu
 * terbaca valid: Jadwal Sidang menandai 497/Pdt.G/2026/PA.Dgl "Sudah
 * diverifikasi" padahal duplik belum diperiksa majelis (19 Oktober 2026).
 */
const akar = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(akar, "aleta_bot", "app.js"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const toko = muat("./services/ecourtStoreService.js");

describe("status verifikasi dokumen e-Court", () => {
  it("belum diverifikasi tetap belum", () => {
    expect(toko.normalizeStatus("Belum diverifikasi Majelis/Hakim")).toBe("belum");
    expect(toko.normalizeStatus("Status Dokumen : Belum diverifikasi Majelis/Hakim")).toBe("belum");
    expect(toko.normalizeStatus("Menunggu verifikasi majelis")).toBe("belum");
  });

  it("sudah diverifikasi tetap valid", () => {
    expect(toko.normalizeStatus("Sudah diverifikasi Majelis/Hakim (Dokumen Valid)")).toBe("valid");
    expect(toko.normalizeStatus("terverifikasi")).toBe("valid");
    expect(toko.normalizeStatus("valid")).toBe("valid");
  });

  it("tidak valid dan kosong", () => {
    expect(toko.normalizeStatus("Dokumen Tidak Valid")).toBe("tidak_valid");
    expect(toko.normalizeStatus("")).toBe("belum");
    expect(toko.normalizeStatus("apa saja", { perluVerifikasi: false })).toBe("tidak_perlu");
  });
});
