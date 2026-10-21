// @vitest-environment node
/**
 * ============================================================================
 * 21 OKT 2026 (malam) - SISA TUNTUTAN PAKET x4 (paket ABT x8)
 * ============================================================================
 *   A  CT [02] Rekonvensi: harta bersama dalam gugatan rekonvensi tercetak lewat #3451# (pertimbangan, paragraf baru sebelum judul
 *      "Dalam Konvensi Dan Rekonvensi") dan #3452# (amar, butir bernomor sesudah butir rekonvensi terakhir); panel hanya mengenal
 *      tuntutan harta bersama di blangko ini - isi tetap rekonvensi (mut'ah, iddah, madliyah, hak asuh, nafkah anak) tidak disembunyikan.
 *   B  Kutipan petitum untuk pemicu tuntutan lain (#3450#): bagian "Tuntutan dalam posita dan petitum" panel menampilkan kutipan
 *      hak bekas istri, kebendaan, anak, kelalaian seperti kutipan akibat cerai (#3400#).
 *   C  Paket ABT x8: ASCII, tanpa nama aplikasi, hanya SELECT, nomor 3450-3452 bebas; 3450 mencakup SEMUA pemicu tuntutan lain.
 * Fixture = blangko server 21 Okt malam sesudah tambalan RTF x8 + katalog abt_variabel lab dengan x8 (alat/buat_fixture.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";

import { kodeUntukNilai, susunIsian, TUNTUTAN_LAIN, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

type Fixture = { blangko: Array<{ berkas: string; penandaAbt: string[] }>; katalog: Record<string, { nama: string; jenis: string; sql: string; bawaan: string }> };
const FX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "tuntutan-sisa-21okt.json"), "utf8")) as Fixture;
const KATALOG = new Map<string, Definisi>(Object.entries(FX.katalog).map(([kode, d]) => [kode, { kode, ...d }]));
const KATALOG_LAMA = new Map([...KATALOG].filter(([k]) => !["3450", "3451", "3452"].includes(k)));
const blangko = (awal: string) => {
  const b = FX.blangko.find((x) => x.berkas.startsWith(awal));
  if (!b) throw new Error(`fixture tanpa ${awal}`);
  return b;
};
const susun = (awal: string, k = KATALOG) => susunIsian(blangko(awal).penandaAbt, k);
const tag = (awal: string, k = KATALOG) => new Map(susun(awal, k).isian.map((b) => [b.kode, b.tuntutan || []]));
const REK = "1a Perceraian CT/[02] [Kabul] [Rekonvensi]";
const CT01 = "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf";
const HBI = "1f Hak Bekas Istri/[01b]";
const HB = "4a Harta Bersama/[01b]";
const NA = "6c Nafkah Anak/[01b]";

describe("A. CT [02] Rekonvensi: harta bersama dalam gugatan rekonvensi", () => {
  it("blangko memuat #3451# (pertimbangan) dan #3452# (amar); panel mengenal HANYA tuntutan harta bersama", () => {
    expect(blangko(REK).penandaAbt).toEqual(expect.arrayContaining(["3451", "3452"]));
    expect((susun(REK).tuntutan || []).map((t) => t.pemicu)).toEqual(["4145"]);
    const t = tag(REK);
    expect(t.get("4105")).toEqual(["4145"]);
    expect(t.get("8730")).toEqual(["4145"]);
    for (const k of ["6054", "6055", "7120", "6071", "6072", "2004"]) expect(t.get(k) || [], k).toEqual([]);
  });
  it("sebelum paket x8 terpasang (katalog tanpa 3451/3452) tidak ada isian rekonvensi yang disembunyikan", () => {
    expect(susun(REK, KATALOG_LAMA).tuntutan || []).toEqual([]);
  });
});

describe("B. kutipan petitum tuntutan lain (#3450#)", () => {
  it("hak bekas istri, harta bersama, nafkah anak: kutipanLain = 3450 dan ikut dinilai bot; blangko cerai tetap memakai 3400 saja", () => {
    for (const awal of [HBI, HB, NA]) {
      const s = susun(awal);
      expect(s.kutipanLain, awal).toBe("3450");
      expect(s.kutipanTuntutan, awal).toBeUndefined();
      expect(kodeUntukNilai(s, false), awal).toContain("3450");
    }
    const c = susun(CT01);
    expect(c.kutipanTuntutan).toBe("3400");
    expect(c.kutipanLain).toBeUndefined();
    expect(susun(HBI, KATALOG_LAMA).kutipanLain).toBeUndefined(); // sebelum paket: tidak ada kode yang tidak dikenal
  });

  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/lain/", runScripts: "outside-only" });
  const w = dom.window as unknown as { eval: (s: string) => void; aletaBlangkoDerryIsian: any; chrome: unknown };
  w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } }, runtime: { id: "uji" } };
  const EK = path.resolve(process.cwd(), "../ekstensi-sipp");
  w.eval(readFileSync(path.join(EK, "blangko-derry.js"), "utf8"));
  w.eval(readFileSync(path.join(EK, "blangko-derry-isian.js"), "utf8"));
  afterAll(() => dom.window.close());

  it("ekstensi menguraikan baris kutipan semua kode pemicu (bukan hanya 4140-4145)", () => {
    const u = w.aletaBlangkoDerryIsian.murni.uraiKutipanTuntutan("3402|ya|...membayar maskan selama iddah...\n3404|tidak|\n4788|ragu|petitum di SIPP kosong\n4142|ya|...nafkah iddah...");
    expect(u["3402"]).toEqual({ status: "ya", kutipan: "...membayar maskan selama iddah..." });
    expect(u["3404"].status).toBe("tidak");
    expect(u["4788"].status).toBe("ragu");
    expect(u["4142"].status).toBe("ya");
  });
});

const PAKET = path.resolve(process.cwd(), "../abt-paket/x8-sisa-tuntutan-21okt");
const N = "abt-x8-sisa-tuntutan-21okt";
describe("C. paket ABT x8", () => {
  it("berkas paket lengkap; ASCII; tanpa nama aplikasi; uji kueri hanya SELECT", () => {
    for (const f of ["PRASYARAT", "PASANG", "PERIKSA", "PULIH"]) {
      const s = readFileSync(path.join(PAKET, "paket-satker", `${N}-${f}.sql`), "latin1");
      expect(/[^\x00-\x7f]/.test(s), f).toBe(false);
      expect(/aleta/i.test(s), f).toBe(false);
    }
    const uji = readFileSync(path.join(PAKET, "paket-satker", "uji-kueri.tsv"), "latin1").split("\n").filter((l) => /^\d{4}\t/.test(l));
    expect(uji.map((l) => l.slice(0, 4))).toEqual(["3450", "3451", "3452"]);
    for (const l of uji) expect(/\b(insert|update|delete|drop|alter|truncate|replace\s+into)\b/i.test(l.split("\t")[1].replace(/'[^']*'/g, "''"))).toBe(false);
  });
  it("nomor baru 3450-3452 tidak dipakai paket x1-x7", () => {
    const baru = readFileSync(path.join(PAKET, "paket-satker", "nomor-baru.txt"), "utf8").trim().split(",");
    expect(baru).toEqual(["3450", "3451", "3452"]);
    for (const p of ["x1-perbaikan-audit-21okt", "x2-perbaikan-audit-sedang-21okt", "x3-tuntutan-sinkron-21okt", "x4-tuntutan-perluasan-21okt", "x5-kodepos-amplop-21okt", "x6-penutup-saksi-21okt", "x7-penutup-saksi-21okt"]) {
      const f = path.resolve(PAKET, "..", p, "paket-satker", "nomor-baru.txt");
      if (!existsSync(f)) continue;
      const lain = readFileSync(f, "utf8").trim().split(",");
      for (const n of baru) expect(lain, `${p} ${n}`).not.toContain(n);
    }
  });
  it("#3450# memuat SETIAP pemicu tuntutan lain di peta panel (satu sumber: bendera = nilai pemicu itu sendiri)", () => {
    const def = readFileSync(path.join(PAKET, "sumber", "definisi_x8.py"), "utf8");
    const kata = def.slice(def.indexOf("KATA = {"), def.indexOf("}\nPEMICU"));
    for (const t of TUNTUTAN_LAIN) expect(kata, t.pemicu).toContain(`'${t.pemicu}':`);
  });
});
