// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET CELAH BAS (I16, 18 Okt): abt-celah-bas-derry - 38 BAS baru di folder "<Jenis> - BAS" yang sudah ada
 * ============================================================================
 *
 * Paket (BELUM terpasang di server; 38 berkas di fixtures/blangko-derry-server-17okt.json dari rtf/ paket; data langkah = pemetaan-langkah-baru.json):
 *   - harta bersama (ALUR 31): V1 sidang 1 tunda panggil T, V2 sidang 2 pembuktian dan putusan verstek;
 *   - cabut [C] / gugur [G] untuk perwalian (16), wali adhal (19), AUA (13l), PAW (14), pengangkatan anak (18), DK gugur (12l);
 *   - cerai kumulasi itsbat (ALUR 36, folder 1c): Tergugat hadir H1-H9, tunda P&T TT, cabut CA/CB/CD, gugur G;
 *   - cerai gugat kumulasi hak asuh (ALUR 37, folder 1d): T1/T2/TT/CA/CB/CD/G/TP/NO/N1/N2.
 * Menu/hak tidak berubah (106, 110, 112, 114, 116, 118, 120, 124, 132). Yang dijaga: (A) data = berkas di fixture; (B) HB verstek; (C) cabut/gugur permohonan;
 * (D) kumulasi itsbat; (E) kumulasi hak asuh; (F) bawaan lama tidak berubah; (G) tampil lewat rekomendasi sidang.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ALUR_BAS_BARU, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/";

const I16: Record<string, string[]> = {
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
const KUM = (...kode: string[]) => ({ daftar: kode.map((k) => ({ kode: k })) });
const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]> & { jenisPerkara: string }) => {
  const h = tentukanBasBaru({ urutanSidang: 1, dihadiriOleh: 1, ...m });
  return { h, id: h?.alur.id ?? null, kode: h?.langkah.kode ?? null };
};

describe("A. data: 38 langkah baru = 38 berkas di folder BAS server (dua arah)", () => {
  it("tiap langkah I16 ADA di fixture; tidak ada berkas BAS ALUR 31/16/19/13/14/18/12/36/37 di fixture tanpa langkah", () => {
    let jumlah = 0;
    for (const [id, kode] of Object.entries(I16)) {
      const alur = ALUR_BAS_BARU.find((a) => a.id === id)!;
      for (const k of kode) {
        const l = alur.langkah.find((x) => x.kode === k);
        expect(l, `${id} ${k}`).toBeTruthy();
        expect(FIX.berkas, `${id} ${k}`).toContain(`${alur.folder}/${l!.berkas}`);
        jumlah++;
      }
      // dua arah: berkas "BAS ALUR <nomor> ..." di folder alur itu semuanya punya langkah (ALUR 12l / 13l: nomor sama dengan salinan "BAS ALUR 13 [1] ..." - hanya arah maju)
      if (id === "alur-12l" || id === "alur-13l") continue;
      const nomor = /BAS ALUR (\d+) /.exec(alur.langkah[0].berkas)![1];
      const diServer = FIX.berkas.filter((b) => b.startsWith(`${alur.folder}/BAS ALUR ${nomor} `));
      expect(diServer.sort(), id).toEqual(alur.langkah.map((l) => `${alur.folder}/${l.berkas}`).sort());
    }
    expect(jumlah).toBe(38);
  });

  it("nama berkas langkah baru bermenu ABT yang sudah ada; ALUR 36 bernama 'Verstek dan Tergugat Hadir'; kode lama tetap", () => {
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-36")).toMatchObject({ nama: "Cerai Kumulasi Itsbat Nikah (Verstek dan Tergugat Hadir)", menu: { id: 106 } });
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-36")!.langkah.slice(0, 4).map((l) => l.kode)).toEqual(["S1", "L", "P2", "P3"]);
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-37")!.langkah.slice(0, 2).map((l) => l.kode)).toEqual(["1", "2m"]);
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-14")!.langkah.some((l) => l.kode === "NO")).toBe(true);
    for (const [id, menu] of Object.entries({ "alur-31": 124, "alur-16": 112, "alur-19": 114, "alur-13l": 116, "alur-14": 118, "alur-18": 120, "alur-12l": 110, "alur-37": 132 })) {
      expect(ALUR_BAS_BARU.find((a) => a.id === id)!.menu.id, id).toBe(menu);
    }
  });
});

describe("B. harta bersama: BAS verstek V1 / V2 (kewarisan belum)", () => {
  const hb = { jenisPerkara: "Harta Bersama", nomorPerkara: "3/Pdt.G/2026/PA.Dgl" };

  it("T tidak pernah hadir: sidang 1 V1, sidang 2 V2 (perkiraan bila lebih dari 2); folder 4a - BAS menu 124", () => {
    expect(t({ ...hb, dihadiriOleh: 2 })).toMatchObject({ id: "alur-31", kode: "V1" });
    expect(t({ ...hb, dihadiriOleh: 2 }).h!.alur).toMatchObject({ folder: `${A}4a Harta Bersama - BAS`, menu: { id: 124 } });
    expect(t({ ...hb, dihadiriOleh: 2, urutanSidang: 2 })).toMatchObject({ id: "alur-31", kode: "V2" });
    expect(t({ ...hb, dihadiriOleh: 2, urutanSidang: 2 }).h!.perkiraan).toBe(false);
    expect(t({ ...hb, dihadiriOleh: 2, urutanSidang: 3 }).h!.perkiraan).toBe(true);
  });

  it("T pernah hadir / kedua hadir / P tidak hadir / cabut / damai / NO tidak berubah; kewarisan tetap salinan ALUR 04", () => {
    expect(t({ ...hb, dihadiriOleh: 2, tergugatPernahHadir: true, urutanSidang: 3, agenda: "Pembuktian" }).id).toBe("alur-04");
    expect(t({ ...hb, dihadiriOleh: 1, urutanSidang: 3, agenda: "Jawaban" }).id).toBe("alur-04");
    expect(t({ ...hb, dihadiriOleh: 4, urutanSidang: 2 })).toMatchObject({ id: "alur-31", kode: "TP" });
    expect(t({ ...hb, akhir: "cabut" })).toMatchObject({ id: "alur-31", kode: "CB" });
    expect(t({ ...hb, akhir: "no", dihadiriOleh: 4, urutanSidang: 3 })).toMatchObject({ id: "alur-31", kode: "NO" });
    expect(t({ ...hb, urutanSidang: 2, agenda: "Mediasi berhasil" })).toMatchObject({ id: "alur-31", kode: "AP" });
    const waris = t({ jenisPerkara: "Kewarisan", nomorPerkara: "4/Pdt.G/2026/PA.Dgl", dihadiriOleh: 2 });
    expect(waris.id).not.toBe("alur-33");
    expect(waris.kode).not.toBe("V1");
  });
});

describe("C. permohonan: cabut [C] dan gugur [G] di folder BAS jenisnya (bukan 9b)", () => {
  const kasus: Array<[string, string, string, string, number]> = [
    ["Perwalian", "alur-16", "6 Perwalian - BAS", "BAS ALUR 16 Perwalian", 112],
    ["Wali Adhol", "alur-19", "7 Wali Adhal - BAS", "BAS ALUR 19 Wali Adhal", 114],
    ["Asal Usul Anak", "alur-13l", "8 Asal Usul Anak - BAS", "BAS ALUR 13 AUA", 116],
    ["P3HP/Penetapan Ahli Waris", "alur-14", "9 Penetapan Ahli Waris - BAS", "BAS ALUR 14 PAW", 118],
    ["Lain-Lain", "alur-18", "9a Lain-Lain (Pengangkatan Anak) - BAS", "BAS ALUR 18 Angkat Anak", 120],
  ];
  for (const [jenis, id, folder, awalan, menu] of kasus) {
    it(`${jenis}: cabut -> ${id} [C], gugur -> ${id} [G] (${folder})`, () => {
      const c = t({ jenisPerkara: jenis, akhir: "cabut" });
      expect(c).toMatchObject({ id, kode: "C" });
      expect(c.h!.alur).toMatchObject({ folder: `${A}${folder}`, menu: { id: menu } });
      expect(c.h!.langkah.berkas.startsWith(`${awalan} - [C]`)).toBe(true);
      expect(FIX.berkas).toContain(`${A}${folder}/${c.h!.langkah.berkas}`);
      const g = t({ jenisPerkara: jenis, akhir: "gugur" });
      expect(g).toMatchObject({ id, kode: "G" });
      expect(g.h!.langkah.berkas.startsWith(`${awalan} - [G]`)).toBe(true);
      expect(FIX.berkas).toContain(`${A}${folder}/${g.h!.langkah.berkas}`);
      expect(t({ jenisPerkara: jenis, agenda: "Pencabutan permohonan" })).toMatchObject({ id, kode: "C" });
    });
  }

  it("DK: gugur [G] di 3 Dispensasi Kawin - BAS (cabut [C] sudah ada); tunda panggil Pemohon [T] dan NO [N] tetap di 9b; itsbat tetap peta 946", () => {
    expect(t({ jenisPerkara: "Dispensasi Kawin", akhir: "gugur" })).toMatchObject({ id: "alur-12l", kode: "G" });
    expect(t({ jenisPerkara: "Dispensasi Kawin", akhir: "cabut" })).toMatchObject({ id: "alur-12l", kode: "C" });
    for (const j of ["Perwalian", "Wali Adhol", "Asal Usul Anak", "Dispensasi Kawin"]) {
      expect(t({ jenisPerkara: j, dihadiriOleh: 4 })).toMatchObject({ id: "alur-15", kode: "T" });
      expect(t({ jenisPerkara: j, akhir: "no" })).toMatchObject({ id: "alur-15", kode: "N" });
    }
    expect(t({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", akhir: "gugur" }).h).toBeNull();
    expect(t({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", akhir: "cabut" }).h).toBeNull();
    expect(t({ jenisPerkara: "P3HP/Penetapan Ahli Waris", akhir: "no" })).toMatchObject({ id: "alur-14", kode: "NO" });
  });
});

describe("D. cerai kumulasi itsbat (ALUR 36, 1c)", () => {
  const cg = { jenisPerkara: "Cerai Gugat", nomorPerkara: "337/Pdt.G/2026/PA.Dgl", kumulasi: KUM("itsbat-nikah") };
  const ct = { ...cg, jenisPerkara: "Cerai Talak" };

  it("Tergugat HADIR: sidang 1-9 -> H1-H9 (saksi 3/4/5 ke sidang pembuktian yang sama); CG dan CT sama", () => {
    for (const dasar of [cg, ct]) {
      expect(t({ ...dasar, urutanSidang: 1, dihadiriOleh: 1 })).toMatchObject({ id: "alur-36", kode: "H1" });
      expect(t({ ...dasar, urutanSidang: 3, dihadiriOleh: 1, agenda: "Jawaban Tergugat" })).toMatchObject({ id: "alur-36", kode: "H3" });
      expect(t({ ...dasar, urutanSidang: 4, dihadiriOleh: 1, agenda: "Replik" })).toMatchObject({ id: "alur-36", kode: "H4" });
      expect(t({ ...dasar, urutanSidang: 5, dihadiriOleh: 1, agenda: "Duplik" })).toMatchObject({ id: "alur-36", kode: "H5" });
      expect(t({ ...dasar, urutanSidang: 6, dihadiriOleh: 1, agenda: "Pembuktian Penggugat" })).toMatchObject({ id: "alur-36", kode: "H6" });
      expect(t({ ...dasar, urutanSidang: 7, dihadiriOleh: 1, agenda: "Pembuktian Tergugat" })).toMatchObject({ id: "alur-36", kode: "H7" });
      expect(t({ ...dasar, urutanSidang: 8, dihadiriOleh: 1, agenda: "Kesimpulan" })).toMatchObject({ id: "alur-36", kode: "H8" });
      expect(t({ ...dasar, urutanSidang: 9, dihadiriOleh: 1, agenda: "Pengucapan putusan" })).toMatchObject({ id: "alur-36", kode: "H9" });
    }
    const h = t({ ...cg, urutanSidang: 1, dihadiriOleh: 1 }).h!;
    expect(h.alur).toMatchObject({ folder: `${A}1c Perceraian Kumulasi Itsbat Nikah - BAS`, menu: { id: 106 } });
    expect(h.sebab).not.toMatch(/verstek/);
    expect(FIX.berkas).toContain(`${h.alur.folder}/${h.langkah.berkas}`);
  });

  it("P & T tidak hadir -> tunda TT; gugur -> G; cabut sidang pertama CA / lanjutan CB; verstek lama tetap S1 / L / P2 / P3", () => {
    expect(t({ ...cg, dihadiriOleh: 4 })).toMatchObject({ id: "alur-36", kode: "TT" });
    expect(t({ ...cg, dihadiriOleh: 4, urutanSidang: 1, akhir: "gugur" })).toMatchObject({ id: "alur-36", kode: "TT" }); // sidang 1: ALUR 07 [1]
    expect(t({ ...cg, dihadiriOleh: 4, urutanSidang: 2, akhir: "gugur" })).toMatchObject({ id: "alur-36", kode: "G" });
    expect(t({ ...ct, dihadiriOleh: 4, urutanSidang: 3, akhir: "gugur" })).toMatchObject({ id: "alur-36", kode: "G" });
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 1, akhir: "cabut" })).toMatchObject({ id: "alur-36", kode: "CA" });
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 2, akhir: "cabut" })).toMatchObject({ id: "alur-36", kode: "CB" });
    expect(t({ ...cg, dihadiriOleh: 2 })).toMatchObject({ id: "alur-36", kode: "S1" });
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 2 })).toMatchObject({ id: "alur-36", kode: "P2" });
    expect(t({ ...cg, urutanSidang: 3, dihadiriOleh: 2, tergugatPernahHadir: false, agenda: "Panggil Tergugat" })).toMatchObject({ id: "alur-36", kode: "L" });
  });

  it("tanpa kumulasi itsbat: cerai biasa tidak berubah (null); NO tanpa langkah 1c tetap null", () => {
    const biasa = { jenisPerkara: "Cerai Gugat", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" };
    expect(t({ ...biasa, dihadiriOleh: 1 }).h).toBeNull();
    expect(t({ ...biasa, dihadiriOleh: 4, akhir: "gugur" }).h).toBeNull();
    expect(t({ ...biasa, kumulasi: KUM("nafkah-anak"), akhir: "cabut" }).h).toBeNull();
    expect(t({ ...cg, akhir: "no", dihadiriOleh: 2 }).h).toBeNull();
  });
});

describe("E. cerai gugat kumulasi hak asuh (ALUR 37, 1d)", () => {
  const cg = { jenisPerkara: "Cerai Gugat", nomorPerkara: "336/Pdt.G/2026/PA.Dgl", kumulasi: KUM("hak-asuh-anak") };

  it("T tidak hadir: sidang 1 T1, lanjutan T2; alamat T salah N1 (NO sidang 1) / N2 (putus NO)", () => {
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 1 })).toMatchObject({ id: "alur-37", kode: "T1" });
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 3, tergugatPernahHadir: false, agenda: "Panggil Tergugat" })).toMatchObject({ id: "alur-37", kode: "T2" });
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 1, akhir: "no" })).toMatchObject({ id: "alur-37", kode: "N1" });
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 2, akhir: "no" })).toMatchObject({ id: "alur-37", kode: "N2" });
    // verstek putus sidang 2: tetap peta lama (945)
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 2 }).h).toBeNull();
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 1 }).h!.alur).toMatchObject({ folder: `${A}1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS`, menu: { id: 132 } });
  });

  it("P & T tidak hadir TT / gugur G; cabut CA / CB; Penggugat tidak hadir lanjutan TP dan NO (SEMA 1/2022)", () => {
    expect(t({ ...cg, dihadiriOleh: 4, urutanSidang: 1 })).toMatchObject({ id: "alur-37", kode: "TT" });
    expect(t({ ...cg, dihadiriOleh: 4, urutanSidang: 2, akhir: "gugur" })).toMatchObject({ id: "alur-37", kode: "G" });
    expect(t({ ...cg, dihadiriOleh: 2, urutanSidang: 1, akhir: "cabut" })).toMatchObject({ id: "alur-37", kode: "CA" });
    expect(t({ ...cg, dihadiriOleh: 1, urutanSidang: 3, akhir: "cabut" })).toMatchObject({ id: "alur-37", kode: "CB" });
    expect(t({ ...cg, dihadiriOleh: 3, urutanSidang: 3 })).toMatchObject({ id: "alur-37", kode: "TP" });
    expect(t({ ...cg, dihadiriOleh: 3, urutanSidang: 3 }).h!.alternatif.map((l) => l.kode)).toEqual(["NO"]);
    expect(t({ ...cg, dihadiriOleh: 3, urutanSidang: 3, akhir: "no" })).toMatchObject({ id: "alur-37", kode: "NO" });
  });

  it("bawaan lama utuh: kontradiktoir 1-9 dan mediasi sebagian 2m; hak asuh kontradiktoir sidang 1 P tidak hadir tidak jadi TP", () => {
    expect(t({ ...cg, urutanSidang: 6, dihadiriOleh: 1, agenda: "Pembuktian Penggugat" })).toMatchObject({ id: "alur-37", kode: "6" });
    expect(t({ ...cg, urutanSidang: 2, dihadiriOleh: 1, agenda: "Mediasi berhasil sebagian hak asuh" })).toMatchObject({ kode: "2m" });
    expect(t({ ...cg, urutanSidang: 1, dihadiriOleh: 3 }).kode).not.toBe("TP");
  });
});

describe("G. tampil di rekomendasi BAS sidang (berkas ada di folder BAS server)", () => {
  it("HB verstek sidang 1; cerai kumulasi itsbat T hadir sidang 3; permohonan perwalian dicabut", () => {
    const bas = (m: Parameters<typeof rekomendasiBlangko>[0]) => rekomendasiBlangko(m).bas;
    const hb = bas({ jenisPerkara: "Harta Bersama", nomorPerkara: "3/Pdt.G/2026/PA.Dgl", urutanSidang: 1, dihadiriOleh: 2 });
    expect(hb[0].berkas).toMatch(/^BAS ALUR 31 HB - Sidang 1 - P Hadir & T Tidak Hadir/);
    expect(hb[0]).toMatchObject({ folder: `${A}4a Harta Bersama - BAS`, menu: "Harta Bersama - BAS" });
    const kum = bas({ jenisPerkara: "Cerai Gugat", nomorPerkara: "337/Pdt.G/2026/PA.Dgl", urutanSidang: 3, dihadiriOleh: 1, agenda: "Jawaban Tergugat", kumulasi: KUM("itsbat-nikah") });
    expect(kum[0].berkas).toMatch(/^BAS ALUR 36 Cerai Kumulasi IN - T Hadir - Sidang 3/);
    expect(kum[0].folder).toBe(`${A}1c Perceraian Kumulasi Itsbat Nikah - BAS`);
    const pw = bas({ jenisPerkara: "Perwalian", nomorPerkara: "5/Pdt.P/2026/PA.Dgl", urutanSidang: 2, dihadiriOleh: 1, sudahPutus: true, statusPutusan: "Dicabut" });
    expect(pw[0].berkas).toMatch(/^BAS ALUR 16 Perwalian - \[C\]/);
    for (const x of [...hb, ...kum, ...pw]) expect(FIX.berkas, x.berkas).toContain(`${x.folder}/${x.berkas}`);
  });
});
