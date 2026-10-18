// @vitest-environment node
/**
 * ============================================================================
 * BAS BARU DI FOLDER JENIS -> BAS massal (G3, 15 Okt 2026)
 * ============================================================================
 *
 * F21 17 Okt: + ALUR 38 (hak asuh, 6), 39 (pembatalan perkawinan, 5), 40 (ekonomi syariah gugatan sederhana, 9) = 19 alur, 113 langkah.
 * I7 17 Okt: ALUR 39 kehilangan langkah CB (BAS mediasi dipindah ke terhapus) = 112 langkah.
 *
 * 93 BAS paket ABT D3 (abt-bas-paw, abt-bas-permohonan) dan E3 (abt-bas-gugatan) berada LANGSUNG di folder jenis. Yang dijaga
 * (semuanya dijalankan):
 *   A. data (alur-bas-baru-data.ts) = daftar-rtf.tsv ketiga paket (bila folder kerja ada), nama berkas ^BAS ALUR nn;
 *   B. jenis perkara -> jenis BAS baru (itsbat kontensius dibedakan dari nomor Pdt.G);
 *   C. tiap jenis baru memilih BAS yang benar untuk keadaan sidang nyata; jenis lama (cerai biasa, hak asuh verstek,
 *      itsbat gugur/cabut, sidang 1 itsbat/DK/AUA) tidak berubah;
 *   D. baris BAS massal: usulan/pilihan/salinan menunjuk folder jenis + nama menu ABT; Pemetaan admin tetap menang;
 *   E. ekstensi menemukan token berkas BAS baru lewat nama menu (folder "9 Penetapan Ahli Waris - BAS" = menu "Penetapan Ahli Waris (P3HP) - BAS", id 118 (MENU-FINAL J3)).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { susunBarisBasMassal, type BarisSidangBas } from "@/app/api/aleta-ecourt/bas-massal/susun";
import { ALUR_BAS_BARU, jenisBasBaru, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { berkasBasSalinan, jenisDokumenBlangko, tugasBlangko } from "@/lib/tugas-blangko";

const A = "derry_briantono/";
const KERJA = "D:/aleta-dev/kerja/batch-14okt-sore";
const KUM = (...kode: string[]) => ({ daftar: kode.map((k) => ({ kode: k, sumber: "sipp" })) });

function t(jenisPerkara: string, m: Partial<Parameters<typeof tentukanBasBaru>[0]> = {}) {
  const h = tentukanBasBaru({ jenisPerkara, urutanSidang: 1, dihadiriOleh: 1, nomorPerkara: "1/Pdt.P/2026/PA.Dgl", ...m });
  return { h, id: h?.alur.id ?? null, kode: h?.langkah.kode ?? null, mode: h?.mode ?? null };
}

/** Kode langkah yang ditambahkan paket I20 (abt-bas-perbaikan-derry, abt-bas-cabut-jawaban-derry, penguasaan anak 6b revisi, 18 Okt) per alur - dijaga pemetaan-i20-18okt.test.ts. */
const LANGKAH_I20: Record<string, string[]> = {
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
};

/** Kode langkah yang ditambahkan paket I16 (abt-celah-bas-derry, 18 Okt) per alur. */
const LANGKAH_I16: Record<string, string[]> = {
  "alur-31": ["V1", "V2"],
  "alur-16": ["C", "G"],
  "alur-19": ["C", "G"],
  "alur-13l": ["C", "G"],
  "alur-14": ["C", "G"],
  "alur-18": ["C", "G"],
  "alur-12l": ["G"],
  "alur-36": ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9", "TT", "CA", "CB", "CD", "G"],
  "alur-37": ["T1", "T2", "TT", "CA", "CB", "CD", "G", "TP", "NO", "N1", "N2"],
};

describe("A. data", () => {
  it("26 alur, 230 langkah (93 D3/E3 + 19 F21 sesudah I7 + 22 F22 + 6 I15 + 38 I16 + 43 I20 + 9 I23), kode unik, nama berkas BAS ALUR nn ... .rtf, menu bernama", () => {
    expect(ALUR_BAS_BARU).toHaveLength(26); // + ALUR 46 nafkah anak (I23 18 Okt); // + ALUR 41, 42, 43 (F22 17 Okt), ALUR 44 (I15 18 Okt), "alur-08g" / "alur-08t" cerai biasa cabut sesudah jawaban (I20 18 Okt)
    expect(ALUR_BAS_BARU.reduce((n, a) => n + a.langkah.length, 0)).toBe(178 + 43 + 9);
    const semua = new Set<string>();
    for (const a of ALUR_BAS_BARU) {
      expect(a.folder.startsWith(A)).toBe(true);
      expect(a.menu.id).toBeGreaterThanOrEqual(101);
      expect(new Set(a.langkah.map((l) => l.kode)).size, a.id).toBe(a.langkah.length);
      for (const l of a.langkah) {
        expect(l.berkas, l.berkas).toMatch(new RegExp(`^BAS ALUR 0?${a.nomor} .+\\.rtf$`)); // "BAS ALUR 08" (nomor 8) berawalan nol
        expect(berkasBasSalinan(l.berkas)).toBe(true);
        expect(tugasBlangko(`${a.folder}/${l.berkas}`)).toBe("panitera"); // BAS di folder jenis tetap tugas panitera
        expect(l.berkas).not.toMatch(/[\\/:*?"<>|]/);
        semua.add(`${a.folder}/${l.berkas}`);
      }
    }
    expect(semua.size).toBe(112 + 10 + 6 + 6 + 6 + 38 + 43 + 9); // F22 17 Okt: ALUR 41 (10), 42 (6), 43 (6); I15 18 Okt: ALUR 44 (6); I16 18 Okt: 38 langkah celah BAS
    expect(jenisDokumenBlangko(`${A}7 Wali Adhal - BAS/${ALUR_BAS_BARU.find((a) => a.id === "alur-19")!.langkah[0].berkas}`)).toBe("bas");
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-19")!.menu).toMatchObject({ id: 114, nama: "Wali Adhal - BAS" });
  });

  const daftar = [
    "d3-bas-permohonan/abt-bas-paw/paket-satker/daftar-rtf.tsv",
    "d3-bas-permohonan/abt-bas-permohonan/paket-satker/daftar-rtf.tsv",
    "e3-bas-gugatan/paket-satker/daftar-rtf.tsv",
  ].map((x) => `${KERJA}/${x}`);
  it.skipIf(!daftar.every(existsSync))("sama persis dengan daftar-rtf.tsv paket D3 dan E3", () => {
    const dari = new Set<string>();
    for (const f of daftar) {
      for (const baris of readFileSync(f, "utf8").split(/\r?\n/)) {
        if (!baris || baris.startsWith("#")) continue;
        const [folder, berkas] = baris.split("\t");
        dari.add(`${folder.startsWith(A) ? folder : A + folder}/${berkas}`);
      }
    }
    // K3: daftar-rtf.tsv paket D3/E3 memuat folder putusan (sebelum dipindah ke "... - BAS"); folder BAS = folder itu + " - BAS".
    // ALUR 38-40 berasal dari paket F21 (17 Okt), bukan D3/E3: dijaga di bagian F di bawah terhadap pohon server.
    // I16 18 Okt: 38 langkah celah BAS (paket abt-celah-bas-derry) ditambahkan ke alur yang sudah ada dan dijaga pemetaan-i16-18okt.test.ts.
    const data = new Set(ALUR_BAS_BARU.filter((a) => a.nomor < 38 && a.nomor !== 8).flatMap((a) => a.langkah.filter((l) => !LANGKAH_I16[a.id]?.includes(l.kode) && !LANGKAH_I20[a.id]?.includes(l.kode)).map((l) => `${a.folder.replace(/ - BAS$/, "")}/${l.berkas}`)));
    expect([...data].sort()).toEqual([...dari].sort());
  });
});

describe("B. jenis perkara", () => {
  it("dikenali dari nama jenis SIPP; itsbat Pdt.G = kontensius", () => {
    expect(jenisBasBaru("P3HP/Penetapan Ahli Waris")).toBe("paw");
    expect(jenisBasBaru("Kewarisan")).toBe("waris");
    expect(jenisBasBaru("Harta Bersama")).toBe("hb");
    expect(jenisBasBaru("Izin Poligami")).toBe("poligami");
    expect(jenisBasBaru("Wali Adhol")).toBe("wali-adhal");
    expect(jenisBasBaru("Perwalian")).toBe("perwalian");
    expect(jenisBasBaru("Lain-Lain")).toBe("angkat-anak");
    expect(jenisBasBaru("Dispensasi Kawin")).toBe("dk");
    expect(jenisBasBaru("Asal Usul Anak")).toBe("aua");
    expect(jenisBasBaru("Pengesahan Perkawinan/Istbat Nikah", "3/Pdt.P/2026/PA.Dgl")).toBe("itsbat");
    expect(jenisBasBaru("Pengesahan Perkawinan/Istbat Nikah", "3/Pdt.G/2026/PA.Dgl")).toBe("itsbat-kontensius");
    expect(jenisBasBaru("Cerai Gugat")).toBe("cerai-gugat");
    // F21 17 Okt: hak asuh (349 "Penguasaan Anak"; Lain-Lain bernomor Pdt.G), pembatalan perkawinan, ekonomi syariah gugatan sederhana (Pdt.G.S).
    expect(jenisBasBaru("Penguasaan Anak", "3/Pdt.G/2026/PA.Dgl")).toBe("penguasaan-anak"); // I15 18 Okt: ALUR 44 (folder 6b), bukan hak asuh
    expect(jenisBasBaru("Lain-Lain", "3/Pdt.G/2026/PA.Dgl")).toBe("hak-asuh");
    expect(jenisBasBaru("Lain-Lain", "3/Pdt.P/2026/PA.Dgl")).toBe("angkat-anak");
    expect(jenisBasBaru("Pembatalan Perkawinan", "3/Pdt.G/2026/PA.Dgl")).toBe("pembatalan");
    expect(jenisBasBaru("Ekonomi Syariah", "3/Pdt.G.S/2026/PA.Dgl")).toBe("es");
    expect(jenisBasBaru("Ekonomi Syariah", "3/Pdt.G/2026/PA.Dgl")).toBe("es-biasa"); // F22 17 Okt: acara biasa = ALUR 43
    expect(jenisBasBaru("Ekonomi Syariah")).toBe(""); // nomor tak diketahui: tidak ditebak
    expect(jenisBasBaru(null)).toBe("");
  });
});

describe("C. pemilihan menurut jenis + keadaan sidang", () => {
  it("PAW: sidang 1 ditunda [1a]; sidang 2 pembacaan [3]; saksi lanjutan [2]; perbaikan [1c]/[2a]; NO", () => {
    expect(t("P3HP/Penetapan Ahli Waris")).toMatchObject({ id: "alur-14", kode: "1a", mode: "ganti" });
    expect(t("P3HP/Penetapan Ahli Waris").h!.perkiraan).toBe(true);
    expect(t("P3HP/Penetapan Ahli Waris", { urutanSidang: 2, agenda: "Pembacaan Penetapan" })).toMatchObject({ id: "alur-14", kode: "3" });
    expect(t("P3HP/Penetapan Ahli Waris", { urutanSidang: 2, agenda: "Pemeriksaan Saksi" })).toMatchObject({ kode: "2" });
    expect(t("P3HP/Penetapan Ahli Waris", { agenda: "Perbaikan Permohonan" })).toMatchObject({ kode: "1c" });
    expect(t("P3HP/Penetapan Ahli Waris", { urutanSidang: 2, agenda: "Perbaikan Permohonan" })).toMatchObject({ kode: "2a" });
    expect(t("P3HP/Penetapan Ahli Waris", { akhir: "no" })).toMatchObject({ id: "alur-14", kode: "NO" });
    expect(t("P3HP/Penetapan Ahli Waris", { urutanSidang: 4 })).toMatchObject({ kode: "3" });
  });

  it("permohonan tidak hadir / gugur / cabut -> BAS di folder jenisnya sendiri (I20 18 Okt: [T] dan [N] kini ada di sana; 9b tinggal cadangan)", () => {
    const alurJenis: Record<string, string> = { "P3HP/Penetapan Ahli Waris": "alur-14", Perwalian: "alur-16", "Wali Adhol": "alur-19", "Lain-Lain": "alur-18", "Dispensasi Kawin": "alur-12l", "Asal Usul Anak": "alur-13l" };
    for (const j of Object.keys(alurJenis)) {
      expect(t(j, { dihadiriOleh: 4 }), j).toMatchObject({ id: alurJenis[j], kode: "T" });
      expect(t(j, { dihadiriOleh: 4, urutanSidang: 2 }), j).toMatchObject({ id: alurJenis[j], kode: "G" });
    }
    // I16 18 Okt: cabut / gugur punya BAS di folder jenisnya sendiri ([C] / [G]); T dan N tetap di 9b.
    expect(t("Perwalian", { akhir: "cabut" })).toMatchObject({ id: "alur-16", kode: "C" });
    expect(t("Perwalian", { agenda: "Pencabutan permohonan" })).toMatchObject({ id: "alur-16", kode: "C" });
    expect(t("Dispensasi Kawin", { akhir: "cabut" })).toMatchObject({ id: "alur-12l", kode: "C" });
    expect(t("P3HP/Penetapan Ahli Waris", { akhir: "gugur" })).toMatchObject({ id: "alur-14", kode: "G" });
    // I20 18 Okt: T dan N juga di folder jenisnya (perwalian = 6 Perwalian - BAS, menu 112); 9b (menu 122) tinggal untuk jenis tanpa BAS sendiri.
    expect(t("Perwalian", { akhir: "no" })).toMatchObject({ id: "alur-16", kode: "N" });
    expect(t("Perwalian", { dihadiriOleh: 4 }).h!.alur.folder).toBe(`${A}6 Perwalian - BAS`);
    expect(t("Perwalian", { dihadiriOleh: 4 }).h!.alur.menu.id).toBe(112);
  });

  it("perwalian, wali adhal, pengangkatan anak: folder & menu masing-masing", () => {
    const pw = t("Perwalian", { urutanSidang: 3 });
    expect(pw).toMatchObject({ id: "alur-16", kode: "3" });
    expect(pw.h!.alur).toMatchObject({ folder: `${A}6 Perwalian - BAS`, menu: { id: 112 } });
    const wa = t("Wali Adhol", { urutanSidang: 2, agenda: "Pemeriksaan saksi" });
    expect(wa).toMatchObject({ id: "alur-19", kode: "2" });
    expect(wa.h!.alur).toMatchObject({ folder: `${A}7 Wali Adhal - BAS`, menu: { id: 114, nama: "Wali Adhal - BAS" } });
    expect(t("Wali Adhol", { agenda: "Perbaikan" }).kode).toBe("1a"); // wali adhal tanpa [1c]: jatuh ke default sidang 1
    expect(t("Lain-Lain", { agenda: "Menghadirkan orang tua kandung calon anak angkat" })).toMatchObject({ id: "alur-18", kode: "1d" });
    expect(t("Lain-Lain", { urutanSidang: 2 }).h!.alur.menu.id).toBe(120);
  });

  it("itsbat permohonan: sidang 1 tidak berubah (hanya ditawarkan), sidang 2+ = ALUR 17, tidak hadir = ALUR 15, gugur/cabut tetap peta 946", () => {
    const s1 = t("Pengesahan Perkawinan/Istbat Nikah");
    expect(s1).toMatchObject({ id: "alur-17", kode: "1a", mode: "tambah" });
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { urutanSidang: 2 })).toMatchObject({ id: "alur-17", kode: "3", mode: "ganti" });
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { urutanSidang: 3, agenda: "Pemeriksaan Saksi" })).toMatchObject({ kode: "2" });
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { dihadiriOleh: 4 })).toMatchObject({ id: "alur-17", kode: "T" }); // I20 18 Okt: [T] kini di folder itsbat (dulu 9b)
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { urutanSidang: 2, dihadiriOleh: 4 }).h).toBeNull(); // 946 [G] tetap
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { akhir: "gugur" }).h).toBeNull();
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { akhir: "cabut" }).h).toBeNull();
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { urutanSidang: 2 }).h!.alur.folder).toBe(`${A}2 Itsbat Nikah - BAS`);
  });

  it("dispensasi kawin & asal usul anak: sidang 1 hanya ditawarkan, lanjutan = [3]; AUA saksi/perbaikan", () => {
    expect(t("Dispensasi Kawin")).toMatchObject({ id: "alur-12l", kode: "1t", mode: "tambah" });
    expect(t("Dispensasi Kawin").h!.alternatif.map((l) => l.kode)).toEqual(["1at", "2t", "2at"]);
    expect(t("Dispensasi Kawin", { urutanSidang: 2 })).toMatchObject({ id: "alur-12l", kode: "3", mode: "ganti" });
    expect(t("Asal Usul Anak")).toMatchObject({ id: "alur-13l", kode: "1a", mode: "tambah" });
    expect(t("Asal Usul Anak", { urutanSidang: 2 })).toMatchObject({ id: "alur-13l", kode: "3", mode: "ganti" });
    expect(t("Asal Usul Anak", { urutanSidang: 2, agenda: "Pemeriksaan saksi" })).toMatchObject({ kode: "2" });
    expect(t("Asal Usul Anak", { urutanSidang: 2 }).h!.alur.folder).toBe(`${A}8 Asal Usul Anak - BAS`);
  });

  it("harta bersama & kewarisan: insidentil/putusan sela/setempat (30/32), damai/cabut/P tidak hadir/NO (31/33), selebihnya ALUR 04 salinan", () => {
    const hb = "Harta Bersama";
    expect(t(hb, { agenda: "Sidang Insidentil Sita Marital" })).toMatchObject({ id: "alur-30", kode: "I1" });
    expect(t(hb, { agenda: "Pembacaan Putusan Sela" })).toMatchObject({ id: "alur-30", kode: "I2" });
    expect(t(hb, { agenda: "Pemeriksaan Setempat" })).toMatchObject({ id: "alur-30", kode: "PS" });
    expect(t(hb, { urutanSidang: 2, agenda: "Laporan Mediasi - Akta Perdamaian" })).toMatchObject({ id: "alur-31", kode: "AP" });
    expect(t(hb, { urutanSidang: 2, dihadiriOleh: 3 })).toMatchObject({ id: "alur-31", kode: "TP" });
    expect(t(hb, { urutanSidang: 3, dihadiriOleh: 4, akhir: "no" })).toMatchObject({ id: "alur-31", kode: "NO" });
    expect(t(hb, { akhir: "cabut" })).toMatchObject({ id: "alur-31", kode: "CB" });
    expect(t("Kewarisan", { agenda: "Pemeriksaan Setempat" })).toMatchObject({ id: "alur-32", kode: "PS" });
    expect(t("Kewarisan", { urutanSidang: 2, dihadiriOleh: 3 })).toMatchObject({ id: "alur-33", kode: "TP" });
    expect(t("Kewarisan", { agenda: "Pemeriksaan Setempat" }).h!.alur.folder).toBe(`${A}4b Kewarisan - BAS`);
    // sidang biasa: BAS kontradiktoir ALUR 04 yang disalin ke folder jenis
    const biasa = t(hb, { urutanSidang: 3, agenda: "Jawaban" });
    expect(biasa).toMatchObject({ id: "alur-04", kode: "3" });
    expect(biasa.h!.alur.folder).toBe(`${A}4a Harta Bersama - BAS`);
    expect(biasa.h!.langkah.berkas).toMatch(/^BAS ALUR 04 \[3\] BAS 3 P & T Hadir/);
    expect(t("Kewarisan", { urutanSidang: 6, agenda: "Pembuktian Penggugat" }).h!.langkah.berkas).toMatch(/^BAS ALUR 04 \[6\]/);
    expect(t("Kewarisan", { urutanSidang: 6 }).h!.alur.folder).toBe(`${A}4b Kewarisan - BAS`);
  });

  it("izin poligami 1-3 sidang & cabut; itsbat kontensius (Pdt.G) 1-2 sidang, P tidak hadir, cabut, NO", () => {
    expect(t("Izin Poligami")).toMatchObject({ id: "alur-34", kode: "S1" });
    expect(t("Izin Poligami", { urutanSidang: 2 })).toMatchObject({ kode: "S2" });
    expect(t("Izin Poligami", { urutanSidang: 3 })).toMatchObject({ kode: "S3" });
    expect(t("Izin Poligami", { urutanSidang: 2, akhir: "cabut" })).toMatchObject({ kode: "CB" });
    const IN = { nomorPerkara: "498/Pdt.G/2025/PA.Dgl" };
    expect(t("Pengesahan Perkawinan/Istbat Nikah", IN)).toMatchObject({ id: "alur-35", kode: "S1T" });
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { ...IN, agenda: "Pembuktian dan Putusan" })).toMatchObject({ kode: "S1P" });
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { ...IN, urutanSidang: 2 })).toMatchObject({ kode: "S2" });
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { ...IN, urutanSidang: 2, dihadiriOleh: 3 })).toMatchObject({ kode: "TP" });
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { ...IN, urutanSidang: 3, dihadiriOleh: 4, akhir: "no" })).toMatchObject({ kode: "NO" });
    expect(t("Pengesahan Perkawinan/Istbat Nikah", { ...IN, akhir: "cabut" })).toMatchObject({ kode: "CB" });
    expect(t("Pengesahan Perkawinan/Istbat Nikah", IN).h!.alur).toMatchObject({ folder: `${A}2a Itsbat Nikah Kontensius - BAS`, menu: { id: 128 } });
  });

  it("cerai kumulasi itsbat verstek -> ALUR 36 (1c); hak asuh kontradiktoir -> ALUR 37 (1d); kumulasi lain & cerai biasa tidak berubah", () => {
    const cg = { jenisPerkara: "Cerai Gugat", dihadiriOleh: 2, nomorPerkara: "337/Pdt.G/2026/PA.Dgl" };
    const k = (m: object) => tentukanBasBaru({ urutanSidang: 1, ...cg, ...m } as Parameters<typeof tentukanBasBaru>[0]);
    expect(k({ kumulasi: KUM("itsbat-nikah") })).toMatchObject({ alur: { id: "alur-36" }, langkah: { kode: "S1" } });
    expect(k({ urutanSidang: 2, kumulasi: KUM("itsbat-nikah") })).toMatchObject({ langkah: { kode: "P2" } });
    expect(k({ urutanSidang: 2, kumulasi: KUM("itsbat-nikah") })!.alur.folder).toBe(`${A}1c Perceraian Kumulasi Itsbat Nikah - BAS`);
    expect(k({ urutanSidang: 2, kumulasi: KUM("itsbat-nikah"), jenisPerkara: "Cerai Talak" })).toMatchObject({ langkah: { kode: "P2" } });
    expect(k({ urutanSidang: 3, kumulasi: KUM("itsbat-nikah"), tergugatPernahHadir: false, agenda: "Panggil Tergugat" })).toMatchObject({ langkah: { kode: "L" } });
    // hak asuh kontradiktoir
    const ha = k({ urutanSidang: 6, dihadiriOleh: 1, kumulasi: KUM("hak-asuh-anak"), agenda: "Pembuktian Penggugat" });
    expect(ha).toMatchObject({ alur: { id: "alur-37", folder: `${A}1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS` }, langkah: { kode: "6" } });
    expect(k({ urutanSidang: 2, dihadiriOleh: 1, kumulasi: KUM("hak-asuh-anak"), agenda: "Mediasi berhasil sebagian hak asuh" })).toMatchObject({ langkah: { kode: "2m" } });
    // tidak berubah
    expect(k({ kumulasi: KUM("hak-asuh-anak") })).toMatchObject({ alur: { id: "alur-37" }, langkah: { kode: "T1" } }); // I16 18 Okt: verstek sidang 1 hak asuh = tunda panggil T (dulu peta lama)
    expect(k({ urutanSidang: 2, kumulasi: KUM("hak-asuh-anak") })).toBeNull(); // verstek putus hak asuh: 945 (peta lama)
    expect(k({})).toBeNull();
    expect(k({ urutanSidang: 4, dihadiriOleh: 1 })).toBeNull();
    expect(k({ kumulasi: KUM("nafkah-anak") })).toBeNull();
    expect(k({ urutanSidang: 2, kumulasi: KUM("itsbat-nikah"), akhir: "gugur" })).toMatchObject({ alur: { id: "alur-36" }, langkah: { kode: "G" } }); // I16 18 Okt (dulu null)
  });

  it("jenis di luar BAS baru -> null", () => {
    expect(t("Ekonomi Syariah").h).toBeNull();
    expect(t("").h).toBeNull();
  });
});

describe("D. baris BAS massal (susun.ts sungguhan)", () => {
  const dasar: BarisSidangBas = {
    sidangId: "s1",
    perkaraId: "100",
    nomorPerkara: "1/Pdt.P/2026/PA.Dgl",
    jenisPerkara: "P3HP/Penetapan Ahli Waris",
    tanggalSidang: "2026-10-15",
    jamSidang: "09:00",
    agenda: "Pemeriksaan",
    urutanSidang: 1,
    dihadiriOleh: 1,
    paniteraNama: "PP Satu",
  };
  const susun = (b: BarisSidangBas[], petaBas?: Record<string, string>) =>
    susunBarisBasMassal(b, { namaAkun: "PP Satu", saringan: "semua", katalog: {}, lembar: {}, saat: null, petaBas }).baris;

  it("PAW: usulan = BAS di folder jenis dengan salinan (menu 118) menunjuk dirinya sendiri; alurBas alur-14", () => {
    const [b] = susun([dasar]);
    expect(b.blangko.usulan).toMatchObject({ folder: `${A}9 Penetapan Ahli Waris - BAS`, perkiraan: true });
    expect(b.blangko.usulan!.berkas).toMatch(/^BAS ALUR 14 PAW - \[1a\]/);
    expect(b.blangko.usulan!.salinan).toEqual([
      { folder: `${A}9 Penetapan Ahli Waris - BAS`, berkas: b.blangko.usulan!.berkas, menu: "Penetapan Ahli Waris (P3HP) - BAS", alias: "PAW/P3HP - BAS" },
    ]);
    expect(b.blangko.pilihan.map((p) => p.berkas)).toContain(ALUR_BAS_BARU.find((a) => a.id === "alur-14")!.langkah.find((l) => l.kode === "1")!.berkas);
    expect(b.alurBas).toMatchObject({ id: "alur-14", kode: "1a", perkiraan: true, folder: `${A}9 Penetapan Ahli Waris - BAS` });
    // pasti (agenda menyebut pembacaan penetapan sidang 2): tidak ditandai perkiraan
    const [c] = susun([{ ...dasar, urutanSidang: 2, agenda: "Pembacaan Penetapan" }]);
    expect(c.blangko.usulan!.perkiraan).toBeUndefined();
    expect(c.blangko.usulan!.kehadiran).toBe("cocok");
    expect(c.blangko.sebab).toBe("");
  });

  it("jenis lama tidak berubah: cerai gugat biasa alurBas alur-02 (kini juga pilihan, Q3 16 Okt); sidang 1 DK: varian tunda baru ditawarkan, usulan dari penebak alur lama", () => {
    const [cg] = susun([{ ...dasar, jenisPerkara: "Cerai Gugat", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", dihadiriOleh: 2 }]);
    expect(cg.alurBas).toMatchObject({ id: "alur-02", kode: "1" });
    // Q3 16 Okt: tanpa katalog arsip, langkah alur menjadi usulan perkiraan (dulu: tanpa pilihan, hanya tag).
    expect(cg.blangko.usulan).toMatchObject({ setId: "alur-02", perkiraan: true });
    const [dk] = susun([{ ...dasar, jenisPerkara: "Dispensasi Kawin" }]);
    expect(dk.alurBas).toMatchObject({ id: "alur-12", kode: "1" }); // keterangan alur lama tetap
    expect(dk.blangko.usulan?.setId).toBe("alur-12"); // Q3: tanpa katalog, langkah alur lama = usulan perkiraan; varian tunda baru hanya ditawarkan
    expect(dk.blangko.pilihan.filter((p) => p.setId === "alur-12l")).toHaveLength(4);
    const [dk2] = susun([{ ...dasar, jenisPerkara: "Dispensasi Kawin", urutanSidang: 2, agenda: "Pembacaan Penetapan" }]);
    expect(dk2.blangko.usulan).toMatchObject({ folder: `${A}3 Dispensasi Kawin - BAS` });
    expect(dk2.blangko.usulan!.berkas).toMatch(/^BAS ALUR 12 DK - \[3\]/);
    expect(dk2.alurBas).toMatchObject({ id: "alur-12l", kode: "3" });
  });

  it("Pemetaan blangko admin tetap menang atas usulan baru", () => {
    // Tanpa katalog Pemetaan tidak dapat menunjuk berkas (usulan null) - jalur terkunci diuji langsung lewat gabungBasBaru.
    return import("@/app/api/aleta-ecourt/bas-massal/susun").then(({ gabungBasBaru }) => {
      const baru = tentukanBasBaru({ jenisPerkara: "Perwalian", urutanSidang: 3, dihadiriOleh: 1 })!;
      const admin = { folder: "x", berkas: "pilihan admin.rtf", setId: "s", setNama: "S", basKe: 3, label: "admin", kehadiran: "cocok" as const, dariPemetaan: "perwalian|3|" };
      const g = gabungBasBaru({ usulan: admin, pilihan: [admin], sebab: "" }, baru);
      expect(g.usulan).toBe(admin);
      expect(g.pilihan[0]).toBe(admin);
      expect(g.pilihan.some((p) => p.berkas.startsWith("BAS ALUR 16 Perwalian - [3]"))).toBe(true);
      const tanpa = gabungBasBaru({ usulan: null, pilihan: [], sebab: "belum ada set" }, baru);
      expect(tanpa.usulan!.berkas).toMatch(/^BAS ALUR 16 Perwalian - \[3\]/);
    });
  });

  it("HB sidang insidentil, itsbat kontensius: alurBas baru dan usulan di folder jenisnya", () => {
    const [hb, inK] = susun([
      { ...dasar, jenisPerkara: "Harta Bersama", nomorPerkara: "308/Pdt.G/2026/PA.Dgl", agenda: "Sidang Insidentil Sita", perkaraId: "1" },
      { ...dasar, jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "498/Pdt.G/2025/PA.Dgl", perkaraId: "2" },
    ]);
    expect(hb.blangko.usulan).toMatchObject({ folder: `${A}4a Harta Bersama - BAS`, salinan: [expect.objectContaining({ menu: "Harta Bersama - BAS" })] });
    expect(hb.alurBas).toMatchObject({ id: "alur-30", kode: "I1" });
    expect(inK.alurBas).toMatchObject({ id: "alur-35" });
    expect(inK.blangko.usulan!.salinan![0].menu).toBe("Itsbat Nikah Kontensius - BAS");
  });
});

describe("E. ekstensi: token berkas BAS baru lewat nama menu", () => {
  const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
  const sumberBasmassal = readFileSync(path.join(EKSTENSI, "basmassal.js"), "utf8");
  const sumberAlat = readFileSync(path.join(EKSTENSI, "panel-alat.js"), "utf8");
  function muat(html: string) {
    const simpanan: Record<string, unknown> = {};
    const dom = new JSDOM(html, { url: "http://192.168.10.10/aps_badilag/abt/main/beranda" });
    const awal = sumberBasmassal.indexOf("function basmassalKunciNama(");
    const akhir = sumberBasmassal.indexOf("/** Mode coba atau mode latihan menahan POST ini? */");
    const awalToken = sumberAlat.indexOf("function alatTokenDariTautan(");
    const akhirToken = sumberAlat.indexOf("/* ─── 2. ANTREAN MASSAL");
    const k: any = {
      document: dom.window.document, location: dom.window.location, URL, console, Date, Object, Array, String, Number, JSON,
      chrome: { storage: { local: { get: async (kunci: string[]) => Object.fromEntries(kunci.filter((x) => x in simpanan).map((x) => [x, simpanan[x]])), set: async (o: Record<string, unknown>) => void Object.assign(simpanan, o) } } },
    };
    vm.createContext(k);
    vm.runInContext(
      `${sumberBasmassal.match(/^const BASMASSAL_KUNCI_TOKEN = .*;$/m)![0]}\n${sumberBasmassal.match(/^const BASMASSAL_TOKEN_MAKS = .*;$/m)![0]}\n${sumberAlat.slice(awalToken, akhirToken)}\n${sumberBasmassal.slice(awal, akhir)}`,
      k
    );
    return { k, simpanan };
  }
  const kartu = (kelompok: string, berkas: Array<[string, string, string]>) =>
    `<div class="pricing_inner_w3ls"><div class="pricing-top"><h3>${kelompok}<br>Penetapan Ahli Waris 1/Pdt.P/2026</h3></div><div class="pricing-bottom-bottom">` +
    berkas.map(([nama, a, b]) => `<a onclick='x({a:"${a}", b:"${b}"})'><span># ${nama}</span></a>`).join("") +
    `</div></div>`;

  it("PAW (menu 118) dan wali adhal (menu 114 'Wali Adhal - BAS'): berkas BAS terpanen dan ditemukan lewat salinan menu", async () => {
    const paw = tentukanBasBaru({ jenisPerkara: "P3HP/Penetapan Ahli Waris", urutanSidang: 1, dihadiriOleh: 1 })!;
    const wa = tentukanBasBaru({ jenisPerkara: "Wali Adhol", urutanSidang: 2, dihadiriOleh: 1, agenda: "saksi" })!;
    const html =
      `<html><body><div id="navbar"><div class="accordion">` +
      `<a href="/x?a=K_PAW">${paw.alur.menu.nama}</a><a href="/x?a=K_WA">${wa.alur.menu.nama}</a></div></div>` +
      kartu(paw.alur.menu.nama, [[paw.langkah.berkas, "A_PAW", "B_PAW"]]) +
      kartu("Penetapan Ahli Waris - Putusan", [["[01] [Kabul] PAW.rtf", "A_PUT", "B_PUT"]]) +
      kartu(wa.alur.menu.nama, [[wa.langkah.berkas, "A_WA", "B_WA"]]) +
      `</body></html>`;
    const { k, simpanan } = muat(html);
    expect(await k.basmassalPanenTokenAbt()).toBeGreaterThan(0);
    const peta = (simpanan as any).tokenBlangkoBas;
    // hanya menu "... - BAS" yang dipanen: kartu "... - Putusan" (berkas putusan) tidak
    expect(Object.keys(peta.berkas)).toHaveLength(2);
    const salinan = (h: typeof paw) => [{ folder: h.alur.folder, berkas: h.langkah.berkas, menu: h.alur.menu.nama, alias: h.alur.menu.alias }];
    const tp = k.basmassalTokenUntuk(peta, paw.alur.folder, paw.langkah.berkas, [], salinan(paw));
    expect(tp.berkas).toMatchObject({ a: "A_PAW", b: "B_PAW" });
    expect(tp.kelompok).toMatchObject({ a: "K_PAW" });
    const tw = k.basmassalTokenUntuk(peta, wa.alur.folder, wa.langkah.berkas, [], salinan(wa));
    expect(tw.berkas).toMatchObject({ a: "A_WA", b: "B_WA" });
    expect(tw.kelompok).toMatchObject({ a: "K_WA" });
  });
});
