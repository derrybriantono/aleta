// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET BAS PERBAIKAN (I20, 18 Okt): abt-bas-perbaikan-derry (20), abt-bas-cabut-jawaban-derry (22), penguasaan anak 6b revisi, cacat lama
 * ============================================================================
 *
 * Paket (BELUM terpasang; berkas baru di folder yang sudah ada, tanpa menu/folder baru). Yang dijaga:
 *   (A) data: 43 langkah baru (20 + 22 + V2S) = berkas di fixture, dua arah; alur cerai "alur-08g"/"alur-08t";
 *   (B) verstek V1/V2 kewarisan, poligami, itsbat kontensius; [T]/[N] permohonan di folder jenisnya;
 *   (C) cabut sesudah jawaban CS / CM untuk 11 jenis;
 *   (D) 6b revisi: [02] [02b] kabul sebagian, [01d] dialihkan (keadaan dikabulkan-sebagian / dialihkan), TS = panel-alat.js;
 *   (E) nama berkas kewarisan [01] Kontradiktoir.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ALUR_BAS_BARU, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { kabulSebagianDariAmar, keadaanPutusan } from "@/lib/keadaan-putusan";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

import { muatPanelAlat, pilihDariPanel } from "./panel-alat-vm";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/";
const KUM = (...kode: string[]) => ({ daftar: kode.map((k) => ({ kode: k, sumber: "sipp" })) });
const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]> & { jenisPerkara: string }) => {
  const h = tentukanBasBaru({ urutanSidang: 1, dihadiriOleh: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", ...m });
  return { h, id: h?.alur.id ?? null, kode: h?.langkah.kode ?? null };
};

const BARU: Record<string, string[]> = {
  "alur-33": ["V1", "V2", "CS", "CM"],
  "alur-34": ["V1", "V2"],
  "alur-35": ["V1", "V2", "CS", "CM"],
  "alur-17": ["T", "N"],
  "alur-12l": ["T", "N"],
  "alur-16": ["T", "N"],
  "alur-19": ["T", "N"],
  "alur-13l": ["T", "N"],
  "alur-14": ["T", "N"],
  "alur-18": ["T", "N"],
  "alur-31": ["CS", "CM"],
  "alur-36": ["CS", "CM"],
  "alur-37": ["CS", "CM"],
  "alur-38": ["CS", "CM"],
  "alur-39": ["CS", "CM"],
  "alur-40": ["CS", "CM"],
  "alur-44": ["V2S", "CS", "CM"],
  "alur-08g": ["CS", "CM"],
  "alur-08t": ["CS", "CM"],
};

describe("A. data: 43 langkah baru = berkas di fixture", () => {
  it("tiap langkah baru ADA di fixture; alur cerai biasa punya CS/CM di folder CG / CT - BAS", () => {
    let jumlah = 0;
    for (const [id, kode] of Object.entries(BARU)) {
      const alur = ALUR_BAS_BARU.find((a) => a.id === id)!;
      expect(alur, id).toBeTruthy();
      for (const k of kode) {
        const l = alur.langkah.find((x) => x.kode === k);
        expect(l, `${id} ${k}`).toBeTruthy();
        expect(FIX.berkas, `${id} ${k}`).toContain(`${alur.folder}/${l!.berkas}`);
        jumlah++;
      }
    }
    expect(jumlah).toBe(20 + 22 + 1);
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-08g")).toMatchObject({ nomor: 8, folder: `${A}1 Perceraian CG - BAS`, menu: { id: 102, nama: "Cerai Gugat - BAS" }, jenisMin: 347, jenisMaks: 347 });
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-08t")).toMatchObject({ nomor: 8, folder: `${A}1a Perceraian CT - BAS`, menu: { id: 104, nama: "Cerai Talak - BAS" }, jenisMin: 346, jenisMaks: 346 });
  });
});

describe("B. verstek V1/V2 dan [T]/[N] permohonan", () => {
  it("kewarisan, poligami, itsbat kontensius: P hadir T tidak -> V1 (sidang 1), V2 (sidang 2); T pernah hadir bukan verstek", () => {
    for (const [jenis, id] of [["Kewarisan", "alur-33"], ["Izin Poligami", "alur-34"], ["Pengesahan Perkawinan/Istbat Nikah", "alur-35"]] as const) {
      expect(t({ jenisPerkara: jenis, dihadiriOleh: 2 }), jenis).toMatchObject({ id, kode: "V1" });
      expect(t({ jenisPerkara: jenis, dihadiriOleh: 2, urutanSidang: 2 }), jenis).toMatchObject({ id, kode: "V2" });
      expect(t({ jenisPerkara: jenis, dihadiriOleh: 2, urutanSidang: 2, tergugatPernahHadir: true }).kode, jenis).not.toBe("V2");
    }
  });

  it("[T] Pemohon tidak hadir sidang 1 dan [N] pernah hadir lalu tidak hadir lagi: di folder jenisnya, bukan 9b", () => {
    const kasus: Array<[string, string, string]> = [
      ["Pengesahan Perkawinan/Istbat Nikah", "alur-17", "2 Itsbat Nikah - BAS"],
      ["Dispensasi Kawin", "alur-12l", "3 Dispensasi Kawin - BAS"],
      ["Perwalian", "alur-16", "6 Perwalian - BAS"],
      ["Wali Adhal", "alur-19", "7 Wali Adhal - BAS"],
      ["Asal Usul Anak", "alur-13l", "8 Asal Usul Anak - BAS"],
      ["P3HP/Penetapan Ahli Waris", "alur-14", "9 Penetapan Ahli Waris - BAS"],
      ["Lain-Lain", "alur-18", "9a Lain-Lain (Pengangkatan Anak) - BAS"],
    ];
    for (const [jenis, id, folder] of kasus) {
      const p = { jenisPerkara: jenis, nomorPerkara: "1/Pdt.P/2026/PA.Dgl" };
      expect(t({ ...p, dihadiriOleh: 4 }), jenis).toMatchObject({ id, kode: "T" });
      expect(t({ ...p, dihadiriOleh: 4 }).h!.alur.folder).toBe(`${A}${folder}`);
      if (jenis !== "Pengesahan Perkawinan/Istbat Nikah") {
        expect(t({ ...p, dihadiriOleh: 4, urutanSidang: 3, penggugatPernahHadir: true }), jenis).toMatchObject({ id, kode: "N" });
        expect(t({ ...p, dihadiriOleh: 4, urutanSidang: 3, penggugatPernahHadir: false }), jenis).toMatchObject({ id, kode: "G" });
      }
      if (jenis !== "P3HP/Penetapan Ahli Waris") expect(t({ ...p, akhir: "no" }), jenis).toMatchObject({ id, kode: "N" });
    }
    // PAW: "NO" lama (permohonan kabur) tetap untuk akhir no
    expect(t({ jenisPerkara: "P3HP/Penetapan Ahli Waris", nomorPerkara: "1/Pdt.P/2026/PA.Dgl", akhir: "no" })).toMatchObject({ id: "alur-14", kode: "NO" });
  });
});

describe("C. cabut sesudah jawaban CS / CM", () => {
  const cabut = { akhir: "cabut" as const, sudahJawaban: true };
  const jenisId: Array<[string, string, string, Record<string, unknown>]> = [
    ["Harta Bersama", "alur-31", "3/Pdt.G/2026/PA.Dgl", {}],
    ["Kewarisan", "alur-33", "3/Pdt.G/2026/PA.Dgl", {}],
    ["Pengesahan Perkawinan/Istbat Nikah", "alur-35", "3/Pdt.G/2026/PA.Dgl", {}],
    ["Lain-Lain", "alur-38", "3/Pdt.G/2026/PA.Dgl", {}],
    ["Penguasaan Anak", "alur-44", "3/Pdt.G/2026/PA.Dgl", {}],
    ["Pembatalan Perkawinan", "alur-39", "3/Pdt.G/2026/PA.Dgl", {}],
    ["Ekonomi Syariah", "alur-40", "3/Pdt.G.S/2026/PA.Dgl", {}],
    ["Cerai Gugat", "alur-08g", "3/Pdt.G/2026/PA.Dgl", {}],
    ["Cerai Talak", "alur-08t", "3/Pdt.G/2026/PA.Dgl", {}],
    ["Cerai Gugat", "alur-36", "3/Pdt.G/2026/PA.Dgl", { kumulasi: KUM("itsbat-nikah") }],
    ["Cerai Talak", "alur-36", "3/Pdt.G/2026/PA.Dgl", { kumulasi: KUM("itsbat-nikah") }],
    ["Cerai Gugat", "alur-37", "3/Pdt.G/2026/PA.Dgl", { kumulasi: KUM("hak-asuh-anak") }],
  ];
  for (const [jenis, id, nomor, tambahan] of jenisId) {
    it(`${jenis} -> ${id}: CS (cabut + sudah jawaban, setuju) dan CM (T menolak, perkara berlanjut)`, () => {
      const dasar = { jenisPerkara: jenis, nomorPerkara: nomor, urutanSidang: 3, ...tambahan };
      expect(t({ ...dasar, ...cabut }), jenis).toMatchObject({ id, kode: "CS" });
      expect(t({ ...dasar, ...cabut, sikapTergugatCabut: "setuju" }).kode).toBe("CS");
      const cm = t({ ...dasar, sudahJawaban: true, sikapTergugatCabut: "menolak" });
      expect(cm, jenis).toMatchObject({ id, kode: "CM" });
      const alur = ALUR_BAS_BARU.find((a) => a.id === id)!;
      expect(FIX.berkas).toContain(`${alur.folder}/${cm.h!.langkah.berkas}`);
    });
  }

  it("tanpa penanda tegas tidak berubah: cabut sebelum jawaban dan sidang biasa tetap jalur lama", () => {
    expect(t({ jenisPerkara: "Harta Bersama", akhir: "cabut" })).toMatchObject({ id: "alur-31", kode: "CB" }); // sebelum jawaban = CB mediasi berhasil
    expect(t({ jenisPerkara: "Harta Bersama", sudahJawaban: true, urutanSidang: 3 }).kode).not.toMatch(/^C[SM]$/);
    expect(t({ jenisPerkara: "Cerai Gugat", akhir: "cabut" }).h).toBeNull();
    expect(t({ jenisPerkara: "Cerai Gugat", sudahJawaban: true, sikapTergugatCabut: "menolak", akhir: "cabut" }).kode).not.toBe("CM");
    expect(t({ jenisPerkara: "Perwalian", nomorPerkara: "1/Pdt.P/2026/PA.Dgl", akhir: "cabut", sudahJawaban: true }).kode).toBe("C"); // permohonan: tak ada jawaban Tergugat
  });

  it("rekomendasi sidang membawa sikap Tergugat dan penanda jawaban", () => {
    const r = rekomendasiBlangko({ jenisPerkara: "Harta Bersama", nomorPerkara: "3/Pdt.G/2026/PA.Dgl", urutanSidang: 3, dihadiriOleh: 1, sudahPutus: true, statusPutusan: "Dicabut", penandaJawaban: { berkas: 1 } });
    expect(r.bas.some((x) => /Cabut sesudah Jawaban - Tergugat Setuju/.test(x.berkas))).toBe(true);
  });
});

describe("D. penguasaan anak 6b revisi: kabul sebagian [02]/[02b], dialihkan [01d]", () => {
  const PG = { jenisPerkara: "Penguasaan Anak", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" };
  const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
    const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
    return r.length ? { berkas: r[0].berkas.replace(/\.rtf$/, ""), folder: r[0].folder.replace(A, "") } : null;
  };

  it("berkas baru ada di fixture dan dijangkau peta", () => {
    for (const b of [
      "6b Penguasaan Anak/[02] [Kabul Sebagian] Penguasaan Anak - Kontradiktoir - Petitum Selebihnya Ditolak.rtf",
      "6b Penguasaan Anak/[02b] [Kabul Sebagian Verstek] Penguasaan Anak - T Tidak Hadir - Petitum Selebihnya Ditolak.rtf",
      "6b Penguasaan Anak/[01d] [Kabul] Penguasaan Anak - Kontradiktoir - Penguasaan Dialihkan.rtf",
    ]) {
      expect(FIX.berkas).toContain(`${A}${b}`);
    }
    const semua = new Set<string>();
    for (const b of Object.values(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (folder) semua.add(`${folder}/${b.berkas}.rtf`);
    }
    expect(semua.has("6b Penguasaan Anak/[01d] [Kabul] Penguasaan Anak - Kontradiktoir - Penguasaan Dialihkan.rtf")).toBe(true);
  });

  it("keadaan dikabulkan-sebagian dari saklar atau amar; dialihkan hanya dari saklar", () => {
    expect(kabulSebagianDariAmar("Mengabulkan gugatan Penggugat untuk sebagian; Menolak gugatan Penggugat selain dan selebihnya")).toBe(true);
    expect(kabulSebagianDariAmar("Mengabulkan gugatan Penggugat; Menghukum Tergugat membayar biaya perkara")).toBe(false);
    expect(kabulSebagianDariAmar("Menolak gugatan Penggugat seluruhnya")).toBe(false);
    expect(keadaanPutusan({ ...PG, dihadiriOleh: 1, dikabulkanSebagian: true })).toContain("dikabulkan-sebagian");
    expect(keadaanPutusan({ ...PG, dihadiriOleh: 1, amarPutusan: "Mengabulkan gugatan untuk sebagian" })).toContain("dikabulkan-sebagian");
    expect(keadaanPutusan({ ...PG, dihadiriOleh: 1, dikabulkanSebagian: false, amarPutusan: "Mengabulkan gugatan untuk sebagian" })).not.toContain("dikabulkan-sebagian");
    expect(keadaanPutusan({ ...PG, dihadiriOleh: 1, penguasaanDialihkan: true })).toContain("dialihkan");
    expect(keadaanPutusan({ ...PG, dihadiriOleh: 1 })).not.toContain("dialihkan");
    expect(keadaanPutusan({ jenisPerkara: "Cerai Gugat", dihadiriOleh: 1, penguasaanDialihkan: true })).not.toContain("dialihkan");
  });

  it("pemilihan: kabul sebagian kontradiktoir [02], verstek [02b], dialihkan [01d]; bawaan [01]/[01b] tidak berubah", () => {
    expect(put({ ...PG, statusPutusan: "Dikabulkan", dikabulkanSebagian: true })).toMatchObject({ berkas: "[02] [Kabul Sebagian] Penguasaan Anak - Kontradiktoir - Petitum Selebihnya Ditolak", folder: "6b Penguasaan Anak" });
    expect(put({ ...PG, statusPutusan: "Dikabulkan", dikabulkanSebagian: true, verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toBe("[02b] [Kabul Sebagian Verstek] Penguasaan Anak - T Tidak Hadir - Petitum Selebihnya Ditolak");
    expect(put({ ...PG, statusPutusan: "Dikabulkan", penguasaanDialihkan: true })!.berkas).toBe("[01d] [Kabul] Penguasaan Anak - Kontradiktoir - Penguasaan Dialihkan");
    expect(put({ ...PG, statusPutusan: "Dikabulkan" })!.berkas).toMatch(/^\[01\] \[Kabul\] Penguasaan Anak/);
    expect(put({ ...PG, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toMatch(/^\[01b\] \[Kabul Verstek\]/);
    // jenis tanpa baris "dikabulkan sebagian" (cerai) tidak terpengaruh
    expect(put({ jenisPerkara: "Cerai Gugat", nomorPerkara: "5/Pdt.G/2026/PA.Dgl", statusPutusan: "Dikabulkan", dikabulkanSebagian: true })!.berkas).toBe("[02] [Kabul] CG - F");
  });

  it("alternatif verstek 6b: V2S sebagai langkah BAS kabul sebagian ada di ALUR 44", () => {
    const alur = ALUR_BAS_BARU.find((a) => a.id === "alur-44")!;
    expect(alur.langkah.map((l) => l.kode)).toContain("V2S");
  });

  it("TS = panel-alat.js untuk kunci kabul sebagian dan dialihkan", () => {
    const panel = muatPanelAlat();
    const kasus: Array<[string, string, boolean, string[]]> = [
      ["Penguasaan Anak", "Dikabulkan", false, ["dikabulkan-sebagian", "kontradiktoir"]],
      ["Penguasaan Anak", "Dikabulkan", true, ["dikabulkan-sebagian"]],
      ["Penguasaan Anak", "Dikabulkan", false, ["dialihkan", "kontradiktoir"]],
      ["Penguasaan Anak", "Dikabulkan", false, ["kontradiktoir"]],
      ["Cerai Gugat", "Dikabulkan", false, ["dikabulkan-sebagian"]],
    ];
    for (const [j, s, v, kd] of kasus) {
      const ts = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, null, kd);
      expect(ts ? { kunci: ts.kunci, tingkat: ts.tingkat } : null, `${j} ${s} ${v} ${kd}`).toEqual(pilihDariPanel(panel, j, s, v, null, kd));
    }
  });
});

describe("E. nama berkas kewarisan: Kontradiktoir (abt-cacat-lama-derry)", () => {
  it("fixture memuat nama baru, peta bawaan memakainya, nama lama tak dirujuk", () => {
    expect(FIX.berkas).toContain(`${A}4b Kewarisan/[01] [Kabul] Kewarisan - Kontradiktoir.rtf`);
    expect(FIX.berkas).not.toContain(`${A}4b Kewarisan/[01] [Kabul] Kewarisan - Kontradiktur.rtf`);
    expect(PETA_PUTUSAN_BAWAAN["kewarisan"].berkas).toBe("[01] [Kabul] Kewarisan - Kontradiktoir");
    expect(JSON.stringify(PETA_PUTUSAN_BAWAAN)).not.toContain("Kontradiktur");
  });
});
