// @vitest-environment node
/**
 * Paket ABT abt-prodeo-8507-5nov: nilai prodeo variabel 8507 berakhir <br>; trim() ABT membuang spasi sesudah \par sehingga #8507#Bahwa tercetak \parBahwa dan kata "Bahwa" hilang.
 * Rumus baru mengakhiri nilai dengan kata kendali netral \uc1. Penjaga: hanya ujung rumus yang berubah, tanpa escape baru, tanpa berkas blangko, MD5SUMS, uji laptop, render, dan mesin bersih
 * menghasilkan \par 솺hwa.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(REPO, "abt-paket/prodeo-8507-5nov");
const P = path.join(AKAR, "paket-satker");
const N = "abt-prodeo-8507-5nov";
const sql = (n: string) => readFileSync(path.join(P, `${N}-${n}.sql`), "latin1");
const heks = (s: string) => Buffer.from(/CONVERT\(0x([0-9a-f]+) USING latin1\)/.exec(s)?.[1] ?? "", "hex").toString("latin1");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");
const baru = heks(sql("PASANG"));
const lama = heks(sql("PULIH"));

describe("paket prodeo-8507-5nov", () => {
  it("hanya ujung rumus yang berubah; non-prodeo tetap kosong; tanpa escape baru", () => {
    const ujungLama = 'cuma-cuma;<br>")';
    const ujungBaru = 'cuma-cuma;<br>", CONVERT(CHAR(92) USING utf8), "uc1")';
    expect(lama.split(ujungLama)).toHaveLength(2);
    expect(baru).toBe(lama.replace(ujungLama, ujungBaru));
    expect(baru).toMatch(/else '' end as data/);
    expect(baru.split("\\").length).toBe(lama.split("\\").length);
    expect(baru).not.toMatch(/aleta/i);
  });

  it("sidik PRASYARAT/PERIKSA cocok dengan rumus lama dan baru; WHERE menjaga rumus; modified tidak berubah", () => {
    const m0 = md5(Buffer.from(lama, "latin1"));
    const m1 = md5(Buffer.from(baru, "latin1"));
    expect(sql("PRASYARAT")).toContain(m0);
    expect(sql("PRASYARAT")).toContain(m1);
    expect(sql("PERIKSA")).toContain(m1);
    expect(sql("PASANG")).toContain(`MD5(sql_query) = '${m0}'`);
    expect(sql("PULIH")).toContain(`MD5(sql_query) = '${m1}'`);
    for (const n of ["PASANG", "PULIH"]) expect(sql(n)).toContain("modified = modified");
    expect(readFileSync(path.join(P, "harap.txt"), "utf8").trim().split("\n")).toEqual(["1|0", "0|1"]);
  });

  it("isi paket = MD5SUMS; tanpa berkas blangko", () => {
    for (const l of readFileSync(path.join(P, "MD5SUMS.txt"), "utf8").split("\n").filter(Boolean)) {
      const [h, n] = l.split(/\s+\*?/);
      expect(md5(readFileSync(path.join(P, n))), n).toBe(h);
    }
    expect(readdirSync(P).filter((f) => /\.rtf$|tambal/i.test(f))).toHaveLength(0);
  });

  it("mesin bersih: rumus lolos pagar; nilai + teks blangko = \\par \\uc1Bahwa", () => {
    const r = createRequire(import.meta.url);
    const m = r(path.join(REPO, "aleta_bot/services/abtMesinVariabel.js"));
    expect(m.pagarBaca(baru.replace(/#perkara_id#/g, "1"))).toBe("");
    const peta = new Map<string, string>([["", "\\uc1"]]);
    const rtf = m.keRtf(m.bersihkanHtmlAbt("cuma-cuma;<br>"), peta) + "Bahwa";
    expect(rtf).toContain("\\par \\uc1Bahwa");
  });

  it("uji laptop dan render ABT asli lengkap", () => {
    const uji = readFileSync(path.join(AKAR, "hasil/uji-lokal.txt"), "utf8");
    for (const s of ["PRASYARAT COCOK (1|0)", "PRASYARAT COCOK (0|1)", "SEMUA COCOK", "PULIH COCOK (1|0)", "SELURUH TABEL VARIABEL = AWAL (termasuk modified)", "TIDAK ADA YANG BERUBAH", "AKHIR: SELURUH TABEL VARIABEL = AWAL"]) {
      expect(uji, s).toContain(s);
    }
    const render = readFileSync(path.join(AKAR, "hasil/render-banding.txt"), "utf8");
    expect(render).toMatch(/^GAGAL\t0$/m);
    expect(render).not.toMatch(/\tTIDAK$/m);
  });
});
