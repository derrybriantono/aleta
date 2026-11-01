// @vitest-environment node
/**
 * 1 NOV 2026 - paket ABT abt-bukti-pisah-1nov (bukti surat dan bukti elektronik dicetak TERPISAH di BAS pembuktian dan putusan).
 * Yang dijaga dari isi paket SUNGGUHAN (penulisan ke blangko ABT, jadi ketat):
 *   - nomor variabel paket = blok 12040-12079, nomor tetap 12040-12049 selaras KODE_BUKTI_PISAH portal/ekstensi, tanpa tabrakan dengan paket lain;
 *   - tiap variabel di PASANG.sql, PERIKSA.sql, PULIH.sql, nomor-variabel.txt; tanpa kata "Aleta"; md5 berkas paket cocok;
 *   - kueri variabel: bagian kosong = '' (bukan titik-titik / placeholder), daftar hanya lewat fungsi paket, garis miring terbalik lewat CHAR(92);
 *   - tambalan blangko: tiap berkas ditambal ber-md5 lama/baru, tanpa tambalan di berkas di luar daftar sasaran awan-T11 (397 - 2 yang dibiarkan);
 *   - fungsi paket: nama, tidak menyentuh isian_rtf_bukti lama (variabel 11170-11177 tetap).
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { KODE_BUKTI_PISAH } from "@/lib/isi-sipp-format";

const AKAR = path.resolve(process.cwd(), "..");
const DIR = path.join(AKAR, "abt-paket/bukti-pisah-1nov/paket-satker");
const N = "abt-bukti-pisah-1nov";
const baca = (b: string) => readFileSync(path.join(DIR, b), "utf8");
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const VAR = JSON.parse(readFileSync(path.join(AKAR, "abt-paket/bukti-pisah-1nov/hasil/variabel.json"), "utf8")) as { no: number; nama: string; sql: string; kunci: string[] }[];
const SASARAN = readFileSync(path.join(AKAR, "docs/arahan/awan-T11-blangko-sasaran.tsv"), "utf8")
  .split("\n")
  .filter((l) => l.endsWith("\tBAS") || /\t(putusan-penetapan)\t/.test(l) || l.includes(".rtf\t"));
const DAFTAR = baca("daftar-tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));

describe("variabel paket", () => {
  it("nomor unik dalam blok 12040-12079; nomor tetap selaras KODE_BUKTI_PISAH portal", () => {
    const nomor = VAR.map((v) => v.no);
    expect(new Set(nomor).size).toBe(nomor.length);
    for (const n of nomor) {
      expect(n).toBeGreaterThanOrEqual(12040);
      expect(n).toBeLessThanOrEqual(12079);
    }
    const byKey = (k: string[]) => VAR.find((v) => JSON.stringify(v.kunci) === JSON.stringify(k))?.no;
    expect(byKey(["DS", "P"])).toBe(Number(KODE_BUKTI_PISAH.P.surat));
    expect(byKey(["DE", "P"])).toBe(Number(KODE_BUKTI_PISAH.P.el));
    expect(byKey(["DS", "T"])).toBe(Number(KODE_BUKTI_PISAH.T.surat));
    expect(byKey(["DE", "T"])).toBe(Number(KODE_BUKTI_PISAH.T.el));
    expect(byKey(["SL", "P", ". Selanjutnya #7085# menyerahkan bukti surat berupa :"])).toBe(Number(KODE_BUKTI_PISAH.P.pengantarSurat));
    expect(byKey(["EI", "P", "#7085#"])).toBe(Number(KODE_BUKTI_PISAH.P.pengantarEl));
    expect(byKey(["HA", "P", "Bukti Surat:"])).toBe(Number(KODE_BUKTI_PISAH.P.putusan));
    expect(byKey(["SL", "T", ". Selanjutnya #7086# menyerahkan bukti surat berupa:"])).toBe(Number(KODE_BUKTI_PISAH.T.pengantarSurat));
    expect(byKey(["EI", "T", "#7086#"])).toBe(Number(KODE_BUKTI_PISAH.T.pengantarEl));
    expect(byKey(["HA", "T", "Bukti Surat:"])).toBe(Number(KODE_BUKTI_PISAH.T.putusan));
  });

  it("tidak bertabrakan dengan blok jawab-replik 12020-12036 atau paket lain yang memakai 120xx", () => {
    const pakai = new Set<number>();
    for (const d of readdirSync(path.join(AKAR, "abt-paket"))) {
      if (d === "bukti-pisah-1nov") continue;
      let nv = "";
      try {
        nv = readFileSync(path.join(AKAR, "abt-paket", d, "paket-satker/nomor-variabel.txt"), "utf8");
      } catch {
        continue;
      }
      for (const l of nv.split("\n")) if (/^\d+$/.test(l.trim())) pakai.add(Number(l.trim()));
    }
    for (const v of VAR) expect(pakai.has(v.no)).toBe(false);
    expect(baca("nomor-variabel.txt").split("\n").filter((l) => /^\d+$/.test(l)).map(Number)).toEqual(VAR.map((v) => v.no));
  });

  it("PASANG, PERIKSA, PULIH memuat tiap variabel; tanpa kata Aleta di berkas mana pun yang tertulis ke ABT", () => {
    const pasang = baca(`${N}-PASANG.sql`);
    const periksa = baca(`${N}-PERIKSA.sql`);
    const pulih = baca(`${N}-PULIH.sql`);
    for (const v of VAR) {
      expect(pasang).toContain(`WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = ${v.no})`);
      expect(periksa).toContain(`'var ${v.no}'`);
      expect(pulih).toContain(`DELETE FROM abt_variabel WHERE no_var = ${v.no} AND`);
      expect(v.nama + v.sql).not.toMatch(/aleta/i);
      expect(v.nama.length).toBeLessThanOrEqual(200);
    }
    for (const b of [`${N}-FUNGSI.sql`, `${N}-PASANG.sql`, `${N}-PERIKSA.sql`, `${N}-PULIH.sql`, "uji-kueri.tsv"]) expect(baca(b)).not.toMatch(/aleta/i);
  });

  it("kueri: kosong = '' (atau titik untuk klausa), daftar hanya lewat fungsi paket, garis miring terbalik lewat CHAR(92)", () => {
    for (const v of VAR) {
      expect(v.sql.startsWith("SELECT ")).toBe(true);
      expect(v.sql).toContain("aps_badilag.isian_bukti_");
      expect(v.sql).not.toContain("\\");
      expect(v.sql).not.toMatch(/\.\.\./);
      expect(v.sql).not.toMatch(/isian_rtf_bukti\(/); // daftar hanya lewat isian_bukti_rtf (penutup \par ikut fungsi)
      const j = v.kunci[0];
      if (j === "DS" || j === "DE") expect(v.sql).toMatch(/isian_bukti_rtf\(aps_badilag\.isian_bukti_sumber\('#perkara_id#', '[PT]'\), [01]\)/);
      if (j === "SL") expect(v.sql).toMatch(/, '\.'\) AS data$/);
      if (["EI", "HA", "HE"].includes(j)) expect(v.sql).toMatch(/, ''\) AS data$/);
      if (["EI", "HA", "HE"].includes(j)) expect(v.sql).toContain("CHAR(92 USING latin1), 'par'");
    }
  });

  it("pihak: sumber T hanya untuk variabel T, selain itu P (tidak tertukar)", () => {
    for (const v of VAR) {
      const pihak = v.kunci[0] === "A" ? v.kunci[2] : v.kunci[0] === "LT" ? v.kunci[1] : v.kunci[1];
      const dipakai = [...new Set([...v.sql.matchAll(/isian_bukti_sumber\('#perkara_id#', '([PT])'\)/g)].map((m) => m[1]))];
      expect(dipakai).toEqual([pihak]);
    }
  });
});

describe("berkas paket dan tambalan blangko", () => {
  it("md5 berkas paket cocok MD5SUMS", () => {
    const baris = baca("MD5SUMS.txt").split("\n").filter(Boolean);
    expect(baris.length).toBeGreaterThanOrEqual(14);
    for (const l of baris) {
      const [m, f] = l.split(/  /);
      expect(md5(readFileSync(path.join(DIR, f)))).toBe(m);
    }
    expect(readdirSync(DIR).includes("cadangan")).toBe(false);
  });

  it("daftar tambalan: 395 berkas dari 397 sasaran, tiap berkas md5 lama/baru beda, tidak ada di luar sasaran", () => {
    const sasaran = new Set(SASARAN.map((l) => l.split("\t")[0]).filter((x) => x.endsWith(".rtf")));
    expect(sasaran.size).toBe(397);
    expect(DAFTAR).toHaveLength(395);
    const rel = DAFTAR.map((d) => d[1].replace(/^derry_briantono\//, ""));
    for (const r of rel) expect(sasaran.has(r)).toBe(true);
    expect(new Set(rel).size).toBe(rel.length);
    for (const d of DAFTAR) {
      expect(d[2]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[3]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[2]).not.toBe(d[3]);
    }
    const dibiarkan = [...sasaran].filter((r) => !rel.includes(r));
    expect(dibiarkan.every((r) => r.startsWith("4a Harta Bersama/"))).toBe(true);
    expect(dibiarkan).toHaveLength(2);
  });

  it("tambalan: potongan baru memuat variabel paket dan TIDAK menyisakan penanda sementara atau variabel lama #1117x# kecuali di 2 berkas dibiarkan", () => {
    const nomor = new Set(VAR.map((v) => String(v.no)));
    let dipakai = new Set<string>();
    let adaBaru = 0;
    for (const l of baca("tambal.tsv").split("\n")) {
      if (!l || l.startsWith("#")) continue;
      const [, , lama, baru] = l.split("\t");
      const b = Buffer.from(baru, "base64").toString("latin1");
      const a = Buffer.from(lama, "base64").toString("latin1");
      expect(b).not.toContain("<<<");
      expect(b).not.toMatch(/#1117[0-7]#/);
      for (const m of b.matchAll(/#(120\d\d)#/g)) {
        expect(nomor.has(m[1])).toBe(true);
        dipakai.add(m[1]);
      }
      if (/#1117[0-7]#/.test(a)) adaBaru += 1;
    }
    expect(adaBaru).toBeGreaterThan(300);
    expect([...dipakai].sort()).toEqual([...nomor].sort());
  });
});

describe("fungsi paket", () => {
  const f = baca(`${N}-FUNGSI.sql`);
  it("tiga fungsi baru; tanpa mengubah fungsi lama; baris elektronik dikenali dari 'bukti elektronik tersebut'", () => {
    for (const n of ["isian_bukti_baris", "isian_bukti_sumber", "isian_bukti_rtf"]) {
      expect(f).toContain(`CREATE FUNCTION \`${n}\``);
      expect(f).toContain(`DROP FUNCTION IF EXISTS ${n}$$`);
    }
    expect(f).not.toMatch(/CREATE FUNCTION `isian_rtf_/);
    expect(f).toContain("LOCATE('bukti elektronik tersebut', ln)");
    expect(f).toMatch(/isian_bukti_sumber[\s\S]*9955, 1214, 9958, 8131, 8132, 378, 9956/);
    expect(f).toContain("= 9911");
  });
});
