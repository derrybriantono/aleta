// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN BLANGKO JENIS BARU F22 (17 Okt 2026): PENCEGAHAN PERKAWINAN, WASIAT, EKONOMI SYARIAH ACARA BIASA
 * ============================================================================
 *
 * Paket abt-pencegahan-nikah-derry (menu 139/140, "5b Pencegahan Perkawinan", ALUR 41, jenis 342 Pdt.P), abt-wasiat-derry (141/142, "4c Wasiat", ALUR 42,
 * jenis 365) dan abt-es-biasa-derry (143/144, "10a Ekonomi Syariah Biasa", ALUR 43, jenis 370 nomor Pdt.G). BELUM terpasang di server; keadaan disusun di
 * fixtures/blangko-derry-server-17okt.json dari daftar-rtf.tsv dan PASANG.sql paket. Yang dijaga:
 *   A. pohon: menu 139-144, berkas bawaan putusan ADA di folder menunya, ALUR 41-43 dua arah dengan berkas server, 29 salinan ALUR 04-09 di 4c dan 10a;
 *   B. putusan bawaan per keadaan (kabul/tolak/verstek/damai/cabut/gugur/coret/NO) untuk ketiga jenis; ES MEMILIH menurut nomor (Pdt.G.S vs Pdt.G);
 *   C. BAS massal per sidang (ALUR 41/42/43; salinan ALUR 04-09 untuk sidang kontradiktoir);
 *   D. set pohon dan kunci baku: ES dipilih menurut nomor, tidak mengisi pemetaan per jenis;
 *   E. label isian 9460-9493, huruf kunci 9463/9475 ditulis hurufnya saja.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { ALUR_BAS_BARU, jenisBasBaru, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { langkahUntukIsian } from "@/lib/konseptor-langkah";
import { JENIS_BAS_BAKU, KUNCI_BAKU, kunciJenisPerkara } from "@/lib/pemetaan-blangko";
import { SET_BLANGKO, setBlangkoGabung, setCocokPerkara, setUntukPerkara } from "@/lib/pohon-blangko";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";
import { MENU_FOLDER_JENIS, SALINAN_BAS_JENIS } from "@/lib/salinan-bas-jenis-data";
import { jenisPerkaraDariFolder } from "@/lib/tugas-blangko";

type BarisMenu = { id: number; nama: string; nama_alias: string; direktori: string; parent_direktori: string; user_cek: number; user_grup_id: string; user_top_id: string; perkara_id_min?: string; perkara_id_max?: string; perkara_id_referensi?: string };
const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[]; menu: BarisMenu[] };
const A = "derry_briantono/";
const menuId = (id: number) => FIX.menu.find((m) => m.id === id)!;

const PC = { putusan: "5b Pencegahan Perkawinan", bas: "5b Pencegahan Perkawinan - BAS", idPutusan: 139, idBas: 140, jenis: 342, menuPutusan: "Putusan Pencegahan Perkawinan" };
const WS = { putusan: "4c Wasiat", bas: "4c Wasiat - BAS", idPutusan: 141, idBas: 142, jenis: 365, menuPutusan: "Putusan Wasiat" };
const ESB = { putusan: "10a Ekonomi Syariah Biasa", bas: "10a Ekonomi Syariah Biasa - BAS", idPutusan: 143, idBas: 144, jenis: 370, menuPutusan: "Putusan Ekonomi Syariah (Acara Biasa)" };
const BARU = [PC, WS, ESB];

describe("A. pohon server: menu, folder, berkas", () => {
  it("tiga pasang menu 139-144 berpasangan, berhak seperti jenis lain, acuan jenis_perkara_id 342/365/370", () => {
    for (const j of BARU) {
      const p = menuId(j.idPutusan);
      const b = menuId(j.idBas);
      expect(p, j.putusan).toMatchObject({ direktori: j.putusan, parent_direktori: "derry_briantono", user_cek: 3, user_grup_id: "1|10|20", user_top_id: "1", nama: j.menuPutusan, perkara_id_min: String(j.jenis), perkara_id_max: String(j.jenis), perkara_id_referensi: "jenis_perkara_id" });
      expect(b, j.bas).toMatchObject({ direktori: j.bas, parent_direktori: "derry_briantono", user_cek: 3, user_top_id: "1|30", user_grup_id: "1|30|500|430|1000|1010|1020" });
      expect(b.nama_alias.replace(/ - BAS$/, "")).toBe(p.nama_alias.replace(/ - Putusan$/, ""));
      expect(FOLDER_MENU_PUTUSAN[p.nama]).toBe(j.putusan);
      expect(FIX.berkas.some((x) => x.startsWith(`${A}${j.putusan}/`)), j.putusan).toBe(true);
      expect(FIX.berkas.some((x) => x.startsWith(`${A}${j.bas}/`)), j.bas).toBe(true);
    }
  });

  it("tiap baris putusan bawaan F22: berkas ADA di folder menunya, menu dan alias sama dengan abt_menu server", () => {
    const baris = Object.entries(PETA_PUTUSAN_BAWAAN).filter(([, v]) => BARU.some((j) => j.menuPutusan === String(v.blangko)));
    expect(baris).toHaveLength(34); // pencegahan 9 + wasiat 13 + ES acara biasa 12
    for (const [kunci, b] of baris) {
      const folder = FOLDER_MENU_PUTUSAN[String(b.blangko)];
      expect(FIX.berkas, `${kunci} -> ${b.berkas}`).toContain(`${A}${folder}/${b.berkas}.rtf`);
      const menu = FIX.menu.find((m) => m.direktori === folder)!;
      expect(menu.nama, kunci).toBe(b.blangko);
      expect(b.blangkoLain, kunci).toContain(menu.nama_alias);
      // varian yang disebut catatan juga ada di folder itu
      if (/^varian: /.test(b.catatan ?? "")) for (const v of (b.catatan ?? "").replace(/^varian: /, "").split("; ")) expect(FIX.berkas, `${kunci} varian ${v}`).toContain(`${A}${folder}/${v}.rtf`);
    }
    // ES acara biasa hanya lewat baris berkeadaan "es-biasa*" (nomor Pdt.G); tidak ada baris jenis/status polos yang menimpa gugatan sederhana
    for (const [kunci, b] of baris.filter(([, v]) => v.blangko === ESB.menuPutusan)) expect(kunci, kunci).toMatch(/^ekonomi syariah\|[a-z ]+\|es-biasa/);
  });

  it("ALUR 41/42/43 = berkas BAS ALUR di folder BAS server (dua arah); menu = abt_menu 140/142/144; kode langkah", () => {
    const peta: Record<string, { j: typeof PC; id: string }> = { "41": { j: PC, id: "alur-41" }, "42": { j: WS, id: "alur-42" }, "43": { j: ESB, id: "alur-43" } };
    for (const [nomor, { j, id }] of Object.entries(peta)) {
      const alur = ALUR_BAS_BARU.find((a) => a.id === id)!;
      expect(alur.nomor).toBe(Number(nomor));
      expect(alur.folder).toBe(`${A}${j.bas}`);
      expect(alur.menu).toMatchObject({ id: j.idBas, nama: menuId(j.idBas).nama, alias: menuId(j.idBas).nama_alias });
      expect([alur.jenisMin, alur.jenisMaks]).toEqual([j.jenis, j.jenis]);
      const diServer = FIX.berkas.filter((x) => x.startsWith(`${A}${j.bas}/BAS ALUR ${nomor} `));
      expect(diServer.length, id).toBe(alur.langkah.length);
      expect(alur.langkah.map((l) => `${alur.folder}/${l.berkas}`).sort(), id).toEqual([...diServer].sort());
    }
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-41")!.langkah.map((l) => l.kode)).toEqual(["1", "1a", "1b", "2", "2b", "3", "C", "G", "N", "T"]);
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-42")!.langkah.map((l) => l.kode)).toEqual(["V1", "AP", "CB", "V2", "TP", "NO"]);
    expect(ALUR_BAS_BARU.find((a) => a.id === "alur-43")!.langkah.map((l) => l.kode)).toEqual(["V1", "AP", "CB", "V2", "TP", "NO", "CS", "CM"]); // + CS / CM (I25 18 Okt)
  });

  it("29 BAS ALUR 04-09 disalin ke 4c Wasiat - BAS dan 10a Ekonomi Syariah Biasa - BAS: tabel salinan = berkas server, menu bernama; pencegahan tanpa salinan", () => {
    for (const j of [WS, ESB]) {
      expect(MENU_FOLDER_JENIS[j.bas]).toMatchObject({ id: j.idBas, nama: menuId(j.idBas).nama, alias: menuId(j.idBas).nama_alias });
      const diTabel: string[] = [];
      for (const [fs, berkas] of Object.entries(SALINAN_BAS_JENIS)) {
        const nomor = /^ALUR (\d+)/.exec(fs)?.[1];
        for (const [bs, tujuan] of Object.entries(berkas)) if (tujuan.includes(j.bas)) diTabel.push(`BAS ALUR ${nomor} ${bs}`);
      }
      const diServer = FIX.berkas.filter((x) => x.startsWith(`${A}${j.bas}/BAS ALUR 0`)).map((x) => x.slice(`${A}${j.bas}/`.length));
      expect(diTabel).toHaveLength(29);
      expect(diTabel.sort()).toEqual(diServer.sort());
    }
    expect(MENU_FOLDER_JENIS[PC.bas]).toMatchObject({ id: 140 });
    expect(Object.values(SALINAN_BAS_JENIS).some((isi) => Object.values(isi).some((t) => t.includes(PC.bas)))).toBe(false);
  });
});

describe("B. putusan bawaan per keadaan", () => {
  const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
    const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
    return r.length ? { berkas: r[0].berkas.replace(/\.rtf$/, ""), folder: r[0].folder.replace(A, ""), menu: r[0].menu, semua: r.map((x) => x.berkas.replace(/\.rtf$/, "")) } : null;
  };
  const SEMA = { dihadiriOleh: 4, hadirSebelumnya: 4, penggugatPernahHadir: true };
  const MEDIASI = { dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true };

  it("pencegahan perkawinan (Pdt.P): kabul [01], tolak [03], cabut [98], gugur [98a], coret [98c], NO SEMA [99], NO lain [99a] dengan varian [99b]/[99]", () => {
    const j = { jenisPerkara: "Pencegahan Perkawinan", nomorPerkara: "5/Pdt.P/2026/PA.Dgl" };
    expect(put({ ...j, statusPutusan: "Dikabulkan" })).toMatchObject({ berkas: "[01] [Kabul] Pencegahan Perkawinan - Calon Mempelai Hadir", folder: PC.putusan, menu: "Putusan Pencegahan Perkawinan" });
    expect(put({ ...j, statusPutusan: "Dikabulkan" })!.semua).toContain("[01a] [Kabul] Pencegahan Perkawinan - Calon Mempelai Tidak Hadir");
    expect(put({ ...j, statusPutusan: "Ditolak" })!.berkas).toBe("[03] [Tolak] Pencegahan Perkawinan - Alasan Pencegahan Tidak Terbukti");
    expect(put({ ...j, statusPutusan: "Dicabut" })!.berkas).toBe("[98] [Cabut] Pencegahan Perkawinan - Permohonan Ditarik Kembali");
    expect(put({ ...j, statusPutusan: "Digugurkan" })!.berkas).toMatch(/^\[98a\] \[Gugur\] Pencegahan/);
    expect(put({ ...j, statusPutusan: "Gugur" })!.berkas).toMatch(/^\[98a\] \[Gugur\] Pencegahan/);
    expect(put({ ...j, statusPutusan: "Dicoret dari Register" })!.berkas).toMatch(/^\[98c\] \[Coret\] Pencegahan/);
    expect(put({ ...j, statusPutusan: "Tidak Dapat Diterima", ...SEMA })!.berkas).toMatch(/^\[99\] \[NO\] Pencegahan Perkawinan - Pemohon Tidak Hadir Lagi \(SEMA 1 2022\)/);
    const no = put({ ...j, statusPutusan: "Tidak Dapat Diterima" })!;
    expect(no.berkas).toMatch(/^\[99a\] \[NO\] Pencegahan Perkawinan - Pemohon Tidak Berhak Mencegah/);
    expect(no.semua.slice(1).map((x) => x.slice(0, 5))).toEqual(["[99b]", "[99] "]);
    // sidang yang akan memutus, status belum tercatat: perkiraan dikabulkan
    const belum = rekomendasiBlangko({ ...j, urutanSidang: 3, dihadiriOleh: 1, agenda: "Pembacaan penetapan" }).putusan[0];
    expect(belum).toMatchObject({ perkiraan: true, folder: `${A}${PC.putusan}` });
    expect(belum.berkas).toMatch(/^\[01\] \[Kabul\] Pencegahan/);
  });

  for (const [nama, jenis, B, tutup] of [
    ["wasiat", { jenisPerkara: "Wasiat", nomorPerkara: "12/Pdt.G/2026/PA.Dgl" }, WS, "Wasiat"],
    ["ekonomi syariah ACARA BIASA (nomor Pdt.G)", { jenisPerkara: "Ekonomi Syariah", nomorPerkara: "12/Pdt.G/2026/PA.Dgl" }, ESB, "ES Acara Biasa"],
  ] as const) {
    it(`${nama}: kabul kontradiktoir [01], T tidak hadir setelah mediasi [01a], verstek [01b]/[03b], tolak, damai, cabut [98] (+[98b]), gugur, coret, NO SEMA [99], NO formil [99a]`, () => {
      const ada = (r: ReturnType<typeof put>) => {
        expect(r, nama).toMatchObject({ folder: B.putusan, menu: B.menuPutusan });
        return r!.berkas;
      };
      expect(ada(put({ ...jenis, statusPutusan: "Dikabulkan" }))).toMatch(new RegExp(`^\\[01\\] \\[Kabul\\] .*${tutup}`));
      expect(ada(put({ ...jenis, statusPutusan: "Dikabulkan", ...MEDIASI }))).toMatch(/^\[01a\] \[Kabul\] .*T Tidak Hadir Setelah Mediasi/);
      expect(ada(put({ ...jenis, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 }))).toMatch(/^\[01b\] \[Kabul Verstek\]/);
      expect(ada(put({ ...jenis, statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: null, mediasiTerbaca: true, tergugatPernahHadir: false }))).toMatch(/^\[01b\]/); // verstek tanpa bendera
      expect(ada(put({ ...jenis, statusPutusan: "Ditolak" }))).toMatch(/^\[03\] \[Tolak\] /);
      expect(ada(put({ ...jenis, statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 }))).toMatch(/^\[03b\] \[Tolak Verstek\]/);
      expect(ada(put({ ...jenis, statusPutusan: "Perdamaian" }))).toMatch(/^\[97\] \[Perdamaian\] /);
      const cabut = put({ ...jenis, statusPutusan: "Dicabut" });
      expect(ada(cabut)).toMatch(/^\[98\] \[Cabut\] /);
      expect(cabut!.semua[1]).toMatch(/^\[98b\] \[Cabut\] .*Sesudah Jawaban dengan Persetujuan T/);
      expect(ada(put({ ...jenis, statusPutusan: "Digugurkan" }))).toMatch(/^\[98a\] \[Gugur\] /);
      expect(ada(put({ ...jenis, statusPutusan: "Gugur" }))).toMatch(/^\[98a\] \[Gugur\] /);
      expect(ada(put({ ...jenis, statusPutusan: "Dicoret dari Register" }))).toMatch(/^\[98c\] \[Coret\] /);
      expect(ada(put({ ...jenis, statusPutusan: "Tidak Dapat Diterima", ...SEMA }))).toMatch(/^\[99\] \[NO\] .*SEMA 1 2022/);
      const no = put({ ...jenis, statusPutusan: "Tidak Dapat Diterima" });
      expect(ada(no)).toMatch(/^\[99a\] \[NO\] /);
      expect(no!.semua[1]).toMatch(/^\[99\] \[NO\] /);
      const belum = rekomendasiBlangko({ ...jenis, urutanSidang: 6, dihadiriOleh: 1, agenda: "Pembacaan putusan" }).putusan[0];
      expect(belum).toMatchObject({ perkiraan: true, folder: `${A}${B.putusan}` });
      expect(belum.berkas).toMatch(/^\[01\] \[Kabul\] /);
    });
  }

  it("ES dipilih menurut NOMOR: Pdt.G.S dan nomor tak diketahui tetap blangko gugatan sederhana (F21), Pdt.G acara biasa; Lain-Lain/jenis lain tidak terpengaruh", () => {
    const sederhana = { jenisPerkara: "Ekonomi Syariah", nomorPerkara: "2/Pdt.G.S/2025/PA.Dgl" };
    expect(put({ ...sederhana, statusPutusan: "Dikabulkan" })).toMatchObject({ berkas: "[01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadir", folder: "10 Ekonomi Syariah" });
    expect(put({ ...sederhana, statusPutusan: "Tidak Dapat Diterima" })!.berkas).toMatch(/^\[99\] \[NO\] ES Gugatan Sederhana/);
    expect(put({ ...sederhana, statusPutusan: "Dikabulkan", ...MEDIASI })!.folder).toBe("10 Ekonomi Syariah");
    expect(put({ jenisPerkara: "Ekonomi Syariah", statusPutusan: "Dikabulkan" })).toMatchObject({ folder: "10 Ekonomi Syariah" }); // nomor tak diketahui: tidak ditebak
    expect(put({ jenisPerkara: "Ekonomi Syariah", nomorPerkara: "2/Pdt.G/2025/PA.Dgl", statusPutusan: "Dikabulkan" })).toMatchObject({ folder: ESB.putusan });
    // Pdt.G.S tidak pernah memakai blangko acara biasa walau coret (tidak ada baris sederhana untuk coret -> jatuh ke blangko jenis, bukan 10a)
    expect(put({ ...sederhana, statusPutusan: "Dicoret dari Register" })?.folder ?? "10 Ekonomi Syariah").toBe("10 Ekonomi Syariah");
    expect(put({ jenisPerkara: "Harta Bersama", nomorPerkara: "2/Pdt.G/2025/PA.Dgl", statusPutusan: "Dikabulkan" })!.folder).toBe("4a Harta Bersama");
  });

  it("keadaan putusan: kode es-biasa* hanya untuk ES bernomor Pdt.G, gabungan didahulukan; wasiat mengenal mediasi/verstek seperti cerai", () => {
    const g = "12/Pdt.G/2026/PA.Dgl";
    expect(keadaanPutusan({ jenisPerkara: "Ekonomi Syariah", nomorPerkara: g, dihadiriOleh: 1 })).toEqual(["es-biasa", "kontradiktoir"]);
    expect(keadaanPutusan({ jenisPerkara: "Ekonomi Syariah", nomorPerkara: g, verstekPutusan: true, dihadiriOleh: 2 })).toEqual(["es-biasa-verstek", "es-biasa"]);
    expect(keadaanPutusan({ jenisPerkara: "Ekonomi Syariah", nomorPerkara: g, ...MEDIASI, panggilan: { tergugatPernahHadir: true } })).toEqual([
      "es-biasa-setelah-mediasi",
      "es-biasa",
      "t-tidak-hadir-setelah-mediasi",
      "sesudah-mediasi",
    ]);
    expect(keadaanPutusan({ jenisPerkara: "Ekonomi Syariah", nomorPerkara: g, dihadiriOleh: 4, panggilan: { hadirSebelumnya: 4, penggugatPernahHadir: true } })).toEqual(["es-biasa-sema-1-2022", "es-biasa", "sema-1-2022"]);
    for (const nomor of ["2/Pdt.G.S/2025/PA.Dgl", "", undefined]) expect(keadaanPutusan({ jenisPerkara: "Ekonomi Syariah", nomorPerkara: nomor, dihadiriOleh: 1 }).some((k) => k.startsWith("es-biasa"))).toBe(false);
    expect(keadaanPutusan({ jenisPerkara: "Wasiat", nomorPerkara: g, dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, panggilan: { tergugatPernahHadir: true } })).toContain("t-tidak-hadir-setelah-mediasi");
    expect(keadaanPutusan({ jenisPerkara: "Wasiat", nomorPerkara: g, dihadiriOleh: 2, mediasi: null, mediasiTerbaca: true, panggilan: { tergugatPernahHadir: false } })).toContain("verstek-tanpa-bendera");
    expect(keadaanPutusan({ jenisPerkara: "Pencegahan Perkawinan", nomorPerkara: "5/Pdt.P/2026/PA.Dgl", dihadiriOleh: 1 })).toEqual([]);
  });
});

describe("C. BAS massal per sidang", () => {
  const t = (jenisPerkara: string, nomorPerkara: string, m: Partial<Parameters<typeof tentukanBasBaru>[0]> = {}) => {
    const h = tentukanBasBaru({ jenisPerkara, nomorPerkara, urutanSidang: 1, dihadiriOleh: 1, ...m });
    return { h, id: h?.alur.id ?? null, kode: h?.langkah.kode ?? null, folder: h?.alur.folder.replace(A, "") ?? null };
  };

  it("jenis perkara -> jenis BAS baru (pencegahan, wasiat, ES menurut nomor)", () => {
    expect(jenisBasBaru("Pencegahan Perkawinan", "5/Pdt.P/2026/PA.Dgl")).toBe("pencegahan");
    expect(jenisBasBaru("Wasiat", "12/Pdt.G/2026/PA.Dgl")).toBe("wasiat");
    expect(jenisBasBaru("Ekonomi Syariah", "2/Pdt.G.S/2025/PA.Dgl")).toBe("es");
    expect(jenisBasBaru("Ekonomi Syariah", "2/Pdt.G/2025/PA.Dgl")).toBe("es-biasa");
    expect(jenisBasBaru("Ekonomi Syariah", "")).toBe("");
  });

  for (const [nama, jenis, id, B] of [
    ["wasiat", "Wasiat", "alur-42", WS],
    ["ES acara biasa", "Ekonomi Syariah", "alur-43", ESB],
  ] as const) {
    it(`${nama}: verstek V1/V2, P tidak hadir TP, 2x tidak hadir NO, damai AP, cabut CB; kontradiktoir = salinan ALUR 04 di ${B.bas}`, () => {
      const G = "12/Pdt.G/2026/PA.Dgl";
      expect(t(jenis, G, { dihadiriOleh: 2 })).toMatchObject({ id, kode: "V1", folder: B.bas });
      expect(t(jenis, G, { dihadiriOleh: 2, urutanSidang: 2 })).toMatchObject({ id, kode: "V2" });
      expect(t(jenis, G, { dihadiriOleh: 4, urutanSidang: 2 })).toMatchObject({ id, kode: "TP" });
      expect(t(jenis, G, { akhir: "no", dihadiriOleh: 4, urutanSidang: 3 })).toMatchObject({ id, kode: "NO" });
      expect(t(jenis, G, { urutanSidang: 2, agenda: "Laporan mediasi - akta perdamaian" })).toMatchObject({ id, kode: "AP" });
      expect(t(jenis, G, { akhir: "cabut" })).toMatchObject({ id, kode: "CB" });
      const kontra = t(jenis, G, { urutanSidang: 3, agenda: "Jawaban" });
      expect(kontra).toMatchObject({ id: "alur-04", kode: "3", folder: B.bas });
      expect(kontra.h!.langkah.berkas).toMatch(/^BAS ALUR 04 \[3\] BAS 3 P & T Hadir/);
      // sidang 1 kontradiktoir: ada mediasi di folder ini (tidak seperti pembatalan perkawinan)
      expect(t(jenis, G, { urutanSidang: 1, dihadiriOleh: 1 }).h!.langkah.berkas).toMatch(/^BAS ALUR 04 \[1\] BAS 1 P & T Hadir - Mediasi/);
      for (const x of [kontra.h!.langkah.berkas, ...ALUR_BAS_BARU.find((a) => a.id === id)!.langkah.map((l) => l.berkas)]) expect(FIX.berkas, x).toContain(`${A}${B.bas}/${x}`);
    });
  }

  it("ES: nomor Pdt.G.S tetap ALUR 40, Pdt.G ALUR 43, nomor tak diketahui tanpa BAS; wasiat tidak mengambil ALUR 38/39", () => {
    expect(t("Ekonomi Syariah", "2/Pdt.G.S/2025/PA.Dgl", { dihadiriOleh: 2 })).toMatchObject({ id: "alur-40", kode: "1b" });
    expect(t("Ekonomi Syariah", "2/Pdt.G/2025/PA.Dgl", { dihadiriOleh: 2 })).toMatchObject({ id: "alur-43", kode: "V1" });
    expect(t("Ekonomi Syariah", "", { dihadiriOleh: 2 }).h).toBeNull();
    expect(t("Wasiat", "12/Pdt.G/2026/PA.Dgl", { dihadiriOleh: 2 }).id).toBe("alur-42");
  });

  it("pencegahan perkawinan (ALUR 41): sidang 1 hadir [1a]/[1] dan tidak hadir [1b], lanjutan [2]/[2b], penetapan [3], T/G/N/C", () => {
    const P = "5/Pdt.P/2026/PA.Dgl";
    expect(t("Pencegahan Perkawinan", P)).toMatchObject({ id: "alur-41", kode: "1a", folder: PC.bas });
    expect(t("Pencegahan Perkawinan", P).h!.perkiraan).toBe(true);
    expect(t("Pencegahan Perkawinan", P, { agenda: "Pembuktian dan pembacaan penetapan" }).kode).toBe("1");
    expect(t("Pencegahan Perkawinan", P, { agenda: "Calon mempelai tidak hadir, tunda panggil" }).kode).toBe("1b");
    expect(t("Pencegahan Perkawinan", P, { dihadiriOleh: 4 }).kode).toBe("T");
    expect(t("Pencegahan Perkawinan", P, { dihadiriOleh: 4, urutanSidang: 2 }).kode).toBe("G");
    expect(t("Pencegahan Perkawinan", P, { urutanSidang: 2 }).kode).toBe("2");
    expect(t("Pencegahan Perkawinan", P, { urutanSidang: 2, agenda: "Pembacaan penetapan" }).kode).toBe("2b");
    expect(t("Pencegahan Perkawinan", P, { urutanSidang: 3 }).kode).toBe("3");
    expect(t("Pencegahan Perkawinan", P, { akhir: "cabut" }).kode).toBe("C");
    expect(t("Pencegahan Perkawinan", P, { akhir: "gugur", dihadiriOleh: 4 }).kode).toBe("G");
    expect(t("Pencegahan Perkawinan", P, { akhir: "no", dihadiriOleh: 4, urutanSidang: 3 }).kode).toBe("N");
  });

  it("rekomendasiBlangko: BAS pencegahan/wasiat/ES acara biasa selalu berkas di folder '<jenis> - BAS' dengan nama menu ABT-nya (140/142/144)", () => {
    const r = (jenisPerkara: string, nomorPerkara: string, m: object = {}) => rekomendasiBlangko({ jenisPerkara, nomorPerkara, urutanSidang: 1, dihadiriOleh: 2, ...m }).bas;
    const pc = r("Pencegahan Perkawinan", "5/Pdt.P/2026/PA.Dgl", { dihadiriOleh: 1 });
    expect(pc[0]).toMatchObject({ utama: true, folder: `${A}${PC.bas}`, menu: "Pencegahan Perkawinan - BAS", alias: expect.arrayContaining(["Pencegahan Nikah - BAS"]) });
    expect(pc[0].berkas).toMatch(/^BAS ALUR 41 Pencegahan - \[1a\]/);
    const ws = r("Wasiat", "12/Pdt.G/2026/PA.Dgl");
    expect(ws[0]).toMatchObject({ utama: true, folder: `${A}${WS.bas}`, menu: "Wasiat - BAS", alias: expect.arrayContaining(["Wasiat - BAS"]) });
    expect(ws[0].berkas).toMatch(/^BAS ALUR 42 Wasiat - Sidang 1 - P Hadir & T Tidak Hadir/);
    const es = r("Ekonomi Syariah", "12/Pdt.G/2026/PA.Dgl", { urutanSidang: 2 });
    expect(es[0]).toMatchObject({ utama: true, folder: `${A}${ESB.bas}`, menu: "Ekonomi Syariah (Acara Biasa) - BAS", alias: expect.arrayContaining(["ES Acara Biasa - BAS"]) });
    expect(es[0].berkas).toMatch(/^BAS ALUR 43 ES Acara Biasa - Sidang 2 - T Tetap Tidak Hadir/);
    for (const x of [...pc, ...ws, ...es]) expect(FIX.berkas, x.berkas).toContain(`${x.folder}/${x.berkas}`);
  });
});

describe("D. set pohon dan kunci baku", () => {
  const putusanCocok = (jenis: string, nomor?: string) => setUntukPerkara(jenis, nomor).filter((s) => s.cocok && s.jenis === "putusan").map((s) => s.folder.replace(A, ""));

  it("set putusan ada di SET_BLANGKO; folder BAS ditemukan dari server menjadi set BAS yang cocok jenisnya (ES menurut nomor)", () => {
    for (const j of BARU) expect(SET_BLANGKO.find((s) => s.folder === `${A}${j.putusan}`), j.putusan).toMatchObject({ jenis: "putusan" });
    const gabung = setBlangkoGabung(FIX.berkas.map((b) => b.split("/")[1]).filter((v, i, a) => a.indexOf(v) === i));
    for (const j of BARU) expect(gabung.find((x) => x.folder === `${A}${j.bas}`), j.bas).toMatchObject({ jenis: "bas" });
    expect(jenisPerkaraDariFolder(PC.bas).untuk).toContain("pencegahan perkawinan");
    expect(jenisPerkaraDariFolder(WS.bas).untuk).toContain("wasiat");
    expect(jenisPerkaraDariFolder(ESB.bas).untuk).toContain("ekonomi syariah");
    const set = (folder: string) => gabung.find((x) => x.folder === `${A}${folder}`)!;
    expect(set(ESB.bas).syaratNomor).toBe("gugatan-biasa");
    expect(set("10 Ekonomi Syariah - BAS").syaratNomor).toBe("gugatan-sederhana");
    expect(setCocokPerkara(set(ESB.bas), "Ekonomi Syariah", "2/Pdt.G/2025/PA.Dgl")).toBe(true);
    expect(setCocokPerkara(set(ESB.bas), "Ekonomi Syariah", "2/Pdt.G.S/2025/PA.Dgl")).toBe(false);
    expect(setCocokPerkara(set("10 Ekonomi Syariah - BAS"), "Ekonomi Syariah", "2/Pdt.G.S/2025/PA.Dgl")).toBe(true);
    expect(setCocokPerkara(set("10 Ekonomi Syariah - BAS"), "Ekonomi Syariah", "2/Pdt.G/2025/PA.Dgl")).toBe(false);
  });

  it("ES: nomor Pdt.G.S -> 10, Pdt.G -> 10a, tanpa nomor -> keduanya; pencegahan dan wasiat menurut jenisnya", () => {
    expect(putusanCocok("Ekonomi Syariah", "2/Pdt.G.S/2025/PA.Dgl")).toEqual(["10 Ekonomi Syariah"]);
    expect(putusanCocok("Ekonomi Syariah", "2/Pdt.G/2025/PA.Dgl")).toEqual([ESB.putusan]);
    expect(putusanCocok("Ekonomi Syariah").sort()).toEqual(["10 Ekonomi Syariah", ESB.putusan].sort());
    expect(putusanCocok("Pencegahan Perkawinan", "5/Pdt.P/2026/PA.Dgl")).toEqual([PC.putusan]);
    expect(putusanCocok("Wasiat", "12/Pdt.G/2026/PA.Dgl")).toEqual([WS.putusan]);
    expect(putusanCocok("Harta Bersama")).not.toContain(WS.putusan);
  });

  it("kunci baku Pemetaan blangko: putusan + Pencegahan Perkawinan, Wasiat; BAS 17 jenis x 11 keadaan", () => {
    const kunci = KUNCI_BAKU.putusan.map((k) => k.kunci);
    expect(kunci).toEqual(expect.arrayContaining(["Pencegahan Perkawinan", "Wasiat", "Ekonomi Syariah"]));
    expect(KUNCI_BAKU.putusan.find((k) => k.kunci === "Ekonomi Syariah")!.sebutan).toMatch(/gugatan sederhana dan acara biasa/);
    expect(JENIS_BAS_BAKU).toEqual(expect.arrayContaining(["Pencegahan Perkawinan", "Wasiat"]));
    expect(JENIS_BAS_BAKU).toHaveLength(32); // W3a 21 Okt: + 6 jenis (343, 345, 351, 352, 359, 361); W3b 21 Okt: + 5 jenis keluarga/wali (353, 355, 356, 357, 350); // I23 18 Okt: + Nafkah Anak Pasca Perceraian; I28 18 Okt: + Hibah, Wakaf, Penetapan Mafqud
    expect(KUNCI_BAKU.bas).toHaveLength(32 * 11); // W3a + W3b 21 Okt: 32 jenis
    expect(kunciJenisPerkara("Pencegahan Perkawinan")).toBe("pencegahan perkawinan");
    expect(kunciJenisPerkara("Wasiat")).toBe("wasiat");
  });
});

describe("E. label isian 9460-9493 dan huruf kunci", () => {
  const D = (kode: string, nama: string, jenis = "data_teks", sql = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan: "" }];
  const KATALOG = new Map<string, Definisi>([
    D("9460", "PENCEGAHAN NIKAH: NAMA CALON ISTRI - ISIAN (nama lengkap binti ...; nama calon suami diisi di #1029#)"),
    D("9461", 'PENCEGAHAN NIKAH: WILAYAH KUA TEMPAT PERKAWINAN AKAN DILANGSUNGKAN - ISIAN (tulis "Kecamatan ..., Kabupaten ...")'),
    D("9462", "PENCEGAHAN NIKAH: KEDUDUKAN #0046# - ISIAN (mis. ayah kandung calon istri, wali nikah, istri sah calon suami, Pegawai Pencatat Nikah KUA ...)"),
    D("9463", "PENCEGAHAN NIKAH: ALASAN (1 huruf) A masih terikat perkawinan, B di bawah umur, C larangan nasab/semenda/susuan, D masa iddah, E beda agama, F talak tiga/li'an, G tanpa persetujuan/izin, H pengampuan"),
    D("9464", 'PENCEGAHAN NIKAH: DASAR HUKUM ALASAN (OTOMATIS dari isian 9463: pasal UU 1/1974 & KHI menurut huruf alasan)', "data_sql", "SELECT CASE UPPER(LEFT(IFNULL((SELECT TRIM(t.data) FROM abt_data_teks t WHERE t.no_var = 9463 AND t.perkara_id = '#perkara_id#' LIMIT 1), ''), 1)) WHEN 'A' THEN 'x' END AS data"),
    D("9466", "PENCEGAHAN NIKAH: FAKTA ALASAN PENCEGAHAN YANG TERBUKTI - ISIAN (uraian singkat dari bukti, saksi dan keterangan calon mempelai)"),
    D("9467", "PENCEGAHAN NIKAH (TOLAK): PERTIMBANGAN MENGAPA ALASAN PENCEGAHAN TIDAK TERBUKTI / TIDAK BERALASAN HUKUM"),
    D("9470", "PENCEGAHAN NIKAH: ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.; tanpa teks satker tetap)"),
    D("9475", "WASIAT: POKOK TUNTUTAN (1 huruf) A lebih 1/3 harta, B kepada ahli waris tanpa persetujuan, C syarat pewasiat/bentuk, D harta bukan milik pewasiat, E batal KHI 197, F sahkan & serahkan, G wajibah"),
    D("9476", "WASIAT: DASAR HUKUM POKOK TUNTUTAN (OTOMATIS dari isian 9475: pasal KHI menurut huruf)", "data_sql", "SELECT CASE UPPER(LEFT(IFNULL((SELECT TRIM(t.data) FROM abt_data_teks t WHERE t.no_var = 9475 AND t.perkara_id = '#perkara_id#' LIMIT 1), ''), 1)) WHEN 'A' THEN 'x' END AS data"),
    D("9480", "WASIAT: PENERIMA WASIAT - ISIAN (nama/sebutan; kosong = #7036# untuk pokok tuntutan F/G, selain itu #7037#)"),
    D("9485", "WASIAT (NO KURANG PIHAK): PIHAK YANG BERKEPENTINGAN TETAPI TIDAK DITARIK SEBAGAI PIHAK - ISIAN"),
    D("9488", "WASIAT: ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.; tanpa teks satker tetap)"),
    D("9490", "EKONOMI SYARIAH (NO ARBITRASE): KLAUSULA ARBITRASE DALAM AKAD - ISIAN (pasal akad dan lembaga arbitrase yang dipilih)"),
    D("9491", "EKONOMI SYARIAH (NO ARBITRASE): POKOK EKSEPSI #0047# - ISIAN (satu kalimat)"),
    D("9493", "EKONOMI SYARIAH (ACARA BIASA): ALAT BUKTI SURAT #0047# - ISIAN (daftar bukti T.1 dst.)"),
  ]);

  it("label awam tanpa nomor variabel; 9463 dan 9475 berpilihan huruf; 9464/9476 otomatis", () => {
    const s = susunIsian([...KATALOG.keys()], KATALOG);
    const peta = Object.fromEntries(s.isian.map((b) => [b.kode, b]));
    expect(Object.keys(peta).sort()).toEqual(["9460", "9461", "9462", "9463", "9466", "9467", "9470", "9475", "9480", "9485", "9488", "9490", "9491", "9493"]);
    expect(peta["9460"].nama).toMatch(/^Nama calon istri/);
    expect(peta["9462"].nama).toMatch(/^Kedudukan Penggugat\/Pemohon terhadap calon mempelai/);
    expect(peta["9463"].nama).toBe("Alasan pencegahan perkawinan (pilih satu huruf)");
    expect(peta["9463"].pilihan).toHaveLength(8);
    expect(peta["9463"].pilihan[0]).toBe("A · calon mempelai masih terikat perkawinan");
    expect(peta["9463"].dipakaiOleh).toContain("9464"); // "mengubah dasar hukum otomatis"
    expect(peta["9475"].nama).toBe("Pokok tuntutan wasiat (pilih satu huruf)");
    expect(peta["9475"].pilihan).toHaveLength(7);
    expect(peta["9475"].dipakaiOleh).toContain("9476");
    expect(peta["9480"].nama).toBe("Penerima wasiat (nama atau sebutan; kosong = otomatis)");
    expect(peta["9491"].nama).toBe("Pokok eksepsi Tergugat/Termohon (satu kalimat)");
    expect(peta["9493"].nama).toMatch(/^Alat bukti surat Tergugat\/Termohon/);
    for (const b of Object.values(peta)) expect(b.nama, b.kode).not.toMatch(/\b9[0-9]{3}\b|OTOMATIS|ISIAN|#\d{4}#/);
    expect(s.otomatis.map((o) => o.kode).sort()).toEqual(["9464", "9476"]);
  });

  it("konseptor: alasan, fakta, pertimbangan tolak masuk langkah pertimbangan hukum; bukti surat ke langkah bukti", () => {
    for (const kode of ["9463", "9466", "9467", "9475", "9482", "9483", "9485", "9490", "9491"]) expect(langkahUntukIsian({ kode, nama: "x" }), kode).toBe("pertimbangan");
    for (const kode of ["9470", "9488", "9489", "9492", "9493"]) expect(langkahUntukIsian({ kode, nama: "Alat bukti surat Penggugat/Pemohon" }), kode).toBe("bukti");
  });

  it("ekstensi: 9463 dan 9475 ditulis ke ABT hanya hurufnya (pilihan 'A · uraian' -> 'A'); isian lain tidak diubah", () => {
    const sumber = readFileSync(path.resolve(__dirname, "../../../ekstensi-sipp/blangko-derry-isian.js"), "utf8");
    expect(sumber).toContain('kode === "8503" || kode === "9463" || kode === "9475" || kode === "9790" || kode === "9820" || kode === "9865" ? nilaiSimpan8503(nilai) : nilai'); // I28 18 Okt: + 9790, 9820, 9865
    const awal = sumber.indexOf("function nilaiSimpan8503(teks) {");
    const akhir = sumber.indexOf("const alasanHuruf = ", awal);
    const fn = vm.runInNewContext(`(${sumber.slice(awal, akhir).trim()})`) as (t: string) => string;
    expect(fn("A · calon mempelai masih terikat perkawinan")).toBe("A");
    expect(fn("G · wasiat wajibah")).toBe("G");
    expect(fn("e")).toBe("e");
  });
});
