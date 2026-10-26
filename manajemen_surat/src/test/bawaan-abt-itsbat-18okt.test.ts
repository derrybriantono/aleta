// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Keputusan 18 Okt 2026 (butir 25): nilai bawaan ABT untuk popup itsbat (5178, 5105, 1046, 1002, 0007) disimpan
 * OTOMATIS ke isian yang masih kosong, tanpa petugas membuka popup. Isian manual menang.
 */
const AKAR = path.resolve(process.cwd(), "..");
const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8").replace(/\r\n/g, "\n");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;

const a = sumber.indexOf("const BAWAAN_ABT_ITSBAT");
const b = sumber.indexOf("ELITIGASI-7139 (17 Okt)", a);
const blok = sumber.slice(a, b);
const akhirKomentar = blok.lastIndexOf("/**");
const kode = blok.slice(0, akhirKomentar);

function jalankan(opsi: { jenis?: string; bisaTulis?: boolean; isian?: Apa[]; bawaan?: Record<string, string>; terisi?: (k: string) => boolean; berganti?: boolean }) {
  const S: Apa = { pk: { jenisPerkara: opsi.jenis ?? "Itsbat Nikah" }, susunan: null };
  const d = { isian: opsi.isian ?? ["5178", "5105", "1046", "1002", "0007", "5197"].map((k) => ({ kode: k, jenis: "teks" })) };
  S.susunan = d;
  const tersimpan: Array<[string, string]> = [];
  const dibaca: string[] = [];
  const klienAbt = () => ({
    bacaIsian: async (k: string) => {
      dibaca.push(k);
      if (opsi.berganti) S.susunan = {};
      return { ok: true, nilai: (opsi.bawaan ?? {})[k] ?? "" };
    },
  });
  const f = new Function(
    "S",
    "bolehTulis",
    "terisi",
    "klienAbt",
    "perkaraId",
    "sidangUrutan",
    "jadwalkanSimpan",
    "renderIsian",
    "konteksJejak",
    `${kode}\nreturn simpanBawaanAbtItsbat;`
  )(
    S,
    () => opsi.bisaTulis !== false,
    (bb: Apa) => (opsi.terisi ? opsi.terisi(bb.kode) : false),
    klienAbt,
    () => "123",
    () => "1",
    async (k: string, n: string) => {
      tersimpan.push([k, n]);
    },
    () => {},
    new Map() // konteksJejak (rantai C1): peta jejak isian milik lapisan
  );
  return { jalan: () => f(d), tersimpan, dibaca };
}

describe("butir 25: bawaan ABT itsbat disimpan otomatis", () => {
  it("daftar kodenya persis lima isian yang diserahkan ke bawaan ABT", () => {
    expect(kode).toContain('["5178", "5105", "1046", "1002", "0007"]');
  });

  it("isian kosong: bawaan dibaca dari ABT lalu disimpan; 5197 (sumber ALETA) tidak disentuh", async () => {
    const t = jalankan({ bawaan: { "5178": "Banawa", "5105": "Desa Loli", "1046": "Ayah kandung", "1002": "Jejaka", "0007": "2 orang", "5197": "01/01/2010" } });
    await t.jalan();
    expect(t.tersimpan).toEqual([
      ["5178", "Banawa"],
      ["5105", "Desa Loli"],
      ["1046", "Ayah kandung"],
      ["1002", "Jejaka"],
      ["0007", "2 orang"],
    ]);
    expect(t.dibaca).not.toContain("5197");
  });

  it("isian manual menang: yang sudah terisi tidak dibaca dan tidak ditulis", async () => {
    const t = jalankan({ bawaan: { "5178": "Banawa", "5105": "Desa Loli" }, terisi: (k) => k === "5178" });
    await t.jalan();
    expect(t.tersimpan).toEqual([["5105", "Desa Loli"]]);
    expect(t.dibaca).not.toContain("5178");
  });

  it("bawaan sampah (penanda #...#, garis bawah, titik-titik, kosong) tidak disimpan", async () => {
    const t = jalankan({ bawaan: { "5178": "", "5105": "#10104# belum diolah", "1046": "_ binti _", "1002": "...", "0007": "1 orang" } });
    await t.jalan();
    expect(t.tersimpan).toEqual([["0007", "1 orang"]]);
  });

  it("bukan perkara itsbat atau tanpa hak tulis: tidak ada bacaan maupun tulisan", async () => {
    const lain = jalankan({ jenis: "Cerai Gugat", bawaan: { "5178": "Banawa" } });
    await lain.jalan();
    expect(lain.dibaca).toEqual([]);
    expect(lain.tersimpan).toEqual([]);
    const tanpaHak = jalankan({ bisaTulis: false, bawaan: { "5178": "Banawa" } });
    await tanpaHak.jalan();
    expect(tanpaHak.dibaca).toEqual([]);
    expect(tanpaHak.tersimpan).toEqual([]);
  });

  it("perkara berganti selagi menunggu: tidak ada yang ditulis", async () => {
    const t = jalankan({ bawaan: { "5178": "Banawa" }, berganti: true });
    await t.jalan();
    expect(t.tersimpan).toEqual([]);
  });

  it("kabel: dipanggil sesudah susunan dimuat, tanpa kata aleta pada nilai yang ditulis", () => {
    // 19 Okt: dipanggil lewat orkestrasi isi otomatis (saklar "Isi otomatis dari SIPP"), yang dipanggil sesudah susunan dimuat.
    expect(sumber).toContain("await simpanBawaanAbtItsbat(d);");
    expect(sumber).toContain("void lacakOto(isiOtomatisBlangko(d));");
    expect(blok).not.toMatch(/jadwalkanSimpan\([^)]*aleta/i);
  });
});
