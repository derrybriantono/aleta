// @vitest-environment node
/**
 * Paket ABT abt-a5-merah-5nov (keputusan Derry, 5 Nov 2026): teks merah daftar A5 dan kalimat [98] Cabut. Hanya blangko derry_briantono + isian barunya.
 * Dasar md5 = keadaan SESUDAH keputusan-a-rekonvensi-4nov. Penjaga: isi paket, tiap potongan hanya jenis ubahan yang diizinkan, kata tetap pada baris hitamkan,
 * 540 baris "hitamkan atau isian" tidak tersentuh, variabel aman untuk MariaDB 5.5, tanpa kata nama aplikasi, MD5SUMS, uji laptop, render.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(REPO, "abt-paket/a5-merah-5nov");
const P = path.join(AKAR, "paket-satker");
const baca = (n: string) => readFileSync(path.join(P, n));
const tsv = (p: string) => readFileSync(p, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
type Potong = { kode: string; off: number; lama: string; baru: string };
const potongan = (dir: string): Potong[] => tsv(path.join(dir, "tambal.tsv")).map(([k, off, lama, baru]) => ({
  kode: k, off: Number(off), lama: Buffer.from(lama, "base64").toString("latin1"), baru: Buffer.from(baru, "base64").toString("latin1"),
}));
const daftar = tsv(path.join(P, "daftar-tambal.tsv"));
const potong = potongan(P);
const NOMOR = [9284, 9285, 9286, 9287, 9288, 9289, 9294, 9295, 9296];
const CF = /^\\cf\d+ ?$/;

const csv = readFileSync(path.join(AKAR, "hasil/daftar-tambalan.csv"), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
const gol = (g: string) => csv.filter((l) => new RegExp(`,${g},`).test(l));

describe("paket a5-merah-5nov", () => {
  it("65 blangko derry_briantono, tanpa berkas ganda; jumlah potongan per berkas sesuai", () => {
    expect(daftar).toHaveLength(65);
    expect(new Set(daftar.map((d) => d[1])).size).toBe(65);
    for (const d of daftar) {
      expect(d[0]).toMatch(/^A\d{4}$/);
      expect(d[1].startsWith("derry_briantono/"), d[1]).toBe(true);
      expect(potong.filter((p) => p.kode === d[0]), d[1]).toHaveLength(Number(d[4]));
    }
  });

  it("golongan: 293 hitamkan, 37 isian, 33 buang, 6 cabut, 8 batal (kutipan Arab); 540 baris lain tidak tercatat", () => {
    const ringkas = readFileSync(path.join(AKAR, "hasil/ringkas.txt"), "utf8");
    expect(ringkas).toMatch(/^hitamkan\t293$/m);
    expect(ringkas).toMatch(/^isian\t37$/m);
    expect(ringkas).toMatch(/^buang\t33$/m);
    expect(ringkas).toMatch(/^cabut\t6$/m);
    expect(ringkas).toMatch(/^batal isian \(kutipan Arab\)\t8$/m);
    expect(gol("hitamkan")).toHaveLength(293);
    expect(gol("buang")).toHaveLength(33);
    expect(csv.length - 1).toBe(293 + 37 + 33 + 6 + 8);
  });

  it("tiap potongan hanya: hapus warna, teks jadi isian, buang catatan, atau #8555# -> #8554#", () => {
    let warna = 0, isian = 0, buang = 0, cabut = 0;
    for (const p of potong) {
      if (CF.test(p.lama) || /^\\cf\d+$/.test(p.lama)) {
        expect(p.baru).toBe("");
        warna++;
      } else if (p.lama === "#8555#") {
        expect(p.baru).toBe("#8554#");
        cabut++;
      } else if (p.baru === "") {
        expect(p.lama).toMatch(/\((PERTIMBANGAN APABILA SAKSI HANYA MENGETAHUI PISAH TAPI TIDAK MELIHAT LANGSUNG APA MASALAHNYA|APABILA SUAMI TIDAK BEKERJA\/MALAS|ANAK 1 PERSATU P NYA)\)/);
        buang++;
      } else {
        expect(p.baru).toMatch(/#(9284|9285|9286|9287|9288|9289|9294|9295|9296|9683)#/);
        expect(p.lama).not.toContain("\\");
        isian++;
      }
    }
    expect(warna).toBe(293 + 37);
    expect(isian).toBe(37);
    expect(buang).toBe(33);
    expect(cabut).toBe(6);
  });

  it("[98] Cabut: enam penetapan, satu kalimat per berkas", () => {
    const berkas = new Map(daftar.map((d) => [d[0], d[1]] as [string, string]));
    const c = potong.filter((p) => p.lama === "#8555#").map((p) => berkas.get(p.kode) ?? "");
    expect(c).toHaveLength(6);
    expect(new Set(c).size).toBe(6);
    for (const x of c) expect(x).toMatch(/\[98\] \[Cabut\]/);
  });

  it("variabel baru: data_teks, nomor tepat, heks, tanpa escape, tanpa kata nama aplikasi; PRASYARAT/PERIKSA/PULIH memakai sidik yang sama", () => {
    const sql = baca("abt-a5-merah-5nov-PASANG.sql").toString("latin1");
    for (const n of NOMOR) expect(sql).toContain(`SELECT ${n}, CONVERT(0x`);
    expect(sql.match(/INSERT INTO abt_variabel/g)).toHaveLength(NOMOR.length);
    expect(sql).not.toContain("\\");
    expect(sql).toMatch(/START TRANSACTION;[\s\S]*COMMIT;/);
    const nama = [...sql.matchAll(/0x([0-9a-f]+)/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1")).join("\n");
    expect(nama).not.toMatch(/aleta/i);
    expect(nama).toContain("Lurah\nKepala Desa");
    expect(baca("harap.txt").toString("utf8").trim().split("\n")).toEqual(["0|0|2", "0|9|2"]);
    const sidik = [...baca("abt-a5-merah-5nov-PERIKSA.sql").toString("latin1").matchAll(/= '([0-9a-f]{32})'/g)].map((m) => m[1]);
    expect(sidik).toHaveLength(NOMOR.length);
    for (const s of sidik) {
      expect(baca("abt-a5-merah-5nov-PRASYARAT.sql").toString("latin1")).toContain(s);
      expect(baca("abt-a5-merah-5nov-PULIH.sql").toString("latin1")).toContain(s);
    }
    const nomor = (s: string) => [...s.matchAll(/#(\d{4,5})#/g)].map((m) => Number(m[1]));
    const nomorBaru = new Set(potong.flatMap((p) => nomor(p.baru).filter((n) => !nomor(p.lama).includes(n))));
    for (const n of nomorBaru) expect([...NOMOR, 9683, 8554]).toContain(n);
  });

  it("isi paket = MD5SUMS; tambal_rtf.py sama dengan paket sebelumnya; PRASYARAT sebelum pasang; tanpa kata nama aplikasi", () => {
    for (const l of baca("MD5SUMS.txt").toString("utf8").split("\n").filter(Boolean)) {
      const [h, n] = l.split(/\s+\*?/);
      expect(md5(baca(n)), n).toBe(h);
    }
    expect(md5(baca("tambal_rtf.py"))).toBe(md5(readFileSync(path.join(REPO, "abt-paket/keputusan-a-mekanis-4nov/paket-satker/tambal_rtf.py"))));
    const sh = baca("pasang-satker.sh").toString("utf8");
    expect(sh).toContain("N=abt-a5-merah-5nov");
    expect(sh).toContain('"BERKAS SIAP" ] || gagal');
    expect(sh.indexOf("tambal_rtf.py cek")).toBeLessThan(sh.indexOf("-PASANG.sql"));
    expect(sh.indexOf("-PASANG.sql")).toBeLessThan(sh.indexOf("tambal_rtf.py pasang"));
    for (const n of ["daftar-tambal.tsv", "abt-a5-merah-5nov-PRASYARAT.sql", "abt-a5-merah-5nov-PERIKSA.sql", "abt-a5-merah-5nov-PULIH.sql"]) {
      expect(baca(n).toString("latin1").replace(/abt-a5-merah/g, "")).not.toMatch(/aleta/i);
    }
  });

  it("dasar md5 = md5_baru keputusan-a-mekanis-4nov untuk berkas yang tercakup", () => {
    const m = new Map(tsv(path.join(REPO, "abt-paket/keputusan-a-mekanis-4nov/paket-satker/daftar-tambal.tsv")).map((b) => [b[1], b[3]] as [string, string]));
    let tercakup = 0;
    for (const d of daftar) {
      const harap = m.get(d[1]);
      if (harap) { tercakup++; expect(d[2], d[1]).toBe(harap); }
    }
    expect(tercakup).toBe(15);
  });

  it("uji laptop lengkap dan render ABT asli tanpa penanda tersisa", () => {
    const uji = readFileSync(path.join(AKAR, "hasil/uji-lokal.txt"), "utf8");
    for (const s of ["PRASYARAT COCOK (0|0|2)", "TAMBAL=65", "SUDAH=65", "SIDIK & VARIABEL TETAP", "PULIH=65", "PULIH COCOK", "SIDIK BERKAS = AWAL", "VARIABEL = AWAL", "BIARKAN=1 PULIH=64", "GAGAL=1 SIAP=64", "'1|0|2'", "AKHIR: VARIABEL = AWAL"]) {
      expect(uji, s).toContain(s);
    }
    expect(uji.match(/TIDAK ADA YANG BERUBAH/g)).toHaveLength(2);
    const r = readFileSync(path.join(AKAR, "hasil/render-banding.txt"), "utf8").split("\n").filter((l) => /^A\d{4}\t/.test(l)).map((l) => l.split("\t"));
    expect(r).toHaveLength(65);
    for (const b of r) expect(b[3], b[9]).toBe("0");
  });
});
