// @vitest-environment node
/**
 * ============================================================================
 * BLANGKO DERRY BARU GELOMBANG 3 (W3b, 21 Okt): pencabutan kekuasaan orang tua (353), pencabutan kekuasaan wali (355), penunjukan wali (356),
 * ganti rugi terhadap wali (357), nafkah anak oleh ibu karena ayah tidak mampu (350), eksekusi.
 * ============================================================================
 *
 * Paket abt-paket/w3b-blangko-baru-kuasa-wali: 274 berkas RTF, 14 menu (240-253), ALUR BAS 70-76, variabel 3800-3999.
 * Yang dijaga: (A) integritas paket (berkas ada di disk dan md5 cocok dengan daftar, menu dan ALUR tidak bentrok, tanpa kata ALETA, nomor variabel dalam jatah);
 * (B) ALUR 70-76 dan pemilihan BAS; (C) keadaan permohonan / gugatan; (D) pemilihan putusan; (E) TS = panel-alat.js; (F) label isian awam; (G) katalog saksi.
 * Batas: tidak ada perkara jenis 353/355/356/357/350 di SIPP, jadi pemilihan diuji dengan masukan buatan; tampilan RTF di ABT sungguhan belum teruji.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RAMAH_W3B } from "@/app/api/aleta-ecourt/blangko-derry/ramah-w3b";
import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { ALUR_BAS_BARU, jenisBasBaru, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { ALUR_BAS_W3B } from "@/lib/alur-bas-w3b-data";
import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { jenisPerkaraIdDariNama } from "@/lib/pandu-saksi";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";
import { semuaSalinanBas } from "@/lib/salinan-bas-jenis";
import { SALINAN_BAS_JENIS } from "@/lib/salinan-bas-jenis-data";
import { jenisPerkaraDariFolder } from "@/lib/tugas-blangko";
import { FOLDER_MENU_W3B, JENIS_W3B } from "@/lib/w3b-jenis-data";

import { muatPanelAlat, pilihDariPanel } from "./panel-alat-vm";

type Fix = { berkas: string[]; menu: Array<{ id: number; nama: string; nama_alias: string; direktori: string }> };
// Fixture bersama (keadaan server 17 Okt + paket yang belum terpasang); berkas dan menu paket W3b ditambahkan oleh alat/buat_fixture_uji.py.
const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as Fix;
const AKAR_REPO = path.resolve(__dirname, "../../..");
const PAKET = path.join(AKAR_REPO, "abt-paket", "w3b-blangko-baru-kuasa-wali", "paket-satker");
const A = "derry_briantono/";
const nama = (x: string) => x.replace(/\.rtf$/, "");
const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
  const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
  return r.length ? { berkas: nama(r[0].berkas), folder: r[0].folder.replace(A, ""), semua: r.map((x) => nama(x.berkas)) } : null;
};
const gugatan = (j: (typeof JENIS_W3B)[number]) => ({ jenisPerkara: j.namaSipp, nomorPerkara: "5/Pdt.G/2026/PA.Dgl" });
const mohon = (j: (typeof JENIS_W3B)[number]) => ({ jenisPerkara: j.namaSipp, nomorPerkara: "5/Pdt.P/2026/PA.Dgl" });
const JENIS_PERKARA = JENIS_W3B.filter((j) => j.idJenis !== null);
const JENIS_GUGATAN = JENIS_PERKARA.filter((j) => j.gugatan);
const JENIS_MOHON = JENIS_PERKARA.filter((j) => j.permohonan);

describe("A. integritas paket", () => {
  const daftar = readFileSync(path.join(PAKET, "daftar-rtf.tsv"), "utf8")
    .split("\n")
    .filter((b) => b.trim() && !b.startsWith("#"))
    .map((b) => b.split("\t"));

  it("274 berkas baru: semua ada di folder rtf paket dan md5 sama dengan daftar", () => {
    expect(daftar).toHaveLength(274);
    for (const [folder, berkas, md5] of daftar) {
      const f = path.join(PAKET, "..", "rtf", folder, berkas);
      expect(existsSync(f), `${folder}/${berkas}`).toBe(true);
      expect(createHash("md5").update(readFileSync(f)).digest("hex"), `${folder}/${berkas}`).toBe(md5);
    }
  });

  it("MD5SUMS memuat md5 dari semua berkas SQL dan skrip paket", () => {
    const sums = readFileSync(path.join(PAKET, "MD5SUMS.txt"), "utf8").split("\n").filter(Boolean);
    expect(sums.length).toBeGreaterThanOrEqual(8 + 274);
    for (const baris of sums) {
      const m = /^([0-9a-f]{32})\s+(.+)$/.exec(baris);
      expect(m, baris).not.toBeNull();
      if (m![2].startsWith("rtf/")) continue; // berkas RTF diperiksa lewat daftar-rtf.tsv di atas
      expect(createHash("md5").update(readFileSync(path.join(PAKET, m![2]))).digest("hex"), m![2]).toBe(m![1]);
    }
  });

  it("tidak satu pun berkas SQL, skrip, atau RTF paket memuat kata ALETA", () => {
    for (const nm of ["PASANG", "PERIKSA", "PRASYARAT", "PULIH"]) {
      const sql = readFileSync(path.join(PAKET, `abt-w3b-blangko-baru-kuasa-wali-${nm}.sql`), "latin1");
      expect(/aleta/i.test(sql), nm).toBe(false);
    }
    for (const [folder, berkas] of daftar) {
      expect(/aleta/i.test(readFileSync(path.join(PAKET, "..", "rtf", folder, berkas), "latin1")), `${folder}/${berkas}`).toBe(false);
    }
  });

  it("menu 240-253 dan folder tidak bentrok dengan menu server (fixture 17 Okt); tiap jenis punya pasangan putusan + BAS", () => {
    const idBaru = new Set(JENIS_W3B.flatMap((j) => [j.menuPutusan.id, j.menuBas.id]));
    const folderBaru = new Set(JENIS_W3B.flatMap((j) => [j.folder, j.folderBas]));
    const idLama = new Set(FIX.menu.filter((m) => !idBaru.has(m.id)).map((m) => m.id));
    const dirLama = new Set(FIX.menu.filter((m) => !idBaru.has(m.id)).map((m) => m.direktori));
    // tiap id dan folder paket muncul tepat sekali di fixture (tidak ada yang dobel dengan menu lama)
    for (const id of idBaru) expect(FIX.menu.filter((m) => m.id === id), `id ${id}`).toHaveLength(1);
    for (const f of folderBaru) expect(FIX.menu.filter((m) => m.direktori === f), f).toHaveLength(1);
    expect(JENIS_W3B).toHaveLength(7);
    const ids: number[] = [];
    for (const j of JENIS_W3B) {
      ids.push(j.menuPutusan.id, j.menuBas.id);
      expect(j.menuBas.id, j.kunci).toBe(j.menuPutusan.id + 1);
      for (const id of [j.menuPutusan.id, j.menuBas.id]) {
        expect(id, j.kunci).toBeGreaterThanOrEqual(240);
        expect(id, j.kunci).toBeLessThanOrEqual(253);
        expect(idLama.has(id), `${j.kunci} id ${id}`).toBe(false);
      }
      for (const f of [j.folder, j.folderBas]) expect(dirLama.has(f), f).toBe(false);
      expect(j.folderBas, j.kunci).toBe(`${j.folder} - BAS`);
      expect(j.menuBas.nama, j.kunci).toMatch(/ - BAS$/);
      expect(j.menuBas.alias, j.kunci).toMatch(/ - BAS$/);
    }
    expect(new Set(ids).size).toBe(14);
    expect(FIX.menu.filter((m) => idBaru.has(m.id)).map((m) => m.id).sort((a, b) => a - b)).toEqual(ids.sort((a, b) => a - b));
  });

  it("variabel paket ada di jatah 3800-3999 dan nomor ALUR 70-76 unik terhadap ALUR lama", () => {
    const sql = readFileSync(path.join(PAKET, "abt-w3b-blangko-baru-kuasa-wali-PASANG.sql"), "latin1");
    const nomor = [...sql.matchAll(/INSERT INTO abt_variabel \([^)]*\) SELECT (\d{4}),/g)].map((m) => Number(m[1]));
    expect(nomor.length).toBeGreaterThanOrEqual(181);
    for (const n of nomor) {
      expect(n).toBeGreaterThanOrEqual(3800);
      expect(n).toBeLessThanOrEqual(3999);
    }
    expect(new Set(nomor).size).toBe(nomor.length);
    const nomorLama = ALUR_BAS_BARU.filter((a) => !ALUR_BAS_W3B.includes(a)).map((a) => a.nomor);
    expect(ALUR_BAS_W3B.map((a) => a.nomor).sort()).toEqual([70, 71, 72, 73, 74, 75, 76]);
    for (const a of ALUR_BAS_W3B) expect(nomorLama, `alur ${a.nomor}`).not.toContain(a.nomor);
  });

  it("semua berkas yang disebut tabel jenis ada di fixture paket (putusan di folder jenis)", () => {
    for (const j of JENIS_W3B) {
      for (const [kunci, b] of Object.entries(j.berkas)) expect(FIX.berkas, `${j.kunci} ${kunci}`).toContain(`${A}${j.folder}/${b}.rtf`);
    }
  });
});

describe("B. ALUR BAS 70-76", () => {
  const alur = (id: string) => ALUR_BAS_BARU.find((a) => a.id === id)!;

  it("tiap jenis punya ALUR dengan folder, menu, jenis perkara, dan semua berkas langkah ada di fixture", () => {
    for (const j of JENIS_W3B) {
      const a = alur(j.alur.id);
      expect(a, j.kunci).toBeDefined();
      expect(a.nomor, j.kunci).toBe(j.alur.nomor);
      expect(a.folder, j.kunci).toBe(`${A}${j.folderBas}`);
      expect(a.menu, j.kunci).toMatchObject({ id: j.menuBas.id, nama: j.menuBas.nama });
      if (j.idJenis !== null) expect([a.jenisMin, a.jenisMaks], j.kunci).toEqual([j.idJenis, j.idJenis]);
      expect(a.langkah.length, j.kunci).toBeGreaterThanOrEqual(8);
      for (const l of a.langkah) expect(FIX.berkas, `${j.kunci} ${l.berkas}`).toContain(`${a.folder}/${l.berkas}`);
    }
  });

  it("kode langkah: gugatan V1, V2, CB, TP, NO (+ AP bila damai); permohonan 1, 1a, 1b, 1c, 2, 2a, 2b, 3, T, N", () => {
    const KODE_M = ["1", "1a", "1b", "1c", "2", "2a", "2b", "3", "T", "N"];
    for (const j of JENIS_PERKARA) {
      const kode = alur(j.alur.id).langkah.map((l) => l.kode);
      if (j.gugatan) for (const k of ["V1", "V2", "CB", "TP", "NO"]) expect(kode, `${j.kunci} ${k}`).toContain(k);
      if (j.gugatan) expect(kode.includes("AP"), j.kunci).toBe(j.perdamaian);
      if (j.permohonan) for (const k of KODE_M) expect(kode, `${j.kunci} ${k}`).toContain(k);
      if (!j.gugatan) expect(kode.sort(), j.kunci).toEqual([...KODE_M].sort());
    }
  });

  it("29 salinan BAS ALUR 04-09 di folder BAS jenis gugatan sama persis dengan tabel salinan; permohonan saja (356) tanpa salinan", () => {
    for (const j of JENIS_W3B) {
      const salinan = FIX.berkas.filter((b) => b.startsWith(`${A}${j.folderBas}/`) && /\/BAS ALUR 0[4-9] /.test(b));
      const harap = j.gugatan ? 29 : 0;
      expect(salinan, j.kunci).toHaveLength(harap);
      if (!j.gugatan) continue;
      const dariTabel: string[] = [];
      for (const [folderSumber, isi] of Object.entries(SALINAN_BAS_JENIS)) {
        for (const berkasSumber of Object.keys(isi)) {
          if (!isi[berkasSumber].includes(j.folderBas)) continue;
          const s = semuaSalinanBas(folderSumber, berkasSumber).find((x) => x.folder === `${A}${j.folderBas}`);
          expect(s, `${folderSumber}/${berkasSumber}`).toBeDefined();
          dariTabel.push(`${A}${j.folderBas}/${s!.berkas}`);
        }
      }
      expect(dariTabel.sort(), j.kunci).toEqual([...salinan].sort());
    }
  });

  it("jenis dikenali dari nama SIPP; Pdt.P memilih ALUR permohonan, Pdt.G gugatan", () => {
    expect(jenisBasBaru("Pencabutan Kekuasaan Orang Tua", "5/Pdt.G/2026/PA.Dgl")).toBe("kuasa-asuh");
    expect(jenisBasBaru("Pencabutan Kekuasaan Orang Tua", "5/Pdt.P/2026/PA.Dgl")).toBe("kuasa-asuh-mohon");
    expect(jenisBasBaru("Pencabutan Kekuasaan Wali", "5/Pdt.G/2026/PA.Dgl")).toBe("kuasa-wali");
    expect(jenisBasBaru("Pencabutan Kekuasaan Wali", "5/Pdt.P/2026/PA.Dgl")).toBe("kuasa-wali-mohon");
    expect(jenisBasBaru("Penunjukan orang lain sebagai Wali oleh Pengadilan", "5/Pdt.P/2026/PA.Dgl")).toBe("penunjukan-wali");
    expect(jenisBasBaru("Ganti Rugi terhadap Wali", "5/Pdt.G/2026/PA.Dgl")).toBe("ganti-rugi-wali");
    expect(jenisBasBaru("Nafkah Anak Oleh Ibu karena Ayah tidak mampu", "5/Pdt.G/2026/PA.Dgl")).toBe("nafkah-anak-ibu");
    // nafkah anak pasca perceraian (jenis lama) tidak ikut berpindah
    expect(jenisBasBaru("Nafkah Anak", "5/Pdt.G/2026/PA.Dgl")).not.toBe("nafkah-anak-ibu");
  });

  it("tentukanBasBaru: gugatan sidang 1 P hadir T tidak hadir -> V1, sidang 2 T tetap tidak hadir -> V2, P tidak hadir -> TP, cabut -> CB, NO -> NO", () => {
    for (const j of JENIS_GUGATAN) {
      const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]>) => {
        const h = tentukanBasBaru({ urutanSidang: 3, dihadiriOleh: 1, ...gugatan(j), ...m });
        return h ? { id: h.alur.id, kode: h.langkah.kode } : null;
      };
      expect(t({ urutanSidang: 1, dihadiriOleh: 2, tergugatPernahHadir: false }), j.kunci).toEqual({ id: j.alur.id, kode: "V1" });
      expect(t({ urutanSidang: 2, dihadiriOleh: 2, tergugatPernahHadir: false }), j.kunci).toEqual({ id: j.alur.id, kode: "V2" });
      expect(t({ dihadiriOleh: 3 }), j.kunci).toEqual({ id: j.alur.id, kode: "TP" });
      expect(t({ akhir: "cabut" }), j.kunci).toEqual({ id: j.alur.id, kode: "CB" });
      expect(t({ akhir: "no" }), j.kunci).toEqual({ id: j.alur.id, kode: "NO" });
      if (j.perdamaian) expect(t({ agenda: "mediasi berhasil perdamaian" }), j.kunci).toEqual({ id: j.alur.id, kode: "AP" });
      else expect(t({ agenda: "mediasi berhasil perdamaian" })?.kode ?? null, j.kunci).not.toBe("AP");
    }
  });

  it("tentukanBasBaru: permohonan sidang 1 / lanjutan / tunda panggil Pemohon / NO SEMA", () => {
    for (const j of JENIS_MOHON) {
      const dasar = { dihadiriOleh: 1, ...mohon(j) };
      const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]>) => {
        const h = tentukanBasBaru({ urutanSidang: 1, ...dasar, ...m });
        return h ? { id: h.alur.id, kode: h.langkah.kode } : null;
      };
      expect(t({ agenda: "Pemeriksaan permohonan, bukti surat dan 2 saksi" })?.id, j.kunci).toBe(j.alur.id);
      expect(t({ urutanSidang: 3, agenda: "Pembacaan penetapan" }), j.kunci).toEqual({ id: j.alur.id, kode: "3" });
      expect(t({ dihadiriOleh: 4 }), j.kunci).toEqual({ id: j.alur.id, kode: "T" });
      expect(t({ urutanSidang: 3, dihadiriOleh: 4, penggugatPernahHadir: true }), j.kunci).toEqual({ id: j.alur.id, kode: "N" });
    }
  });
});

describe("C. keadaan", () => {
  it("jenis Pdt.P = permohonan (tanpa mediasi, verstek, atau sesudah jawaban); Pdt.G = gugatan", () => {
    for (const j of JENIS_MOHON) {
      const p = keadaanPutusan({ ...mohon(j), dihadiriOleh: 1 });
      expect(p, j.kunci).toContain("permohonan");
      expect(p, j.kunci).not.toContain("kontradiktoir");
      expect(p, j.kunci).not.toContain("sesudah-jawaban");
      const sema = keadaanPutusan({ ...mohon(j), dihadiriOleh: 4, panggilan: { hadirSebelumnya: 4, penggugatPernahHadir: true } });
      expect(sema, j.kunci).toContain("permohonan-sema-1-2022");
      expect(sema, j.kunci).not.toContain("permohonan");
    }
    for (const j of JENIS_GUGATAN) {
      expect(keadaanPutusan({ ...gugatan(j), dihadiriOleh: 1 }), j.kunci).toEqual(expect.arrayContaining(["kontradiktoir"]));
      expect(keadaanPutusan({ ...gugatan(j), dihadiriOleh: 1 }), j.kunci).not.toContain("permohonan");
      expect(keadaanPutusan({ ...gugatan(j), dihadiriOleh: 1, sesudahJawaban: true }), j.kunci).toContain("sesudah-jawaban");
      expect(keadaanPutusan({ ...gugatan(j), dihadiriOleh: 1, kurangPihak: true }), j.kunci).toContain("kurang-pihak");
    }
  });
});

describe("D. pemilihan putusan", () => {
  it("gugatan: kabul, verstek, setelah mediasi, tolak, tolak verstek, damai (bila ada), cabut, cabut sesudah jawaban, gugur, coret, NO kurang pihak", () => {
    for (const j of JENIS_GUGATAN) {
      const B = j.berkas;
      const p = (m: object) => put({ ...gugatan(j), ...m } as never);
      expect(p({ statusPutusan: "Dikabulkan" }), j.kunci).toMatchObject({ berkas: B.kabul, folder: j.folder });
      expect(p({ statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })!.berkas, j.kunci).toBe(B.verstek);
      expect(p({ statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true })!.berkas, j.kunci).toBe(B.setelahMediasi);
      expect(p({ statusPutusan: "Ditolak" })!.berkas, j.kunci).toBe(B.tolak);
      expect(p({ statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 })!.berkas, j.kunci).toBe(B.tolakVerstek);
      if (j.perdamaian) expect(p({ statusPutusan: "Perdamaian" })!.berkas, j.kunci).toBe(B.damai);
      else expect(p({ statusPutusan: "Perdamaian" })?.berkas ?? null, j.kunci).not.toBe(B.damai);
      expect(p({ statusPutusan: "Dicabut" })!.berkas, j.kunci).toBe(B.cabut);
      expect(p({ statusPutusan: "Dicabut", sesudahJawaban: true })!.berkas, j.kunci).toBe(B.cabutSesudahJawaban);
      expect(p({ statusPutusan: "Digugurkan" })!.berkas, j.kunci).toBe(B.gugur);
      expect(p({ statusPutusan: "Dicoret dari Register" })!.berkas, j.kunci).toBe(B.coret);
      expect(p({ statusPutusan: "Tidak Dapat Diterima", kurangPihak: true })!.berkas, j.kunci).toBe(B.noFormil);
    }
  });

  it("permohonan: kabul, tolak, NO formil di folder jenis; cabut dan gugur ke 9b Permohonan Umum", () => {
    for (const j of JENIS_MOHON) {
      const B = j.berkas;
      const p = (m: object) => put({ ...mohon(j), ...m } as never);
      expect(p({ statusPutusan: "Dikabulkan" }), j.kunci).toMatchObject({ berkas: B.mohonKabul, folder: j.folder });
      expect(p({ statusPutusan: "Ditolak" })!.berkas, j.kunci).toBe(B.mohonTolak);
      expect(p({ statusPutusan: "Tidak Dapat Diterima" })!.berkas, j.kunci).toBe(B.mohonNo);
      expect(p({ statusPutusan: "Dicabut" })!.folder, j.kunci).toBe("9b Permohonan Umum");
      expect(p({ statusPutusan: "Digugurkan" })!.folder, j.kunci).toBe("9b Permohonan Umum");
    }
  });

  it("jenis lama tidak berubah: nafkah anak pasca perceraian tetap ke 6c, penunjukan wali umum (Pdt.P wali) tidak ke 6f", () => {
    const lama = put({ jenisPerkara: "Nafkah Anak Pasca Perceraian", nomorPerkara: "5/Pdt.G/2026/PA.Dgl", statusPutusan: "Dikabulkan" });
    expect(lama?.folder).toBe("6c Nafkah Anak");
    const wali = put({ jenisPerkara: "Perwalian", nomorPerkara: "5/Pdt.P/2026/PA.Dgl", statusPutusan: "Dikabulkan" });
    expect(wali?.folder).not.toBe("6f Penunjukan Wali oleh Pengadilan");
  });

  it("FOLDER_MENU_PUTUSAN memuat nama menu putusan tiap jenis -> folder, dan tugas Blangko Derry mengenali folder", () => {
    for (const j of JENIS_W3B) {
      expect(FOLDER_MENU_W3B[j.menuPutusan.nama], j.kunci).toBe(j.folder);
      expect(FOLDER_MENU_PUTUSAN[j.menuPutusan.nama], j.kunci).toBe(j.folder);
    }
    for (const j of JENIS_PERKARA) {
      expect(jenisPerkaraDariFolder(`${A}${j.folder}`).untuk.length, j.kunci).toBeGreaterThan(0);
      expect(jenisPerkaraDariFolder(`${A}${j.folderBas}`).untuk.length, j.kunci).toBeGreaterThan(0);
    }
  });
});

describe("E. TS = panel-alat.js", () => {
  it("pilihPutusanBawaan sama dengan alatPetaUntukPerkara untuk jenis baru", () => {
    const panel = muatPanelAlat();
    const kasus: Array<[string, string, boolean, string[]]> = [];
    for (const j of JENIS_PERKARA) {
      for (const s of ["Dikabulkan", "Ditolak", "Tidak Dapat Diterima", "Dicabut", "Digugurkan", "Gugur", "Dicoret dari Register", "Perdamaian"]) {
        for (const kd of [[], ["permohonan"], ["permohonan-sema-1-2022"], ["kontradiktoir"], ["t-tidak-hadir-setelah-mediasi"], ["sesudah-jawaban"], ["kurang-pihak"], ["sema-1-2022"]]) kasus.push([j.namaSipp, s, false, kd]);
        kasus.push([j.namaSipp, s, true, []]);
      }
    }
    expect(kasus.length).toBeGreaterThan(200);
    for (const [j, s, v, kd] of kasus) {
      const ts = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, null, kd);
      expect(ts ? { kunci: ts.kunci, tingkat: ts.tingkat } : null, `${j} ${s} ${v} ${kd}`).toEqual(pilihDariPanel(panel, j, s, v, null, kd));
    }
  });
});

describe("F. isian baru (label awam, tanpa kode atau nama mentah)", () => {
  const D = (kode: string, nm: string, jenis = "data_teks", sql = "") => ({ kode, nama: nm, jenis, sql, bawaan: "" });

  it("tiap isian tangan berlabel ramah: label bukan nama mentah ABT, tanpa nomor variabel", () => {
    const kunci = Object.keys(RAMAH_W3B);
    expect(kunci.length).toBeGreaterThan(80);
    const katalog = new Map<string, Definisi>(kunci.map((k) => [k, D(k, `ABT NAMA ASLI ${k}`)]));
    const s = susunIsian(kunci, katalog);
    const peta = Object.fromEntries(s.isian.map((i) => [i.kode, i]));
    for (const k of kunci) {
      if (!peta[k]) continue; // isian yang dijadikan otomatis / opsional di tabel metadata
      expect(peta[k].nama, k).not.toMatch(/ABT NAMA ASLI|#\d{4}#|\b3[89]\d\d\b/);
      expect(peta[k].nama.length, k).toBeGreaterThanOrEqual(8);
    }
    expect(Object.keys(peta).length).toBeGreaterThan(50);
  });
});

describe("G. katalog saksi baru ikut panduan pertanyaan saksi", () => {
  const AKAR_EKS = path.resolve(__dirname, "../../../ekstensi-sipp");
  const dunia: Record<string, unknown> = {};
  for (const n of ["saksi-katalog.js", "saksi-katalog-data.js"]) {
    const modul = { exports: {} };
    new Function("module", "globalThis", "self", readFileSync(path.join(AKAR_EKS, n), "utf8"))(modul, dunia, dunia);
  }
  const mesin = dunia.AletaSaksiKatalog as { kenaliKatalog: (k: unknown[], p: Record<string, unknown>) => { kunci: string; pertanyaan: unknown[]; blangkoBas: Array<{ berkas: string }> } | null };
  const katalog = dunia.ALETA_SAKSI_KATALOG_DATA as Array<{ kunci: string; versi: number }>;
  const KATALOG: Array<[number, string, number]> = [
    [353, "pencabutan-kuasa-asuh", 15],
    [355, "pencabutan-kuasa-wali", 15],
    [356, "penunjukan-wali", 15],
    [357, "ganti-rugi-wali", 15],
  ];

  it("jenis dikenali dari nama dan nomor", () => {
    for (const j of JENIS_PERKARA) expect(jenisPerkaraIdDariNama(j.namaSipp), j.kunci).toBe(j.idJenis);
  });

  it("katalog ada di data ekstensi dan dikenali mesin menurut jenis perkara; jumlah butir memadai", () => {
    for (const [id, kunci, minimum] of KATALOG) {
      expect(katalog.map((k) => k.kunci), kunci).toContain(kunci);
      const k = mesin.kenaliKatalog(katalog, { jenisPerkaraId: id, alurPerkaraId: 15 });
      expect(k?.kunci, kunci).toBe(kunci);
      expect(k!.pertanyaan.length, kunci).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("nafkah anak oleh ibu (350) memakai katalog nafkah anak W2b; katalog tidak memakai kunci ganda", () => {
    const k = mesin.kenaliKatalog(katalog, { jenisPerkaraId: 350, alurPerkaraId: 15 });
    expect(k?.kunci).toBe("nafkah-anak");
    const kunci = katalog.map((x) => x.kunci);
    expect(new Set(kunci).size).toBe(kunci.length);
  });

  it("BAS yang disebut katalog (ALUR 70-73) ada di pohon paket", () => {
    for (const [id, kunci] of KATALOG) {
      const k = mesin.kenaliKatalog(katalog, { jenisPerkaraId: id, alurPerkaraId: 15 })!;
      const j = JENIS_W3B.find((x) => x.idJenis === id)!;
      const khusus = k.blangkoBas.filter((b) => new RegExp(`ALUR ${j.alur.nomor} `).test(b.berkas));
      for (const b of khusus) expect(FIX.berkas, `${kunci} ${b.berkas}`).toContain(`${A}${j.folderBas}/${nama(b.berkas)}.rtf`);
    }
  });
});
