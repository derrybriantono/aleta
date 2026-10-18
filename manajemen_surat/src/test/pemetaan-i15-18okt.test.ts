// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET I15 (18 Okt): abt-penguasaan-anak-derry - PENGUASAAN ANAK (jenis 349) terpisah dari hak asuh
 * ============================================================================
 *
 * Paket (BELUM terpasang di server; keadaan di fixtures/blangko-derry-server-17okt.json dari rtf/ paket + INSERT menu): folder `6b Penguasaan Anak`
 * (10 putusan) dan `6b Penguasaan Anak - BAS` (35 BAS: 29 salinan ALUR 04-09 + 6 ALUR 44), menu 153/154 (jenis_perkara_id 349-349), isian 9590-9593.
 * Hak asuh/hadhanah (6a, menu 133/134, jenis 369 Lain-Lain Pdt.G) TIDAK berubah. Yang dijaga:
 *   (A) pohon: berkas, menu, folder, set;  (B) putusan bawaan per keadaan (6b) dan hak asuh Lain-Lain tetap 6a;
 *   (C) BAS: ALUR 44, salinan 29 di 6b;  (D) label isian 9590/9592 dan langkah konseptor.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { ALUR_BAS_BARU, jenisBasBaru, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { KUNCI_BAKU, JENIS_BAS_BAKU } from "@/lib/pemetaan-blangko";
import { langkahUntukIsian } from "@/lib/konseptor-langkah";
import { SET_BLANGKO, setBlangkoGabung, setUntukPerkara } from "@/lib/pohon-blangko";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";
import { cariBerkasBasJenis, salinanBasJenis } from "@/lib/salinan-bas-jenis";
import { MENU_FOLDER_JENIS, SALINAN_BAS_JENIS } from "@/lib/salinan-bas-jenis-data";
import { folderTugas, jenisDokumenBlangko, tugasBlangko } from "@/lib/tugas-blangko";

type BarisMenu = { id: number; nama: string; nama_alias: string; direktori: string; parent_direktori: string; proses_id_min: number; proses_id_max: number; perkara_id_min?: string; perkara_id_max?: string; perkara_id_referensi?: string; user_cek: number; user_grup_id: string; user_top_id: string };
const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[]; menu: BarisMenu[] };
const A = "derry_briantono/";
const PG = "6b Penguasaan Anak";
const PG_BAS = "6b Penguasaan Anak - BAS";
const HA = "6a Hak Asuh Anak (Hadhanah)";

const B01 = "[01] [Kabul] Penguasaan Anak - Kontradiktoir - Anak Belum Mumayyiz";
const B01A = "[01a] [Kabul] Penguasaan Anak - T Tidak Hadir Setelah Mediasi - Anak Belum Mumayyiz";
const B01B = "[01b] [Kabul Verstek] Penguasaan Anak - Anak Belum Mumayyiz";
const B01C = "[01c] [Kabul] Penguasaan Anak - Kontradiktoir - Anak Mumayyiz Memilih";
const B03 = "[03] [Tolak] Penguasaan Anak - Kontradiktoir - Kepentingan Terbaik Anak Tidak Terbukti";
const B03A = "[03a] [Tolak Verstek] Penguasaan Anak - T Tidak Hadir - Gugatan Tidak Beralasan Hukum";

describe("A. pohon: berkas, menu 153/154, set", () => {
  it("13 putusan di 6b (10 + [02] [02b] [01d] revisi I20) dan 36 BAS + 2 BAS cabut sesudah jawaban di 6b - BAS ada di fixture; hak asuh 6a tidak berkurang", () => {
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${PG}/`))).toHaveLength(13);
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${PG_BAS}/`))).toHaveLength(35 + 1 + 2);
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${PG_BAS}/BAS ALUR 44 `))).toHaveLength(9); // + V2S verstek kabul sebagian, CS, CM (I20 18 Okt)
    expect(FIX.berkas.filter((b) => b.startsWith(`${A}${HA}/`)).length).toBeGreaterThanOrEqual(12);
    for (const b of [B01, B01A, B01B, B01C, B03, B03A]) expect(FIX.berkas, b).toContain(`${A}${PG}/${b}.rtf`);
  });

  it("menu 153 (putusan, hakim) berpasangan dengan 154 (BAS, panitera): acuan jenis_perkara_id 349; menu hak asuh 133/134 tetap 369", () => {
    const m = (id: number) => FIX.menu.find((x) => x.id === id)!;
    expect(m(153)).toMatchObject({ nama: "Putusan Penguasaan Anak", nama_alias: "Penguasaan Anak - Putusan", direktori: PG, parent_direktori: "derry_briantono", perkara_id_min: "349", perkara_id_max: "349", perkara_id_referensi: "jenis_perkara_id", user_cek: 3, user_grup_id: "1|10|20", user_top_id: "1" });
    expect(m(154)).toMatchObject({ nama: "Penguasaan Anak - BAS", direktori: PG_BAS, perkara_id_min: "349", perkara_id_max: "349", perkara_id_referensi: "jenis_perkara_id", user_cek: 3, user_top_id: "1|30" });
    expect(m(154).id).toBe(m(153).id + 1);
    for (const id of [133, 134]) expect(m(id)).toMatchObject({ perkara_id_min: "369", perkara_id_max: "369" });
    expect(FOLDER_MENU_PUTUSAN["Putusan Penguasaan Anak"]).toBe(PG);
    expect(MENU_FOLDER_JENIS[PG_BAS]).toMatchObject({ id: 154, nama: "Penguasaan Anak - BAS" });
  });

  it("tugas folder: 6b putusan = hakim, 6b BAS = panitera; set pohon 6b ada, set hak asuh tidak lagi memuat 'penguasaan anak'", () => {
    expect(folderTugas(PG)).toMatchObject({ jenis: "putusan", untuk: ["penguasaan anak"] });
    expect(folderTugas(PG_BAS)).toMatchObject({ jenis: "bas", untuk: ["penguasaan anak"] });
    expect(tugasBlangko(`${A}${PG}/${B01}.rtf`)).toBe("hakim");
    expect(tugasBlangko(`${A}${PG_BAS}/BAS ALUR 44 Penguasaan Anak - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf`)).toBe("panitera");
    expect(jenisDokumenBlangko(`${A}${PG_BAS}/BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf`)).toBe("bas");
    const s = SET_BLANGKO.find((x) => x.folder === `${A}${PG}`);
    expect(s).toMatchObject({ jenis: "putusan", untuk: ["penguasaan anak"] });
    expect(SET_BLANGKO.find((x) => x.folder === `${A}${HA}`)!.untuk).toEqual(["hak asuh", "hadhanah"]);
    const gabung = setBlangkoGabung(FIX.berkas.map((b) => b.split("/")[1]).filter((v, i, a) => a.indexOf(v) === i));
    expect(gabung.find((x) => x.folder === `${A}${PG_BAS}`)).toMatchObject({ jenis: "bas", untuk: ["penguasaan anak"] });
    expect(gabung.find((x) => x.folder === `${A}${HA} - BAS`)!.untuk).not.toContain("penguasaan anak");
    const cocok = (j: string, n?: string) => setUntukPerkara(j, n).filter((x) => x.cocok && x.jenis === "putusan").map((x) => x.folder.replace(A, ""));
    expect(cocok("Penguasaan Anak")).toContain(PG);
    expect(cocok("Penguasaan Anak")).not.toContain(HA);
    expect(cocok("Lain-Lain", "358/Pdt.G/2020/PA.Dgl")).toContain(HA);
    expect(cocok("Lain-Lain", "358/Pdt.G/2020/PA.Dgl")).not.toContain(PG);
  });

  it("kunci baku Pemetaan blangko: 'Penguasaan Anak' tetap ada (putusan dan BAS)", () => {
    expect(KUNCI_BAKU.putusan.some((k) => k.kunci === "Penguasaan Anak")).toBe(true);
    expect(JENIS_BAS_BAKU as readonly string[]).toContain("Penguasaan Anak");
  });
});

describe("B. putusan bawaan per keadaan (6b)", () => {
  const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
    const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
    return r.length ? { berkas: r[0].berkas.replace(/\.rtf$/, ""), folder: r[0].folder.replace(A, ""), menu: r[0].menu, semua: r.map((x) => x.berkas.replace(/\.rtf$/, "")) } : null;
  };
  const j = { jenisPerkara: "Penguasaan Anak", nomorPerkara: "7/Pdt.G/2026/PA.Dgl" };

  it("tiap baris putusan bawaan penguasaan anak mengarah ke berkas yang ADA di 6b dan menu 153", () => {
    const baris = Object.entries(PETA_PUTUSAN_BAWAAN).filter(([, b]) => b.blangko === "Putusan Penguasaan Anak");
    expect(baris.map(([k]) => k).sort()).toEqual(
      [
        "penguasaan anak",
        "penguasaan anak|dikabulkan",
        "penguasaan anak|dikabulkan sebagian", // I20 18 Okt
        "penguasaan anak|dikabulkan sebagian|verstek",
        "penguasaan anak|dikabulkan|dialihkan",
        "penguasaan anak|dikabulkan|t-tidak-hadir-setelah-mediasi",
        "penguasaan anak|dikabulkan|verstek",
        "penguasaan anak|dicabut",
        "penguasaan anak|digugurkan",
        "penguasaan anak|ditolak",
        "penguasaan anak|ditolak|verstek",
        "penguasaan anak|gugur",
        "penguasaan anak|perdamaian",
        "penguasaan anak|tidak dapat diterima",
      ].sort()
    );
    const menu = FIX.menu.find((m) => m.id === 153)!;
    for (const [k, b] of baris) {
      expect(FIX.berkas, k).toContain(`${A}${PG}/${b.berkas}.rtf`);
      expect(b.blangkoLain, k).toContain(menu.nama_alias);
    }
    // tidak satu pun baris jenis 349 yang masih menunjuk hak asuh 6a
    expect(Object.entries(PETA_PUTUSAN_BAWAAN).filter(([k, b]) => k.startsWith("penguasaan anak") && b.blangko !== "Putusan Penguasaan Anak")).toEqual([]);
  });

  it("kabul [01]/[01b]/[01a] (varian [01c] disebut), tolak [03]/[03a] verstek, damai [97], cabut [98], gugur [98a], NO [99]", () => {
    expect(put({ ...j, statusPutusan: "Dikabulkan" })).toMatchObject({ berkas: B01, folder: PG, menu: "Putusan Penguasaan Anak" });
    expect(put({ ...j, statusPutusan: "Dikabulkan" })!.semua).toEqual(expect.arrayContaining([B01A, B01C]));
    expect(put({ ...j, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toBe(B01B);
    expect(put({ ...j, statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true })!.berkas).toBe(B01A);
    expect(put({ ...j, statusPutusan: "Ditolak" })).toMatchObject({ berkas: B03, folder: PG });
    expect(put({ ...j, statusPutusan: "Ditolak" })!.semua).toContain(B03A);
    expect(put({ ...j, statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 })).toMatchObject({ berkas: B03A, folder: PG });
    // Tergugat ibu: tidak ada [03a] hadhanah di 6b -> tetap [03] 6b
    expect(put({ ...j, statusPutusan: "Ditolak", tergugatPerempuan: true })).toMatchObject({ berkas: B03, folder: PG });
    expect(put({ ...j, statusPutusan: "Perdamaian" })).toMatchObject({ berkas: "[97] [Perdamaian] Akta Perdamaian", folder: PG });
    expect(put({ ...j, statusPutusan: "Dicabut" })).toMatchObject({ folder: PG });
    expect(put({ ...j, statusPutusan: "Digugurkan" })).toMatchObject({ folder: PG });
    expect(put({ ...j, statusPutusan: "Gugur" })).toMatchObject({ folder: PG });
    expect(put({ ...j, statusPutusan: "Tidak Dapat Diterima" })).toMatchObject({ folder: PG });
  });

  it("hak asuh Lain-Lain Pdt.G tetap di 6a (tidak berubah)", () => {
    const g = { jenisPerkara: "Lain-Lain", nomorPerkara: "358/Pdt.G/2020/PA.Dgl" };
    expect(put({ ...g, statusPutusan: "Dikabulkan" })).toMatchObject({ folder: HA, menu: "Putusan Hak Asuh Anak (Hadhanah)" });
    expect(put({ ...g, statusPutusan: "Ditolak", tergugatPerempuan: true })!.berkas).toMatch(/^\[03a\] \[Tolak\] Hak Asuh/);
  });
});

describe("C. BAS: ALUR 44 dan 29 salinan ALUR 04-09 di 6b - BAS", () => {
  const t = (jenisPerkara: string, nomorPerkara: string, m: Partial<Parameters<typeof tentukanBasBaru>[0]> = {}) => tentukanBasBaru({ jenisPerkara, nomorPerkara, urutanSidang: 1, dihadiriOleh: 1, ...m });
  const G = "7/Pdt.G/2026/PA.Dgl";

  it("ALUR 44 = 6 berkas BAS ALUR 44 di folder 6b - BAS server (dua arah), menu 154, jenis 349", () => {
    const alur = ALUR_BAS_BARU.find((a) => a.id === "alur-44")!;
    expect(alur).toMatchObject({ nomor: 44, folder: `${A}${PG_BAS}`, jenisMin: 349, jenisMaks: 349, menu: { id: 154, nama: "Penguasaan Anak - BAS", alias: "Penguasaan Anak - BAS" } });
    expect(alur.langkah.map((l) => l.kode)).toEqual(["V1", "AP", "CB", "V2", "TP", "NO", "V2S", "CS", "CM"]); // + I20 18 Okt
    const diServer = FIX.berkas.filter((x) => x.startsWith(`${A}${PG_BAS}/BAS ALUR 44 `));
    expect(alur.langkah.map((l) => `${alur.folder}/${l.berkas}`).sort()).toEqual([...diServer].sort());
    // ALUR 38 (hak asuh) tidak berubah
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-38")).toMatchObject({ folder: `${A}${HA} - BAS`, jenisMin: 369, jenisMaks: 369 });
  });

  it("salinan: 29 BAS ALUR 04-09 di tabel = berkas 6b - BAS server; kedua folder (6a dan 6b) menerima", () => {
    const diTabel: string[] = [];
    for (const [fs, berkas] of Object.entries(SALINAN_BAS_JENIS)) {
      const nomor = /^ALUR (\d+)/.exec(fs)?.[1];
      for (const [bs, tujuan] of Object.entries(berkas)) if (tujuan.includes(PG_BAS)) diTabel.push(`BAS ALUR ${nomor} ${bs}`);
    }
    const diServer = FIX.berkas.filter((x) => x.startsWith(`${A}${PG_BAS}/BAS ALUR 0`)).map((x) => x.slice(`${A}${PG_BAS}/`.length));
    expect(diTabel).toHaveLength(29);
    expect(diTabel.sort()).toEqual(diServer.sort());
    const alur04 = "ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)";
    const berkas = "[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf";
    expect(salinanBasJenis(`${A}${alur04}`, berkas, "Penguasaan Anak").map((s) => s.folder)).toEqual([`${A}${PG_BAS}`]);
    expect(salinanBasJenis(`${A}${alur04}`, berkas, "Hak Asuh Anak").map((s) => s.folder)).toEqual([`${A}${HA} - BAS`]);
    expect(cariBerkasBasJenis("BAS ALUR 44 Penguasaan Anak - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf", "Penguasaan Anak")?.folder).toBe(`${A}${PG_BAS}`);
    expect(cariBerkasBasJenis("BAS ALUR 38 Hak Asuh - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf", "Penguasaan Anak")).toBeNull();
  });

  it("pemilihan BAS per sidang: 349 -> ALUR 44; Lain-Lain Pdt.G -> ALUR 38; kontradiktoir = salinan ALUR 04 di 6b", () => {
    expect(jenisBasBaru("Penguasaan Anak", G)).toBe("penguasaan-anak");
    expect(jenisBasBaru("Lain-Lain", "358/Pdt.G/2020/PA.Dgl")).toBe("hak-asuh");
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 2 })).toMatchObject({ alur: { id: "alur-44", folder: `${A}${PG_BAS}` }, langkah: { kode: "V1" } });
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 2, urutanSidang: 2 })).toMatchObject({ alur: { id: "alur-44" }, langkah: { kode: "V2" } });
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 4, urutanSidang: 2 })).toMatchObject({ langkah: { kode: "TP" } });
    expect(t("Penguasaan Anak", G, { urutanSidang: 3, dihadiriOleh: 4, akhir: "no" })).toMatchObject({ langkah: { kode: "NO" } });
    expect(t("Penguasaan Anak", G, { urutanSidang: 2, agenda: "Laporan mediasi - akta perdamaian" })).toMatchObject({ langkah: { kode: "AP" } });
    expect(t("Penguasaan Anak", G, { akhir: "cabut" })).toMatchObject({ langkah: { kode: "CB" } });
    const kontra = t("Penguasaan Anak", G, { urutanSidang: 3, agenda: "Jawaban" })!;
    expect(kontra.alur.folder).toBe(`${A}${PG_BAS}`);
    expect(kontra.langkah.berkas).toMatch(/^BAS ALUR 04 \[3\] BAS 3 P & T Hadir/);
    expect(t("Lain-Lain", "358/Pdt.G/2020/PA.Dgl", { dihadiriOleh: 2 })).toMatchObject({ alur: { id: "alur-38", folder: `${A}${HA} - BAS` }, langkah: { kode: "V1" } });
    const r = rekomendasiBlangko({ jenisPerkara: "Penguasaan Anak", nomorPerkara: G, urutanSidang: 1, dihadiriOleh: 2 }).bas;
    expect(r[0]).toMatchObject({ utama: true, folder: `${A}${PG_BAS}`, menu: "Penguasaan Anak - BAS" });
    for (const x of r) expect(FIX.berkas, x.berkas).toContain(`${x.folder}/${x.berkas}`);
  });
});

describe("D. isian 9590 / 9592", () => {
  const D = (kode: string, nama: string, jenis = "data_teks"): [string, Definisi] => [kode, { kode, nama, jenis, sql: "", bawaan: "" }];
  const KATALOG = new Map<string, Definisi>([
    D("9590", "PENGUASAAN ANAK: KEADAAN PENGUASAAN ANAK SAAT INI - ISIAN (siapa yang menguasai anak, sejak kapan, di mana; dari bukti & saksi; kosong = kalimat bawaan)"),
    D("9591", "PENGUASAAN ANAK: KEADAAN PENGUASAAN ANAK SAAT INI (OTOMATIS: isian 9590)", "data_sql"),
    D("9592", "PENGUASAAN ANAK: TEMPAT TINGGAL ANAK SENYATANYA - ISIAN (kalimat; kosong = wilayah hukum Pengadilan ini)"),
    D("9593", "PENGUASAAN ANAK: TEMPAT TINGGAL ANAK SENYATANYA (OTOMATIS: isian 9592)", "data_sql"),
  ]);

  it("9590 dan 9592 berlabel awam tanpa nomor; 9591 dan 9593 otomatis (bukan isian)", () => {
    const s = susunIsian([...KATALOG.keys()], KATALOG);
    const peta = Object.fromEntries(s.isian.map((b) => [b.kode, b]));
    expect(Object.keys(peta).sort()).toEqual(["9590", "9592"]);
    expect(peta["9590"].nama).toMatch(/^Keadaan penguasaan anak saat ini/);
    expect(peta["9592"].nama).toMatch(/^Tempat tinggal anak senyatanya/);
    for (const b of Object.values(peta)) expect(b.nama, b.kode).not.toMatch(/\b9[0-9]{3}\b|OTOMATIS|ISIAN/);
    expect(s.otomatis.map((o) => o.kode).sort()).toEqual(["9591", "9593"]);
  });

  it("keduanya masuk langkah 'pertimbangan' konseptor", () => {
    expect(langkahUntukIsian({ kode: "9590", nama: "x" })).toBe("pertimbangan");
    expect(langkahUntukIsian({ kode: "9592", nama: "x" })).toBe("pertimbangan");
  });
});
