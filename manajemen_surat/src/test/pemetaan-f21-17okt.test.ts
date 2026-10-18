// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN BLANGKO JENIS BARU F21 (17 Okt 2026): HAK ASUH ANAK, PEMBATALAN PERKAWINAN, EKONOMI SYARIAH
 * ============================================================================
 *
 * Paket ABT abt-hak-asuh-derry (menu 133/134, folder "6a Hak Asuh Anak (Hadhanah)", ALUR 38), abt-pembatalan-perkawinan-derry (135/136,
 * "5a Pembatalan Perkawinan", ALUR 39) dan abt-ekonomi-syariah-derry (137/138, "10 Ekonomi Syariah", ALUR 40) terpasang di server 17 Okt.
 * Yang dijaga (semuanya dijalankan, atas keadaan server di fixtures/blangko-derry-server-17okt.json):
 *   A. pohon: tiap berkas yang dirujuk ALETA (putusan bawaan, BAS ALUR 38-40, salinan BAS ALUR 04-09) ADA di folder server, menu dan alias cocok;
 *   B. putusan bawaan per keadaan (verstek, kontradiktoir, T tidak hadir setelah mediasi, tolak, perdamaian, cabut, gugur, NO) memilih blangko yang benar;
 *   C. BAS massal per sidang: ALUR 38/39/40 menurut kehadiran dan urutan sidang, salinan ALUR 04-09 hanya di folder jenisnya;
 *   D. keadaan putusan "Lain-Lain" Pdt.G (hak asuh terdaftar 369) tidak mengganggu pengangkatan anak (Pdt.P);
 *   E. label isian baru 9303-9355 di "Perlu diisi" berbahasa awam dan memuat pilihan;
 *   F. kunci baku Pemetaan blangko.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { ALUR_BAS_BARU, jenisBasBaru, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { JENIS_BAS_BAKU, KUNCI_BAKU, kunciJenisPerkara } from "@/lib/pemetaan-blangko";
import { SET_BLANGKO, setBlangkoGabung, setUntukPerkara } from "@/lib/pohon-blangko";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";
import { cariBerkasBasJenis, salinanBasJenis } from "@/lib/salinan-bas-jenis";
import { MENU_FOLDER_JENIS, SALINAN_BAS_JENIS } from "@/lib/salinan-bas-jenis-data";
import { jenisPerkaraDariFolder } from "@/lib/tugas-blangko";

type BarisMenu = { id: number; nama: string; nama_alias: string; direktori: string; parent_direktori: string; user_cek: number; user_grup_id: string; user_top_id: string };
const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[]; menu: BarisMenu[] };
const A = "derry_briantono/";
const menuId = (id: number) => FIX.menu.find((m) => m.id === id)!;

const HA = { putusan: "6a Hak Asuh Anak (Hadhanah)", bas: "6a Hak Asuh Anak (Hadhanah) - BAS", idPutusan: 133, idBas: 134 };
const PB = { putusan: "5a Pembatalan Perkawinan", bas: "5a Pembatalan Perkawinan - BAS", idPutusan: 135, idBas: 136 };
const ES = { putusan: "10 Ekonomi Syariah", bas: "10 Ekonomi Syariah - BAS", idPutusan: 137, idBas: 138 };
// I15 18 Okt: penguasaan anak (jenis 349) punya sepasang folder sendiri (6b, menu 153/154), terpisah dari hak asuh/hadhanah (6a, jenis 369 Lain-Lain Pdt.G).
const PG = { putusan: "6b Penguasaan Anak", bas: "6b Penguasaan Anak - BAS", idPutusan: 153, idBas: 154 };
const JENIS_BARU = [HA, PB, ES];

describe("A. pohon server 17 Okt: menu, folder, berkas", () => {
  it("tiga pasang menu 133-138 berpasangan, berhak seperti jenis lain (putusan hakim, BAS panitera), folder ada di disk", () => {
    for (const j of JENIS_BARU) {
      const p = menuId(j.idPutusan);
      const b = menuId(j.idBas);
      expect(p, j.putusan).toMatchObject({ direktori: j.putusan, parent_direktori: "derry_briantono", user_cek: 3, user_grup_id: "1|10|20", user_top_id: "1" });
      expect(b, j.bas).toMatchObject({ direktori: j.bas, parent_direktori: "derry_briantono", user_cek: 3, user_top_id: "1|30" });
      expect(b.nama_alias.replace(/ - BAS$/, "")).toBe(p.nama_alias.replace(/ - Putusan$/, ""));
      expect(FIX.berkas.some((x) => x.startsWith(`${A}${j.putusan}/`)), j.putusan).toBe(true);
      expect(FIX.berkas.some((x) => x.startsWith(`${A}${j.bas}/`)), j.bas).toBe(true);
    }
    expect(FOLDER_MENU_PUTUSAN[menuId(133).nama]).toBe(HA.putusan);
    expect(FOLDER_MENU_PUTUSAN[menuId(135).nama]).toBe(PB.putusan);
    expect(FOLDER_MENU_PUTUSAN[menuId(137).nama]).toBe(ES.putusan);
  });

  it("tiap baris putusan bawaan F21: berkas ADA di folder menunya, menu dan alias sama dengan abt_menu server", () => {
    const baris = Object.entries(PETA_PUTUSAN_BAWAAN).filter(([k, v]) => ["Putusan Hak Asuh Anak (Hadhanah)", "Putusan Pembatalan Perkawinan", "Putusan Ekonomi Syariah"].includes(String(v.blangko)));
    // Lain-Lain Pdt.G (hak asuh) 8 + pembatalan 9 + ekonomi syariah 9 + 1 baris tolak "Tergugat ibu" (I7 17 Okt: [03a]) + 1 baris tolak verstek (I8 17 Okt: [03b]);
    // I15 18 Okt: 12 baris jenis 349 (10 + 2 variasi I7/I8) pindah ke blok penguasaan anak (6b) -> 28.
    // I17 18 Okt: + 4 baris hak asuh (98b, 98c, 99a, 99b) dan 5 baris pembatalan (03b, 98b, 98c, 99a, 99b) -> 37.
    // I23 18 Okt: + 3 baris hak asuh + nafkah anak (plus-nafkah-anak, -setelah-mediasi, -verstek) -> 40.
    expect(baris).toHaveLength(40);
    for (const [kunci, b] of baris) {
      const folder = FOLDER_MENU_PUTUSAN[String(b.blangko)];
      expect(FIX.berkas, `${kunci} -> ${b.berkas}`).toContain(`${A}${folder}/${b.berkas}.rtf`);
      const menu = FIX.menu.find((m) => m.direktori === folder)!;
      expect(menu.nama, kunci).toBe(b.blangko);
      expect(b.blangkoLain, kunci).toContain(menu.nama_alias);
    }
  });

  it("ALUR 38/39/40 = berkas BAS ALUR di folder BAS server (dua arah); menu = abt_menu 134/136/138", () => {
    const peta: Record<string, { j: typeof HA; id: string }> = { "38": { j: HA, id: "alur-38" }, "39": { j: PB, id: "alur-39" }, "40": { j: ES, id: "alur-40" } };
    for (const [nomor, { j, id }] of Object.entries(peta)) {
      const alur = ALUR_BAS_BARU.find((a) => a.id === id)!;
      expect(alur.nomor).toBe(Number(nomor));
      expect(alur.folder).toBe(`${A}${j.bas}`);
      expect(alur.menu).toMatchObject({ id: j.idBas, nama: menuId(j.idBas).nama, alias: menuId(j.idBas).nama_alias });
      const diServer = FIX.berkas.filter((x) => x.startsWith(`${A}${j.bas}/BAS ALUR ${nomor} `));
      expect(diServer.length, id).toBe(alur.langkah.length);
      expect(alur.langkah.map((l) => `${alur.folder}/${l.berkas}`).sort(), id).toEqual([...diServer].sort());
    }
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-38")!.langkah.map((l) => l.kode)).toEqual(["V1", "AP", "CB", "V2", "TP", "NO", "CS", "CM"]); // + CS/CM cabut sesudah jawaban (I20 18 Okt)
    // I7 17 Okt: langkah CB ("Mediasi Berhasil - Gugatan Dicabut") dipindah ke derry_briantono/terhapus (pembatalan perkawinan dikecualikan dari mediasi).
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-39")!.langkah.map((l) => l.kode)).toEqual(["V1", "V2", "TP", "NO", "CS", "CM"]);
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-40")!.langkah.map((l) => l.kode)).toEqual(["1", "1a", "1b", "1c", "1d", "2", "2a", "3", "C", "CS", "CM"]);
  });

  it("29 BAS ALUR 04-09 disalin ke 5a dan 6a - BAS: tabel salinan = berkas server, menu bernama", () => {
    for (const j of [PB, HA]) {
      expect(MENU_FOLDER_JENIS[j.bas]).toMatchObject({ id: j.idBas, nama: menuId(j.idBas).nama, alias: menuId(j.idBas).nama_alias });
      const diTabel: string[] = [];
      for (const [fs, berkas] of Object.entries(SALINAN_BAS_JENIS)) {
        const nomor = /^ALUR (\d+)/.exec(fs)?.[1];
        for (const [bs, tujuan] of Object.entries(berkas)) if (tujuan.includes(j.bas)) diTabel.push(`BAS ALUR ${nomor} ${bs}`);
      }
      const diServer = FIX.berkas.filter((x) => x.startsWith(`${A}${j.bas}/BAS ALUR 0`)).map((x) => x.slice(`${A}${j.bas}/`.length));
      // I7 17 Okt: 5a kehilangan 5 BAS mediasi ([1] ALUR 04/05/06, [C1]/[C2] ALUR 08) -> 24; 6a tetap 29.
      expect(diTabel).toHaveLength(j === PB ? 24 : 29);
      expect(diTabel.sort()).toEqual(diServer.sort());
    }
  });

  it("set pohon: putusan hak asuh/pembatalan/ES ada di SET_BLANGKO; folder BAS ditemukan dari server menjadi set BAS yang cocok jenis perkaranya", () => {
    for (const j of JENIS_BARU) {
      const s = SET_BLANGKO.find((x) => x.folder === `${A}${j.putusan}`);
      expect(s, j.putusan).toMatchObject({ jenis: "putusan" });
    }
    const gabung = setBlangkoGabung(FIX.berkas.map((b) => b.split("/")[1]).filter((v, i, a) => a.indexOf(v) === i));
    for (const j of JENIS_BARU) expect(gabung.find((x) => x.folder === `${A}${j.bas}`), j.bas).toMatchObject({ jenis: "bas" });
    // I15 18 Okt: "penguasaan anak" dilepas dari hak asuh; folder 6b membawa kata kunci itu sendiri.
    expect(jenisPerkaraDariFolder(HA.bas).untuk).toContain("hak asuh");
    expect(jenisPerkaraDariFolder(HA.bas).untuk).not.toContain("penguasaan anak");
    expect(jenisPerkaraDariFolder(PG.bas).untuk).toEqual(["penguasaan anak"]);
    expect(jenisPerkaraDariFolder(PB.bas).untuk).toContain("pembatalan perkawinan");
    expect(jenisPerkaraDariFolder(ES.bas).untuk).toContain("ekonomi syariah");
    for (const [jenis, folder] of [["Penguasaan Anak", PG.putusan], ["Pembatalan Perkawinan", PB.putusan], ["Ekonomi Syariah", ES.putusan]] as const) {
      const cocok = setUntukPerkara(jenis).filter((s) => s.cocok && s.jenis === "putusan");
      expect(cocok.map((s) => s.folder), jenis).toContain(`${A}${folder}`);
    }
    // I15 18 Okt: jenis 349 TIDAK lagi cocok dengan folder hak asuh; hak asuh = Lain-Lain bernomor Pdt.G.
    expect(setUntukPerkara("Penguasaan Anak").filter((s) => s.cocok && s.jenis === "putusan").map((s) => s.folder)).not.toContain(`${A}${HA.putusan}`);
    expect(setUntukPerkara("Lain-Lain", "358/Pdt.G/2020/PA.Dgl").filter((s) => s.cocok && s.jenis === "putusan").map((s) => s.folder)).toContain(`${A}${HA.putusan}`);
  });
});

describe("B. putusan bawaan per keadaan", () => {
  const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
    const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
    return r.length ? { berkas: r[0].berkas.replace(/\.rtf$/, ""), folder: r[0].folder.replace(A, ""), menu: r[0].menu, utama: r[0].utama } : null;
  };

  it("penguasaan anak (349, folder 6b sejak I15 18 Okt): kabul kontradiktoir [01], verstek [01b] (juga verstek tanpa bendera), T tidak hadir sesudah mediasi [01a], tolak, damai, cabut, gugur, NO", () => {
    const j = { jenisPerkara: "Penguasaan Anak", nomorPerkara: "7/Pdt.G/2026/PA.Dgl" };
    const kabul = put({ ...j, statusPutusan: "Dikabulkan" })!;
    expect(kabul).toMatchObject({ berkas: "[01] [Kabul] Penguasaan Anak - Kontradiktoir - Anak Belum Mumayyiz", folder: PG.putusan, menu: "Putusan Penguasaan Anak", utama: true });
    expect(put({ ...j, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toBe("[01b] [Kabul Verstek] Penguasaan Anak - Anak Belum Mumayyiz");
    expect(put({ ...j, statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: null, mediasiTerbaca: true, tergugatPernahHadir: false })!.berkas).toMatch(/^\[01b\]/); // verstek tanpa bendera
    expect(put({ ...j, statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true })!.berkas).toMatch(/^\[01a\] \[Kabul\] Penguasaan Anak - T Tidak Hadir Setelah Mediasi/);
    expect(put({ ...j, statusPutusan: "Ditolak" })!.berkas).toMatch(/^\[03\] \[Tolak\] Penguasaan Anak/);
    expect(put({ ...j, statusPutusan: "Perdamaian" })!.berkas).toBe("[97] [Perdamaian] Akta Perdamaian");
    expect(put({ ...j, statusPutusan: "Dicabut" })!.berkas).toMatch(/^\[98\] \[Cabut\]/);
    expect(put({ ...j, statusPutusan: "Digugurkan" })!.berkas).toMatch(/^\[98a\] \[Gugur\]/);
    expect(put({ ...j, statusPutusan: "Gugur" })!.berkas).toMatch(/^\[98a\] \[Gugur\]/);
    expect(put({ ...j, statusPutusan: "Tidak Dapat Diterima" })!.berkas).toMatch(/^\[99\] \[NO\]/);
    // sidang yang akan memutus tetapi status belum tercatat: perkiraan dikabulkan
    const belum = rekomendasiBlangko({ ...j, urutanSidang: 5, dihadiriOleh: 1, agenda: "Pembacaan putusan" }).putusan[0];
    expect(belum).toMatchObject({ perkiraan: true });
    expect(belum.berkas).toMatch(/^\[01\] \[Kabul\] Penguasaan Anak/);
  });

  it("hak asuh terdaftar sebagai Lain-Lain (369) Pdt.G -> blangko hak asuh; Lain-Lain Pdt.P (pengangkatan anak) tetap blangko pengangkatan anak", () => {
    const g = { jenisPerkara: "Lain-Lain", nomorPerkara: "358/Pdt.G/2020/PA.Dgl" };
    expect(put({ ...g, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })).toMatchObject({ berkas: "[01b] [Kabul Verstek] Hak Asuh - Anak Belum Mumayyiz", folder: HA.putusan });
    expect(put({ ...g, statusPutusan: "Dikabulkan" })).toMatchObject({ berkas: "[01] [Kabul] Hak Asuh - Kontradiktoir - Anak Belum Mumayyiz", folder: HA.putusan });
    expect(put({ ...g, statusPutusan: "Perdamaian" })).toMatchObject({ berkas: "[97] [Perdamaian] Akta Perdamaian", folder: HA.putusan });
    expect(put({ ...g, statusPutusan: "Dicabut" })).toMatchObject({ folder: HA.putusan });
    expect(put({ ...g, statusPutusan: "Tidak Dapat Diterima" })).toMatchObject({ folder: HA.putusan });
    const p = put({ jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.P/2024/PA.Dgl", statusPutusan: "Dikabulkan" });
    expect(p).toMatchObject({ berkas: "[01] [Kabul] Pengangkatan Anak", folder: "9a Lain-Lain (Pengangkatan Anak)" });
  });

  it("pembatalan perkawinan: [01] kontradiktoir, [01b] verstek, [01a] T tidak hadir sesudah mediasi, [03], [98], [98a], [99]", () => {
    const j = { jenisPerkara: "Pembatalan Perkawinan", nomorPerkara: "20/Pdt.G/2026/PA.Dgl" };
    expect(put({ ...j, statusPutusan: "Dikabulkan" })).toMatchObject({ berkas: "[01] [Kabul] Pembatalan Perkawinan - Kontradiktoir", folder: PB.putusan, menu: "Putusan Pembatalan Perkawinan" });
    expect(put({ ...j, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toBe("[01b] [Kabul Verstek] Pembatalan Perkawinan");
    expect(put({ ...j, statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true })!.berkas).toMatch(/^\[01a\]/);
    expect(put({ ...j, statusPutusan: "Ditolak" })!.berkas).toMatch(/^\[03\] \[Tolak\]/);
    expect(put({ ...j, statusPutusan: "Dicabut" })!.berkas).toMatch(/^\[98\] \[Cabut\]/);
    expect(put({ ...j, statusPutusan: "Digugurkan" })!.berkas).toMatch(/^\[98a\] \[Gugur\]/);
    expect(put({ ...j, statusPutusan: "Tidak Dapat Diterima" })!.berkas).toMatch(/^\[99\] \[NO\]/);
  });

  it("ekonomi syariah gugatan sederhana: [01], [01b] verstek, [03], [97] perdamaian, [98], [98a], [99] (T tidak diketahui)", () => {
    const j = { jenisPerkara: "Ekonomi Syariah", nomorPerkara: "2/Pdt.G.S/2025/PA.Dgl" };
    expect(put({ ...j, statusPutusan: "Dikabulkan" })).toMatchObject({ berkas: "[01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadir", folder: ES.putusan, menu: "Putusan Ekonomi Syariah" });
    expect(put({ ...j, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toMatch(/^\[01b\] \[Kabul Verstek\] ES Gugatan Sederhana/);
    expect(put({ ...j, statusPutusan: "Ditolak" })!.berkas).toMatch(/^\[03\] \[Tolak\] ES/);
    expect(put({ ...j, statusPutusan: "Perdamaian" })!.berkas).toMatch(/^\[97\] \[Perdamaian\] ES Gugatan Sederhana/);
    expect(put({ ...j, statusPutusan: "Dicabut" })!.berkas).toMatch(/^\[98\] \[Cabut\] ES/);
    expect(put({ ...j, statusPutusan: "Digugurkan" })!.berkas).toMatch(/^\[98a\] \[Gugur\] ES/);
    expect(put({ ...j, statusPutusan: "Tidak Dapat Diterima" })!.berkas).toMatch(/^\[99\] \[NO\] ES Gugatan Sederhana - Tergugat Tidak Diketahui/);
  });
});

describe("C. BAS massal per sidang", () => {
  const t = (jenisPerkara: string, nomorPerkara: string, m: Partial<Parameters<typeof tentukanBasBaru>[0]> = {}) => {
    const h = tentukanBasBaru({ jenisPerkara, nomorPerkara, urutanSidang: 1, dihadiriOleh: 1, ...m });
    return { h, id: h?.alur.id ?? null, kode: h?.langkah.kode ?? null, folder: h?.alur.folder.replace(A, "") ?? null };
  };

  it("jenis perkara -> jenis BAS baru", () => {
    expect(jenisBasBaru("Penguasaan Anak", "1/Pdt.G/2026/PA.Dgl")).toBe("penguasaan-anak"); // I15 18 Okt: ALUR 44 (6b), bukan hak asuh
    expect(jenisBasBaru("Lain-Lain", "358/Pdt.G/2020/PA.Dgl")).toBe("hak-asuh");
    expect(jenisBasBaru("Lain-Lain", "7/Pdt.P/2024/PA.Dgl")).toBe("angkat-anak");
    expect(jenisBasBaru("Pembatalan Perkawinan", "1/Pdt.G/2026/PA.Dgl")).toBe("pembatalan");
    expect(jenisBasBaru("Ekonomi Syariah", "2/Pdt.G.S/2025/PA.Dgl")).toBe("es");
    expect(jenisBasBaru("Ekonomi Syariah", "2/Pdt.G/2025/PA.Dgl")).toBe("es-biasa"); // F22 17 Okt: acara biasa = ALUR 43
    expect(jenisBasBaru("Ekonomi Syariah")).toBe(""); // nomor belum diketahui: tidak ditebak
  });

  it("penguasaan anak (349, ALUR 44 sejak I15 18 Okt): verstek sidang 1 [V1], verstek putus sidang 2 [V2], P tidak hadir [TP], 2x tidak hadir NO, damai [AP], cabut [CB]; kontradiktoir = salinan ALUR 04 di 6b; hak asuh Lain-Lain tetap ALUR 38", () => {
    const G = "7/Pdt.G/2026/PA.Dgl";
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 2 })).toMatchObject({ id: "alur-44", kode: "V1", folder: PG.bas });
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 2, urutanSidang: 2 })).toMatchObject({ id: "alur-44", kode: "V2" });
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 2, urutanSidang: 2 }).h!.perkiraan).toBe(false);
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 2, urutanSidang: 3 }).h!.perkiraan).toBe(true);
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 4, urutanSidang: 2 })).toMatchObject({ id: "alur-44", kode: "TP" });
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 3, urutanSidang: 2 })).toMatchObject({ id: "alur-44", kode: "TP" });
    expect(t("Penguasaan Anak", G, { urutanSidang: 3, dihadiriOleh: 4, akhir: "no" })).toMatchObject({ id: "alur-44", kode: "NO" });
    expect(t("Penguasaan Anak", G, { urutanSidang: 2, agenda: "Laporan mediasi - akta perdamaian" })).toMatchObject({ id: "alur-44", kode: "AP" });
    expect(t("Penguasaan Anak", G, { akhir: "cabut" })).toMatchObject({ id: "alur-44", kode: "CB" });
    const kontra = t("Penguasaan Anak", G, { urutanSidang: 3, agenda: "Jawaban" });
    expect(kontra).toMatchObject({ id: "alur-04", kode: "3", folder: PG.bas });
    expect(kontra.h!.langkah.berkas).toMatch(/^BAS ALUR 04 \[3\] BAS 3 P & T Hadir/);
    // T pernah hadir (mediasi) lalu tidak hadir: bukan verstek, memakai salinan kontradiktoir
    expect(t("Penguasaan Anak", G, { dihadiriOleh: 2, urutanSidang: 3, tergugatPernahHadir: true, agenda: "Pembuktian" }).id).toBe("alur-04");
    // Lain-Lain Pdt.G = hak asuh; Lain-Lain Pdt.P tetap pengangkatan anak (ALUR 18)
    expect(t("Lain-Lain", "358/Pdt.G/2020/PA.Dgl", { dihadiriOleh: 2 })).toMatchObject({ id: "alur-38", kode: "V1" });
    expect(t("Lain-Lain", "7/Pdt.P/2024/PA.Dgl", { urutanSidang: 2 }).id).toBe("alur-18");
  });

  it("pembatalan perkawinan: sama dengan hak asuh tanpa akta perdamaian; mediasi berhasil TIDAK diusulkan (dikecualikan dari mediasi, I7 17 Okt)", () => {
    const G = "20/Pdt.G/2026/PA.Dgl";
    expect(t("Pembatalan Perkawinan", G, { dihadiriOleh: 2 })).toMatchObject({ id: "alur-39", kode: "V1", folder: PB.bas });
    expect(t("Pembatalan Perkawinan", G, { dihadiriOleh: 2, urutanSidang: 2 })).toMatchObject({ id: "alur-39", kode: "V2" });
    expect(t("Pembatalan Perkawinan", G, { dihadiriOleh: 4, urutanSidang: 2 })).toMatchObject({ id: "alur-39", kode: "TP" });
    expect(t("Pembatalan Perkawinan", G, { akhir: "no", dihadiriOleh: 4, urutanSidang: 3 })).toMatchObject({ id: "alur-39", kode: "NO" });
    expect(t("Pembatalan Perkawinan", G, { urutanSidang: 2, agenda: "Mediasi berhasil" }).h).toBeNull();
    expect(t("Pembatalan Perkawinan", G, { urutanSidang: 4, agenda: "Replik" })).toMatchObject({ id: "alur-04", kode: "4", folder: PB.bas });
  });

  it("ekonomi syariah gugatan sederhana (ALUR 40): sidang 1 menurut kehadiran, sidang 2 pembuktian/verstek, pengucapan putusan, damai, cabut, gugur, NO; acara biasa = ALUR 43 (F22 17 Okt), nomor tak diketahui tidak ditebak", () => {
    const S = "2/Pdt.G.S/2025/PA.Dgl";
    expect(t("Ekonomi Syariah", S)).toMatchObject({ id: "alur-40", kode: "1", folder: ES.bas });
    expect(t("Ekonomi Syariah", S, { dihadiriOleh: 2 }).kode).toBe("1b");
    expect(t("Ekonomi Syariah", S, { dihadiriOleh: 4 }).kode).toBe("1c");
    expect(t("Ekonomi Syariah", S, { agenda: "Damai berhasil - akta perdamaian" }).kode).toBe("1a");
    expect(t("Ekonomi Syariah", S, { akhir: "no" }).kode).toBe("1d");
    expect(t("Ekonomi Syariah", S, { akhir: "gugur" }).kode).toBe("1c");
    expect(t("Ekonomi Syariah", S, { akhir: "cabut" }).kode).toBe("C");
    expect(t("Ekonomi Syariah", S, { urutanSidang: 2 }).kode).toBe("2");
    expect(t("Ekonomi Syariah", S, { urutanSidang: 2, dihadiriOleh: 2 }).kode).toBe("2a");
    expect(t("Ekonomi Syariah", S, { urutanSidang: 3, agenda: "Pengucapan putusan" }).kode).toBe("3");
    expect(t("Ekonomi Syariah", "2/Pdt.G/2025/PA.Dgl", { dihadiriOleh: 2 })).toMatchObject({ id: "alur-43", kode: "V1" }); // F22 17 Okt
    expect(t("Ekonomi Syariah", "").h).toBeNull();
  });

  it("rekomendasiBlangko: BAS selalu berkas di folder '<jenis> - BAS' dengan nama menu ABT-nya (134/136/138)", () => {
    const r = (jenisPerkara: string, nomorPerkara: string, m: object = {}) => rekomendasiBlangko({ jenisPerkara, nomorPerkara, urutanSidang: 1, dihadiriOleh: 2, ...m }).bas;
    const ha = r("Lain-Lain", "358/Pdt.G/2020/PA.Dgl");
    expect(ha[0]).toMatchObject({ utama: true, folder: `${A}${HA.bas}`, menu: "Hak Asuh Anak (Hadhanah) - BAS", alias: ["Hak Asuh - BAS"] });
    // I15 18 Okt: penguasaan anak (349) -> "6b Penguasaan Anak - BAS" (menu 154), ALUR 44.
    const pg = r("Penguasaan Anak", "7/Pdt.G/2026/PA.Dgl");
    expect(pg[0]).toMatchObject({ utama: true, folder: `${A}${PG.bas}`, menu: "Penguasaan Anak - BAS", alias: ["Penguasaan Anak - BAS"] });
    expect(pg[0].berkas).toMatch(/^BAS ALUR 44 Penguasaan Anak - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T/);
    expect(ha[0].berkas).toMatch(/^BAS ALUR 38 Hak Asuh - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T/);
    const pb = r("Pembatalan Perkawinan", "20/Pdt.G/2026/PA.Dgl", { urutanSidang: 2 });
    expect(pb[0]).toMatchObject({ utama: true, folder: `${A}${PB.bas}`, menu: "Pembatalan Perkawinan - BAS", alias: ["Pembatalan Nikah - BAS"] });
    expect(pb[0].berkas).toMatch(/^BAS ALUR 39 Pembatalan Nikah - Sidang 2 - T Tetap Tidak Hadir/);
    const es = r("Ekonomi Syariah", "2/Pdt.G.S/2025/PA.Dgl", { urutanSidang: 2 });
    expect(es[0]).toMatchObject({ utama: true, folder: `${A}${ES.bas}`, menu: "Ekonomi Syariah - BAS" });
    expect(es[0].berkas).toMatch(/^BAS ALUR 40 ES GS - \[2a\]/);
    for (const x of [...ha, ...pg, ...pb, ...es]) expect(FIX.berkas, x.berkas).toContain(`${x.folder}/${x.berkas}`);
  });

  it("salinan BAS ALUR 04-09 hanya di folder jenis yang cocok: Penguasaan Anak -> 6b (I15 18 Okt), hak asuh Lain-Lain -> 6a, Pembatalan -> 5a, tidak ke cerai/HB/ES", () => {
    const alur04 = "ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)";
    const berkas = "[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf";
    expect(salinanBasJenis(`${A}${alur04}`, berkas, "Penguasaan Anak").map((s) => s.folder)).toEqual([`${A}${PG.bas}`]);
    expect(salinanBasJenis(`${A}${alur04}`, berkas, "Hak Asuh Anak").map((s) => s.folder)).toEqual([`${A}${HA.bas}`]);
    expect(salinanBasJenis(`${A}${alur04}`, berkas, "Pembatalan Perkawinan").map((s) => s.folder)).toEqual([`${A}${PB.bas}`]);
    // F22 17 Okt: ES acara biasa menerima 29 BAS ALUR 04-09 di "10a Ekonomi Syariah Biasa - BAS" (gugatan sederhana tetap tanpa salinan: ALUR 40 saja).
    expect(salinanBasJenis(`${A}${alur04}`, berkas, "Ekonomi Syariah").map((s) => s.folder)).toEqual([`${A}10a Ekonomi Syariah Biasa - BAS`]);
    expect(salinanBasJenis(`${A}${alur04}`, berkas, "Penguasaan Anak")[0]).toMatchObject({ menu: "Penguasaan Anak - BAS", alias: "Penguasaan Anak - BAS" });
    expect(salinanBasJenis(`${A}${alur04}`, berkas, "Hak Asuh Anak")[0]).toMatchObject({ menu: "Hak Asuh Anak (Hadhanah) - BAS", alias: "Hak Asuh - BAS" });
    expect(salinanBasJenis(`${A}${alur04}`, berkas, "Harta Bersama").map((s) => s.folder)).toEqual([`${A}4a Harta Bersama - BAS`]);
  });
});

describe("C2. Pemetaan blangko tab BAS: nama yang dipetakan -> berkas di folder BAS jenis", () => {
  it("BAS ALUR 38/39/40 dan salinan ALUR 04 ditemukan hanya untuk jenis perkaranya", () => {
    const ha = cariBerkasBasJenis("BAS ALUR 38 Hak Asuh - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf", "Hak Asuh Anak");
    expect(ha).toMatchObject({ folder: `${A}${HA.bas}`, menu: "Hak Asuh Anak (Hadhanah) - BAS" });
    // I15 18 Okt: ALUR 38 bukan milik jenis 349; ALUR 44 milik 6b saja.
    expect(cariBerkasBasJenis("BAS ALUR 38 Hak Asuh - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf", "Penguasaan Anak")).toBeNull();
    expect(cariBerkasBasJenis("BAS ALUR 44 Penguasaan Anak - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf", "Penguasaan Anak")).toMatchObject({ folder: `${A}${PG.bas}`, menu: "Penguasaan Anak - BAS" });
    expect(cariBerkasBasJenis("BAS ALUR 44 Penguasaan Anak - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf", "Hak Asuh Anak")).toBeNull();
    expect(cariBerkasBasJenis("BAS ALUR 38 Hak Asuh - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf", "Pembatalan Perkawinan")).toBeNull();
    expect(cariBerkasBasJenis("BAS ALUR 38 Hak Asuh - Sidang 2 - Mediasi Berhasil - Akta Perdamaian.rtf", "Cerai Gugat")).toBeNull();
    expect(cariBerkasBasJenis("BAS ALUR 39 Pembatalan Nikah - Sidang 1 - P Hadir & T Tidak Hadir - Tunda Panggil T.rtf", "Pembatalan Perkawinan")?.folder).toBe(`${A}${PB.bas}`);
    expect(cariBerkasBasJenis("BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bukti dan Putusan Verstek.rtf", "Ekonomi Syariah")?.folder).toBe(`${A}${ES.bas}`);
    expect(cariBerkasBasJenis("BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bukti dan Putusan Verstek.rtf", "Penguasaan Anak")).toBeNull();
    // salinan ALUR 04 ada di dua folder baru (nama asal "[3] BAS 3 ..." ambigu antar folder jenis: tidak ditebak tanpa nama jenis yang tepat)
    expect(cariBerkasBasJenis("BAS ALUR 04 [3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf", "Penguasaan Anak")?.folder).toBe(`${A}${PG.bas}`);
    expect(cariBerkasBasJenis("BAS ALUR 04 [3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf", "Hak Asuh Anak")?.folder).toBe(`${A}${HA.bas}`);
    expect(cariBerkasBasJenis("BAS ALUR 04 [3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf", "Pembatalan Perkawinan")?.folder).toBe(`${A}${PB.bas}`);
  });
});

describe("D. keadaan putusan", () => {
  it("Lain-Lain Pdt.G: hak-asuh (+ hak-asuh-verstek lebih dulu bila verstek); Lain-Lain Pdt.P dan jenis lain tidak", () => {
    expect(keadaanPutusan({ jenisPerkara: "Lain-Lain", nomorPerkara: "358/Pdt.G/2020/PA.Dgl", verstekPutusan: true, dihadiriOleh: 2 })).toEqual(["hak-asuh-verstek", "hak-asuh"]);
    expect(keadaanPutusan({ jenisPerkara: "Lain-Lain", nomorPerkara: "542/Pdt.G/2021/PA.Dgl", dihadiriOleh: 1 })).toEqual(["kontradiktoir", "hak-asuh"]);
    expect(keadaanPutusan({ jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.P/2024/PA.Dgl", dihadiriOleh: 1 })).toEqual([]);
    expect(keadaanPutusan({ jenisPerkara: "Harta Bersama", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", dihadiriOleh: 1 })).not.toContain("hak-asuh");
  });

  it("hak asuh, pembatalan, ES mengenal keadaan mediasi/verstek seperti cerai", () => {
    for (const jenisPerkara of ["Penguasaan Anak", "Pembatalan Perkawinan", "Ekonomi Syariah"]) {
      const k = keadaanPutusan({ jenisPerkara, dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, panggilan: { tergugatPernahHadir: true } });
      expect(k, jenisPerkara).toContain("t-tidak-hadir-setelah-mediasi");
      expect(keadaanPutusan({ jenisPerkara, dihadiriOleh: 2, mediasi: null, mediasiTerbaca: true, panggilan: { tergugatPernahHadir: false } }), jenisPerkara).toContain("verstek-tanpa-bendera");
    }
  });
});

describe("E. label isian baru di 'Perlu diisi'", () => {
  const D = (kode: string, nama: string, jenis = "data_teks"): [string, Definisi] => [kode, { kode, nama, jenis, sql: "", bawaan: "" }];
  const KATALOG = new Map<string, Definisi>([
    D("9303", "HAK ASUH: IDENTITAS ANAK - ISIAN (nama lengkap bin/binti, tempat & tanggal lahir; satu anak satu baris; kosong = data anak di SIPP atau nama anak #8602#)"),
    D("9305", "HAK ASUH: FAKTA PENGASUHAN ANAK SAAT INI - ISIAN (dari bukti & saksi: ...; kosong = kalimat bawaan)"),
    D("9307", "HAK ASUH (ANAK MUMAYYIZ): KETERANGAN ANAK DI PERSIDANGAN - ISIAN (pilihan anak dan alasannya; kosong = memilih #0046#)"),
    D("9309", "HAK ASUH (PEMEGANG HADHANAH DIALIHKAN): KEADAAN YANG MENJADIKAN #0047# TIDAK DAPAT MENJAMIN KESELAMATAN JASMANI DAN ROHANI ANAK (Pasal 156 huruf c KHI)"),
    D("9310", "HAK ASUH (TOLAK): PERTIMBANGAN MENGAPA KEPENTINGAN TERBAIK ANAK TIDAK TERPENUHI BILA DIASUH #0046#"),
    D("9320", "PEMBATALAN NIKAH: ALASAN (1 huruf) A poligami tanpa izin, B istri orang lain/iddah, C di bawah umur, D tanpa wali/wali tak berhak, E paksaan, F penipuan/salah sangka, G larangan kawin"),
    D("9324", "PEMBATALAN NIKAH: KEDUDUKAN #0046# - ISIAN (mis. ayah kandung #0047#, istri pertama dari ..., Kepala KUA ...; kosong = suami/istri #0047#)"),
    D("9329", "PEMBATALAN NIKAH: FAKTA ALASAN PEMBATALAN YANG TERBUKTI - ISIAN (uraian singkat dari bukti & saksi)"),
    D("9340", 'EKONOMI SYARIAH: AKAD YANG DISENGKETAKAN - ISIAN (jenis akad, nomor, tanggal; mis. "Akad Pembiayaan Murabahah Nomor ... tanggal ...")'),
    D("9341", "EKONOMI SYARIAH: JUMLAH KEWAJIBAN #0047# YANG DIKABULKAN - ISIAN (rupiah, angka saja; mis. 61241800 atau 61.241.800)"),
    D("9352", "EKONOMI SYARIAH: ISI KESEPAKATAN PERDAMAIAN DI HADAPAN HAKIM - ISIAN (pasal demi pasal; gugatan sederhana tidak melalui mediasi)"),
    D("9353", "EKONOMI SYARIAH: TANGGAL KESEPAKATAN PERDAMAIAN DI HADAPAN HAKIM", "data_tanggal"),
    D("9354", "EKONOMI SYARIAH (PERDAMAIAN): PIHAK YANG DIBEBANI BIAYA PERKARA MENURUT KESEPAKATAN - ISIAN"),
    D("9355", "EKONOMI SYARIAH: POKOK JAWABAN #0047# - ISIAN (satu kalimat; gugatan sederhana tanpa replik/duplik)"),
  ]);
  const kode = [...KATALOG.keys()];

  it("tiap isian punya label bahasa awam (bukan nama ABT mentah), tanpa nomor variabel dan tanpa huruf kapital semua", () => {
    const h = susunIsian(kode, KATALOG);
    const label = Object.fromEntries(h.isian.map((i) => [i.kode, i.nama]));
    expect(Object.keys(label).sort()).toEqual([...kode].sort());
    expect(label["9303"]).toBe("Identitas anak (nama, tempat dan tanggal lahir; satu anak satu baris)");
    expect(label["9305"]).toMatch(/^Keadaan pengasuhan anak saat ini/);
    expect(label["9307"]).toBe("Pilihan anak yang sudah mumayyiz di persidangan");
    expect(label["9309"]).toBe("Mengapa pemegang hak asuh tidak dapat menjamin keselamatan anak");
    expect(label["9310"]).toBe("Pertimbangan penolakan hak asuh");
    expect(label["9324"]).toMatch(/^Kedudukan Penggugat/);
    expect(label["9329"]).toBe("Fakta alasan pembatalan yang terbukti di persidangan");
    expect(label["9340"]).toBe("Akad yang disengketakan (jenis akad, nomor, tanggal)");
    expect(label["9341"]).toBe("Jumlah kewajiban Tergugat/Termohon yang dikabulkan (rupiah, angka saja)"); // sebutan bawaan; mengikuti perkara bila sebutan dikirim
    expect(label["9353"]).toBe("Tanggal kesepakatan perdamaian");
    expect(label["9355"]).toBe("Pokok jawaban Tergugat/Termohon (satu kalimat)");
    for (const [k, v] of Object.entries(label)) {
      expect(v, k).not.toMatch(/#\d{4,5}#/);
      expect(v, k).not.toBe(v.toUpperCase());
    }
  });

  it("sebutan pihak mengikuti perkara (Pemohon/Termohon); alasan pembatalan dan pihak penanggung biaya memuat pilihan", () => {
    const h = susunIsian(kode, KATALOG, { P: "Penggugat", T: "Tergugat" });
    const per = Object.fromEntries(h.isian.map((i) => [i.kode, i]));
    expect(per["9320"].nama).toBe("Alasan pembatalan perkawinan");
    expect(per["9320"].pilihan).toHaveLength(7);
    expect(per["9320"].pilihan[0]).toMatch(/^A · /);
    expect(per["9320"].pilihan[6]).toMatch(/^G · /);
    expect(per["9354"].pilihan).toEqual(["Penggugat", "Tergugat", "kedua belah pihak secara tanggung renteng"]);
    expect(per["9341"].nama).toBe("Jumlah kewajiban Tergugat yang dikabulkan (rupiah, angka saja)");
    expect(per["9341"].jenis).toBe("teks");
    expect(per["9353"].jenis).toBe("tanggal");
  });
});

describe("F. kunci baku Pemetaan blangko", () => {
  it("putusan: Penguasaan Anak, Pembatalan Perkawinan, Ekonomi Syariah; BAS: 18 jenis (F22 17 Okt: + Pencegahan Perkawinan, Wasiat; I23 18 Okt: + Nafkah Anak Pasca Perceraian)", () => {
    const putusan = KUNCI_BAKU.putusan.map((k) => k.kunci);
    for (const k of ["Penguasaan Anak", "Pembatalan Perkawinan", "Ekonomi Syariah"]) {
      expect(putusan).toContain(k);
      expect(JENIS_BAS_BAKU as readonly string[]).toContain(k);
      expect(kunciJenisPerkara(k)).toBe(k.toLowerCase());
      expect(KUNCI_BAKU.bas.some((b) => b.kunci === `${k}|1|semua-hadir`), k).toBe(true);
    }
    expect(JENIS_BAS_BAKU).toHaveLength(18);
  });
});
