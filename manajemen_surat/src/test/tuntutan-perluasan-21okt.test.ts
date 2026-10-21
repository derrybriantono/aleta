// @vitest-environment node
/**
 * ============================================================================
 * 21 OKT 2026 - TUNTUTAN MENGIKUTI POSITA/PETITUM UNTUK SEMUA KELOMPOK BLANGKO DERRY (paket ABT x4)
 * ============================================================================
 *
 * Lanjutan tuntutan-sinkron-21okt (cerai biasa). Pengguna: "kalau tidak ada permintaan mut'ah maka tidak ada pertimbangan mut'ah
 * begitupun sama semua variabel/form yang tidak diminta di posita dan petitum"; "ABT lama dan ABT by Derry harus sinkron".
 *
 * Yang dijaga:
 *   A  peta tuntutan per BLANGKO (susun.ts): sebuah isian hanya bertuntutan bila bagian otomatis yang mencetak tuntutan itu secara
 *      bersyarat dipakai blangko - perkara anak (hak asuh / nafkah anak pokok perkara), asal usul anak, Rekonvensi CT dan BAS tanpa
 *      bagian akibat cerai TIDAK lagi menyembunyikan isiannya (sebelum x4: nama anak 8603 dan nafkah anak 9740 ikut "tuntutan").
 *   B  kelompok baru: hak bekas istri (3401-3408), kebendaan (sita/uang paksa/serta merta/bagian/utang/ekonomi syariah), tuntutan
 *      tambahan perkara anak (3430-3435), varian cerai (3410-3421) - isian disembunyikan bila tidak diminta, tampil bila diminta.
 *   C  paket ABT x4: pola petitum tidak menyala atas nama pihak / "posita" / alamat; isi ASCII, hanya SELECT, nomor bebas.
 * Fixture = blangko server 21 Okt sesudah tambalan RTF x4 + katalog abt_variabel lab dengan x4 terpasang (alat/buat_fixture.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";

import { susunIsian, TUNTUTAN_SEMUA, tuntutanAktif, tuntutanIsianDi, type ButirIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

type Fixture = { blangko: Array<{ berkas: string; penandaAbt: string[] }>; katalog: Record<string, { nama: string; jenis: string; sql: string; bawaan: string }> };
const FX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "tuntutan-perluasan-21okt.json"), "utf8")) as Fixture;
const KATALOG = new Map<string, Definisi>(Object.entries(FX.katalog).map(([kode, d]) => [kode, { kode, ...d }]));
/** Katalog server SEBELUM paket x4 (pemicu dan bagian baru belum ada). */
const BARU_X4 = ["3401", "3402", "3403", "3404", "3405", "3406", "3407", "3408", "3430", "3431", "3432", "3433", "3434", "3435", "3440", "3441", "3442", "3443", "3444", "3445", "3446", "3447", "3448", ...Array.from({ length: 12 }, (_, i) => String(3410 + i))];
const KATALOG_LAMA = new Map([...KATALOG].filter(([k]) => !BARU_X4.includes(k)));
const blangko = (awal: string) => {
  const b = FX.blangko.find((x) => x.berkas.startsWith(awal));
  if (!b) throw new Error(`fixture tanpa ${awal}`);
  return b;
};
const susun = (awal: string, katalog = KATALOG) => susunIsian(blangko(awal).penandaAbt, katalog);
const tag = (awal: string, katalog = KATALOG) => new Map(susun(awal, katalog).isian.map((b) => [b.kode, b.tuntutan || []]));
const pemicuTuntutan = (awal: string, katalog = KATALOG) => (susun(awal, katalog).tuntutan || []).map((t) => t.pemicu);

const CG01 = "1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf";
const CG_QD = "1 Perceraian CG/[01a]";
const CG_NI = "1 Perceraian CG/[01d]";
const CT_MI = "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah";
const CT_EX = "1a Perceraian CT/[01a]";
const CT_REK = "1a Perceraian CT/[02] [Kabul] [Rekonvensi]";
const D1_HA = "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[01]";
const D1_HAN = "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[02b]";
const HBI = "1f Hak Bekas Istri/[01b]";
const HB = "4a Harta Bersama/[01b]";
const HB_KR = "4a Harta Bersama/[01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan";
const HA = "6a Hak Asuh Anak (Hadhanah)/[02b]";
const NA = "6c Nafkah Anak/[01b]";
const AUA = "8 Asal Usul Anak/";
const IKRAR = "ALUR 10 Cerai Talak Sidang Ikrar Talak/";
const KEL = "1e Kelalaian Kewajiban Suami Istri/[01b]";
const NAI = "6h Nafkah Anak oleh Ibu/[01b]";

// ----------------------------------------------------------------------------
// A. Peta tuntutan per blangko
// ----------------------------------------------------------------------------
describe("A. tuntutan hanya dikenal blangko yang mencetaknya secara bersyarat", () => {
  it("tuntutanIsianDi: kode yang sama, konteks berbeda (hak bekas istri / cerai / anak); isian bersama yang tertulis langsung tidak pernah bertuntutan", () => {
    expect(tuntutanIsianDi("9712", new Set(["3401"]), false)).toEqual(["3401"]);
    expect(tuntutanIsianDi("9712", new Set(["4142"]), false)).toEqual(["4142"]);
    expect(tuntutanIsianDi("9741", new Set(["3431"]), true)).toEqual(["3431"]);
    expect(tuntutanIsianDi("9741", new Set(["4141"]), false)).toEqual(["4141"]);
    expect(tuntutanIsianDi("9740", new Set(["3431", "3432"]), true)).toEqual([]); // nafkah anak = pokok perkara nafkah anak
    expect(tuntutanIsianDi("8603", new Set(["4140", "4141"]), true)).toEqual([]); // nama anak tertulis langsung (isi tetap hak asuh)
    expect(tuntutanIsianDi("8603", new Set(["4140", "4141"]), false)).toEqual(["4140", "4141"]);
    expect(tuntutanIsianDi("8503", new Set(["4140"]), false)).toEqual([]);
    expect(tuntutanAktif(new Set(["4119"]), new Map([["4140", 1], ["4141", 1]]))).toEqual(new Set(["4140", "4141"]));
    expect(tuntutanAktif(new Set(["4119"]), new Map())).toEqual(new Set()); // pemicu belum terpasang = tidak ada yang disembunyikan
  });

  it("perkara anak dan asal usul anak: nafkah anak (pokok), hak asuh, nama anak TIDAK ditandai tuntutan akibat cerai (sebelum x4: 8603 disembunyikan di 8 blangko asal usul)", () => {
    for (const awal of [HA, NA, AUA]) {
      const t = tag(awal, KATALOG_LAMA);
      for (const [kode, p] of t) expect(p.filter((x) => /^414[0-5]$/.test(x)), `${awal} ${kode}`).toEqual([]);
    }
    expect(pemicuTuntutan(AUA)).toEqual([]);
    expect(tag(NA).get("9740")).toEqual([]);
    expect(tag(HA).get("9740") || []).toEqual([]);
  });

  it("Rekonvensi CT (isi tetap mut'ah, iddah, madliyah, hak asuh, nafkah anak) dan BAS ikrar tanpa bagian akibat cerai: tidak ada isian yang disembunyikan", () => {
    expect(pemicuTuntutan(CT_REK)).toEqual([]);
    for (const [, p] of tag(CT_REK)) expect(p).toEqual([]);
    for (const b of FX.blangko.filter((x) => x.berkas.startsWith(IKRAR))) {
      const s = susunIsian(b.penandaAbt, KATALOG);
      const pakaiBagianCerai = b.penandaAbt.includes("4150");
      if (!pakaiBagianCerai) for (const x of s.isian) expect(x.tuntutan || [], `${b.berkas} ${x.kode}`).toEqual([]);
    }
  });

  it("cerai biasa tidak berubah: keenam tuntutan akibat cerai dikenal CG [01] Format Lengkap", () => {
    expect(pemicuTuntutan(CG01)).toEqual(["4140", "4141", "4142", "4143", "4144", "4145"]);
    expect(tag(CG01).get("9712")).toEqual(["4142"]);
  });
});

// ----------------------------------------------------------------------------
// B. Kelompok baru
// ----------------------------------------------------------------------------
describe("B. kelompok blangko yang diperluas", () => {
  it("hak bekas istri: tiap hak = pemicu sendiri (3401-3408, pola sama dengan 3764); sebelum paket terpasang tidak ada yang disembunyikan", () => {
    const t = tag(HBI);
    expect(t.get("9712")).toEqual(["3401"]);
    expect(t.get("3751")).toEqual(["3402"]);
    expect(t.get("3752")).toEqual(["3403"]);
    expect(t.get("9713")).toEqual(["3404"]);
    expect(t.get("9711")).toEqual(["3405"]);
    expect(t.get("3753")).toEqual(["3406"]);
    expect(t.get("9740")).toEqual(["3407"]);
    expect(t.get("3754")).toEqual(["3408"]);
    expect(pemicuTuntutan(HBI)).toEqual(expect.arrayContaining(["3401", "3402", "3403", "3404", "3405", "3406", "3407", "3408"]));
    expect(pemicuTuntutan(HBI)).not.toEqual(expect.arrayContaining(["4142"]));
    for (const [, p] of tag(HBI, KATALOG_LAMA)) expect(p).toEqual([]);
  });

  it("varian cerai: bagian akibat cerai baru (3410-3421) membuat tuntutan yang belum tercetak dikenal; yang ditulis tetap pada varian ikut aturan w25", () => {
    expect(blangko(CT_MI).penandaAbt).toEqual(expect.arrayContaining(["4139", "3410", "3411"]));
    expect(blangko(CT_EX).penandaAbt).toEqual(expect.arrayContaining(["3412", "3413"]));
    expect(blangko(CG_NI).penandaAbt).toEqual(expect.arrayContaining(["9716", "9717", "3414", "3415"]));
    expect(blangko(D1_HA).penandaAbt).toEqual(expect.arrayContaining(["3416", "3417"]));
    expect(blangko(D1_HAN).penandaAbt).toEqual(expect.arrayContaining(["3418", "3421"]));
    expect(blangko(CG_QD).penandaAbt).toEqual(expect.arrayContaining(["4119", "4138"]));
    expect(tag(CT_MI).get("4100")).toEqual(["4140"]);
    expect(tag(CT_MI).get("4105")).toEqual(["4145"]);
    expect(tag(CT_EX).get("4104")).toEqual(["4144"]);
    expect(tag(CG_NI).get("4101")).toEqual(["4141"]);
    expect(tag(D1_HAN).get("4102")).toEqual(["4142"]);
    // 1d: nama anak tertulis langsung untuk hak asuh tetap -> tidak pernah disembunyikan
    expect(tag(D1_HA).get("8603") || []).toEqual([]);
  });

  it("kebendaan: sita, bagian, uang paksa, serta merta, utang bersama dikenal; blangko Konvensi Rekonvensi Sita Jaminan menetapkan sita sendiri", () => {
    const t = tag(HB);
    expect(t.get("4783")).toEqual(["4788"]);
    expect(t.get("4784")).toEqual(["4790"]);
    expect(t.get("4785")).toEqual(["4791"]);
    expect(t.get("4786")).toEqual(["3440"]);
    expect(tag(HB_KR).get("4783") || []).toEqual([]);
    expect(tag(HB_KR).get("4784")).toEqual(["4790"]);
  });

  it("perkara anak: tuntutan tambahan (kenaikan, pendidikan/kesehatan, pemotongan, nafkah lampau anak, sita) dikenal; nafkah anak pokok tidak", () => {
    const t = tag(NA);
    expect(t.get("9741")).toEqual(["3431"]);
    expect(t.get("9742")).toEqual(["3432"]);
    expect(t.get("9745")).toEqual(["3433"]);
    expect(t.get("9747")).toEqual(["3434"]);
    expect(t.get("9743")).toEqual(["3435"]);
    expect(t.get("9740")).toEqual([]);
  });

  it("kelalaian kewajiban (gelombang 3): nafkah, madliyah, kiswah, tempat kediaman, biaya, pemotongan, sita, uang paksa = pemicu sendiri; kewajiban lain selalu tampil", () => {
    const t = tag(KEL);
    expect(t.get("3700")).toEqual(["3441"]);
    expect(t.get("3702")).toEqual(["3442"]);
    expect(t.get("3703")).toEqual(["3443"]);
    expect(t.get("3704")).toEqual(["3444"]);
    expect(t.get("3705")).toEqual(["3445"]);
    expect(t.get("3708")).toEqual(["3446"]);
    expect(t.get("3709")).toEqual(["3447"]);
    expect(t.get("3710")).toEqual(["3448"]);
    expect(t.get("3706") || []).toEqual([]);
    expect(tag(NAI).get("3931")).toEqual(["3431"]);
  });

  it("setiap tuntutan di peta punya label; keputusan (bila ada) adalah salah satu isiannya", () => {
    for (const t of TUNTUTAN_SEMUA) {
      expect(t.label.length, t.pemicu).toBeGreaterThan(3);
      if (t.keputusan) expect(t.isian, t.pemicu).toContain(t.keputusan);
    }
  });
});

// ----------------------------------------------------------------------------
// B2. Ekstensi: golongan tampil (fungsi murni yang SAMA dengan layar)
// ----------------------------------------------------------------------------
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/lain/", runScripts: "outside-only" });
const w = dom.window as unknown as { eval: (s: string) => void; aletaBlangkoDerryIsian: any; chrome: unknown };
w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } }, runtime: { id: "uji" } };
w.eval(readFileSync(path.join(EKSTENSI, "blangko-derry.js"), "utf8"));
w.eval(readFileSync(path.join(EKSTENSI, "blangko-derry-isian.js"), "utf8"));
afterAll(() => dom.window.close());
const M = () => w.aletaBlangkoDerryIsian.murni;

function golongan(awal: string, menyala: string[] = []) {
  const s = susun(awal);
  const dikenal = new Set((s.tuntutan || []).map((t) => t.pemicu));
  const ctx = {
    dikenal: (p: string) => dikenal.has(p),
    terisiTuntutan: () => false,
    perkara: { prodeo: false, ghaib: false, lewatEcourt: true, kuasaP: false, kuasaT: false },
    menyala: (p: string) => menyala.includes(p),
    terisi: () => false,
    jabatan: () => false,
    keputusan: () => false,
    opsional: (x: ButirIsian) => Boolean(x.opsional),
    jenisCerai: "cg",
  };
  return new Map<string, string>(s.isian.map((x) => [x.kode, M().golonganIsianMurni(x, ctx) as string]));
}

describe("B2. layar: tidak diminta = tidak tampil, diminta = tampil", () => {
  it("hak bekas istri: petitum hanya mut'ah -> maskan, kiswah, mahar, nafkah iddah, sita tidak tampil; mut'ah tampil", () => {
    const g = golongan(HBI, ["3404"]);
    expect(g.get("9713")).not.toBe("tuntutan");
    for (const k of ["3751", "3752", "3753", "3754", "9712", "9711", "9740"]) expect(g.get(k), k).toBe("tuntutan");
  });
  it("harta bersama: tanpa sita/uang paksa/serta merta/utang -> isian keputusannya tidak tampil; sita diminta -> tampil", () => {
    const g = golongan(HB);
    for (const k of ["4783", "4784", "4785", "4786"]) expect(g.get(k), k).toBe("tuntutan");
    expect(golongan(HB, ["4788"]).get("4783")).not.toBe("tuntutan");
  });
  it("nafkah anak: kenaikan tidak diminta -> kotak kenaikan tidak tampil, nafkah pokok tetap tampil", () => {
    const g = golongan(NA);
    expect(g.get("9741")).toBe("tuntutan");
    expect(g.get("9740")).not.toBe("tuntutan");
    expect(golongan(NA, ["3431"]).get("9741")).not.toBe("tuntutan");
  });
  it("asal usul anak: tidak ada kartu yang masuk 'tuntutan tidak diminta'", () => {
    expect([...golongan(AUA).values()]).not.toContain("tuntutan");
  });
});

// ----------------------------------------------------------------------------
// C. Paket ABT x4
// ----------------------------------------------------------------------------
const PAKET = path.resolve(process.cwd(), "../abt-paket/x4-tuntutan-perluasan-21okt");
const N = "abt-x4-tuntutan-perluasan-21okt";
describe("C. paket ABT x4", () => {
  const ada = existsSync(path.join(PAKET, "paket-satker", `${N}-PASANG.sql`));
  it("berkas paket lengkap; ASCII; tanpa nama aplikasi; uji kueri hanya SELECT", () => {
    expect(ada).toBe(true);
    for (const f of ["PRASYARAT", "PASANG", "PERIKSA", "PULIH"]) {
      const s = readFileSync(path.join(PAKET, "paket-satker", `${N}-${f}.sql`), "latin1");
      expect(/[^\x00-\x7f]/.test(s), f).toBe(false);
      expect(/aleta/i.test(s), f).toBe(false);
    }
    const uji = readFileSync(path.join(PAKET, "paket-satker", "uji-kueri.tsv"), "latin1").split("\n").filter((l) => l && !l.startsWith("#"));
    expect(uji.length).toBeGreaterThan(100);
    for (const l of uji) {
      const q = l.split("\t")[1];
      expect(q.trim().toUpperCase().startsWith("SELECT"), l.slice(0, 20)).toBe(true);
      expect(/\b(insert|update|delete|drop|alter|truncate|replace\s+into)\b/i.test(q.replace(/'[^']*'/g, "''")), l.slice(0, 20)).toBe(false);
    }
  });
  it("nomor baru tidak bentrok dengan paket x1/x2/x3", () => {
    const baru = readFileSync(path.join(PAKET, "paket-satker", "nomor-baru.txt"), "utf8").trim().split(",");
    expect(baru).toEqual(expect.arrayContaining(["3401", "3408", "3410", "3421", "3430", "3435", "3440"]));
    for (const p of ["x1-perbaikan-audit-21okt", "x2-perbaikan-audit-sedang-21okt", "x3-tuntutan-sinkron-21okt"]) {
      const f = path.resolve(PAKET, "..", p, "paket-satker", "nomor-baru.txt");
      if (!existsSync(f)) continue;
      const lain = readFileSync(f, "utf8").trim().split(",");
      for (const n of baru) expect(lain, `${p} ${n}`).not.toContain(n);
    }
  });
  it("pola pemicu (kueri paket yang sama dengan server): nama pihak, 'posita', alamat KUA dan 'biaya pakaian' anak tidak menyala; tuntutan sungguhan menyala", () => {
    const uji = new Map(readFileSync(path.join(PAKET, "paket-satker", "uji-kueri.tsv"), "latin1").split("\n").filter((l) => /^\d{4}\t/.test(l)).map((l) => [l.slice(0, 4), l.slice(5)]));
    const pola = (no: string) => new RegExp((uji.get(no) || "").match(/REGEXP '([^']+)'/)![1]);
    const iddah = pola("3401"), maskan = pola("3402"), kiswah = pola("3403"), mutah = pola("3404"), mahar = pola("3406"), sita = pola("3408");
    const kenaikan = pola("3431"), serah = pola("3430"), utang = pola("3440");
    expect(iddah.test("terhadap penggugat (rosidah binti x); membebankan biaya")).toBe(false);
    expect(iddah.test("menghukum tergugat membayar nafkah iddah sejumlah rp3.000.000")).toBe(true);
    expect(iddah.test("maskan dan kiswah selama masa iddah")).toBe(false);
    expect(maskan.test("kantor urusan agama yang mewilayahi tempat tinggal pemohon")).toBe(false);
    expect(maskan.test("membayar maskan selama iddah")).toBe(true);
    expect(kiswah.test("belum termasuk biaya pakaian kebutuhan lain anak")).toBe(false);
    expect(kiswah.test("kiswah sebesar rp900.000")).toBe(true);
    expect(mutah.test("pemohon (ainul mutahir bin x)")).toBe(false);
    expect(mutah.test("membayar mut&#39;ah berupa uang")).toBe(true);
    expect(mahar.test("penggugat (dewi maharani binti x)")).toBe(false);
    expect(mahar.test("melunasi mahar yang masih terhutang")).toBe(true);
    expect(sita.test("penggugat (rosita binti x) dan masita")).toBe(false);
    expect(sita.test("sebagaimana tersebut dalam posita poin 5 adalah harta bersama")).toBe(false);
    expect(sita.test("menyatakan sah dan berharga sita marital")).toBe(true);
    expect(kenaikan.test("dengan kenaikan 10 % setiap tahun")).toBe(true);
    expect(serah.test("menghukum tergugat untuk menyerahkan kepada penggugat nafkah 3 orang anak")).toBe(false);
    expect(serah.test("menghukum tergugat untuk menyerahkan anak yang bernama x")).toBe(true);
    expect(utang.test("utang bersama berupa kredit bank")).toBe(true);
    expect(utang.test("penggugat (butang binti x)")).toBe(false);
  });
});
