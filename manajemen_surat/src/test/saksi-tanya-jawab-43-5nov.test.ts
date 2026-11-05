// @vitest-environment node
/**
 * Paket ABT abt-saksi-tanya-jawab-43-5nov: blangko yang mencetak keterangan saksi lewat #9259#-#9267# tanpa variabel tanya jawabnya mendapat grup tersembunyi isianasal.
 * Penjaga: isi paket, hanya sisipan grup tersembunyi, dasar md5 = sesudah a5-kelompok, panel tidak mendapat butir ganda, uji laptop dan render.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(REPO, "abt-paket/saksi-tanya-jawab-43-5nov");
const P = path.join(AKAR, "paket-satker");
const baca = (n: string) => readFileSync(path.join(P, n));
const tsv = (p: string) => readFileSync(p, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const daftar = tsv(path.join(P, "daftar-tambal.tsv"));
const potong = tsv(path.join(P, "tambal.tsv")).map(([k, off, l0, l1]) => ({ kode: k, off: Number(off), lama: Buffer.from(l0, "base64").toString("latin1"), baru: Buffer.from(l1, "base64").toString("latin1") }));
const TJ = ["2021", "2022", "2031", "8920", "8932", "2023", "2024", "2032", "8942"];

describe("paket saksi-tanya-jawab-43-5nov", () => {
  it("75 blangko derry_briantono di luar folder arsip", () => {
    expect(daftar).toHaveLength(75);
    for (const d of daftar) {
      expect(d[1].startsWith("derry_briantono/"), d[1]).toBe(true);
      expect(d[1]).not.toMatch(/^derry_briantono\/(ALUR |- BAS |terhapus)/);
      expect(potong.filter((p) => p.kode === d[0]), d[1]).toHaveLength(Number(d[4]));
    }
  });

  it("tiap potongan hanya menyisipkan satu grup tersembunyi variabel tanya jawab, tanpa kata nama aplikasi", () => {
    expect(potong).toHaveLength(196);
    for (const p of potong) {
      expect(p.lama).toHaveLength(1);
      const m = /^\{\\\*\\isianasal #(\d+)#\}([\s\S])$/.exec(p.baru);
      expect(m, p.baru).not.toBeNull();
      expect(TJ).toContain(m?.[1]);
      expect(m?.[2]).toBe(p.lama);
    }
  });

  it("dasar md5 = md5_baru a5-kelompok-5nov bila berkas itu tercakup, selain itu a5-merah-5nov", () => {
    const peta = (n: string) => new Map(tsv(path.join(REPO, `abt-paket/${n}/paket-satker/daftar-tambal.tsv`)).map((b) => [b[1], b[3]] as [string, string]));
    const k = peta("a5-kelompok-5nov");
    const m = peta("a5-merah-5nov");
    let cakup = 0;
    for (const d of daftar) {
      const h = k.get(d[1]) ?? m.get(d[1]);
      if (h) { cakup++; expect(d[2], d[1]).toBe(h); }
    }
    expect(cakup).toBeGreaterThan(15);
  });

  it("panel: keterangan otomatis + tanya jawab tersembunyi = satu butir per saksi", () => {
    const d = (kode: string, nama: string, jenis: string): [string, Definisi] => [kode, { kode, nama, jenis, sql: "", bawaan: "" }];
    const kat = new Map<string, Definisi>([
      d("9259", "KETERANGAN SAKSI 1 #0046# (OTOMATIS)", "data_sql"), d("9260", "KETERANGAN SAKSI 2 #0046# (OTOMATIS)", "data_sql"),
      d("2021", "Keterangan Saksi 1 P", "tanya_jawab"), d("2022", "Keterangan Saksi 2 P", "tanya_jawab"),
    ]);
    const tj = susunIsian(["2021", "9259", "2022", "9260"], kat).isian.filter((i) => i.jenis === "tj").map((i) => i.kode);
    expect(tj).toEqual(["2021", "2022"]);
  });

  it("isi paket = MD5SUMS; PRASYARAT sebelum pasang; uji laptop, pindai, render", () => {
    for (const l of baca("MD5SUMS.txt").toString("utf8").split("\n").filter(Boolean)) {
      const [h, n] = l.split(/\s+\*?/);
      expect(md5(baca(n)), n).toBe(h);
    }
    const sh = baca("pasang-satker.sh").toString("utf8");
    expect(sh.indexOf("PRASYARAT.sql")).toBeLessThan(sh.indexOf("tambal_rtf.py cek"));
    expect(sh.indexOf("tambal_rtf.py cek")).toBeLessThan(sh.indexOf("tambal_rtf.py pasang"));
    const uji = readFileSync(path.join(AKAR, "hasil/uji-lokal.txt"), "utf8");
    for (const s of ["PRASYARAT COCOK (10)", "TAMBAL=75", "SUDAH=75", "SIDIK TETAP", "PULIH=75", "PULIH COCOK", "SIDIK = AWAL", "GAGAL=1 SIAP=74", "BIARKAN=1 PULIH=74"]) expect(uji, s).toContain(s);
    expect(uji.match(/TIDAK ADA YANG BERUBAH/g)).toHaveLength(2);
    expect(readFileSync(path.join(AKAR, "hasil/pindai-sesudah.txt"), "utf8")).toMatch(/^GAGAL\t0$/m);
    expect(readFileSync(path.join(AKAR, "hasil/render-banding.txt"), "utf8")).toMatch(/^GAGAL\t0$/m);
  });
});
