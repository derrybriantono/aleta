// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { BAGIAN_FITUR_EKSTENSI, DAFTAR_FITUR_EKSTENSI, KODE_FITUR_EKSTENSI } from "@/lib/daftar-fitur-ekstensi";

/**
 * ============================================================================
 * DAFTAR FITUR PORTAL = DAFTAR FITUR EKSTENSI, BUTIR DEMI BUTIR
 * ============================================================================
 *
 * Halaman Tampilan ekstensi menyimpan saklar menurut kode, dan ekstensi
 * membacanya menurut kode. Bila salinan portal tertinggal, dua hal terjadi
 * tanpa satu pun galat: kode baru tidak dapat diterapkan dari portal, dan
 * kode yang dibuang ekstensi tetap disimpan dengan judul yang salah.
 *
 * Uji ini MENJALANKAN berkas ekstensi apa adanya (bukan membaca teksnya dengan
 * pola) lalu membandingkan seluruh ruasnya. Bila merah: jalankan ulang
 * D:/aleta-dev/kerja/tahap5/buat-daftar-fitur-ts.mjs.
 */

const BERKAS = path.resolve(__dirname, "../../../ekstensi-sipp/daftar-fitur.js");

function jalankanBerkasEkstensi() {
  const kotak: Record<string, unknown> = {};
  kotak.globalThis = kotak;
  vm.runInNewContext(readFileSync(BERKAS, "utf8"), kotak);
  return {
    daftar: kotak.ALETA_DAFTAR_FITUR as Array<Record<string, unknown>>,
    bagian: kotak.ALETA_BAGIAN_FITUR as Record<string, string>,
  };
}

describe("daftar fitur ekstensi", () => {
  const ekstensi = jalankanBerkasEkstensi();

  it("berkas ekstensi sungguh terbaca (penjaga ini tidak kosong)", () => {
    expect(Array.isArray(ekstensi.daftar)).toBe(true);
    expect(ekstensi.daftar.length).toBeGreaterThanOrEqual(120);
  });

  it("setiap butir sama: kode, bagian, nomor, jenis, judul, perluKeputusan - dalam urutan yang sama", () => {
    const dariEkstensi = ekstensi.daftar.map((x) => ({
      kode: x.kode,
      bagian: x.bagian,
      nomor: x.nomor,
      jenis: x.jenis,
      judul: x.judul,
      perluKeputusan: x.perluKeputusan === true,
    }));
    expect(DAFTAR_FITUR_EKSTENSI.map((x) => ({ ...x }))).toEqual(dariEkstensi);
  });

  it("nama bagian sama", () => {
    expect({ ...BAGIAN_FITUR_EKSTENSI }).toEqual({ ...ekstensi.bagian });
  });

  it("kode unik dan berbentuk <bagian>-<nomor>", () => {
    expect(KODE_FITUR_EKSTENSI.size).toBe(DAFTAR_FITUR_EKSTENSI.length);
    for (const f of DAFTAR_FITUR_EKSTENSI) {
      expect(f.kode).toBe(f.bagian + "-" + f.nomor);
      expect(Object.keys(BAGIAN_FITUR_EKSTENSI)).toContain(f.bagian);
    }
  });
});
