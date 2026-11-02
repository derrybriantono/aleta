// @vitest-environment node
/**
 * Butir 9 (2 Nov 2026): aturan pemisah daftar "Pilih blangko" (ekstensi-sipp/blangko-derry-golongan.js), murni.
 * Nama blangko = bentuk nama blangko Derry yang sungguh dipakai (lihat abt-paket/.../derry_briantono).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

type Golongan = { kunci: string; judul: string };
type Api = {
  golongan: (nama: string, jenis: string) => Golongan | null;
  kelompokkan: <T>(butir: T[], jenis: string, nama?: (b: T) => string) => Array<{ kunci: string; judul: string; butir: T[] }>;
  idGolongan: (awalan: string, kunci: string) => string;
};
const sumber = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/blangko-derry-golongan.js"), "utf8");
const konteks: Record<string, unknown> = {};
konteks.globalThis = konteks;
vm.runInNewContext(sumber, konteks);
const G = konteks.AletaBdGolongan as Api;
const kunci = (n: string, j: string) => G.golongan(n, j)?.kunci;

describe("golongan putusan menurut status", () => {
  it.each([
    ["[01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi)", "verstek"],
    ["[01d] [Kabul Verstek] Cerai (Format Lengkap) - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah)", "verstek"],
    ["[02] [Kabul] CG - F", "kabul"],
    ["[01d] [Kabul] IN - Format Lengkap Rukun dan Syarat per Unsur", "kabul"],
    ["[03] [Tolak] CG - F", "tolak"],
    ["[03a] [Tolak Verstek] Kurang 6 Bulan", "tolak"],
    ["[04] [NO] Gugatan Kabur (Obscuur Libel)", "no"],
    ["[04] Gugatan Tidak Dapat Diterima", "no"],
    ["[05] Gugur - Penggugat Tidak Hadir", "gugur"],
    ["[06] [Cabut] Sebelum Jawaban", "gugur"],
    ["[07] Putusan Sela - Eksepsi Kompetensi", "sela"],
    ["PMH Penunjukan Majelis Hakim", "penetapan"],
    ["Nomor Register Lain", "lain"],
  ])("%s -> %s", (nama, harap) => {
    expect(kunci(nama, "put")).toBe(harap);
  });

  it("'Nomor'/'NOVEMBER' tidak dianggap NO; tab sela memakai aturan putusan", () => {
    expect(kunci("[02] [Kabul] Nomor Perkara Lama", "put")).toBe("kabul");
    expect(kunci("[09] Akta NOVEMBER", "put")).toBe("lain");
    expect(kunci("[07] Sela - Eksepsi", "sela")).toBe("sela");
  });
});

describe("golongan BAS menurut agenda sidang", () => {
  it.each([
    ["BAS ALUR 06 [1] BAS 1 P & T Hadir - Mediasi", "mediasi"],
    ["BAS ALUR 04 [2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara", "gugatan"],
    ["BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Jawab Menjawab Lisan, Tunda Pembuktian P", "gugatan"],
    ["BAS ALUR 04 [3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada)", "jawab"],
    ["BAS ALUR 04 [4] BAS 4 P & T Hadir - Replik (dan Jawaban Rekonvensi bila ada)", "jawab"],
    ["BAS ALUR 04 [5] BAS 5 P & T Hadir - Duplik (dan Replik Rekonvensi bila ada)", "jawab"],
    ["BAS ALUR 04 [6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi)", "buktiP"],
    ["BAS ALUR 04 [7b] BAS 7 P & T Hadir - Pembuktian T (4 Saksi)", "buktiT"],
    ["BAS ALUR 04 [8] BAS 8 P & T Hadir - Kesimpulan", "kesimpulan"],
    ["BAS ALUR 64 Kelalaian Kewajiban - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek", "putusan"],
    ["BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)", "putusan"],
    ["BAS Sidang Ikrar Talak", "ikrar"],
    ["BAS ALUR 01 [1] Sidang Pertama - Tunda", "lain"],
  ])("%s -> %s", (nama, harap) => {
    expect(kunci(nama, "bas")).toBe(harap);
  });
});

describe("golongan relaas menurut keperluan", () => {
  it.each([
    ["Relaas Panggilan Sidang I - Tergugat", "panggilan"],
    ["Relaas Panggilan Ghaib II (Media)", "ghaib"],
    ["Relaas Pemberitahuan Isi Putusan Verstek", "pip"],
    ["Relaas PIP - Penggugat", "pip"],
    ["Relaas Panggilan Ikrar Talak - Termohon", "ikrar"],
    ["Relaas Pemberitahuan Pernyataan Banding", "banding"],
    ["Surat Tercatat", "lain"],
  ])("%s -> %s", (nama, harap) => {
    expect(kunci(nama, "rel")).toBe(harap);
  });
});

describe("kelompokkan", () => {
  const n = (x: string) => ({ berkas: x });
  it("urutan tampil tetap; urutan di dalam golongan = urutan asal; tidak ada yang hilang", () => {
    const daftar = [n("[03] [Tolak] CG"), n("[01] [Kabul Verstek] Cerai"), n("[02] [Kabul] CG"), n("Lain-lain"), n("[02b] [Kabul] CG Hak Asuh")];
    const g = G.kelompokkan(daftar, "put");
    expect(g.map((x) => x.judul)).toEqual(["Dikabulkan", "Dikabulkan verstek", "Ditolak", "Lainnya"]);
    expect(g[0].butir.map((x) => x.berkas)).toEqual(["[02] [Kabul] CG", "[02b] [Kabul] CG Hak Asuh"]);
    expect(g.flatMap((x) => x.butir).length).toBe(daftar.length);
  });

  it("satu golongan saja / jenis tanpa aturan: satu daftar tanpa judul (tidak diberi pemisah yang tidak berguna)", () => {
    expect(G.kelompokkan([n("[02] [Kabul] A"), n("[02a] [Kabul] B")], "put")).toEqual([{ kunci: "", judul: "", butir: [n("[02] [Kabul] A"), n("[02a] [Kabul] B")] }]);
    expect(G.kelompokkan([n("PTSP Formulir")], "ptsp")[0].judul).toBe("");
    expect(G.kelompokkan([], "put")).toEqual([]);
  });

  it("id subjudul aman untuk selektor", () => {
    expect(G.idGolongan("bd-g-c3", "buktiP")).toBe("bd-g-c3-buktiP");
    expect(G.idGolongan("a b", "x/y")).toMatch(/^[a-z0-9-]+$/i);
  });
});
