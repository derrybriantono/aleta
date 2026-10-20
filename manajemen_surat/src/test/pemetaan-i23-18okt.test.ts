// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET NAFKAH ANAK (I23, 18 Okt): abt-nafkah-anak-derry (56 berkas, menu 165/166, jenis SIPP 743) dan abt-nafkah-anak-kumulasi-derry (sunting 1d)
 * ============================================================================
 *
 * Folder BARU "6c Nafkah Anak" (15 putusan) + "6c Nafkah Anak - BAS" (9 ALUR 46 + 29 salinan ALUR 04-09 = 38), 3 varian hak asuh + nafkah anak di 6a.
 * Yang dijaga: (A) pohon + menu; (B) keadaan; (C) putusan per keadaan; (D) BAS ALUR 46 + salinan; (E) jenis 743 dikenali di semua tabel jenis ALETA
 * (sebutan pihak, id jenis SIPP, folder tugas, kumulasi); (F) TS = panel-alat.js; (G) isian 9740-9750.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import { ALUR_BAS_BARU, jenisBasBaru, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { KUNCI_BAKU, JENIS_BAS_BAKU } from "@/lib/pemetaan-blangko";
import { SET_BLANGKO } from "@/lib/pohon-blangko";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, masukanRekomendasiDariBaris, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";
import { MENU_FOLDER_JENIS, SALINAN_BAS_JENIS } from "@/lib/salinan-bas-jenis-data";
import { folderJenisCocok } from "@/lib/salinan-bas-jenis";
import { jenisPerkaraDariFolder } from "@/lib/tugas-blangko";
import { ID_JENIS_PERKARA_SIPP, idJenisPerkaraSipp } from "@/server/modules/aleta-ecourt/bas-tanya-jawab";
import { susunIsian } from "@/app/api/aleta-ecourt/blangko-derry/susun";

import { muatPanelAlat, pilihDariPanel } from "./panel-alat-vm";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as {
  berkas: string[];
  menu: Array<{ id: number; nama: string; nama_alias: string; direktori: string; perkara_id_min?: string; perkara_id_max?: string; user_grup_id?: string }>;
};
const A = "derry_briantono/";
const NF = "6c Nafkah Anak";
const NF_BAS = "6c Nafkah Anak - BAS";
const JENIS = "Nafkah Anak Pasca Perceraian";
const P = { jenisPerkara: JENIS, nomorPerkara: "7/Pdt.G/2026/PA.Dgl" };
const nama = (x: string) => x.replace(/\.rtf$/, "");

const PUTUSAN_6C = [
  "[01] [Kabul] Nafkah Anak - Kontradiktoir",
  "[01a] [Kabul] Nafkah Anak - T Tidak Hadir Setelah Mediasi",
  "[01b] [Kabul Verstek] Nafkah Anak",
  "[02] [Kabul Sebagian] Nafkah Anak - Kontradiktoir - Petitum Selebihnya Ditolak",
  "[02b] [Kabul Sebagian Verstek] Nafkah Anak - T Tidak Hadir - Petitum Selebihnya Ditolak",
  "[03] [Tolak] Nafkah Anak - Kontradiktoir - Dalil Tidak Terbukti",
  "[03b] [Tolak Verstek] Nafkah Anak - T Tidak Hadir - Dalil Tidak Terbukti",
  "[97] [Perdamaian] Nafkah Anak - Akta Perdamaian",
  "[98] [Cabut] Nafkah Anak - P & T Hadir Sebelum Jawaban",
  "[98a] [Gugur] Nafkah Anak - P Tidak Hadir Sidang Pertama",
  "[98b] [Cabut] Nafkah Anak - Sesudah Jawaban dengan Persetujuan T",
  "[98c] [Coret] Nafkah Anak - Dibatalkan dari Pendaftaran - Panjar Habis",
  "[99] [NO] Nafkah Anak - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)",
  "[99a] [NO] Nafkah Anak - Kurang Pihak (Plurium Litis Consortium)",
  "[99b] [NO] Nafkah Anak - Gugatan Kabur (Obscuur Libel)",
];
const HA_PLUS = [
  "[02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak Belum Mumayyiz",
  "[02a] [Kabul] Hak Asuh dan Nafkah Anak - T Tidak Hadir Setelah Mediasi - Anak Belum Mumayyiz",
  "[02b] [Kabul Verstek] Hak Asuh dan Nafkah Anak - Anak Belum Mumayyiz",
];

const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
  const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
  return r.length ? { berkas: nama(r[0].berkas), folder: r[0].folder.replace(A, ""), menu: r[0].menu, semua: r.map((x) => nama(x.berkas)) } : null;
};

const W3A_PUTUSAN = ["5c Penolakan Perkawinan", "5d Perkawinan Campuran", "3a Izin Kawin", "8a Pengesahan Anak", "1e Kelalaian Kewajiban Suami Istri", "1f Hak Bekas Istri"]; // W3a 21 Okt: dijaga w3a-pemetaan-21okt.test.ts (fixture 17 Okt tidak memuatnya)
describe("A. pohon dan menu", () => {
  it("15 putusan di 6c, 38 BAS di 6c - BAS, 3 varian hak asuh + nafkah di 6a ada di fixture", () => {
    for (const b of PUTUSAN_6C) expect(FIX.berkas, b).toContain(`${A}${NF}/${b}.rtf`);
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${NF}/`))).toHaveLength(15);
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${NF_BAS}/`))).toHaveLength(38);
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${NF_BAS}/BAS ALUR 46 `))).toHaveLength(9);
    for (const b of HA_PLUS) expect(FIX.berkas, b).toContain(`${A}6a Hak Asuh Anak (Hadhanah)/${b}.rtf`);
  });

  it("menu 165 (putusan) dan 166 (BAS): jenis 743-743, grup hak mengikuti pola 133/134", () => {
    const m165 = FIX.menu.find((m) => m.id === 165)!;
    const m166 = FIX.menu.find((m) => m.id === 166)!;
    expect(m165).toMatchObject({ nama: "Putusan Nafkah Anak", nama_alias: "Nafkah Anak - Putusan", direktori: NF, perkara_id_min: "743", perkara_id_max: "743", user_grup_id: "1|10|20" });
    expect(m166).toMatchObject({ nama: "Nafkah Anak - BAS", nama_alias: "Nafkah Anak - BAS", direktori: NF_BAS, perkara_id_min: "743", perkara_id_max: "743", user_grup_id: "1|30|500|430|1000|1010|1020" });
    expect(MENU_FOLDER_JENIS[NF_BAS]).toEqual({ id: 166, nama: "Nafkah Anak - BAS", alias: "Nafkah Anak - BAS" });
    expect(FOLDER_MENU_PUTUSAN["Putusan Nafkah Anak"]).toBe(NF);
  });

  it("tiap berkas yang dirujuk peta bawaan (utama atau varian) ada di folder menunya; semua 15 putusan dan 3 varian 6a dijangkau", () => {
    const dijangkau = new Set<string>();
    const tanpa: string[] = [];
    for (const [kunci, b] of Object.entries(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (!folder || W3A_PUTUSAN.includes(folder)) continue;
      const semua = [b.berkas, ...(/^varian: /.test(b.catatan ?? "") ? (b.catatan ?? "").slice(8).split("; ").filter(Boolean) : [])];
      for (const n of semua) {
        dijangkau.add(`${folder}/${nama(n)}.rtf`);
        if (!FIX.berkas.includes(`${A}${folder}/${nama(n)}.rtf`)) tanpa.push(`${kunci} -> ${folder}/${n}`);
      }
    }
    expect(tanpa).toEqual([]);
    expect(PUTUSAN_6C.filter((b) => !dijangkau.has(`${NF}/${b}.rtf`))).toEqual([]);
    expect(HA_PLUS.filter((b) => !dijangkau.has(`6a Hak Asuh Anak (Hadhanah)/${b}.rtf`))).toEqual([]);
  });

  it("set pohon blangko putusan-nafkah-anak dan baris pemetaan admin memuat jenis 743", () => {
    expect(SET_BLANGKO.find((s) => s.id === "putusan-nafkah-anak")).toMatchObject({ folder: `${A}${NF}`, jenis: "putusan" });
    expect(KUNCI_BAKU.putusan.some((x) => x.kunci === JENIS)).toBe(true);
    expect([...JENIS_BAS_BAKU]).toContain(JENIS);
  });
});

describe("B. keadaan", () => {
  it("nafkah anak (743) dikenali sebagai gugatan: kontradiktoir, verstek, setelah mediasi, sesudah jawaban, kabul sebagian", () => {
    expect(keadaanPutusan({ ...P, dihadiriOleh: 1 })).toContain("kontradiktoir");
    expect(keadaanPutusan({ ...P, dihadiriOleh: 2, verstekPutusan: true })).not.toContain("kontradiktoir");
    expect(keadaanPutusan({ ...P, dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, panggilan: { tergugatPernahHadir: true } })).toContain("t-tidak-hadir-setelah-mediasi");
    expect(keadaanPutusan({ ...P, sesudahJawaban: true })).toContain("sesudah-jawaban");
    expect(keadaanPutusan({ ...P, kurangPihak: true })).toContain("kurang-pihak");
    expect(keadaanPutusan({ ...P, dihadiriOleh: 1, amarPutusan: "Mengabulkan gugatan Penggugat untuk sebagian" })).toContain("dikabulkan-sebagian");
  });

  it("hak asuh + nafkah anak: kode gabungan menurut kehadiran; dari petitum (bot), saklar, atau kumulasi nafkah-anak", () => {
    const ha = { jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.G/2026/PA.Dgl" };
    expect(keadaanPutusan({ ...ha, dihadiriOleh: 1, plusNafkahAnak: true })).toContain("plus-nafkah-anak");
    expect(keadaanPutusan({ ...ha, dihadiriOleh: 2, verstekPutusan: true, plusNafkahAnak: true })).toContain("plus-nafkah-anak-verstek");
    expect(keadaanPutusan({ ...ha, dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, panggilan: { tergugatPernahHadir: true }, plusNafkahAnak: true })).toContain("plus-nafkah-anak-setelah-mediasi");
    expect(keadaanPutusan({ ...ha, dihadiriOleh: 1, kumulasi: { daftar: [{ kode: "nafkah-anak" }] } })).toContain("plus-nafkah-anak");
    expect(keadaanPutusan({ ...ha, dihadiriOleh: 1, plusNafkahAnak: false, kumulasi: { daftar: [{ kode: "nafkah-anak" }] } })).not.toContain("plus-nafkah-anak");
    expect(keadaanPutusan({ ...ha, dihadiriOleh: 1 }).some((x) => x.startsWith("plus-nafkah-anak"))).toBe(false);
    // bukan hak asuh Lain-Lain: tidak ada
    expect(keadaanPutusan({ jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.P/2026/PA.Dgl", plusNafkahAnak: true }).some((x) => x.startsWith("plus-nafkah-anak"))).toBe(false);
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Lain-Lain", plusNafkahAnak: true })).toMatchObject({ plusNafkahAnak: true });
  });
});

describe("C. putusan 6c per keadaan", () => {
  const kasus: Array<[string, Record<string, unknown>, string]> = [
    ["Dikabulkan", {}, PUTUSAN_6C[0]],
    ["Dikabulkan", { dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true }, PUTUSAN_6C[1]],
    ["Dikabulkan", { dihadiriOleh: 2, verstekPutusan: true }, PUTUSAN_6C[2]],
    ["Dikabulkan", { dikabulkanSebagian: true }, PUTUSAN_6C[3]],
    ["Dikabulkan", { dikabulkanSebagian: true, dihadiriOleh: 2, verstekPutusan: true }, PUTUSAN_6C[4]],
    ["Ditolak", {}, PUTUSAN_6C[5]],
    ["Ditolak", { dihadiriOleh: 2, verstekPutusan: true }, PUTUSAN_6C[6]],
    ["Perdamaian", {}, PUTUSAN_6C[7]],
    ["Dicabut", {}, PUTUSAN_6C[8]],
    ["Digugurkan", {}, PUTUSAN_6C[9]],
    ["Gugur", {}, PUTUSAN_6C[9]],
    ["Dicabut", { sesudahJawaban: true }, PUTUSAN_6C[10]],
    ["Dicoret dari Register", {}, PUTUSAN_6C[11]],
    ["Tidak Dapat Diterima", { dihadiriOleh: 4, hadirSebelumnya: 4, penggugatPernahHadir: true }, PUTUSAN_6C[12]],
    ["Tidak Dapat Diterima", { kurangPihak: true }, PUTUSAN_6C[13]],
    ["Tidak Dapat Diterima", { cacatFormil: true }, PUTUSAN_6C[14]],
  ];
  for (const [status, tambahan, berkas] of kasus) {
    it(`${status} ${JSON.stringify(tambahan).slice(0, 60)} -> ${berkas.slice(0, 40)}`, () => {
      const h = put({ ...P, statusPutusan: status, ...tambahan } as Parameters<typeof rekomendasiBlangko>[0])!;
      expect(h, status).toMatchObject({ berkas, folder: NF, menu: "Putusan Nafkah Anak" });
    });
  }

  it("hak asuh + nafkah anak di 6a: [02] / [02a] / [02b]; tanpa penanda tetap [01] hak asuh", () => {
    const ha = { jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.G/2026/PA.Dgl", statusPutusan: "Dikabulkan" };
    expect(put({ ...ha, plusNafkahAnak: true })).toMatchObject({ berkas: HA_PLUS[0], folder: "6a Hak Asuh Anak (Hadhanah)" });
    expect(put({ ...ha, plusNafkahAnak: true, dihadiriOleh: 2, verstekPutusan: true })!.berkas).toBe(HA_PLUS[2]);
    expect(put({ ...ha, plusNafkahAnak: true, dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true })!.berkas).toBe(HA_PLUS[1]);
    expect(put({ ...ha })!.berkas).toMatch(/^\[01\] \[Kabul\]/);
  });

  it("bawaan jenis lain tidak terpengaruh: penguasaan anak dan hak asuh kabul sebagian tanpa baris sendiri tetap kabul biasa", () => {
    expect(put({ jenisPerkara: "Penguasaan Anak", nomorPerkara: "7/Pdt.G/2026/PA.Dgl", statusPutusan: "Dikabulkan" })!.folder).toBe("6b Penguasaan Anak");
    expect(put({ jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.G/2026/PA.Dgl", statusPutusan: "Dikabulkan", dikabulkanSebagian: true })!.folder).toBe("6a Hak Asuh Anak (Hadhanah)");
  });
});

describe("D. BAS ALUR 46 dan salinan", () => {
  const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]> = {}) => {
    const h = tentukanBasBaru({ jenisPerkara: JENIS, nomorPerkara: "7/Pdt.G/2026/PA.Dgl", urutanSidang: 1, dihadiriOleh: 1, ...m });
    return { h, id: h?.alur.id ?? null, kode: h?.langkah.kode ?? null };
  };

  it("jenisBasBaru mengenali nafkah anak; ALUR 46 = 9 berkas di 6c - BAS server (dua arah), menu 166, jenis 743", () => {
    expect(jenisBasBaru(JENIS, "7/Pdt.G/2026/PA.Dgl")).toBe("nafkah-anak");
    expect(jenisBasBaru("Nafkah Anak")).toBe("nafkah-anak");
    const alur = ALUR_BAS_BARU.find((a) => a.id === "alur-46")!;
    expect(alur).toMatchObject({ nomor: 46, folder: `${A}${NF_BAS}`, jenisMin: 743, jenisMaks: 743, menu: { id: 166, nama: "Nafkah Anak - BAS", alias: "Nafkah Anak - BAS" } });
    expect(alur.langkah.map((l) => l.kode)).toEqual(["V1", "V2", "V2S", "AP", "GD", "N", "T", "CS", "CM"]);
    const diServer = FIX.berkas.filter((x) => x.startsWith(`${A}${NF_BAS}/BAS ALUR 46 `));
    expect(alur.langkah.map((l) => `${alur.folder}/${l.berkas}`).sort()).toEqual([...diServer].sort());
  });

  it("pemilihan: verstek V1 / V2, damai AP, cabut mediasi GD, P tidak hadir T, NO N, cabut sesudah jawaban CS / CM", () => {
    expect(t({ dihadiriOleh: 2 })).toMatchObject({ id: "alur-46", kode: "V1" });
    expect(t({ dihadiriOleh: 2, urutanSidang: 2 })).toMatchObject({ id: "alur-46", kode: "V2" });
    expect(t({ dihadiriOleh: 2, urutanSidang: 2 }).h!.alternatif.map((l) => l.kode)).toContain("V2S");
    expect(t({ urutanSidang: 2, agenda: "Mediasi berhasil" })).toMatchObject({ id: "alur-46", kode: "AP" });
    expect(t({ urutanSidang: 2, akhir: "cabut" })).toMatchObject({ id: "alur-46", kode: "GD" });
    expect(t({ dihadiriOleh: 3, urutanSidang: 3 })).toMatchObject({ id: "alur-46", kode: "T" });
    expect(t({ akhir: "no", dihadiriOleh: 4, urutanSidang: 3 })).toMatchObject({ id: "alur-46", kode: "N" });
    expect(t({ akhir: "cabut", sudahJawaban: true, urutanSidang: 4 })).toMatchObject({ id: "alur-46", kode: "CS" });
    expect(t({ sudahJawaban: true, sikapTergugatCabut: "menolak", urutanSidang: 4 })).toMatchObject({ id: "alur-46", kode: "CM" });
  });

  it("sidang kontradiktoir memakai salinan ALUR 04-09 di 6c - BAS; 29 salinan terdaftar", () => {
    const h = t({ urutanSidang: 3, agenda: "Pembuktian Penggugat" }).h!;
    expect(h.alur.folder).toBe(`${A}${NF_BAS}`);
    expect(FIX.berkas).toContain(`${h.alur.folder}/${h.langkah.berkas}`);
    let salinan = 0;
    for (const isi of Object.values(SALINAN_BAS_JENIS)) for (const tujuan of Object.values(isi)) if (tujuan.includes(NF_BAS)) salinan++;
    expect(salinan).toBe(29);
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${NF_BAS}/BAS ALUR 0`))).toHaveLength(29);
  });
});

describe("E. jenis 743 dikenali di tabel jenis ALETA", () => {
  it("sebutan pihak: gugatan (Penggugat/Tergugat) menurut id, alur 15 dan nama; alur 16 mengikuti kueri ABT", () => {
    expect(sebutanPihakPerkara({ jenisPerkaraId: 743, alurPerkaraId: 15, jenisPerkaraNama: JENIS })).toMatchObject({ satu: "Penggugat", dua: "Tergugat" });
    expect(sebutanPihakPerkara({ jenisPerkaraNama: JENIS })).toMatchObject({ satu: "Penggugat", dua: "Tergugat", sumber: "kata" });
    expect(sebutanPihakPerkara({ jenisPerkaraId: 743, nomorPerkara: "7/Pdt.G/2026/PA.Dgl" })).toMatchObject({ satu: "Penggugat", dua: "Tergugat" });
    expect(sebutanPihakPerkara({ jenisPerkaraId: 743, alurPerkaraId: 16 })).toMatchObject({ satu: "Pemohon", dua: "Termohon" });
  });

  it("id jenis SIPP 743 sama di portal dan ekstensi (abt.js) dan bot (pertanyaanSaksiService)", () => {
    expect(ID_JENIS_PERKARA_SIPP["nafkah anak pasca perceraian"]).toBe("743");
    expect(idJenisPerkaraSipp("Nafkah Anak Pasca Perceraian")).toBe("743");
    const abt = readFileSync(path.resolve(__dirname, "../../../ekstensi-sipp/abt.js"), "utf8");
    expect(abt).toMatch(/const ID_JENIS_PERKARA_SIPP = Object\.freeze\(\{[\s\S]*?"nafkah anak pasca perceraian": "743"[\s\S]*?\}\);/);
    const bot = readFileSync(path.resolve(__dirname, "../../../aleta_bot/services/pertanyaanSaksiService.js"), "utf8");
    expect(bot).toMatch(/"nafkah anak pasca perceraian": "743"/);
  });

  it("folder 6c dikenali menurut jenis (tugas folder) dan cocok untuk perkara 743 saja", () => {
    expect(jenisPerkaraDariFolder(`${A}${NF}`).untuk).toContain("nafkah");
    expect(folderJenisCocok(`${A}${NF_BAS}`, JENIS)).toBe(true);
    expect(folderJenisCocok(`${A}${NF_BAS}`, "Cerai Gugat")).toBe(false);
    expect(folderJenisCocok(`${A}6b Penguasaan Anak - BAS`, JENIS)).toBe(false);
  });

  const kumulasiPath = path.resolve(__dirname, "../../../aleta_bot/services/kumulasiPerkaraService.js");
  it.skipIf(!existsSync(kumulasiPath))("kumulasi: jenis SIPP 743 = kode nafkah-anak", () => {
    const req = createRequire(kumulasiPath);
    const svc = req(kumulasiPath) as { satukanKumulasi: (m: { jenisPerkaraId: number; sipp: Array<{ jenisPerkaraId: number; nama: string }>; petitum?: string }) => { daftar: Array<{ kode: string }> } | null };
    const hasil = svc.satukanKumulasi({ jenisPerkaraId: 347, sipp: [{ jenisPerkaraId: 743, nama: "Nafkah Anak Pasca Perceraian" }], petitum: "" });
    expect(hasil?.daftar.map((x) => x.kode)).toContain("nafkah-anak");
  });
});

describe("F. TS = panel-alat.js", () => {
  it("pilihPutusanBawaan sama dengan alatPetaUntukPerkara untuk nafkah anak dan hak asuh + nafkah", () => {
    const panel = muatPanelAlat();
    const kasus: Array<[string, string, boolean, string[]]> = [
      [JENIS, "Dikabulkan", false, ["kontradiktoir"]],
      [JENIS, "Dikabulkan", true, ["dikabulkan-sebagian"]],
      [JENIS, "Dikabulkan", false, ["dikabulkan-sebagian", "kontradiktoir"]],
      [JENIS, "Dikabulkan", false, ["t-tidak-hadir-setelah-mediasi", "sesudah-mediasi"]],
      [JENIS, "Dicabut", false, ["sesudah-jawaban"]],
      [JENIS, "Tidak Dapat Diterima", false, ["kurang-pihak"]],
      [JENIS, "Tidak Dapat Diterima", false, []],
      [JENIS, "Ditolak", true, []],
      ["Lain-Lain", "Dikabulkan", false, ["plus-nafkah-anak", "hak-asuh"]],
      ["Lain-Lain", "Dikabulkan", true, ["plus-nafkah-anak-verstek", "hak-asuh-verstek", "hak-asuh"]],
      ["Lain-Lain", "Dikabulkan", false, ["plus-nafkah-anak-setelah-mediasi", "t-tidak-hadir-setelah-mediasi", "hak-asuh"]],
    ];
    for (const [j, s, v, kd] of kasus) {
      const ts = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, null, kd);
      expect(ts ? { kunci: ts.kunci, tingkat: ts.tingkat } : null, `${j} ${s} ${v} ${kd}`).toEqual(pilihDariPanel(panel, j, s, v, null, kd));
    }
  });
});

describe("G. isian 9740-9750 (label awam, tanpa label teknis)", () => {
  it("label awam bernomor 9740-9750; 9751-9759 otomatis tak punya label; saklar penyerahan anak 9720 berpilihan Ya / Tidak", () => {
    const D = (kode: string, nm: string, jenis = "data_teks") => ({ kode, nama: nm, jenis, sql: "", bawaan: "" });
    const katalog = new Map(
      [
        D("9740", "NAFKAH ANAK: JUMLAH PER BULAN"),
        D("9745", "NAFKAH ANAK: PEMOTONGAN LANGSUNG - INSTANSI"),
        D("9720", "PENGUASAAN ANAK: PETITUM MENINTA PENYERAHAN ANAK - SAKLAR (1 = ada, 0 atau kosong = tidak ada, 2 = ditetapkan ex officio)"),
        D("9751", "NAFKAH ANAK: KALIMAT NAFKAH KE DEPAN (OTOMATIS)", "data_sql"),
      ].map((d) => [d.kode, d])
    );
    const s = susunIsian(["9740", "9745", "9720", "9751"], katalog);
    const peta = Object.fromEntries(s.isian.map((i) => [i.kode, i]));
    expect(peta["9740"].nama).toBe("Nafkah anak ke depan: jumlah setiap bulan (rupiah, angka saja; kosong = tidak dituntut)");
    expect(peta["9745"].nama).toMatch(/^Pemotongan langsung dari penghasilan Tergugat\/Termohon/);
    expect(peta["9720"].nama).toBe("Apakah gugatan meminta Tergugat/Termohon menyerahkan anak?");
    expect(peta["9720"].opsi).toEqual([
      { nilai: "1", label: "Ya, diminta dalam gugatan" },
      { nilai: "0", label: "Tidak diminta" },
      { nilai: "2", label: "Tidak diminta, tetapi ditetapkan oleh Hakim karena jabatannya (Buku II 2026)" },
    ]);
    expect(peta["9751"]).toBeUndefined();
    expect(s.otomatis.map((o) => o.kode)).toContain("9751");
  });
});
