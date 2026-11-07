import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { POLA_ID_BLANGKO } from "@/lib/id-blangko-abt";

/**
 * Tiga cacat yang hanya muncul bila layar cetak ALETA ABT dicoba dengan PUSTAKA NYATA (sinkron dari ABT salinan, 7 Nov 2026), bukan data fiktif:
 *  1. id blangko di pustaka = jalur berkas ("1 Perceraian CG/[01] ... .rtf", sampai 181 huruf), ditolak 400 oleh pola id lama [\w.:@-]{1,80};
 *  2. badan permintaan pratinjau memuat seluruh pustaka rumus (±2,5 MB) dan RTF blangko, ditolak 413 oleh batas 1 MB bot;
 *  3. pemeriksa "bukan RTF" di bot memakai /\{\rtf/ (\r = CR), sehingga tidak ada RTF yang lolos.
 * Berkas sumber dibaca apa adanya, dan pola diambil dari sumber lalu dicoba pada contoh nyata.
 */
const AKAR_PORTAL = path.resolve(__dirname, "..", "..");
const AKAR_BOT = path.resolve(__dirname, "../../../aleta_bot");

describe("layar cetak ALETA ABT dengan pustaka nyata", () => {
  it("pola id blangko menerima jalur berkas pustaka dan tetap menolak jalur berbahaya", () => {
    const pola = POLA_ID_BLANGKO;
    expect(pola.test("1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf")).toBe(true);
    expect(pola.test("4a Harta Bersama/[01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan.rtf")).toBe(true);
    expect(pola.test("berkas-uji")).toBe(true);
    expect(pola.test("a/" + "x".repeat(200) + ".rtf")).toBe(true);
    expect(pola.test("../x")).toBe(false);
    expect(pola.test("a/../b")).toBe(false);
    expect(pola.test("a\\b")).toBe(false);
    expect(pola.test("a\u0001b")).toBe(false);
    expect(pola.test("")).toBe(false);
  });

  it("bot: badan jalur jembatan SIPP boleh besar, dan pengurai besar dipasang sebelum pengurai umum 1 MB", () => {
    const app = readFileSync(path.join(AKAR_BOT, "app.js"), "utf8");
    const baris = 'app.use("/internal/aleta-bot/jlf/sipp/query", express.json({ limit: "16mb" }));';
    expect(app).toContain(baris);
    expect(app.indexOf(baris)).toBeLessThan(app.indexOf('app.use(express.json({ limit: "1mb" }));'));
  });

  it("bot: pemeriksa RTF di isiBlangkoPustaka mengenali RTF sungguhan dan menolak yang bukan", () => {
    const jembatan = readFileSync(path.join(AKAR_BOT, "services/sippReadOnlyBridgeService.js"), "utf8");
    const baris = jembatan.split(/\r?\n/).find((b) => b.includes("Blangko ini bukan RTF."));
    const lit = /if \(!(\/.*\/[a-z]*)\.test\(rtf/.exec(baris ?? "");
    expect(lit).not.toBeNull();
    const pola = new Function(`return ${lit![1]}`)() as RegExp;
    expect(pola.test(String.raw`{\rtf1 \ansi \ansicpg1252 \deff0`)).toBe(true);
    expect(pola.test(String.raw`  {\rtf1\ansi`)).toBe(true);
    expect(pola.test("%PDF-1.7")).toBe(false);
    expect(pola.test("PK\u0003\u0004 docx")).toBe(false);
  });
});
