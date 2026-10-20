// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN ENAM JENIS BARU (W3a, 21 Okt 2026): 343 Penolakan Perkawinan, 345 Kelalaian atas Kewajiban Suami/Istri, 351 Hak-hak Bekas Istri/Kewajiban Bekas Suami,
 * 352 Pengesahan Anak, 359 Perkawinan Campuran, 361 Izin Kawin - paket ABT abt-w3a-blangko-baru-perkawinan (menu 168-179, ALUR BAS 60-65, variabel 3600-3799)
 * ============================================================================
 *
 * Yang dijaga (perilaku, bukan sekadar toContain): (A) paket: berkas, peta, menu, SQL, tanpa kata ALETA; (B) ALUR BAS 60-65 dan pilihan BAS menurut jenis + keadaan sidang;
 * (C) keadaan putusan; (D) pilihan putusan/penetapan (rekomendasi) per status; (E) panel-alat.js = TS; (F) pohon/tugas/pemetaan/pandu-saksi mengenal jenisnya;
 * (G) isian popup: label awam dan penanda manual/opsional tidak tumpang tindih.
 * Perkara nyata keenam jenis hampir nol di SIPP (343: 1; lainnya 0): masukan di sini fixture bergaya nomor/nama jenis SIPP.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ISIAN_MANUAL, ISIAN_OPSIONAL } from "@/app/api/aleta-ecourt/blangko-derry/isian-metadata";
import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { ALUR_BAS_BARU, jenisBasBaru, tentukanBasBaru } from "@/lib/alur-bas-baru";
import { keadaanPutusan } from "@/lib/keadaan-putusan";
import { jenisPerkaraIdDariNama } from "@/lib/pandu-saksi";
import { KUNCI_BAKU, JENIS_BAS_BAKU, kunciJenisPerkara } from "@/lib/pemetaan-blangko";
import { SET_BLANGKO, setCocokPerkara } from "@/lib/pohon-blangko";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";
import { semuaSalinanBas, folderJenisCocok } from "@/lib/salinan-bas-jenis";
import { MENU_FOLDER_JENIS, SALINAN_BAS_JENIS } from "@/lib/salinan-bas-jenis-data";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import { jenisPerkaraDariFolder } from "@/lib/tugas-blangko";

import { muatPanelAlat, pilihDariPanel } from "./panel-alat-vm";

const AKAR = path.resolve(__dirname, "..", "..", "..");
const PAKET = path.join(AKAR, "abt-paket", "w3a-blangko-baru-perkawinan");
const A = "derry_briantono/";
type Baris = { jenis: string; folder: string; berkas: string; kode: string; label: string; status: string; keadaan: string; catatan: string };
type Meta = { sipp: number; nama: string; singkat: string; tipe: "permohonan" | "gugatan"; nomor: string; folder: string; folder_bas: string; menu_putusan: number; menu_bas: number; alur: number; var: [number, number]; kunci_cermin: string; padanan_sipp: string[]; nama_menu_putusan: string; alias_putusan: string; nama_menu_bas: string; awalan_bas: string };
const DATA = JSON.parse(readFileSync(path.join(PAKET, "peta-w3a.json"), "utf8")) as { jenis: Record<string, Meta>; peta: Baris[]; isian: Record<string, [string, string]>; ramah: Record<string, { nm: string; pil?: string[]; saran?: string }> };
const JENIS = Object.entries(DATA.jenis);
const nama = (x: string) => x.replace(/\.rtf$/, "");
const daftar = (folder: string) => readdirSync(path.join(PAKET, "rtf", "derry_briantono", folder)).filter((f) => f.endsWith(".rtf"));
const md5 = (p: string) => createHash("md5").update(readFileSync(p)).digest("hex");
// nama jenis perkara seperti tertulis di SIPP (perkara.jenis_perkara_nama) dan contoh nomor perkara
const SIPP: Record<string, { jenisPerkara: string; nomorPerkara: string }> = {
  "penolakan-perkawinan": { jenisPerkara: "Penolakan Perkawinan", nomorPerkara: "11/Pdt.P/2026/PA.Dgl" },
  "perkawinan-campuran": { jenisPerkara: "Perkawinan Campuran", nomorPerkara: "12/Pdt.P/2026/PA.Dgl" },
  "izin-kawin": { jenisPerkara: "Izin Kawin", nomorPerkara: "13/Pdt.P/2026/PA.Dgl" },
  "pengesahan-anak": { jenisPerkara: "Pengesahan Anak", nomorPerkara: "14/Pdt.P/2026/PA.Dgl" },
  "kelalaian-kewajiban": { jenisPerkara: "Kelalaian Atas Kewajiban Suami / Istri", nomorPerkara: "15/Pdt.G/2026/PA.Dgl" },
  "hak-bekas-istri": { jenisPerkara: "Hak - hak bekas istri/kewajiban bekas Suami", nomorPerkara: "16/Pdt.G/2026/PA.Dgl" },
};
const ALUR_ID: Record<string, string> = Object.fromEntries(JENIS.map(([k, j]) => [k, `alur-${j.alur}`]));

describe("A. paket", () => {
  it("enam jenis lengkap: berkas putusan dan BAS ada di rtf/, tiap berkas peta ada di folder, folder dan menu tidak bentrok", () => {
    expect(JENIS.map(([k]) => k).sort()).toEqual(["hak-bekas-istri", "izin-kawin", "kelalaian-kewajiban", "pengesahan-anak", "penolakan-perkawinan", "perkawinan-campuran"]);
    const menuId = new Set<number>();
    for (const [k, j] of JENIS) {
      const putusan = daftar(j.folder);
      const bas = daftar(j.folder_bas);
      expect(putusan.length, `${k} putusan`).toBeGreaterThanOrEqual(j.tipe === "permohonan" ? 7 : 15);
      expect(bas.length, `${k} BAS`).toBe(j.tipe === "permohonan" ? 12 : 38);
      for (const b of DATA.peta.filter((p) => p.jenis === k)) expect(putusan, `${k} ${b.berkas}`).toContain(b.berkas);
      for (const id of [j.menu_putusan, j.menu_bas]) {
        expect(id, `${k} menu`).toBeGreaterThanOrEqual(168);
        expect(id).toBeLessThanOrEqual(179);
        expect(menuId.has(id), `menu ${id} ganda`).toBe(false);
        menuId.add(id);
      }
      expect(MENU_FOLDER_JENIS[j.folder_bas], k).toMatchObject({ id: j.menu_bas, nama: j.nama_menu_bas });
    }
    expect(menuId.size).toBe(12);
    // folder baru tidak memakai nama folder yang sudah ada di pohon server (fixture 17 Okt) dan nomor ALUR/menu tidak memakai yang sudah terpakai
    const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[]; menu: Array<{ id: number }> };
    for (const [, j] of JENIS) {
      expect(FIX.berkas.filter((b) => b.startsWith(`${A}${j.folder}/`) || b.startsWith(`${A}${j.folder_bas}/`)), j.folder).toEqual([]);
      expect(FIX.menu.filter((m) => m.id === j.menu_putusan || m.id === j.menu_bas), `menu ${j.folder}`).toEqual([]);
    }
  });

  it("setiap putusan di folder dijangkau peta bawaan (utama atau varian) dan folder putusan terpetakan ke menunya", () => {
    const dijangkau = new Set<string>();
    for (const b of Object.values(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (!folder) continue;
      dijangkau.add(`${folder}/${nama(b.berkas)}.rtf`);
      if (/^varian: /.test(b.catatan ?? "")) for (const v of (b.catatan ?? "").slice(8).split("; ").filter(Boolean)) dijangkau.add(`${folder}/${nama(v)}.rtf`);
    }
    for (const [k, j] of JENIS) {
      expect(FOLDER_MENU_PUTUSAN[j.nama_menu_putusan], k).toBe(j.folder);
      const tak = daftar(j.folder).filter((f) => !dijangkau.has(`${j.folder}/${f}`));
      expect(tak, `${k}: putusan yang tak dijangkau peta`).toEqual([]);
    }
  });

  it("paket-satker (bila sudah dibangun): MD5SUMS cocok, SQL memasang 12 menu dan semua variabel, tanpa kata ALETA, prasyarat benar", () => {
    const ps = path.join(PAKET, "paket-satker");
    if (!existsSync(ps)) return;
    const sums = readFileSync(path.join(ps, "MD5SUMS.txt"), "utf8").split("\n").filter(Boolean);
    expect(sums.length).toBeGreaterThan(100);
    for (const baris of sums) {
      const [h, ...sisa] = baris.split("  ");
      expect(md5(path.join(ps, sisa.join("  "))), sisa.join("  ")).toBe(h);
    }
    const N = "abt-w3a-blangko-baru-perkawinan";
    const pasang = readFileSync(path.join(ps, `${N}-PASANG.sql`), "utf8");
    const pulih = readFileSync(path.join(ps, `${N}-PULIH.sql`), "utf8");
    const periksa = readFileSync(path.join(ps, `${N}-PERIKSA.sql`), "utf8");
    const prasyarat = readFileSync(path.join(ps, `${N}-PRASYARAT.sql`), "utf8");
    expect((pasang.match(/INSERT INTO abt_menu/g) ?? []).length).toBe(12);
    const nVar = (pasang.match(/INSERT INTO abt_variabel/g) ?? []).length;
    expect(nVar).toBeGreaterThan(40);
    expect((pulih.match(/DELETE FROM abt_menu/g) ?? []).length).toBe(12);
    expect((pulih.match(/DELETE FROM abt_variabel/g) ?? []).length).toBe(nVar);
    expect(periksa).toContain("'SEMUA COCOK'");
    expect(pulih).toContain("'PULIH COCOK'");
    expect(prasyarat).toMatch(/Benar: "0\|0\|\d+\|0\|0"/);
    for (const f of ["PASANG", "PERIKSA", "PULIH", "PRASYARAT"]) expect(readFileSync(path.join(ps, `${N}-${f}.sql`), "utf8").toLowerCase()).not.toContain("aleta");
    for (const f of ["pasang-satker.sh", "pulih-satker.sh", "daftar-rtf.tsv", "uji-kueri.tsv", "folder-baru.txt"]) {
      expect(readFileSync(path.join(ps, f), "utf8").toLowerCase().replace(/aleta-bot|aleta_bot_/g, ""), f).not.toContain("aleta");
    }
    expect(readFileSync(path.join(ps, "folder-baru.txt"), "utf8").split("\n").filter((x) => x && !x.startsWith("#"))).toHaveLength(12);
    // nomor variabel tidak keluar dari jatah 3600-3799
    const nomor = [...pasang.matchAll(/INSERT INTO abt_variabel[^S]*SELECT (\d+),/g)].map((m) => Number(m[1]));
    expect(nomor.length).toBe(nVar);
    for (const n of nomor) {
      expect(n).toBeGreaterThanOrEqual(3600);
      expect(n).toBeLessThanOrEqual(3799);
    }
  });
});

describe("B. ALUR BAS 60-65", () => {
  const alur = (id: string) => ALUR_BAS_BARU.find((a) => a.id === id)!;
  const KODE_P = ["1", "1a", "1b", "1c", "2", "2a", "2b", "3", "N", "C", "G", "T"].sort();
  const KODE_G = ["V1", "V2", "V2S", "AP", "GD", "N", "T", "CS", "CM"].sort();

  it("enam alur baru: folder, menu, rentang jenis, kode langkah, dan berkasnya ada", () => {
    for (const [k, j] of JENIS) {
      const a = alur(`alur-${j.alur}`);
      expect(a, k).toBeDefined();
      expect(a).toMatchObject({ nomor: j.alur, folder: `${A}${j.folder_bas}`, jenisMin: j.sipp, jenisMaks: j.sipp, menu: { id: j.menu_bas, nama: j.nama_menu_bas } });
      expect(a.langkah.map((l) => l.kode).sort(), k).toEqual(j.tipe === "permohonan" ? KODE_P : KODE_G);
      const ada = daftar(j.folder_bas);
      for (const l of a.langkah) expect(ada, `${k} ${l.kode}`).toContain(l.berkas);
    }
  });

  it("29 salinan BAS ALUR 04-09 di folder BAS kelalaian kewajiban dan hak bekas istri (sama dengan berkas di paket); permohonan tanpa salinan", () => {
    for (const [k, j] of JENIS) {
      const salinanPaket = daftar(j.folder_bas).filter((b) => /^BAS ALUR 0[4-9] /.test(b));
      if (j.tipe === "permohonan") {
        expect(salinanPaket, k).toEqual([]);
        continue;
      }
      expect(salinanPaket, k).toHaveLength(29);
      const dariTabel: string[] = [];
      for (const [folderSumber, isi] of Object.entries(SALINAN_BAS_JENIS)) {
        for (const berkasSumber of Object.keys(isi)) {
          if (!isi[berkasSumber].includes(j.folder_bas)) continue;
          const s = semuaSalinanBas(folderSumber, berkasSumber).find((x) => x.folder === `${A}${j.folder_bas}`);
          expect(s, `${folderSumber}/${berkasSumber}`).toBeDefined();
          dariTabel.push(s!.berkas);
        }
      }
      expect(dariTabel.sort()).toEqual([...salinanPaket].sort());
    }
  });

  it("jenis dikenali dari nama jenis SIPP (huruf, spasi, garis miring seperti di SIPP)", () => {
    for (const [k, v] of Object.entries(SIPP)) expect(jenisBasBaru(v.jenisPerkara, v.nomorPerkara), k).toBe(k);
    expect(jenisBasBaru("Pencegahan Perkawinan", "1/Pdt.P/2026/PA.Dgl")).toBe("pencegahan");
    expect(jenisBasBaru("Pengesahan Perkawinan/Istbat Nikah", "1/Pdt.P/2026/PA.Dgl")).toBe("itsbat");
    expect(jenisBasBaru("Nafkah Anak Pasca Perceraian", "1/Pdt.G/2026/PA.Dgl")).toBe("nafkah-anak");
  });

  it("permohonan (343, 359, 361, 352): sidang 1, lanjutan, pembacaan penetapan, cabut, gugur, tunda panggil Pemohon, NO SEMA", () => {
    for (const k of ["penolakan-perkawinan", "perkawinan-campuran", "izin-kawin", "pengesahan-anak"]) {
      const id = ALUR_ID[k];
      const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]>) => {
        const h = tentukanBasBaru({ urutanSidang: 1, dihadiriOleh: 1, ...SIPP[k], ...m });
        return h ? { id: h.alur.id, kode: h.langkah.kode } : null;
      };
      expect(t({ agenda: "Pemeriksaan permohonan, bukti surat dan 2 saksi" })?.id, k).toBe(id);
      expect(t({ urutanSidang: 3, agenda: "Pembacaan penetapan" }), k).toEqual({ id, kode: "3" });
      expect(t({ urutanSidang: 2, agenda: "Pemeriksaan saksi" }), k).toEqual({ id, kode: "2" });
      expect(t({ akhir: "cabut" }), k).toEqual({ id, kode: "C" });
      expect(t({ akhir: "gugur" }), k).toEqual({ id, kode: "G" });
      expect(t({ dihadiriOleh: 4 }), k).toEqual({ id, kode: "T" });
      expect(t({ urutanSidang: 3, dihadiriOleh: 4, penggugatPernahHadir: true }), k).toEqual({ id, kode: "N" });
      expect(t({ akhir: "no" }), k).toEqual({ id, kode: "N" });
    }
  });

  it("gugatan (345, 351): verstek V1/V2, damai AP, cabut GD, cabut sesudah jawaban CS/CM, P tidak hadir T, NO N; sidang kontradiktoir memakai salinan ALUR 04-09 di folder jenisnya", () => {
    for (const k of ["kelalaian-kewajiban", "hak-bekas-istri"]) {
      const id = ALUR_ID[k];
      const j = DATA.jenis[k];
      const t = (m: Partial<Parameters<typeof tentukanBasBaru>[0]>) => {
        const h = tentukanBasBaru({ urutanSidang: 3, dihadiriOleh: 1, ...SIPP[k], ...m });
        return h ? { id: h.alur.id, kode: h.langkah.kode } : null;
      };
      expect(t({ urutanSidang: 1, dihadiriOleh: 2, tergugatPernahHadir: false }), k).toEqual({ id, kode: "V1" });
      expect(t({ urutanSidang: 2, dihadiriOleh: 2, tergugatPernahHadir: false }), k).toEqual({ id, kode: "V2" });
      expect(t({ agenda: "mediasi berhasil perdamaian" }), k).toEqual({ id, kode: "AP" });
      expect(t({ akhir: "cabut" }), k).toEqual({ id, kode: "GD" });
      expect(t({ dihadiriOleh: 3 }), k).toEqual({ id, kode: "T" });
      expect(t({ akhir: "no" }), k).toEqual({ id, kode: "N" });
      expect(t({ akhir: "cabut", sudahJawaban: true, sikapTergugatCabut: "setuju" }), k).toEqual({ id, kode: "CS" });
      expect(t({ sudahJawaban: true, sikapTergugatCabut: "menolak" }), k).toEqual({ id, kode: "CM" });
      const biasa = tentukanBasBaru({ urutanSidang: 4, dihadiriOleh: 1, ...SIPP[k], agenda: "Pembuktian Penggugat" });
      expect(biasa?.alur.folder, k).toBe(`${A}${j.folder_bas}`);
      expect(biasa?.langkah.berkas, k).toMatch(/^BAS ALUR 0[4-9] /);
    }
  });
});

describe("C. keadaan putusan", () => {
  it("gugatan 345/351 mengenal mediasi, verstek, cabut sesudah jawaban, kurang pihak, kabul sebagian; permohonan tidak", () => {
    for (const k of ["kelalaian-kewajiban", "hak-bekas-istri"]) {
      const s = SIPP[k];
      expect(keadaanPutusan({ ...s, dihadiriOleh: 1 }), k).toContain("kontradiktoir");
      expect(keadaanPutusan({ ...s, dihadiriOleh: 2, mediasiTerbaca: true, panggilan: { tergugatPernahHadir: false } }), k).toContain("verstek-tanpa-bendera");
      expect(keadaanPutusan({ ...s, dihadiriOleh: 1, sesudahJawaban: true }), k).toContain("sesudah-jawaban");
      expect(keadaanPutusan({ ...s, dihadiriOleh: 1, kurangPihak: true }), k).toContain("kurang-pihak");
      expect(keadaanPutusan({ ...s, dihadiriOleh: 1, dikabulkanSebagian: true }), k).toContain("dikabulkan-sebagian");
    }
    for (const k of ["penolakan-perkawinan", "perkawinan-campuran", "izin-kawin", "pengesahan-anak"]) {
      const kd = keadaanPutusan({ ...SIPP[k], dihadiriOleh: 1, sesudahJawaban: true, kurangPihak: true });
      expect(kd, k).not.toContain("sesudah-jawaban");
      expect(kd, k).not.toContain("kurang-pihak");
      expect(kd, k).not.toContain("kontradiktoir");
      expect(keadaanPutusan({ ...SIPP[k], dihadiriOleh: 4, panggilan: { hadirSebelumnya: 4, penggugatPernahHadir: true } }), k).toContain("sema-1-2022");
    }
  });
});

describe("D. pemilihan putusan / penetapan (rekomendasi blangko) menurut jenis dan status", () => {
  const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
    const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
    return r.length ? { berkas: nama(r[0].berkas), folder: r[0].folder.replace(A, ""), semua: r.map((x) => nama(x.berkas)) } : null;
  };
  const STATUS = ["Dikabulkan", "Ditolak", "Tidak Dapat Diterima", "Dicabut", "Digugurkan", "Gugur", "Dicoret dari Register"];

  it("setiap jenis x status: blangko di folder jenisnya, nama berkas ada di folder, bukan blangko jenis lain", () => {
    for (const [k, j] of JENIS) {
      const ada = daftar(j.folder).map(nama);
      for (const status of [...STATUS, ...(j.tipe === "gugatan" ? ["Perdamaian"] : [])]) {
        const p = put({ ...SIPP[k], statusPutusan: status } as never);
        expect(p, `${k} ${status}`).not.toBeNull();
        expect(p!.folder, `${k} ${status}`).toBe(j.folder);
        expect(ada, `${k} ${status}`).toContain(p!.berkas);
      }
    }
  });

  it("kabul/tolak/cabut/gugur/coret: kode di nama berkas sesuai statusnya", () => {
    const kode = (s: string, k: string) => put({ ...SIPP[k], statusPutusan: s } as never)!.berkas.match(/^\[(\w+)\] \[([^\]]+)\]/)!;
    for (const [k] of JENIS) {
      expect(kode("Dikabulkan", k)[2], k).toMatch(/^Kabul/);
      expect(kode("Ditolak", k)[2], k).toMatch(/^Tolak/);
      expect(kode("Dicabut", k)[2], k).toBe("Cabut");
      expect(kode("Digugurkan", k)[2], k).toBe("Gugur");
      expect(kode("Dicoret dari Register", k)[2], k).toBe("Coret");
      expect(kode("Tidak Dapat Diterima", k)[2], k).toBe("NO");
    }
  });

  it("gugatan: verstek, T tidak hadir setelah mediasi, cabut sesudah jawaban, NO SEMA 1/2022, kurang pihak, kabul sebagian", () => {
    for (const k of ["kelalaian-kewajiban", "hak-bekas-istri"]) {
      const p = (m: object) => put({ ...SIPP[k], ...m } as never)!;
      expect(p({ statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 }).berkas, k).toMatch(/^\[01b\] \[Kabul Verstek\]/);
      expect(p({ statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true }).berkas, k).toMatch(/^\[01a\] \[Kabul\]/);
      expect(p({ statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 }).berkas, k).toMatch(/^\[03b\] \[Tolak Verstek\]/);
      expect(p({ statusPutusan: "Dicabut", sesudahJawaban: true }).berkas, k).toMatch(/^\[98b\] \[Cabut\]/);
      expect(p({ statusPutusan: "Tidak Dapat Diterima", kurangPihak: true }).berkas, k).toMatch(/^\[99a\] \[NO\]/);
      expect(p({ statusPutusan: "Dikabulkan", dikabulkanSebagian: true }).berkas, k).toMatch(/^\[02\] \[Kabul Sebagian\]/);
    }
  });
});

describe("E. TS = panel-alat.js (pilihan blangko sama persis)", () => {
  it("pilihPutusanBawaan sama dengan alatPetaUntukPerkara untuk semua jenis x status x keadaan", () => {
    const panel = muatPanelAlat();
    const kasus: Array<[string, string, boolean, string[]]> = [];
    for (const [k] of JENIS) {
      const j = SIPP[k].jenisPerkara;
      for (const s of ["Dikabulkan", "Ditolak", "Tidak Dapat Diterima", "Dicabut", "Digugurkan", "Gugur", "Dicoret dari Register", "Perdamaian"]) {
        for (const kd of [[], ["kontradiktoir"], ["t-tidak-hadir-setelah-mediasi"], ["sesudah-jawaban"], ["kurang-pihak"], ["sema-1-2022"], ["cacat-formil"], ["dikabulkan-sebagian"]]) kasus.push([j, s, false, kd]);
        kasus.push([j, s, true, []]);
        kasus.push([j, s, true, ["dikabulkan-sebagian"]]);
      }
    }
    expect(kasus.length).toBeGreaterThan(300);
    for (const [j, s, v, kd] of kasus) {
      const ts = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, null, kd);
      expect(ts ? { kunci: ts.kunci, tingkat: ts.tingkat } : null, `${j} ${s} ${v} ${kd}`).toEqual(pilihDariPanel(panel, j, s, v, null, kd));
    }
  });
});

describe("F. pohon, tugas, pemetaan, pandu saksi, sebutan pihak", () => {
  it("set pohon putusan cocok hanya untuk jenisnya sendiri", () => {
    for (const [k, j] of JENIS) {
      const set = SET_BLANGKO.filter((s) => s.jenis === "putusan" && s.folder === `${A}${j.folder}`);
      expect(set, k).toHaveLength(1);
      for (const [k2] of JENIS) expect(setCocokPerkara(set[0], SIPP[k2].jenisPerkara, SIPP[k2].nomorPerkara), `${set[0].id} untuk ${k2}`).toBe(k2 === k);
      for (const lain of ["Cerai Gugat", "Cerai Talak", "Dispensasi Kawin", "Pencegahan Perkawinan", "Asal Usul Anak", "Pembatalan Perkawinan", "Nafkah Anak Pasca Perceraian", "Izin Poligami"]) {
        expect(setCocokPerkara(set[0], lain, "1/Pdt.P/2026/PA.Dgl"), `${set[0].id} untuk ${lain}`).toBe(false);
      }
    }
  });

  it("folder (putusan dan BAS) dikenali tugas blangko dan cocok hanya dengan jenisnya", () => {
    for (const [k, j] of JENIS) {
      for (const f of [j.folder, j.folder_bas]) {
        const u = jenisPerkaraDariFolder(`${A}${f}`).untuk;
        expect(u.length, `${k} ${f}`).toBeGreaterThan(0);
        expect(folderJenisCocok(`${A}${j.folder_bas}`, SIPP[k].jenisPerkara), k).toBe(true);
        for (const [k2] of JENIS) if (k2 !== k) expect(folderJenisCocok(`${A}${j.folder_bas}`, SIPP[k2].jenisPerkara), `${k} lawan ${k2}`).toBe(false);
        expect(folderJenisCocok(`${A}${j.folder_bas}`, "Cerai Gugat"), k).toBe(false);
      }
    }
  });

  it("kunci baku pemetaan, jenis BAS baku, padanan nama SIPP, dan id jenis untuk panduan saksi", () => {
    for (const [k, j] of JENIS) {
      expect(KUNCI_BAKU.putusan.map((x) => x.kunci.toLowerCase()), k).toContain(j.kunci_cermin);
      expect(JENIS_BAS_BAKU.map((x) => x.toLowerCase()), k).toContain(j.kunci_cermin);
      expect(kunciJenisPerkara(SIPP[k].jenisPerkara), k).toBe(j.kunci_cermin);
      expect(jenisPerkaraIdDariNama(SIPP[k].jenisPerkara), k).toBe(j.sipp);
    }
  });

  it("sebutan pihak: permohonan (Pdt.P) = Pemohon, gugatan = Penggugat/Tergugat", () => {
    for (const [k] of JENIS) {
      const s = sebutanPihakPerkara({ nomorPerkara: SIPP[k].nomorPerkara, jenisPerkaraNama: SIPP[k].jenisPerkara });
      expect(JSON.stringify(s).toLowerCase(), k).toContain(DATA.jenis[k].tipe === "permohonan" ? "pemohon" : "penggugat");
    }
  });
});

describe("G. isian popup", () => {
  it("penanda manual/opsional tidak tumpang tindih dan semua isian baru berlabel awam (tanpa kode, tanpa nama ABT)", () => {
    const kode = Object.keys(DATA.isian);
    expect(kode.length).toBeGreaterThan(20);
    for (const k of kode) {
      const [jenis] = DATA.isian[k];
      expect(["manual", "opsional"], k).toContain(jenis);
      expect(k in ISIAN_MANUAL && k in ISIAN_OPSIONAL, `${k} di kedua daftar`).toBe(false);
      expect(jenis === "manual" ? k in ISIAN_MANUAL : k in ISIAN_OPSIONAL, k).toBe(true);
      expect(DATA.ramah[k], `label awam ${k}`).toBeDefined();
    }
    const katalog = new Map<string, Definisi>(Object.keys(DATA.ramah).map((k) => [k, { kode: k, nama: `NAMA ABT ${k}`, jenis: "data_teks", sql: "", bawaan: "" }]));
    const s = susunIsian(Object.keys(DATA.ramah), katalog, { P: "Pemohon", T: "Termohon" });
    expect(s.isian.map((i) => i.kode).sort()).toEqual(Object.keys(DATA.ramah).sort());
    for (const i of s.isian) {
      expect(i.nama, i.kode).not.toMatch(/NAMA ABT|#\d{4}#|\b3[67]\d\d\b/);
      expect(i.nama.length, i.kode).toBeGreaterThan(8);
    }
  });
});
