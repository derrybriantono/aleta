// @vitest-environment node
/**
 * PENAHAN CETAK ALETA ABT (keputusan pemilik 6 Nov 2026).
 * Dijaga: ketikan wajib menahan, rumus tanpa data hanya diberitahukan, rumus yang sengaja kosong tidak disebut, isian di dalam rumus ikut dinilai,
 * dan golongan isian sama dengan panel Blangko ABT by Derry (fungsi murni ekstensi yang asli).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";

import { susunIsian, type ButirIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { golonganIsian, kerangkaBawaan, nilaiTahan, type KosongMesin, type NilaiIsian } from "@/lib/aleta-abt-tahan";
import { gabungKatalog, penandaBlangko } from "@/server/modules/aleta-abt-cetak/tahan";

const def = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  def("1006", "Nomor akta nikah", "data_teks"),
  def("8436", "Kesimpulan oleh Penggugat", "data_teks"),
  def("0184", "Tgl. Surat Kuasa #0046# (Isi Apabila #0046# Pakai Kuasa) #11111#", "data_tanggal"),
  def("0056", "Nama Mediator", "data_sipp"),
  def("8510", "Duduk perkara PNS", "data_sql", "SELECT ''"),
  def("4001", "Amar", "data_sql", "SELECT data FROM abt_data_teks WHERE no_var = '8503' AND perkara_id = #perkara_id#"),
  def("8503", "Alasan perceraian", "data_teks"),
  def("4119", "Pertimbangan akibat", "data_sql", "#4102# #4100#"),
  def("4102", "Keputusan atas nafkah iddah", "data_teks", "", "dikabulkan seluruhnya"),
  def("4100", "Keputusan atas tuntutan hak asuh anak (hadhanah)", "data_teks"),
  def("7139", "SEPAKAT BERACARA SECARA ELEKTRONIK", "data_teks"),
  def("9134", "Petunjuk perbaikan", "data_teks"),
  def("11111", "Pemicu kuasa", "data_sql", "SELECT 1"),
  def("4140", "Pemicu hak asuh", "data_sql", "SELECT 1"),
]);
const PENANDA = ["1006", "8436", "0184", "0056", "8510", "4001", "4119", "7139", "9134"];
const SUSUNAN = susunIsian(PENANDA, KATALOG);
const nilai = (isi: Record<string, string>): Record<string, NilaiIsian> => Object.fromEntries(Object.entries(isi).map(([k, teks]) => [k, { status: teks ? "terisi" : "kosong", teks }]));
const kosong = (...kode: string[]): KosongMesin[] => kode.map((noVar) => ({ noVar, nama: KATALOG.get(noVar)?.nama ?? "", sebab: "", status: "kosong" }));
const tahan = (isi: Record<string, string>, ...k: string[]) => nilaiTahan({ susunan: SUSUNAN, nilai: nilai(isi), kosong: kosong(...k), jenisCerai: "cg", jenisKatalog: (x) => KATALOG.get(x)?.jenis ?? "" });
const kode = (d: Array<{ kode: string }>) => d.map((x) => x.kode).sort();

describe("golongan isian kosong", () => {
  it("ketikan wajib yang tertulis menahan; rumus tanpa data hanya perlu dilihat", () => {
    const h = tahan({ "8503": "F" }, "1006", "0056");
    expect(kode(h.menahan)).toEqual(["1006"]);
    expect(kode(h.perluDilihat)).toEqual(["0056"]);
  });
  it("rumus yang sengaja kosong tidak ada di daftar kosong mesin, jadi tidak disebut sama sekali", () => {
    const h = tahan({ "8503": "F", "8510": "" });
    expect(h.menahan.concat(h.perluDilihat, h.catatan).map((x) => x.kode)).not.toContain("8510");
  });
  it("isian pilihan, tambahan, dan kuasa pada perkara tanpa kuasa tidak menahan", () => {
    const h = tahan({ "8503": "F" }, "9134", "8436", "0184");
    expect(h.menahan).toEqual([]);
    expect(kode(h.catatan)).toEqual(["0184", "8436", "9134"]);
  });
  it("kuasa pada perkara berkuasa menahan", () => {
    const h = tahan({ "8503": "F", "11111": "1" }, "0184");
    expect(kode(h.menahan)).toEqual(["0184"]);
  });
  it("keadaan e-Court yang tidak diketahui tidak ditebak: perlu dilihat", () => {
    const h = tahan({ "8503": "F" }, "7139");
    expect(kode(h.perluDilihat)).toEqual(["7139"]);
    expect(h.menahan).toEqual([]);
  });
  it("alasan perceraian yang hanya dibaca rumus menahan walau mesin tidak menyebutnya", () => {
    expect(kode(tahan({}).menahan)).toEqual(["8503"]);
    expect(tahan({ "8503": "F" }).menahan).toEqual([]);
  });
  it("keputusan tuntutan di dalam rumus: menahan bila tuntutan diminta, bebas bila tidak diminta atau sudah dipilih", () => {
    const pemicu = "4140";
    expect(kode(tahan({ "8503": "F", [pemicu]: "1" }).menahan)).toContain("4100");
    expect(kode(tahan({ "8503": "F" }).menahan)).not.toContain("4100");
    expect(kode(tahan({ "8503": "F", [pemicu]: "1", "4100": "dikabulkan seluruhnya" }).menahan)).not.toContain("4100");
    expect(kode(tahan({ "8503": "F", [pemicu]: "1", "4100": "dikabulkan seluruhnya ditolak" }).menahan)).toContain("4100");
  });
  it("isian yang gagal dihitung selalu menahan, dan ketikan yang tidak terbaca sebagai penanda blangko juga", () => {
    const h = nilaiTahan({ susunan: SUSUNAN, nilai: nilai({ "8503": "F" }), kosong: [{ noVar: "0056", nama: "Nama Mediator", sebab: "x", status: "galat" }, { noVar: "1006", nama: "", sebab: "", status: "kosong" }], jenisCerai: "cg" });
    expect(kode(h.menahan)).toEqual(["0056", "1006"]);
    const lain = nilaiTahan({ susunan: { isian: [], tuntutan: [] }, nilai: {}, kosong: kosong("8436"), jenisCerai: "cg", jenisKatalog: () => "data_teks" });
    expect(kode(lain.menahan)).toEqual(["8436"]);
  });
  it("tiap kode hanya sekali, pada golongan pertama yang mengenainya", () => {
    const h = tahan({}, "8503", "8503");
    expect(h.menahan.filter((x) => x.kode === "8503")).toHaveLength(1);
  });
  it("kerangka bawaan bukan isian", () => {
    const b = { kode: "4100", pilihan: [] as string[], bawaan: "", saran: "" };
    expect(kerangkaBawaan(b, "")).toBe(true);
    expect(kerangkaBawaan(b, "dikabulkan seluruhnya ditolak")).toBe(true);
    expect(kerangkaBawaan(b, "Sebidang tanah seluas _ m2")).toBe(true);
    expect(kerangkaBawaan(b, "ditolak: istri nusyuz")).toBe(false);
  });
});

describe("bahan penahan", () => {
  it("penanda angka dan kode bermakna; kode tanpa peta dilewati", () => {
    expect(penandaBlangko("{#0046# #AA00047# #0046# #tanpapeta# #12#}", { AA00047: "0047" })).toEqual(["0046", "0047"]);
  });
  it("pustaka ALETA menimpa katalog ABT", () => {
    const p = gabungKatalog(new Map([def("0001", "Lama", "data_sql", "SELECT 1")]), { sidik: "s", alias: {}, pustaka: { "0001": { nama: "Baru", data_type: "data_teks", sql_query: null, default_data: null }, "0002": { nama: "Tambah", data_type: "data_teks" } } });
    expect(p.get("0001")).toMatchObject({ nama: "Baru", jenis: "data_teks", sql: "SELECT 1" });
    expect(p.get("0002")?.nama).toBe("Tambah");
  });
});

// Kesetaraan dengan panel: fungsi murni ekstensi yang asli, seperti uji panel lainnya.
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8");
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/lain/", runScripts: "outside-only" });
const w = dom.window as unknown as { eval: (s: string) => void; aletaBlangkoDerryIsian: { murni: { golonganIsianMurni: (b: ButirIsian, c: unknown) => string } }; chrome: unknown };
w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } }, runtime: { id: "uji" } };
w.eval(baca("blangko-derry.js"));
w.eval(baca("blangko-derry-isian.js"));
afterAll(() => dom.window.close());

describe("sama dengan panel Blangko ABT by Derry", () => {
  const KEADAAN: Array<Record<string, string>> = [{}, { "8503": "F" }, { "11111": "1" }, { "4140": "1" }, { "4140": "1", "4100": "dikabulkan seluruhnya" }, { "1006": "12", "0184": "2026-01-01" }, { "9134": "ada" }];
  it("golongan semua isian sama pada tiap keadaan, kecuali keadaan yang butuh data daftar perkara", () => {
    for (const isi of KEADAAN) {
      const n = nilai(isi);
      const pemicuTuntutan = (SUSUNAN.tuntutan ?? []).map((t) => t.pemicu);
      for (const p of pemicuTuntutan) if (!n[p]) n[p] = { status: "kosong", teks: "" };
      const terisi = (b: ButirIsian) => Boolean(n[b.kode]?.status === "terisi" && String(n[b.kode]?.teks ?? "").trim());
      const ctx = {
        perkara: { prodeo: false, ghaib: false, lewatEcourt: true },
        nilai: n,
        menyala: (k: string) => Boolean(String(n[k]?.teks ?? "").trim()),
        terisi,
        terisiTuntutan: terisi,
        jabatan: () => false,
        keputusan: (p: string) => {
          const t = (SUSUNAN.tuntutan ?? []).find((x) => x.pemicu === p);
          return Boolean(t && n[t.keputusan]?.teks === "dikabulkan seluruhnya");
        },
        dikenal: (p: string) => (SUSUNAN.tuntutan ?? []).some((t) => t.pemicu === p) && n[p] !== undefined,
        jenisCerai: "cg",
        opsional: (b: ButirIsian) => b.opsional === true || b.kode === "9134",
      };
      for (const b of SUSUNAN.isian) {
        if (b.keadaan === "ecourt" || b.keadaan === "ghaib") continue;
        const panel = w.aletaBlangkoDerryIsian.murni.golonganIsianMurni(b, ctx);
        const aleta = golonganIsian(b, { nilai: n, susunan: SUSUNAN, jenisCerai: "cg" });
        expect(aleta, `${b.kode} ${JSON.stringify(isi)}`).toBe(panel);
      }
    }
  });
  it("keadaan ghaib dan e-Court yang belum terisi: tidak diketahui di sini, bukan berlaku atau tidak", () => {
    const b = SUSUNAN.isian.find((x) => x.kode === "7139")!;
    expect(b.keadaan).toBe("ecourt");
    expect(golonganIsian(b, { nilai: {}, susunan: SUSUNAN, jenisCerai: "cg" })).toBe("taktahu");
    expect(golonganIsian(b, { nilai: nilai({ "7139": "1" }), susunan: SUSUNAN, jenisCerai: "cg" })).toBe("utama");
  });
});
