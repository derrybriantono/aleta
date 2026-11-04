// @vitest-environment node
/**
 * Paket ABT abt-keputusan-a-mekanis-4nov (keputusan Derry 182/184, 4 Nov 2026): ubahan teks blangko derry_briantono saja.
 *   A6 "#8555# <pemutus>" -> "#8554#" (4 putusan CG/CT)  | A11 #0690# -> #8554#, #4004# -> #8555# di 106 putusan/penetapan non-BAS
 *   A3 catatan kerja "(apabila tau ...)" dibuang        | E2 "untuk mendapatkan Buku Nikah" -> "untuk #8171#"
 *   A13 "isteri" -> "istri" di kalimat buatan blangko (kutipan dibiarkan), "c/q Majelis #8554#" -> "c/q #8554#"; "fijtelijkeground" tetap.
 * Dasar md5 = keadaan SESUDAH ijab-yang-menikahkan-3nov + audit-mekanis-4nov + audit-ejaan-4nov.
 * Penjaga: isi paket, md5 dasar, kode RTF di dalam potongan tidak berubah (kecuali satu paragraf K03), tanpa kata nama aplikasi, MD5SUMS,
 * uji laptop (pasang/ulang/pulih/prasyarat), pindai ulang; bila pohon laptop ada: ketiga paket lebih dulu + paket ini = md5_baru.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(REPO, "abt-paket/keputusan-a-mekanis-4nov");
const P = path.join(AKAR, "paket-satker");
const baca = (n: string) => readFileSync(path.join(P, n));
const tsv = (p: string) => readFileSync(p, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const KODE = /\\[a-zA-Z]+-?\d* ?|[{}]|\r|\n/g;
const tampak = (s: string) => s.replace(KODE, "");
const kode = (s: string) => (s.match(/\\[a-zA-Z]+-?\d* ?|[{}]/g) ?? []).join("");
type Potong = { kode: string; off: number; lama: Buffer; baru: Buffer };
const potongan = (dir: string): Potong[] => tsv(path.join(dir, "tambal.tsv")).map(([k, off, lama, baru]) => ({
  kode: k, off: Number(off), lama: Buffer.from(lama, "base64"), baru: Buffer.from(baru, "base64"),
}));
const t0 = (p: Potong) => tampak(p.lama.toString("latin1"));
const t1 = (p: Potong) => tampak(p.baru.toString("latin1"));

const daftar = tsv(path.join(P, "daftar-tambal.tsv"));
const potong = potongan(P);
const PM = path.join(REPO, "abt-paket/audit-mekanis-4nov/paket-satker");
const PE = path.join(REPO, "abt-paket/audit-ejaan-4nov/paket-satker");
const K03 = "derry_briantono/1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis.rtf";
const V03 = readFileSync(path.join(AKAR, "sumber/daftar-v03.txt"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => "derry_briantono/" + l);

describe("paket keputusan-a-mekanis-4nov", () => {
  it("151 blangko, 505 potongan; jumlah potongan per berkas sesuai daftar", () => {
    expect(daftar).toHaveLength(151);
    expect(potong).toHaveLength(505);
    for (const d of daftar) {
      expect(d[0]).toMatch(/^N\d{4}$/);
      expect(d[1].startsWith("derry_briantono/"), d[1]).toBe(true);
      expect(potong.filter((p) => p.kode === d[0]), d[1]).toHaveLength(Number(d[4]));
    }
  });

  it("A11: #0690# -> #8554# (188) dan #4004# -> #8555# (57) tepat di 106 berkas daftar V03", () => {
    const a = potong.filter((p) => t0(p) === "#0690#" && t1(p) === "#8554#");
    const b = potong.filter((p) => t0(p) === "#4004#" && t1(p) === "#8555#");
    expect(a.length).toBe(188);
    expect(b.length).toBe(57);
    const kodeBerkas = new Map(daftar.map((d) => [d[0], d[1]] as [string, string]));
    const berkas = new Set([...a, ...b].map((p) => kodeBerkas.get(p.kode)));
    expect([...berkas].sort()).toEqual([...V03].sort());
    expect(V03).toHaveLength(106);
    expect(V03.some((x) => /- BAS\/|\/BAS |^derry_briantono\/ALUR|terhapus/.test(x))).toBe(false);
  });

  it("A6: 35 #8555# -> #8554# di 4 putusan; A13: isteri -> istri 217, c/q Majelis 1; E2: 6 blangko tujuan itsbat", () => {
    expect(potong.filter((p) => t0(p) === "#8555#" && t1(p) === "#8554#")).toHaveLength(35);
    const kodeBerkas = new Map(daftar.map((d) => [d[0], d[1]] as [string, string]));
    const a6 = new Set(potong.filter((p) => t0(p) === "#8555#").map((p) => kodeBerkas.get(p.kode)));
    expect(a6.size).toBe(4);
    const ist = potong.filter((p) => /^[Ii]steri/.test(t0(p)));
    expect(ist).toHaveLength(217);
    for (const p of ist) expect(t1(p)).toBe(t0(p).replace("steri", "stri"));
    expect(potong.filter((p) => t0(p) === "Majelis " && t1(p) === "" || t0(p) === "c/q Majelis #8554#")).toHaveLength(1);
    const e2 = potong.filter((p) => /mendapatkan Buku Nikah/.test(t0(p)));
    expect(e2).toHaveLength(6);
    for (const p of e2) expect(t1(p)).toContain("#8171#");
  });

  it("hanya teks yang berubah: kode RTF sama persis (kecuali satu paragraf K03), ASCII polos, tanpa kata nama aplikasi", () => {
    const kodeBerkas = new Map(daftar.map((d) => [d[0], d[1]] as [string, string]));
    let beda = 0;
    for (const p of potong) {
      const lama = p.lama.toString("latin1");
      const baru = p.baru.toString("latin1");
      if (kode(baru) !== kode(lama)) {
        beda++;
        expect(kodeBerkas.get(p.kode)).toBe(K03);
        expect(baru).toContain("\\par ");
      }
      expect(baru).not.toMatch(/aleta/i);
      expect(tampak(baru)).not.toMatch(/apabila tau/);
    }
    expect(beda).toBe(1);
    for (const n of ["pasang-satker.sh", "pulih-satker.sh", "tambal_rtf.py", "daftar-tambal.tsv"]) expect(baca(n).toString("utf8")).not.toMatch(/aleta/i);
  });

  it("md5 dasar = md5_baru paket audit-ejaan / audit-mekanis / ijab / saksi-rapi (yang tercakup) dan tanpa duplikat berkas", () => {
    const sesudah = (dir: string) => new Map(tsv(path.join(dir, "daftar-tambal.tsv")).map((b) => [b[1], b[3]] as [string, string]));
    const e = sesudah(PE);
    const m = sesudah(PM);
    const ijab = sesudah(path.join(REPO, "abt-paket/ijab-yang-menikahkan-3nov/paket-satker"));
    const rapi = sesudah(path.join(REPO, "abt-paket/saksi-rapi-3nov/paket-satker"));
    let tercakup = 0;
    for (const d of daftar) {
      const harap = e.get(d[1]) ?? m.get(d[1]) ?? ijab.get(d[1]) ?? rapi.get(d[1]);
      if (harap) { tercakup++; expect(d[2], d[1]).toBe(harap); }
    }
    expect(tercakup).toBeGreaterThan(100);
    expect(new Set(daftar.map((d) => d[1])).size).toBe(151);
  });

  it("isi paket = MD5SUMS; tambal_rtf.py sama dengan paket audit; cek sebelum pasang; uji laptop lengkap; pindai ulang", () => {
    for (const l of baca("MD5SUMS.txt").toString("utf8").split("\n").filter(Boolean)) {
      const [h, n] = l.split(/\s+\*?/);
      expect(md5(baca(n)), n).toBe(h);
    }
    expect(md5(baca("tambal_rtf.py"))).toBe(md5(readFileSync(path.join(PM, "tambal_rtf.py"))));
    const sh = baca("pasang-satker.sh").toString("utf8");
    expect(sh).toContain("N=abt-keputusan-a-mekanis-4nov");
    expect(sh).toContain('"BERKAS SIAP" ] || gagal');
    expect(sh.indexOf("tambal_rtf.py cek")).toBeLessThan(sh.indexOf("tambal_rtf.py pasang"));
    const uji = readFileSync(path.join(AKAR, "hasil/uji-lokal.txt"), "utf8");
    for (const s of ["TAMBAL=151", "SUDAH=151", "SIDIK TETAP", "PULIH=151", "PULIH COCOK", "SIDIK = AWAL", "BIARKAN=1 PULIH=150", "GAGAL=1 SIAP=150", "GAGAL=122 SIAP=29"]) expect(uji).toContain(s);
    expect(uji.match(/TIDAK ADA YANG BERUBAH/g)).toHaveLength(2);
    const pindai = readFileSync(path.join(AKAR, "hasil/pindai-sesudah.txt"), "utf8");
    expect(pindai).toMatch(/A11 #0690# di 106 berkas\tsebelum 188\tsesudah 0/);
    expect(pindai).toMatch(/A11 #4004# di 106 berkas\tsebelum 57\tsesudah 0/);
    expect(pindai).toMatch(/A6 "#8555# <pemutus>" di 4 putusan\tsebelum 23\tsesudah 0/);
    expect(pindai).toMatch(/apabila tau.*sebelum 1\tsesudah 0/);
    expect(pindai).toMatch(/fijtelijkeground.*sebelum 3\tsesudah 3/);
    expect(pindai).toMatch(/\[98\] Cabut.*sebelum 6\tsesudah 6/);
  });

  const POHON = process.env.POHON_AUDIT_4NOV ?? "D:/aleta-dev/kerja/audit-abt-4nov/pohon";
  it.skipIf(!existsSync(path.join(POHON, "derry_briantono")))("pohon laptop: ijab -> mekanis -> ejaan -> paket ini = md5_baru; pola lama hilang", () => {
    const terapkan = (b: Buffer, ps: Potong[]) => {
      for (const p of [...ps].sort((x, y) => y.off - x.off)) {
        expect(b.subarray(p.off, p.off + p.lama.length).equals(p.lama)).toBe(true);
        b = Buffer.concat([b.subarray(0, p.off), p.baru, b.subarray(p.off + p.lama.length)]);
      }
      return b;
    };
    const pm = potongan(PM);
    const pe = potongan(PE);
    const dm = new Map(tsv(path.join(PM, "daftar-tambal.tsv")).map((d) => [d[1], d] as [string, string[]]));
    const de = new Map(tsv(path.join(PE, "daftar-tambal.tsv")).map((d) => [d[1], d] as [string, string[]]));
    for (const d of daftar) {
      let b: Buffer = readFileSync(path.join(POHON, d[1]));
      const m = dm.get(d[1]);
      if (m) { b = terapkan(b, pm.filter((x) => x.kode === m[0])); expect(md5(b), d[1]).toBe(m[3]); }
      const e = de.get(d[1]);
      if (e) { b = terapkan(b, pe.filter((x) => x.kode === e[0])); expect(md5(b), d[1]).toBe(e[3]); }
      expect(md5(b), d[1]).toBe(d[2]);
      b = terapkan(b, potong.filter((x) => x.kode === d[0]));
      expect(md5(b), d[1]).toBe(d[3]);
      const t = tampak(b.toString("latin1"));
      expect(t, d[1]).not.toMatch(/c\/q Majelis #8554#|apabila tau|untuk mendapatkan Buku Nikah/);
      if (V03.includes(d[1])) expect(t, d[1]).not.toMatch(/#0690#|#4004#/);
    }
  });
});
