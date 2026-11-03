// @vitest-environment node
/**
 * Paket ABT abt-audit-mekanis-4nov (audit A3 4 Nov 2026): tambalan MEKANIS teks blangko derry_briantono tanpa mengubah maksud hukum.
 *   K01 "#8554# Hakim" -> "#8554#" (tercetak "Majelis Hakim Hakim"/"Hakim Hakim")
 *   K09 "Penetapan Hakim #4004#" -> "Penetapan #4004#" (#4004# = "Ketua Majelis"/"Hakim"; tunggal tercetak "Penetapan Hakim Hakim")
 *   K13 "isbat" -> "itsbat" (teks saja, bukan nama folder/berkas) | K06 salah ketik jelas | K07 ejaan baku (diatas, dipersidangan,
 *   dibawah, Undang Undang) | S01 identitas saksi ke-2 memakai variabel saksi ke-1 (#1241# -> #1242#, #1202# -> #1208#).
 * Penjaga: isi paket, md5 dasar = keadaan server sesudah saksi-rapi-3nov + ijab-yang-menikahkan-3nov, kode RTF di dalam potongan
 * tidak berubah, tanpa kata nama aplikasi, MD5SUMS, uji pasang/ulang/pulih/prasyarat (hasil/uji-lokal.txt), pindai ulang = 0.
 * Bila pohon uji laptop ada (POHON_AUDIT_4NOV atau jalur bawaan), tambalan diterapkan di memori: md5 = md5_baru dan pola lama hilang.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(REPO, "abt-paket/audit-mekanis-4nov");
const P = path.join(AKAR, "paket-satker");
const baca = (n: string) => readFileSync(path.join(P, n));
const tsv = (p: string) => readFileSync(p, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const KODE = /\\[a-zA-Z]+-?\d* ?|[{}]|\r|\n/g;
const tampak = (s: string) => s.replace(KODE, "");
const kode = (s: string) => (s.match(/\\[a-zA-Z]+-?\d* ?|[{}]/g) ?? []).join("");

const daftar = tsv(path.join(P, "daftar-tambal.tsv"));
const potong = tsv(path.join(P, "tambal.tsv")).map(([k, off, lama, baru]) => ({
  kode: k, off: Number(off), lama: Buffer.from(lama, "base64"), baru: Buffer.from(baru, "base64"),
}));
const t0 = (p: { lama: Buffer }) => tampak(p.lama.toString("latin1"));
const t1 = (p: { baru: Buffer }) => tampak(p.baru.toString("latin1"));

describe("paket audit-mekanis-4nov", () => {
  it("720 blangko derry_briantono, 1.427 potongan; jumlah potongan per berkas sesuai daftar", () => {
    expect(daftar).toHaveLength(720);
    expect(potong).toHaveLength(1427);
    for (const d of daftar) {
      expect(d[1].startsWith("derry_briantono/"), d[1]).toBe(true);
      expect(potong.filter((p) => p.kode === d[0]), d[1]).toHaveLength(Number(d[4]));
    }
  });

  it("tiap jenis tambalan lengkap: K01 30, K09 131, K13 19, S01 6 (5 hubungan + 1 alamat)", () => {
    const n = (f: (a: string, b: string) => boolean) => potong.filter((p) => f(t0(p), t1(p))).length;
    expect(n((a, b) => a === "#8554# Hakim" && b === "#8554#")).toBe(30);
    expect(n((a, b) => a === "Penetapan Hakim #4004#" && b === "Penetapan #4004#")).toBe(131);
    expect(n((a, b) => /^[Ii]sbat$/.test(a) && b === a.replace(/^([Ii])sbat$/, "$1tsbat"))).toBe(19);
    expect(n((a, b) => /#1241#$/.test(a) && b === a.replace(/#1241#$/, "#1242#"))).toBe(5);
    expect(n((a, b) => a === "bertempat tinggal di #1202#" && b === "bertempat tinggal di #1208#")).toBe(1);
    expect(n((a, b) => /^[Dd]iatas$/.test(a) && b === a.slice(0, 2) + " atas")).toBe(819);
    expect(n((a, b) => /^[Bb]erkaitaan$/.test(a))).toBe(113);
    expect(n((a, b) => /^[Dd]ipertahankankan$/.test(a) && b === a.slice(0, 13))).toBe(52);
    expect(n((a, b) => a === "calon istri istri" && b === "calon suami istri")).toBe(4);
    expect(n((a, b) => a === "sebagai istri istri" && b === "sebagai suami istri")).toBe(6);
  });

  it("hanya teks yang berubah: kode RTF di dalam potongan sama persis, teks baru ASCII polos, tanpa kata nama aplikasi", () => {
    for (const p of potong) {
      expect(kode(p.baru.toString("latin1"))).toBe(kode(p.lama.toString("latin1")));
      expect(p.baru.toString("latin1")).toMatch(/^[\x20-\x7e\r\n]+$/);
      expect(p.baru.toString("latin1")).not.toMatch(/aleta/i);
      expect(t1(p)).not.toMatch(/#8554# Hakim|Penetapan Hakim #4004#|\b[Ii]sbat\b|citakan/);
    }
    for (const n of ["pasang-satker.sh", "pulih-satker.sh", "tambal_rtf.py", "daftar-tambal.tsv"]) expect(baca(n).toString("utf8")).not.toMatch(/aleta/i);
  });

  it("md5 dasar = keadaan server sesudah saksi-rapi-3nov dan ijab-yang-menikahkan-3nov", () => {
    const sesudah = (pk: string) => new Map(tsv(path.join(REPO, "abt-paket", pk, "paket-satker/daftar-tambal.tsv")).map((b) => [b[1], b[3]] as [string, string]));
    const rapi = sesudah("saksi-rapi-3nov");
    const ijab = sesudah("ijab-yang-menikahkan-3nov");
    let nIjab = 0;
    for (const d of daftar) {
      if (ijab.has(d[1])) { nIjab++; expect(d[2], d[1]).toBe(ijab.get(d[1])); } else if (rapi.has(d[1])) expect(d[2], d[1]).toBe(rapi.get(d[1]));
    }
    expect(nIjab).toBe(5);
  });

  it("isi paket = MD5SUMS; tambal_rtf.py sama dengan paket sebelumnya; cek sebelum pasang; uji laptop lengkap", () => {
    for (const l of baca("MD5SUMS.txt").toString("utf8").split("\n").filter(Boolean)) {
      const [h, n] = l.split(/\s+\*?/);
      expect(md5(baca(n)), n).toBe(h);
    }
    expect(md5(baca("tambal_rtf.py"))).toBe(md5(readFileSync(path.join(REPO, "abt-paket/ijab-yang-menikahkan-3nov/paket-satker/tambal_rtf.py"))));
    const sh = baca("pasang-satker.sh").toString("utf8");
    expect(sh).toContain('"BERKAS SIAP" ] || gagal');
    expect(sh.indexOf("tambal_rtf.py cek")).toBeLessThan(sh.indexOf("tambal_rtf.py pasang"));
    const uji = readFileSync(path.join(AKAR, "hasil/uji-lokal.txt"), "utf8");
    for (const s of ["TAMBAL=720", "SUDAH=720", "SIDIK TETAP", "PULIH=720", "PULIH COCOK", "SIDIK = AWAL", "TIDAK ADA YANG BERUBAH", "BIARKAN=1 PULIH=719"]) expect(uji).toContain(s);
    expect(uji.match(/TIDAK ADA YANG BERUBAH/g)).toHaveLength(2);
    const pindai = readFileSync(path.join(AKAR, "hasil/pindai-sesudah.txt"), "utf8");
    expect(pindai).toMatch(/^K01\thakim-ganda-8554\t0 kali/m);
    expect(pindai).toMatch(/^K09\tpenetapan-hakim-4004\t0 kali/m);
    for (const l of pindai.split("\n").filter((x) => /^[KS]\d\d\t/.test(x))) expect(l, l).toMatch(/\t0 kali\t0 berkas/);
  });

  const POHON = process.env.POHON_AUDIT_4NOV ?? "D:/aleta-dev/kerja/audit-abt-4nov/C1/asli";
  it.skipIf(!existsSync(path.join(POHON, "derry_briantono")))("diterapkan atas pohon laptop: md5 = md5_baru, tidak ada 'Majelis Hakim Hakim'/'Penetapan Hakim Hakim' tersisa", () => {
    for (const d of daftar) {
      let b = readFileSync(path.join(POHON, d[1]));
      expect(md5(b), d[1]).toBe(d[2]);
      for (const p of potong.filter((x) => x.kode === d[0]).sort((x, y) => y.off - x.off)) {
        expect(b.subarray(p.off, p.off + p.lama.length).equals(p.lama), d[1]).toBe(true);
        b = Buffer.concat([b.subarray(0, p.off), p.baru, b.subarray(p.off + p.lama.length)]);
      }
      expect(md5(b), d[1]).toBe(d[3]);
      const t = tampak(b.toString("latin1"));
      expect(t, d[1]).not.toMatch(/#8554# Hakim\b|Penetapan Hakim #4004#|#4004# Hakim/);
    }
  });
});
