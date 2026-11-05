// @vitest-environment node
/**
 * Paket ABT abt-a5-kelompok-5nov (keputusan Derry, 5 Nov 2026): 45 kelompok teks merah sisa daftar A5, di atas a5-merah-5nov.
 * Penjaga: isi paket, dasar md5 = hasil a5-merah, bentuk grup bersyarat dan variabelnya, panel tidak menghitung pilihan sebagai wajib, aman MariaDB 5.5, uji laptop dan render.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(REPO, "abt-paket/a5-kelompok-5nov");
const P = path.join(AKAR, "paket-satker");
const N = "abt-a5-kelompok-5nov";
const baca = (n: string) => readFileSync(path.join(P, n));
const tsv = (p: string) => readFileSync(p, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const daftar = tsv(path.join(P, "daftar-tambal.tsv"));
const potong = tsv(path.join(P, "tambal.tsv")).map(([k, off, l0, l1]) => ({ kode: k, off: Number(off), lama: Buffer.from(l0, "base64").toString("latin1"), baru: Buffer.from(l1, "base64").toString("latin1") }));
const hasil = readFileSync(path.join(AKAR, "hasil/ringkas.txt"), "utf8");
const pasang = baca(`${N}-PASANG.sql`).toString("latin1");
type Baris = { no: number; nama: string; jenis: string; sql: string; bawaan: string };
const variabel: Baris[] = [...pasang.matchAll(/SELECT (\d+), CONVERT\(0x([0-9a-f]+) USING latin1\), '(data_\w+)', NULL, NULL, NULL, NULL, (?:REPLACE\(CONVERT\(0x([0-9a-f]+) USING latin1\), 'aps_badilag\.', CONCAT\(DATABASE\(\), '\.'\)\)|NULL), (?:CONVERT\(0x([0-9a-f]+) USING latin1\)|NULL)/g)].map((m) => ({
  no: Number(m[1]),
  nama: Buffer.from(m[2], "hex").toString("latin1"),
  jenis: m[3],
  sql: m[4] ? Buffer.from(m[4], "hex").toString("latin1") : "",
  bawaan: m[5] ? Buffer.from(m[5], "hex").toString("latin1") : "",
}));

describe("paket a5-kelompok-5nov", () => {
  it("22 berkas derry_briantono; golongan menjumlah 540 baris", () => {
    expect(daftar).toHaveLength(22);
    for (const d of daftar) {
      expect(d[1].startsWith("derry_briantono/"), d[1]).toBe(true);
      expect(potong.filter((p) => p.kode === d[0]), d[1]).toHaveLength(Number(d[4]));
    }
    const n = (g: string) => Number(new RegExp(`^${g}\\t(\\d+)$`, "m").exec(hasil)?.[1] ?? "0");
    expect(n("tetap") + n("isian") + n("isian otomatis") + n("kalimat pilihan") + n("buang") + n("tetap merah")).toBe(540);
    expect(n("tetap merah")).toBe(11);
  });

  it("dasar md5 = md5_baru a5-merah-5nov untuk berkas yang tercakup", () => {
    const a5 = new Map(tsv(path.join(REPO, "abt-paket/a5-merah-5nov/paket-satker/daftar-tambal.tsv")).map((b) => [b[1], b[3]] as [string, string]));
    let cakup = 0;
    for (const d of daftar) {
      const h = a5.get(d[1]);
      if (h) { cakup++; expect(d[2], d[1]).toBe(h); }
    }
    expect(cakup).toBe(19);
  });

  it("variabel: 30 baru, nomor 12150-12179, heks, tanpa escape, tanpa kata nama aplikasi; penanda bersyarat hanya menghasilkan kosong atau \\nonshppict", () => {
    expect(variabel.map((v) => v.no)).toEqual(Array.from({ length: 30 }, (_, i) => 12150 + i));
    expect(pasang).not.toContain("\\");
    for (const v of variabel) {
      expect(v.nama + v.sql + v.bawaan).not.toMatch(/aleta/i);
      if (v.jenis === "data_sql") {
        expect(v.sql).toContain("CONCAT(CONVERT(CHAR(92) USING utf8), 'nonshppict')");
        expect(v.sql).not.toContain("\\");
      }
    }
    const pilih = variabel.filter((v) => /PILIH: pakai \/ tidak dipakai/.test(v.nama));
    expect(pilih).toHaveLength(8);
    for (const v of pilih) expect(v.bawaan).toBe("tidak dipakai\npakai");
  });

  it("mesin bersih: rumus penanda bersyarat lolos pagar dan kata kendali dipertahankan", () => {
    const r = createRequire(import.meta.url);
    const m = r(path.join(REPO, "aleta_bot/services/abtMesinVariabel.js"));
    for (const v of variabel.filter((x) => x.jenis === "data_sql")) expect(m.pagarBaca(v.sql.replace(/#perkara_id#/g, "1")), String(v.no)).toBe("");
    const peta = new Map<string, string>([["", "\\nonshppict"]]);
    expect(m.keRtf(m.bersihkanHtmlAbt(""), peta)).toBe("\\nonshppict");
  });

  it("panel: pilihan dipakai/tidak tampil tetapi tidak dihitung wajib; isian ketik tetap wajib", () => {
    const kat = new Map<string, Definisi>(variabel.map((v) => [String(v.no), { kode: String(v.no), nama: v.nama, jenis: v.jenis, sql: v.sql, bawaan: v.bawaan }]));
    const k = "12151";
    const h = susunIsian([k, "12167"], kat);
    const pilih = h.isian.find((i) => i.kode === "12150");
    expect(pilih?.wajib).toBe(false);
    expect(h.isian.find((i) => i.kode === "12167")?.wajib).toBe(true);
  });

  it("isi paket = MD5SUMS; tambal_rtf.py sama dengan paket sebelumnya; PRASYARAT sebelum pasang; tanpa kata nama aplikasi", () => {
    for (const l of baca("MD5SUMS.txt").toString("utf8").split("\n").filter(Boolean)) {
      const [h, n] = l.split(/\s+\*?/);
      expect(md5(baca(n)), n).toBe(h);
    }
    expect(md5(baca("tambal_rtf.py"))).toBe(md5(readFileSync(path.join(REPO, "abt-paket/a5-merah-5nov/paket-satker/tambal_rtf.py"))));
    const sh = baca("pasang-satker.sh").toString("utf8");
    expect(sh).toContain(`N=${N}`);
    expect(sh.indexOf("tambal_rtf.py cek")).toBeLessThan(sh.indexOf("-PASANG.sql"));
    expect(sh.indexOf("-PASANG.sql")).toBeLessThan(sh.indexOf("tambal_rtf.py pasang"));
    for (const p of potong) expect(p.baru).not.toMatch(/aleta/i);
  });

  it("uji laptop, pindai ulang, render ABT asli lengkap", () => {
    const uji = readFileSync(path.join(AKAR, "hasil/uji-lokal.txt"), "utf8");
    for (const s of ["PRASYARAT COCOK (0|0|6)", "TAMBAL=22", "SUDAH=22", "SIDIK & VARIABEL TETAP", "PULIH=22", "PULIH COCOK", "SIDIK BERKAS = AWAL", "VARIABEL = AWAL", "BIARKAN=1 PULIH=21", "GAGAL=1 SIAP=21", "'1|0|6'", "AKHIR: VARIABEL = AWAL"]) {
      expect(uji, s).toContain(s);
    }
    const pindai = readFileSync(path.join(AKAR, "hasil/pindai-sesudah.txt"), "utf8");
    expect(pindai).toMatch(/^GAGAL\t0$/m);
    expect(pindai).toMatch(/Paragraf berisi baris hitamkan a5 dan baris tetap merah: 0/);
    const render = readFileSync(path.join(AKAR, "hasil/render-banding.txt"), "utf8");
    expect(render).toMatch(/^GAGAL\t0$/m);
  });
});
