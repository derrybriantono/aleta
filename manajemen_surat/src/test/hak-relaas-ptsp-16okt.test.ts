// @vitest-environment node
/**
 * ============================================================================
 * 16 OKT 2026 MALAM - RELAAS HANYA JURU SITA; FOLDER "98 Relaas" / "99 PTSP"
 * ============================================================================
 *
 * Keputusan pengguna: folder Relaas Blangko Derry HANYA untuk juru sita, juru
 * sita pengganti, Super Admin, dan Admin (Panitera, PP, Ketua/Wakil, Panmud,
 * hakim tidak). Di ABT hak folder "Relaas"/"PTSP" selama ini terbaca dari baris
 * 900 (LIMIT 1 berurut indeks) - paket abt-ganti-nama-relaas-ptsp memberi
 * awalan angka. Yang dijaga di sini:
 *   R  matriks peran rute relaas massal (daftar, cetak, katalog blangko)
 *   F  ALETA menyebut folder baru; bot menerima nama lama DAN baru selama
 *      peralihan (folder yang ada menang), tanpa keluar dari akar blangko
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bolehAksi } from "@/lib/matriks-peran";
import { FOLDER_PTSP_NAMA, FOLDER_RELAAS_NAMA, SET_BLANGKO, folderBlangkoRelaas, jalurBlangkoRelaas } from "@/lib/pohon-blangko";

describe("R. relaas massal per peran (matriks rute)", () => {
  const boleh = (roleId: string, positionId = "") => bolehAksi({ roleId, positionId }, "sidang.cetak-relaas");
  it("juru sita, juru sita pengganti, Super Admin, Admin: ya", () => {
    expect(boleh("jurusita", "pos-jurusita")).toBe(true);
    expect(boleh("jurusita", "pos-jurusita-pengganti")).toBe(true);
    expect(boleh("pelaksana", "pos-jurusita-pengganti")).toBe(true);
    expect(boleh("super-admin")).toBe(true);
    expect(boleh("admin")).toBe(true);
  });
  it("Panitera, PP, Ketua, Wakil, Panmud, hakim, kasir: tidak", () => {
    for (const r of ["panitera", "panitera-pengganti", "ketua", "wakil-ketua", "panitera-muda", "hakim", "analis-keuangan"]) {
      expect([r, boleh(r)]).toEqual([r, false]);
    }
  });
});

describe("F. nama folder baru", () => {
  it("ALETA menyebut derry_briantono/98 Relaas; PTSP 99 PTSP", () => {
    expect(FOLDER_RELAAS_NAMA).toBe("98 Relaas");
    expect(FOLDER_PTSP_NAMA).toBe("99 PTSP");
    expect(SET_BLANGKO.find((s) => s.id === "relaas-jurusita")!.folder).toBe("derry_briantono/98 Relaas");
    expect(jalurBlangkoRelaas("[JS] 2. Relaas Pemberitahuan Putusan T.rtf")).toBe("derry_briantono/98 Relaas/[JS] 2. Relaas Pemberitahuan Putusan T.rtf");
    expect(folderBlangkoRelaas()).toContain("derry_briantono/98 Relaas");
    expect(folderBlangkoRelaas()).not.toContain("derry_briantono/Relaas");
  });
});

// ----------------------------------------------------------------------------
// Bot: peralihan nama (jalurBlangkoAman) lewat operasi jembatan sungguhan
// ----------------------------------------------------------------------------
const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));
const jalurJembatan = require_.resolve(path.join(akar, "aleta_bot/services/sippReadOnlyBridgeService.js"));
const jalurExternal = require_.resolve(path.join(akar, "aleta_bot/services/externalDbService.js"));
const jalurLog = require_.resolve(path.join(akar, "aleta_bot/services/logService.js"));
type Jembatan = { handleBridgeOperation: (op: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>> };
const sementara: string[] = [];
const envLama = process.env.ALETA_BOT_BLANGKO_DIR;

function muatJembatan(dir: string): Jembatan {
  const buat = (jalur: string, isi: unknown) => {
    const Mod = require_("module") as { new (id: string): { exports: unknown; loaded: boolean } };
    const mod = new Mod(jalur);
    mod.exports = isi;
    mod.loaded = true;
    require_.cache[jalur] = mod as never;
  };
  buat(jalurExternal, { query: async () => [], sanitizeError: (g: unknown) => String(g) });
  buat(jalurLog, { logSystemEvent: async () => undefined, logAdminAction: async () => undefined, logQueryError: async () => undefined });
  process.env.ALETA_BOT_BLANGKO_DIR = dir;
  delete require_.cache[jalurJembatan];
  return require_(jalurJembatan) as Jembatan;
}
function akarUji(folder: string): string {
  const d = mkdtempSync(path.join(os.tmpdir(), "hpb-blangko-"));
  sementara.push(d);
  mkdirSync(path.join(d, "derry_briantono", folder), { recursive: true });
  writeFileSync(path.join(d, "derry_briantono", folder, "[JS] 2. Relaas Pemberitahuan Putusan T.rtf"), "{\\rtf1 #0001# #0046#}", "latin1");
  return d;
}
afterEach(() => {
  delete require_.cache[jalurJembatan];
  delete require_.cache[jalurExternal];
  delete require_.cache[jalurLog];
  if (envLama === undefined) delete process.env.ALETA_BOT_BLANGKO_DIR;
  else process.env.ALETA_BOT_BLANGKO_DIR = envLama;
  while (sementara.length) rmSync(sementara.pop()!, { recursive: true, force: true });
});

describe("F. bot menerima nama lama dan baru selama peralihan", () => {
  const BERKAS = "[JS] 2. Relaas Pemberitahuan Putusan T.rtf";
  it("server SUDAH diganti nama: portal lama (derry_briantono/Relaas) tetap membaca dari 98 Relaas", async () => {
    const j = muatJembatan(akarUji("98 Relaas"));
    const lama = await j.handleBridgeOperation("blangko.baca", { folder: "derry_briantono/Relaas", berkas: BERKAS });
    const baru = await j.handleBridgeOperation("blangko.baca", { folder: "derry_briantono/98 Relaas", berkas: BERKAS });
    expect([lama.ada, baru.ada]).toEqual([true, true]);
    expect(lama.penanda).toEqual(["0001", "0046"]);
  });
  it("server BELUM diganti nama: portal baru (98 Relaas) membaca dari Relaas; katalog folder juga", async () => {
    const j = muatJembatan(akarUji("Relaas"));
    const baru = await j.handleBridgeOperation("blangko.baca", { folder: "derry_briantono/98 Relaas", berkas: BERKAS });
    expect(baru.ada).toBe(true);
    const kat = (await j.handleBridgeOperation("blangko.katalog", { folder: "derry_briantono/98 Relaas" })) as { ada?: boolean; blangko?: Array<{ berkas: string }> };
    expect(kat.ada).toBe(true);
    expect((kat.blangko ?? []).map((b) => b.berkas)).toContain(BERKAS);
  });
  it("folder lain tidak dialihkan; jalur yang keluar dari akar tetap ditolak", async () => {
    const j = muatJembatan(akarUji("98 Relaas"));
    expect((await j.handleBridgeOperation("blangko.baca", { folder: "derry_briantono/Relaasx", berkas: BERKAS })).ada).toBe(false);
    expect((await j.handleBridgeOperation("blangko.baca", { folder: "../derry_briantono/Relaas", berkas: BERKAS })).ada).toBe(false);
  });
});
