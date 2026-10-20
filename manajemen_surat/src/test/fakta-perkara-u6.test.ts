// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - FAKTA PERKARA (agen U6): satu sumber fakta per perkara
 * ============================================================================
 *
 * Yang dijaga (perilaku):
 *   A  peta fakta -> kode: kode hanya di satu fakta, bentuk sah, tanpa kata "ALETA";
 *   B  penimbangan: isian petugas menang dan tetap "pasti"; dua sumber berbeda -> "ragu" + bertentangan; sepakat -> gabungan sumber;
 *   C  faktaPerkara: tanggal nikah dari SIPP dan posita, koreksi petugas di satu kode dibaca kode setara (anak.nama 5110/8603)
 *      dan TIDAK menimpa kode yang sudah diisi petugas; nilai yang memuat "Aleta" dibuang;
 *   D  pembungkus tidak menghapus pengisi lama: usulan dariSipp yang tak berpeta tetap terbaca lewat `kode`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const FP = require_(path.join(AKAR, "aleta_bot", "services", "faktaPerkara.js")) as {
  faktaPerkara: (m: unknown, o?: Record<string, unknown>) => Promise<any>;
  timbang: (tipe: string, daftar: any[]) => any;
  kanon: (tipe: string, v: string) => string;
  sama: (tipe: string, a: string, b: string) => boolean;
  tulisBentuk: (n: string, b: string) => string;
  muatPeta: (p?: unknown) => any;
  nilaiKode: (h: any, k: string) => string;
  PRIO: Record<string, number>;
};
const peta = JSON.parse(readFileSync(path.join(AKAR, "aleta_bot", "config", "peta-fakta-variabel.json"), "utf8"));

const perkara = (extra: Record<string, unknown> = {}) => ({ id: 777, nomor: "777/Pdt.G/2026/PA.Dgl", jenis: 347, alur: 3, posita: "", petitum: "", ...extra });
const dasar = { tanpaDariSipp: true, tanpaBas: true, runAbt: null, sippSaksi: null };

describe("A. peta fakta -> kode", () => {
  it("setiap kode hanya tercantum pada satu fakta dan berbentuk angka 4 digit", () => {
    const lihat = new Map<string, string>();
    for (const [kunci, d] of Object.entries<any>(peta.fakta)) {
      for (const k of d.kode || []) {
        const kode = typeof k === "string" ? k : k.kode;
        expect(kode, `${kunci}`).toMatch(/^\d{4,5}$/);
        expect(lihat.has(kode), `kode ${kode} ganda: ${kunci} dan ${lihat.get(kode)}`).toBe(false);
        lihat.set(kode, kunci);
      }
      expect(peta.tipe[d.tipe], `${kunci}: tipe ${d.tipe}`).toBeTruthy();
    }
    expect(lihat.size).toBeGreaterThan(60);
  });
  it("tanpa kata ALETA di peta", () => {
    expect(JSON.stringify(peta)).not.toMatch(/aleta/i);
  });
  it("kunci saksi lama tidak dipakai dua fakta", () => {
    const lihat = new Set<string>();
    for (const d of Object.values<any>(peta.fakta)) {
      if (!d.kunciSaksi) continue;
      expect(lihat.has(d.kunciSaksi)).toBe(false);
      lihat.add(d.kunciSaksi);
    }
  });
});

describe("B. penimbangan antar sumber", () => {
  const c = (nilai: string, prio: number, yakin = "cukup", sumber = "x") => ({ nilai, yakin, prio, sumber, kutipan: "", kode: "", urut: 0 });
  it("isian petugas menang dan tetap pasti walau SIPP berbeda; perbedaan dicatat", () => {
    const t = FP.timbang("tanggal", [c("2018-02-05", FP.PRIO.sipp, "pasti"), c("2018-02-06", FP.PRIO.petugas, "pasti")]);
    expect(t.nilai).toBe("2018-02-06");
    expect(t.yakin).toBe("pasti");
    expect(t.bertentangan).toHaveLength(1);
  });
  it("dua sumber otomatis yang berbeda menjadi ragu dengan keterangan pertentangan", () => {
    const t = FP.timbang("tanggal", [c("2018-02-05", FP.PRIO.sipp, "pasti"), c("2019-03-01", FP.PRIO.posita, "cukup")]);
    expect(t.yakin).toBe("ragu");
    expect(t.catatan).toMatch(/Periksa mana yang benar/);
  });
  it("dua sumber sepakat menggabungkan sumber dan mengambil keyakinan tertinggi", () => {
    const t = FP.timbang("angka", [c("26", FP.PRIO.posita, "ragu"), c(FP.kanon("angka", "26 tahun"), FP.PRIO.sipp, "cukup")]);
    expect(t.yakin).toBe("cukup");
    expect(t.sumber).toBe("data SIPP + posita/gugatan");
    expect(t.bertentangan).toHaveLength(0);
  });
  it("pembanding per tipe: tanggal berbeda format sama, nama bin/binti diabaikan, rupiah dibaca angkanya", () => {
    expect(FP.sama("tanggal", FP.kanon("tanggal", "5 Februari 2018"), FP.kanon("tanggal", "2018-02-05"))).toBe(true);
    expect(FP.sama("daftar", FP.kanon("daftar", "Aisilah Putri binti Ican"), FP.kanon("daftar", "Aisilah Putri"))).toBe(true);
    expect(FP.kanon("rupiah", "Rp4.000.000,00 (empat juta rupiah)")).toBe("4000000");
    expect(FP.sama("jumlahAnak", FP.kanon("jumlahAnak", "telah dikaruniai seorang anak"), "1")).toBe(true);
    expect(FP.tulisBentuk("2025-11-17", "slash")).toBe("17/11/2025");
    expect(FP.tulisBentuk("2025-11-17", "indo")).toBe("17 November 2025");
  });
});

describe("C. faktaPerkara dengan data tiruan", () => {
  const usulan = [
    { kode: "5110", nama: "Nama anak", nilai: "Aisilah Putri binti Ican Riansya", keyakinan: "ragu", sumber: [{ saksi: 0, asal: "sipp", kalimat: "SIPP anak" }] },
    { kode: "5197", nama: "Tanggal nikah", nilai: "5 Februari 2018", keyakinan: "pasti", sumber: [{ saksi: 0, asal: "sipp", kalimat: "perkara_data_pernikahan" }] },
    { kode: "9999", nama: "Kode tak berpeta", nilai: "isi bebas", keyakinan: "cukup", sumber: [] },
  ];
  it("satu fakta dibaca dari kode mana pun dan kode tak berpeta tetap terbaca (pengisi lama tidak hilang)", async () => {
    const f = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan });
    expect(f.ok).toBe(true);
    expect(f.fakta["nikah.tanggal"].nilai).toBe("2018-02-05");
    expect(FP.nilaiKode(f, "5197")).toBe("2018-02-05");
    expect(f.kode["9999"].nilai).toBe("isi bebas");
    expect(f.kode["8603"].nilai).toMatch(/Aisilah/);
  });
  it("koreksi petugas pada satu kode dibaca kode setara dan tidak menimpa kode yang sudah diisi petugas", async () => {
    const f = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan, isian: { "5110": "Aisilah Putri Ramadhani binti Ican Riansya" } });
    expect(f.fakta["anak.nama"].nilai).toMatch(/Ramadhani/);
    expect(f.fakta["anak.nama"].yakin).toBe("pasti");
    const s = f.usulanSetara.find((u: any) => u.kode === "8603");
    expect(s).toBeTruthy();
    expect(s.keyakinan).toBe("pasti");
    expect(s.jagaIsianLama).toBe(true);
    expect(s.sumber[0].asal).toBe("isian-petugas");
    expect(f.usulanSetara.some((u: any) => u.kode === "5110")).toBe(false);
    // petugas sudah mengisi 8603 sendiri: tidak diusulkan lagi
    const g = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan, isian: { "5110": "Aisilah Putri Ramadhani", "8603": "Aisilah P. R." } });
    expect(g.usulanSetara.some((u: any) => u.kode === "8603")).toBe(false);
  });
  it("kode setara dari fakta otomatis diturunkan: pasti tidak melompat menjadi lebih pasti", async () => {
    const f = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan });
    const s = f.usulanSetara.find((u: any) => u.kode === "8603");
    expect(s.keyakinan).toBe("ragu");
    expect(s.sumber[0].asal).toBe("fakta-setara");
  });
  it("nilai yang memuat nama aplikasi tidak pernah masuk", async () => {
    const f = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan: [{ kode: "5105", nama: "x", nilai: "Aleta tempat", keyakinan: "pasti", sumber: [] }], isian: { "5178": "KUA Aleta" } });
    expect(JSON.stringify(f.fakta)).not.toMatch(/aleta/i);
    expect(JSON.stringify(f.kode)).not.toMatch(/aleta/i);
  });
  it("perkara tak ditemukan dijawab ok:false tanpa galat", async () => {
    const f = await FP.faktaPerkara("999/Pdt.G/2026/PA.Dgl", { ...dasar, runQuery: async () => [] });
    expect(f.ok).toBe(false);
    expect(f.fakta).toEqual({});
  });
  it("petitum ikut dikembalikan dan peta bersama tidak tercemar fakta dinamis", async () => {
    const f = await FP.faktaPerkara(
      777,
      { ...dasar, perkara: perkara({ petitum: "<div>1. Mengabulkan Gugatan Penggugat;</div><div>2. Menjatuhkan talak satu ba'in shughra Tergugat terhadap Penggugat;</div><div>3. Membebankan biaya perkara;</div>", posita: "Bahwa Penggugat dan Tergugat menikah pada tanggal 5 Februari 2018 di KUA Kecamatan Labuan." }) }
    );
    expect(f.petitum.map((b: any) => b.jenis)).toEqual(["kabul", "cerai-talak", "biaya"]);
    expect(Object.keys(FP.muatPeta().fakta).some((k) => k.startsWith("saksi."))).toBe(false);
  }, 30000);
});
