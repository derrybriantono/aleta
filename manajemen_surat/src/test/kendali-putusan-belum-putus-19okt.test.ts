// @vitest-environment node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Kendali berkas: "Putusan yang belum terbit di e-Court" hanya untuk perkara
 * yang SUDAH diputus di SIPP. Dahulu 153 perkara, termasuk 676-678/Pdt.G/2026
 * yang baru terdaftar, tertulis "Menu Putusan E-Court Error" (19 Okt 2026).
 */
const akar = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(akar, "aleta_bot", "app.js"));
const jalurLayanan = muat.resolve("./services/putusanEcourtService.js");
const jalurBotDb = muat.resolve("./services/botDbService.js");
const jalurSipp = muat.resolve("./db_config.js");

function pasangTiruan(sudahPutus: string[] | "galat") {
  delete muat.cache[jalurLayanan];
  muat.cache[jalurBotDb] = {
    id: jalurBotDb,
    filename: jalurBotDb,
    loaded: true,
    exports: {
      query: async (sql: string) =>
        /FROM aleta_bot_ecourt_putusan/.test(sql)
          ? [
              { nomorPerkara: "676/Pdt.G/2026/PA.Dgl", adaBaris: 0, dokumenAda: 0, paniteraTte: 0 },
              { nomorPerkara: "550/Pdt.G/2026/PA.Dgl", adaBaris: 0, dokumenAda: 0, paniteraTte: 0 },
              { nomorPerkara: "400/Pdt.G/2026/PA.Dgl", adaBaris: 1, dokumenAda: 0, paniteraTte: 0 },
            ]
          : [],
    },
  } as unknown as NodeJS.Module;
  muat.cache[jalurSipp] = {
    id: jalurSipp,
    filename: jalurSipp,
    loaded: true,
    exports: {
      query: (_sql: string, _p: unknown[], cb: (e: Error | null, r?: unknown[]) => void) =>
        sudahPutus === "galat" ? cb(new Error("SIPP mati")) : cb(null, sudahPutus.map((n) => ({ nomorPerkara: n }))),
    },
  } as unknown as NodeJS.Module;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const layanan = muat(jalurLayanan);
  layanan.ensureSchema = async () => undefined;
  return layanan;
}

describe("daftar putusan belum terbit hanya perkara yang sudah diputus di SIPP", () => {
  it("perkara belum putus tidak masuk daftar", async () => {
    const layanan = pasangTiruan(["550/Pdt.G/2026/PA.Dgl", "400/Pdt.G/2026/PA.Dgl"]);
    const nomorPutus = await layanan.nomorSudahPutus(["676/Pdt.G/2026/PA.Dgl", "550/Pdt.G/2026/PA.Dgl"]);
    expect([...nomorPutus]).toContain("550/Pdt.G/2026/PA.Dgl");
    expect([...nomorPutus]).not.toContain("676/Pdt.G/2026/PA.Dgl");
  });

  it("SIPP tidak terbaca dijawab null (tidak tahu, bukan tidak putus)", async () => {
    const layanan = pasangTiruan("galat");
    expect(await layanan.nomorSudahPutus(["550/Pdt.G/2026/PA.Dgl"])).toBeNull();
  });

  it("kode daftar menyaring dengan nomorSudahPutus", () => {
    const kode = readFileSync(jalurLayanan, "utf8");
    const i = kode.indexOf("async function daftarPerluTindakan");
    const blok = kode.slice(i, kode.indexOf("module.exports", i));
    expect(blok).toContain("nomorSudahPutus(");
    expect(blok).toContain("putus.has(");
  });
});
