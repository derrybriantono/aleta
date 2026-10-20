// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET PUTUSAN JAWABAN & EKSEPSI (I19, 18 Okt): abt-putusan-eksepsi-cabut-derry (11), abt-putusan-sela-eksepsi-derry (8),
 * abt-putusan-itsbat-tolak-derry (3)
 * ============================================================================
 *
 * Paket (BELUM terpasang di server; 22 berkas baru di folder yang sudah ada, tanpa menu/folder baru). Yang dijaga:
 *   (A) pohon: 22 berkas ada di fixture; tiap berkas DIJANGKAU peta bawaan (pilihan utama atau "varian") di folder menunya;
 *   (B) keadaan baru di lib/keadaan-putusan.ts: cabut-ditolak-t, eksepsi kewenangan (dikabulkan / putusan sela), alasan itsbat - hanya dari penanda tegas;
 *   (C) pemilihan blangko: cerai, HB, kewarisan, itsbat; putusan sela berstatus "Putusan Sela";
 *   (D) bawaan lama tidak berubah; (E) TS = panel-alat.js.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

import { muatPanelAlat, pilihDariPanel } from "./panel-alat-vm";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/";
/** 22 berkas paket (folder/nama.rtf) menurut i19-putusan-jawaban-18okt/PEMETAAN-ALETA.md. */
const BARU_I19 = [
  "1 Perceraian CG/[02c] [Kabul] CG - F - Pencabutan Ditolak T Sesudah Jawaban.rtf",
  "1 Perceraian CG/[99c] [NO] CG - Eksepsi Kewenangan Absolut Dikabulkan.rtf",
  "1 Perceraian CG/[99d] [NO] CG - Eksepsi Kewenangan Relatif Dikabulkan.rtf",
  "1a Perceraian CT/[02c] [Kabul] CT - F - Pencabutan Ditolak T Sesudah Jawaban.rtf",
  "1a Perceraian CT/[99c] [NO] CT - Eksepsi Kewenangan Absolut Dikabulkan.rtf",
  "1a Perceraian CT/[99d] [NO] CT - Eksepsi Kewenangan Relatif Dikabulkan.rtf",
  "4a Harta Bersama/[99c] [NO] HB - Eksepsi Kewenangan Absolut Dikabulkan.rtf",
  "4a Harta Bersama/[99d] [NO] HB - Eksepsi Kewenangan Relatif Dikabulkan.rtf",
  "4b Kewarisan/[99c] [NO] Kewarisan - Eksepsi Kewenangan Absolut Dikabulkan.rtf",
  "4b Kewarisan/[99d] [NO] Kewarisan - Eksepsi Kewenangan Relatif Dikabulkan.rtf",
  "4b Kewarisan/[01c] [Kabul] Kewarisan - Kontradiktoir - Pencabutan Ditolak T Sesudah Jawaban.rtf",
  "1 Perceraian CG/[98e] [Sela] CG - Eksepsi Kewenangan Absolut Ditolak.rtf",
  "1 Perceraian CG/[98f] [Sela] CG - Eksepsi Kewenangan Relatif Ditolak.rtf",
  "1a Perceraian CT/[98e] [Sela] CT - Eksepsi Kewenangan Absolut Ditolak.rtf",
  "1a Perceraian CT/[98f] [Sela] CT - Eksepsi Kewenangan Relatif Ditolak.rtf",
  "4a Harta Bersama/[98e] [Sela] HB - Eksepsi Kewenangan Absolut Ditolak.rtf",
  "4a Harta Bersama/[98f] [Sela] HB - Eksepsi Kewenangan Relatif Ditolak.rtf",
  "4b Kewarisan/[98e] [Sela] Kewarisan - Eksepsi Kewenangan Absolut Ditolak.rtf",
  "4b Kewarisan/[98f] [Sela] Kewarisan - Eksepsi Kewenangan Relatif Ditolak.rtf",
  "2 Itsbat Nikah/[03c] [Tolak] IN - Alternatif Tolak - Salah Satu Pihak Masih Terikat Perkawinan Lain.rtf",
  "2 Itsbat Nikah/[99c] [NO] IN - Poligami Sirri atau Masih Terikat Perkawinan Lain (SEMA 3 2018, Buku II 2026).rtf",
  "2 Itsbat Nikah/[99d] [NO] IN - Pernikahan Sesudah 2019 Tidak Dicatatkan Tanpa Alasan Mendesak (UU Adminduk).rtf",
];

const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
  const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
  return r.length ? { berkas: r[0].berkas.replace(/\.rtf$/, ""), folder: r[0].folder.replace(A, ""), semua: r.map((x) => x.berkas.replace(/\.rtf$/, "")) } : null;
};
const nama = (x: string) => x.replace(/\.rtf$/, "");
const CG = { jenisPerkara: "Cerai Gugat", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" };
const CT = { jenisPerkara: "Cerai Talak", nomorPerkara: "6/Pdt.G/2026/PA.Dgl" };
const HB = { jenisPerkara: "Harta Bersama", nomorPerkara: "7/Pdt.G/2026/PA.Dgl" };
const WARIS = { jenisPerkara: "Kewarisan", nomorPerkara: "8/Pdt.G/2026/PA.Dgl" };
const IN = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "9/Pdt.P/2026/PA.Dgl" };

const W3A_PUTUSAN = ["5c Penolakan Perkawinan", "5d Perkawinan Campuran", "3a Izin Kawin", "8a Pengesahan Anak", "1e Kelalaian Kewajiban Suami Istri", "1f Hak Bekas Istri"]; // W3a 21 Okt: dijaga w3a-pemetaan-21okt.test.ts (fixture 17 Okt tidak memuatnya)
describe("A. pohon: 22 berkas paket ada di fixture dan dijangkau peta bawaan", () => {
  it("22 berkas baru paket (11 + 8 + 3) ada di fixture server", () => {
    expect(new Set(BARU_I19).size).toBe(22);
    expect(BARU_I19.filter((b) => !FIX.berkas.includes(`${A}${b}`))).toEqual([]);
  });

  it("tiap berkas yang dirujuk peta bawaan (utama atau varian) ADA di folder menunya", () => {
    const tanpa: string[] = [];
    for (const [kunci, b] of Object.entries(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (!folder || W3A_PUTUSAN.includes(folder)) continue;
      const semua = [b.berkas, ...(/^varian: /.test(b.catatan ?? "") ? (b.catatan ?? "").slice(8).split("; ").filter(Boolean) : [])];
      for (const n of semua) if (!FIX.berkas.includes(`${A}${folder}/${nama(n)}.rtf`)) tanpa.push(`${kunci} -> ${folder}/${n}`);
    }
    expect(tanpa).toEqual([]);
  });

  it("tiap dari 22 berkas paket DIJANGKAU: pilihan utama suatu baris peta atau varian yang disebut baris dasarnya", () => {
    const dijangkau = new Set<string>();
    for (const b of Object.values(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (!folder) continue;
      dijangkau.add(`${folder}/${nama(b.berkas)}.rtf`);
      if (/^varian: /.test(b.catatan ?? "")) for (const v of (b.catatan ?? "").slice(8).split("; ").filter(Boolean)) dijangkau.add(`${folder}/${nama(v)}.rtf`);
    }
    expect(BARU_I19.filter((b) => !dijangkau.has(b))).toEqual([]);
  });
});

describe("B. keadaan putusan baru (hanya dari penanda tegas; tidak ditebak)", () => {
  it("pencabutan ditolak T: cabut-ditolak-t mendahului sesudah-jawaban; tanpa penanda tidak ada", () => {
    const k = keadaanPutusan({ ...CG, dihadiriOleh: 1, cabutDitolakT: true });
    expect(k.slice(0, 2)).toEqual(["cabut-ditolak-t", "sesudah-jawaban"]);
    expect(keadaanPutusan({ ...CG, dihadiriOleh: 1 })).not.toContain("cabut-ditolak-t");
    expect(keadaanPutusan({ ...CG, dihadiriOleh: 1, cabutDitolakT: "ya" })).not.toContain("cabut-ditolak-t");
  });

  it("eksepsi kewenangan: dikabulkan tanpa putusan sela; ditolak bila putusan sela; nilai lain diabaikan", () => {
    expect(keadaanPutusan({ ...CG, eksepsiKewenangan: "absolut" })).toContain("eksepsi-absolut-dikabulkan");
    expect(keadaanPutusan({ ...CG, eksepsiKewenangan: "Relatif" })).toContain("eksepsi-relatif-dikabulkan");
    expect(keadaanPutusan({ ...HB, eksepsiKewenangan: "absolut", putusanSela: true })).toContain("eksepsi-absolut-ditolak-putusan-sela");
    expect(keadaanPutusan({ ...WARIS, eksepsiKewenangan: "relatif", putusanSela: true })).toContain("eksepsi-relatif-ditolak-putusan-sela");
    expect(keadaanPutusan({ ...CG, eksepsiKewenangan: "lain" }).some((x) => x.startsWith("eksepsi-"))).toBe(false);
    expect(keadaanPutusan({ ...CG, putusanSela: true }).some((x) => x.startsWith("eksepsi-"))).toBe(false);
  });

  it("alasan itsbat hanya untuk permohonan itsbat (bukan kontensius, bukan cerai)", () => {
    expect(keadaanPutusan({ ...IN, alasanItsbat: "poligami-sirri-atau-terikat" })).toContain("poligami-sirri-atau-terikat");
    expect(keadaanPutusan({ ...IN, alasanItsbat: "nikah-sesudah-2019-tidak-dicatat" })).toContain("nikah-sesudah-2019-tidak-dicatat");
    expect(keadaanPutusan({ ...IN, alasanItsbat: "terikat-perkawinan-lain" })).toContain("terikat-perkawinan-lain");
    expect(keadaanPutusan({ ...IN, nomorPerkara: "9/Pdt.G/2026/PA.Dgl", alasanItsbat: "poligami-sirri-atau-terikat" })).not.toContain("poligami-sirri-atau-terikat");
    expect(keadaanPutusan({ ...CG, alasanItsbat: "poligami-sirri-atau-terikat" })).not.toContain("poligami-sirri-atau-terikat");
    expect(keadaanPutusan({ ...IN, alasanItsbat: "ngawur" })).toEqual(keadaanPutusan(IN));
  });
});

describe("C. pemilihan blangko dengan penanda", () => {
  it("cabut ditolak T sesudah jawaban: CG/CT [02c], kewarisan [01c]; HB tidak punya (tetap bawaan)", () => {
    expect(put({ ...CG, statusPutusan: "Dikabulkan", cabutDitolakT: true })).toMatchObject({ berkas: "[02c] [Kabul] CG - F - Pencabutan Ditolak T Sesudah Jawaban", folder: "1 Perceraian CG" });
    expect(put({ ...CT, statusPutusan: "Dikabulkan", cabutDitolakT: true })).toMatchObject({ berkas: "[02c] [Kabul] CT - F - Pencabutan Ditolak T Sesudah Jawaban", folder: "1a Perceraian CT" });
    expect(put({ ...WARIS, statusPutusan: "Dikabulkan", cabutDitolakT: true })).toMatchObject({ berkas: "[01c] [Kabul] Kewarisan - Kontradiktoir - Pencabutan Ditolak T Sesudah Jawaban", folder: "4b Kewarisan" });
    expect(put({ ...HB, statusPutusan: "Dikabulkan", cabutDitolakT: true })!.berkas).toMatch(/^\[01\] \[Kabul\] \[E-Court\] HB/);
  });

  const folderDari: Record<string, string> = { CG: "1 Perceraian CG", CT: "1a Perceraian CT", HB: "4a Harta Bersama", Kewarisan: "4b Kewarisan" };
  const dasar: Array<[string, { jenisPerkara: string; nomorPerkara: string }, string]> = [
    ["CG", CG, "CG"],
    ["CT", CT, "CT"],
    ["HB", HB, "HB"],
    ["Kewarisan", WARIS, "Kewarisan"],
  ];
  for (const [kode, perkara, singkat] of dasar) {
    it(`${kode}: eksepsi kewenangan dikabulkan -> NO [99c] absolut / [99d] relatif`, () => {
      expect(put({ ...perkara, statusPutusan: "Tidak Dapat Diterima", eksepsiKewenangan: "absolut" })).toMatchObject({ berkas: `[99c] [NO] ${singkat} - Eksepsi Kewenangan Absolut Dikabulkan`, folder: folderDari[kode] });
      expect(put({ ...perkara, statusPutusan: "Tidak Dapat Diterima", eksepsiKewenangan: "relatif" })).toMatchObject({ berkas: `[99d] [NO] ${singkat} - Eksepsi Kewenangan Relatif Dikabulkan`, folder: folderDari[kode] });
    });
    it(`${kode}: putusan sela eksepsi ditolak (belum putus, status "Putusan Sela") -> [98e] absolut / [98f] relatif`, () => {
      expect(put({ ...perkara, sudahPutus: false, eksepsiKewenangan: "absolut", putusanSela: true })).toMatchObject({ berkas: `[98e] [Sela] ${singkat} - Eksepsi Kewenangan Absolut Ditolak`, folder: folderDari[kode] });
      expect(put({ ...perkara, sudahPutus: false, eksepsiKewenangan: "relatif", putusanSela: true })).toMatchObject({ berkas: `[98f] [Sela] ${singkat} - Eksepsi Kewenangan Relatif Ditolak`, folder: folderDari[kode] });
    });
  }

  it("putusan sela tanpa penanda eksepsi tidak mengusulkan apa pun; NO tanpa eksepsi tetap bawaan", () => {
    expect(put({ ...CG, sudahPutus: false, putusanSela: true })).toBeNull();
    expect(put({ ...HB, statusPutusan: "Tidak Dapat Diterima" })!.berkas).toMatch(/^\[99\] \[NO\] HB/);
  });

  it("itsbat nikah permohonan: tolak alternatif [03c], NO poligami sirri [99c], NO nikah sesudah 2019 [99d]", () => {
    expect(put({ ...IN, statusPutusan: "Ditolak", alasanItsbat: "terikat-perkawinan-lain" })).toMatchObject({
      berkas: "[03c] [Tolak] IN - Alternatif Tolak - Salah Satu Pihak Masih Terikat Perkawinan Lain",
      folder: "2 Itsbat Nikah",
    });
    expect(put({ ...IN, statusPutusan: "Tidak Dapat Diterima", alasanItsbat: "poligami-sirri-atau-terikat" })).toMatchObject({
      berkas: "[99c] [NO] IN - Poligami Sirri atau Masih Terikat Perkawinan Lain (SEMA 3 2018, Buku II 2026)",
      folder: "2 Itsbat Nikah",
    });
    expect(put({ ...IN, statusPutusan: "Tidak Dapat Diterima", alasanItsbat: "nikah-sesudah-2019-tidak-dicatat" })).toMatchObject({
      berkas: "[99d] [NO] IN - Pernikahan Sesudah 2019 Tidak Dicatatkan Tanpa Alasan Mendesak (UU Adminduk)",
      folder: "2 Itsbat Nikah",
    });
  });

  it("bawaan lama tidak berubah: itsbat tolak/NO tanpa alasan, CG NO dan cabut, kabul CG", () => {
    expect(put({ ...IN, statusPutusan: "Ditolak" })!.berkas).toBe("[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah)");
    expect(put({ ...IN, statusPutusan: "Tidak Dapat Diterima" })!.berkas).toBe("[99] [NO] IN - Dibawah Umur");
    expect(put({ ...CG, statusPutusan: "Dikabulkan" })!.berkas).toBe("[02] [Kabul] CG - F");
    expect(put({ ...CG, statusPutusan: "Dicabut", sesudahJawaban: true })!.berkas).toBe("[98] [Cabut] 7. Cerai P & T Hadir - Sesudah Jawaban dengan Persetujuan T");
  });

  it("baris dasar menyebut berkas baru sebagai varian (dipilih manual)", () => {
    const v = (k: string) => String(PETA_PUTUSAN_BAWAAN[k]?.catatan ?? "");
    expect(v("itsbat nikah|ditolak")).toContain("[03c] [Tolak] IN - Alternatif Tolak");
    expect(v("itsbat nikah|tidak dapat diterima")).toContain("[99d] [NO] IN - Pernikahan Sesudah 2019");
    expect(v("cerai gugat|tidak dapat diterima")).toContain("[99c] [NO] CG - Eksepsi Kewenangan Absolut Dikabulkan");
    expect(v("harta bersama|tidak dapat diterima")).toContain("[99d] [NO] HB - Eksepsi Kewenangan Relatif Dikabulkan");
  });
});

describe("E. TS = panel-alat.js (alatPetaUntukPerkara) untuk kunci keadaan baru", () => {
  it("pilihPutusanBawaan sama dengan alatPetaUntukPerkara", () => {
    const panel = muatPanelAlat();
    const kasus: Array<[string, string, boolean, string[]]> = [
      ["Cerai Gugat", "Dikabulkan", false, ["cabut-ditolak-t", "sesudah-jawaban", "kontradiktoir"]],
      ["Cerai Talak", "Dikabulkan", false, ["cabut-ditolak-t", "sesudah-jawaban"]],
      ["Kewarisan", "Dikabulkan", false, ["cabut-ditolak-t", "sesudah-jawaban", "kontradiktoir"]],
      ["Cerai Gugat", "Tidak Dapat Diterima", false, ["eksepsi-absolut-dikabulkan"]],
      ["Harta Bersama", "Tidak Dapat Diterima", false, ["eksepsi-relatif-dikabulkan"]],
      ["Harta Bersama", "Putusan Sela", false, ["eksepsi-absolut-ditolak-putusan-sela"]],
      ["Kewarisan", "Putusan Sela", false, ["eksepsi-relatif-ditolak-putusan-sela"]],
      ["Pengesahan Perkawinan/Istbat Nikah", "Ditolak", false, ["terikat-perkawinan-lain"]],
      ["Pengesahan Perkawinan/Istbat Nikah", "Tidak Dapat Diterima", false, ["poligami-sirri-atau-terikat"]],
      ["Pengesahan Perkawinan/Istbat Nikah", "Tidak Dapat Diterima", false, ["nikah-sesudah-2019-tidak-dicatat"]],
      ["Pengesahan Perkawinan/Istbat Nikah", "Tidak Dapat Diterima", false, []],
    ];
    for (const [j, s, v, kd] of kasus) {
      const dariTs = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, null, kd);
      expect(dariTs ? { kunci: dariTs.kunci, tingkat: dariTs.tingkat } : null, `${j} ${s} ${kd}`).toEqual(pilihDariPanel(panel, j, s, v, null, kd));
    }
    expect(pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, "Harta Bersama", "Putusan Sela", false, null, ["eksepsi-absolut-ditolak-putusan-sela"])).toMatchObject({
      kunci: "harta bersama|putusan sela|eksepsi-absolut-ditolak-putusan-sela",
      tingkat: "keadaan",
    });
  });
});
