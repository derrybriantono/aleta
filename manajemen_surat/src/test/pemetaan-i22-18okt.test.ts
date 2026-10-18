// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET PUTUSAN JAWABAN B (I22, 18 Okt): abt-putusan-jawaban-b-derry (PAW), abt-putusan-jawaban-b2-derry (itsbat kontensius, AUA, cerai gugat)
 * ============================================================================
 *
 * 5 berkas baru di folder yang ada (menu 117, 127, 115, 101 tidak berubah). Yang dijaga: (A) berkas di fixture dan dijangkau peta; (B) keadaan baru dari penanda/petitum;
 * (C) pemilihan blangko; (D) bawaan lama tidak berubah; (E) TS = panel-alat.js.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, masukanRekomendasiDariBaris, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

import { muatPanelAlat, pilihDariPanel } from "./panel-alat-vm";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/";
const BARU = [
  "9 Penetapan Ahli Waris/[01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, Anak, Ayah, Ibu - Pertimbangan Bagian Otomatis).rtf",
  "2a Itsbat Nikah Kontensius/[01c] [Kabul] IN Kontensius - Pasangan Meninggal, Pencairan Dana (Taspen, BPJS, Bank).rtf",
  "8 Asal Usul Anak/[01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat, Belum Punya Akta Kelahiran.rtf",
  "1 Perceraian CG/[02c] [Kabul] CG - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah) - Kontradiktoir.rtf",
  "1 Perceraian CG/[01d] [Kabul Verstek] Cerai (Format Lengkap) - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah).rtf",
];
const nama = (x: string) => x.replace(/\.rtf$/, "");
const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
  const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
  return r.length ? { berkas: nama(r[0].berkas), folder: r[0].folder.replace(A, ""), semua: r.map((x) => nama(x.berkas)) } : null;
};
const PAW = { jenisPerkara: "Penetapan Ahli Waris", nomorPerkara: "5/Pdt.P/2026/PA.Dgl" };
const INK = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" };
const AUA = { jenisPerkara: "Asal Usul Anak", nomorPerkara: "5/Pdt.P/2026/PA.Dgl" };
const CG = { jenisPerkara: "Cerai Gugat", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" };

describe("A. pohon", () => {
  it("5 berkas ada di fixture dan dijangkau peta bawaan (utama atau varian)", () => {
    expect(BARU.filter((b) => !FIX.berkas.includes(`${A}${b}`))).toEqual([]);
    const dijangkau = new Set<string>();
    for (const b of Object.values(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (!folder) continue;
      dijangkau.add(`${folder}/${nama(b.berkas)}.rtf`);
      if (/^varian: /.test(b.catatan ?? "")) for (const v of (b.catatan ?? "").slice(8).split("; ").filter(Boolean)) dijangkau.add(`${folder}/${nama(v)}.rtf`);
    }
    expect(BARU.filter((b) => !dijangkau.has(b))).toEqual([]);
  });
});

describe("B. keadaan baru", () => {
  it("PAW susunan dinamis dan AUA anak sah hanya dari saklar tegas", () => {
    expect(keadaanPutusan({ ...PAW, susunanAhliWaris: true })).toContain("susunan-ahli-waris");
    expect(keadaanPutusan({ ...PAW })).not.toContain("susunan-ahli-waris");
    expect(keadaanPutusan({ ...CG, susunanAhliWaris: true })).not.toContain("susunan-ahli-waris");
    expect(keadaanPutusan({ ...AUA, anakSahPerkawinanTercatat: true })).toContain("anak-sah-perkawinan-tercatat");
    expect(keadaanPutusan({ ...AUA })).not.toContain("anak-sah-perkawinan-tercatat");
  });

  it("pencairan dana hanya pada itsbat kontensius (Pdt.G); verstek tetap [01b] didahulukan", () => {
    const k = keadaanPutusan({ ...INK, dihadiriOleh: 1, pencairanDana: true });
    expect(k).toContain("pencairan-dana");
    expect(k.indexOf("pencairan-dana")).toBeLessThan(k.indexOf("kontensius"));
    expect(keadaanPutusan({ ...INK, dihadiriOleh: 1 })).not.toContain("pencairan-dana");
    expect(keadaanPutusan({ ...INK, nomorPerkara: "5/Pdt.P/2026/PA.Dgl", pencairanDana: true })).not.toContain("pencairan-dana");
    const v = keadaanPutusan({ ...INK, dihadiriOleh: 2, verstekPutusan: true, pencairanDana: true });
    expect(v.indexOf("kontensius-verstek")).toBeLessThan(v.indexOf("pencairan-dana"));
  });

  it("cerai gugat kumulasi nafkah istri: kontradiktoir atau verstek; cerai talak tidak", () => {
    expect(keadaanPutusan({ ...CG, dihadiriOleh: 1, kumulasiNafkahIstri: true })).toContain("kumulasi-nafkah-istri");
    expect(keadaanPutusan({ ...CG, dihadiriOleh: 2, verstekPutusan: true, kumulasiNafkahIstri: true })).toContain("kumulasi-nafkah-istri-verstek");
    expect(keadaanPutusan({ ...CG, dihadiriOleh: 2, verstekPutusan: true, kumulasiNafkahIstri: true })).not.toContain("kumulasi-nafkah-istri");
    expect(keadaanPutusan({ jenisPerkara: "Cerai Talak", dihadiriOleh: 1, kumulasiNafkahIstri: true })).not.toContain("kumulasi-nafkah-istri");
    expect(keadaanPutusan({ ...CG, dihadiriOleh: 1, kumulasiNafkahIstri: false })).not.toContain("kumulasi-nafkah-istri");
  });

  it("baris bot membawa penanda ke masukan rekomendasi", () => {
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Cerai Gugat", kumulasiNafkahIstri: true, pencairanDana: false })).toMatchObject({ kumulasiNafkahIstri: true, pencairanDana: false });
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Cerai Gugat", kumulasiNafkahIstri: null })).not.toHaveProperty("kumulasiNafkahIstri");
  });
});

describe("C. pemilihan blangko", () => {
  it("PAW susunan dinamis [01b]; tanpa saklar tetap [01] anak kandung", () => {
    expect(put({ ...PAW, statusPutusan: "Dikabulkan", susunanAhliWaris: true })).toMatchObject({ berkas: "[01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, Anak, Ayah, Ibu - Pertimbangan Bagian Otomatis)", folder: "9 Penetapan Ahli Waris" });
    const biasa = put({ ...PAW, statusPutusan: "Dikabulkan" })!;
    expect(biasa.berkas).toMatch(/^\[01\] \[Kabul\] PAW - Ahli Waris Anak Kandung/);
    expect(biasa.semua.some((x) => x.startsWith("[01b] [Kabul] PAW - Susunan"))).toBe(true); // varian
  });

  it("itsbat kontensius pencairan dana [01c]; tanpa pencairan tetap [01]; verstek tetap [01b]", () => {
    expect(put({ ...INK, statusPutusan: "Dikabulkan", pencairanDana: true })).toMatchObject({ berkas: "[01c] [Kabul] IN Kontensius - Pasangan Meninggal, Pencairan Dana (Taspen, BPJS, Bank)", folder: "2a Itsbat Nikah Kontensius" });
    expect(put({ ...INK, statusPutusan: "Dikabulkan" })!.berkas).toMatch(/^\[01\] \[Kabul\] IN Kontensius - Pasangan Meninggal, Ahli Waris Mengakui/);
    expect(put({ ...INK, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2, pencairanDana: true })!.berkas).toMatch(/^\[01b\] \[Kabul Verstek\] IN Kontensius/);
  });

  it("AUA anak sah perkawinan tercatat [01]", () => {
    expect(put({ ...AUA, statusPutusan: "Dikabulkan", anakSahPerkawinanTercatat: true })).toMatchObject({
      berkas: "[01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat, Belum Punya Akta Kelahiran",
      folder: "8 Asal Usul Anak",
    });
  });

  it("cerai gugat kumulasi nafkah istri: kontradiktoir [02c], verstek [01d]; bawaan [02] dan [01aa] tidak berubah", () => {
    expect(put({ ...CG, statusPutusan: "Dikabulkan", kumulasiNafkahIstri: true })).toMatchObject({ berkas: "[02c] [Kabul] CG - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah) - Kontradiktoir", folder: "1 Perceraian CG" });
    expect(put({ ...CG, statusPutusan: "Dikabulkan", kumulasiNafkahIstri: true, verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toBe("[01d] [Kabul Verstek] Cerai (Format Lengkap) - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah)");
    expect(put({ ...CG, statusPutusan: "Dikabulkan" })!.berkas).toBe("[02] [Kabul] CG - F");
    expect(put({ ...CG, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })!.folder).toBe("1 Perceraian CG");
  });
});

describe("E. TS = panel-alat.js", () => {
  it("pilihPutusanBawaan sama dengan alatPetaUntukPerkara", () => {
    const panel = muatPanelAlat();
    const kasus: Array<[string, string, boolean, string[]]> = [
      ["Penetapan Ahli Waris", "Dikabulkan", false, ["susunan-ahli-waris"]],
      ["Penetapan Ahli Waris", "Dikabulkan", false, []],
      ["Pengesahan Perkawinan/Istbat Nikah", "Dikabulkan", false, ["pencairan-dana", "kontensius"]],
      ["Pengesahan Perkawinan/Istbat Nikah", "Dikabulkan", true, ["kontensius-verstek", "pencairan-dana", "kontensius"]],
      ["Asal Usul Anak", "Dikabulkan", false, ["anak-sah-perkawinan-tercatat"]],
      ["Cerai Gugat", "Dikabulkan", false, ["kumulasi-nafkah-istri", "kontradiktoir"]],
      ["Cerai Gugat", "Dikabulkan", true, ["kumulasi-nafkah-istri-verstek"]],
    ];
    for (const [j, s, v, kd] of kasus) {
      const ts = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, null, kd);
      expect(ts ? { kunci: ts.kunci, tingkat: ts.tingkat } : null, `${j} ${s} ${kd}`).toEqual(pilihDariPanel(panel, j, s, v, null, kd));
    }
  });
});
