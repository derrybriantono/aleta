// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Kerangka bersama deteksi per jenis (aleta_bot/services/deteksi/): pemuat
 * modul dan pengurai wilayah. Bentuk tempat di bawah disalin dari posita
 * itsbat nyata PA Donggala (kata tertempel, "Propinsi", KUA tanpa
 * "Kecamatan"), nama desa/kecamatan apa adanya - bukan nama orang.
 */

type Komponen = { desa: string; kecamatan: string; kabupaten: string; provinsi: string };
type Wilayah = {
  komponenWilayah: (t: string) => Komponen;
  tulisWilayah: (k: Komponen) => string;
  selaras: (a: Komponen, b: Komponen) => boolean;
};
type Pemuat = {
  DAFTAR: readonly string[];
  modulUntuk: (j: unknown) => { kunci: string } | null;
  usulanModul: (j: unknown, posita: string) => Array<{ kode: string; nilai: string }>;
};

const require_ = createRequire(import.meta.url);
const wilayah = require_(path.resolve(process.cwd(), "../aleta_bot/services/deteksi/wilayah.js")) as Wilayah;
const pemuat = require_(path.resolve(process.cwd(), "../aleta_bot/services/deteksi/index.js")) as Pemuat;

const tulis = (s: string) => wilayah.tulisWilayah(wilayah.komponenWilayah(s));

describe("pengurai wilayah", () => {
  it("desa + KUA kecamatan + kabupaten + provinsi (228/Pdt.P/2026)", () => {
    expect(
      tulis("bertempat di Desa Lembantongoa , di wilayah hukum Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah")
    ).toBe("Desa Lembantongoa, Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah");
  });
  it("kata tertempel dan ejaan Propinsi", () => {
    expect(tulis("di wilayah hukum Kantor Urusan Agama KecamatanDamsolKabupatenDonggalaPropinsi Sulawesi Tengah")).toBe(
      "Kecamatan Damsol, Kabupaten Donggala, Provinsi Sulawesi Tengah"
    );
  });
  it("KUA tanpa kata Kecamatan, kota, huruf kecil penanda", () => {
    expect(tulis("di wilayah hukum Kantor Urusan Agama Palolo, Kabupaten Sigi")).toBe("Kecamatan Palolo, Kabupaten Sigi");
    expect(tulis("Kelurahan Duyu wilayah hukum Kantor Urusan Agama Kecamatan Tatanga, Kota Palu")).toBe(
      "Kelurahan Duyu, Kecamatan Tatanga, Kota Palu"
    );
    expect(tulis("di Wilayah Desa Labuan Lelea di rumah kecamatan Labuan kabupaten Donggala Propinsi Sulawesi Tengah")).toBe(
      "Desa Labuan Lelea, Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah"
    );
  });
  it("tidak menebak: 'Kecamatan setempat' bukan nama, 'Pedesaan' bukan desa", () => {
    expect(tulis("tidak tercatat pada Kantor Urusan Agama Kecamatan setempat")).toBe("");
    expect(tulis("Pedesaan Indah")).toBe("");
  });
  it("selaras: ruas yang ada di keduanya harus sama", () => {
    const a = wilayah.komponenWilayah("Desa Omu Kecamatan Gumbasa Kabupaten Sigi");
    expect(wilayah.selaras(a, wilayah.komponenWilayah("Kecamatan Gumbasa"))).toBe(true);
    expect(wilayah.selaras(a, wilayah.komponenWilayah("Kecamatan Palolo"))).toBe(false);
  });
});

describe("pemuat modul per jenis", () => {
  it("jenis tak dikenal = null dan tanpa usulan, tidak pernah melempar", () => {
    expect(pemuat.modulUntuk("tidak-ada")).toBeNull();
    expect(pemuat.usulanModul(99999, "posita")).toEqual([]);
    expect(Array.isArray(pemuat.DAFTAR)).toBe(true);
  });
});
