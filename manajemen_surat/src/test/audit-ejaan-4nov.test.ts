// @vitest-environment node
/**
 * Paket ABT abt-audit-ejaan-4nov (audit A3 K07, 4 Nov 2026): ejaan baku teks blangko derry_briantono - "diatas" -> "di atas",
 * "dipersidangan" -> "di persidangan", "dibawah" -> "di bawah", "Undang Undang" -> "Undang-Undang". "isteri" sengaja tidak disentuh
 * (kutipan peraturan). Dipasang SESUDAH audit-mekanis-4nov: md5 dasar berkas yang juga ditambal paket itu = md5_baru-nya.
 * Penjaga: isi paket, md5 dasar, kode RTF di dalam potongan tidak berubah, tanpa kata nama aplikasi, MD5SUMS, uji laptop,
 * pindai ulang = 0; bila pohon laptop ada: mekanis lalu ejaan diterapkan di memori = md5_baru dan pola lama hilang.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(REPO, "abt-paket/audit-ejaan-4nov");
const P = path.join(AKAR, "paket-satker");
const PM = path.join(REPO, "abt-paket/audit-mekanis-4nov/paket-satker");
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

const daftar = tsv(path.join(P, "daftar-tambal.tsv"));
const potong = potongan(P);
const mekanis = tsv(path.join(PM, "daftar-tambal.tsv"));

describe("paket audit-ejaan-4nov", () => {
  it("581 blangko, 938 potongan: diatas 819, dipersidangan 78, dibawah 24, Undang Undang 17", () => {
    expect(daftar).toHaveLength(581);
    expect(potong).toHaveLength(938);
    for (const d of daftar) {
      expect(d[0]).toMatch(/^E\d{4}$/);
      expect(potong.filter((p) => p.kode === d[0]), d[1]).toHaveLength(Number(d[4]));
    }
    const n = (rx: RegExp, ganti: (a: string) => string) =>
      potong.filter((p) => { const a = tampak(p.lama.toString("latin1")); return rx.test(a) && tampak(p.baru.toString("latin1")) === ganti(a); }).length;
    expect(n(/^[Dd]iatas$/, (a) => a.slice(0, 2) + " atas")).toBe(819);
    expect(n(/^[Dd]ipersidangan$/, (a) => a.slice(0, 2) + " persidangan")).toBe(78);
    expect(n(/^[Dd]ibawah$/, (a) => a.slice(0, 2) + " bawah")).toBe(24);
    expect(n(/^Undang Undang$/, () => "Undang-Undang")).toBe(17);
  });

  it("hanya teks yang berubah: kode RTF sama persis, ASCII polos, tanpa kata nama aplikasi; isteri tidak disentuh", () => {
    for (const p of potong) {
      expect(kode(p.baru.toString("latin1"))).toBe(kode(p.lama.toString("latin1")));
      expect(p.baru.toString("latin1")).toMatch(/^[\x20-\x7e\r\n]+$/);
      expect(p.baru.toString("latin1")).not.toMatch(/aleta/i);
      expect(tampak(p.lama.toString("latin1"))).not.toMatch(/isteri/i);
    }
    for (const n of ["pasang-satker.sh", "pulih-satker.sh", "tambal_rtf.py", "daftar-tambal.tsv"]) expect(baca(n).toString("utf8")).not.toMatch(/aleta/i);
  });

  it("md5 dasar = keadaan sesudah audit-mekanis-4nov (150 berkas bersama) atau sesudah ijab/saksi-rapi", () => {
    const sesudah = (dir: string) => new Map(tsv(path.join(dir, "daftar-tambal.tsv")).map((b) => [b[1], b[3]] as [string, string]));
    const m = sesudah(PM);
    const ijab = sesudah(path.join(REPO, "abt-paket/ijab-yang-menikahkan-3nov/paket-satker"));
    const rapi = sesudah(path.join(REPO, "abt-paket/saksi-rapi-3nov/paket-satker"));
    let bersama = 0;
    for (const d of daftar) {
      const harap = m.get(d[1]) ?? ijab.get(d[1]) ?? rapi.get(d[1]);
      if (m.has(d[1])) bersama++;
      if (harap) expect(d[2], d[1]).toBe(harap);
    }
    expect(bersama).toBe(150);
    expect(new Set([...mekanis.map((d) => d[1]), ...daftar.map((d) => d[1])]).size).toBe(720);
  });

  it("isi paket = MD5SUMS; tambal_rtf.py sama; cek sebelum pasang; uji laptop lengkap; pindai ulang = 0", () => {
    for (const l of baca("MD5SUMS.txt").toString("utf8").split("\n").filter(Boolean)) {
      const [h, n] = l.split(/\s+\*?/);
      expect(md5(baca(n)), n).toBe(h);
    }
    expect(md5(baca("tambal_rtf.py"))).toBe(md5(readFileSync(path.join(PM, "tambal_rtf.py"))));
    const sh = baca("pasang-satker.sh").toString("utf8");
    expect(sh).toContain("N=abt-audit-ejaan-4nov");
    expect(sh).toContain('"BERKAS SIAP" ] || gagal');
    expect(sh.indexOf("tambal_rtf.py cek")).toBeLessThan(sh.indexOf("tambal_rtf.py pasang"));
    const uji = readFileSync(path.join(AKAR, "hasil/uji-lokal.txt"), "utf8");
    for (const s of ["TAMBAL=581", "SUDAH=581", "SIDIK TETAP", "PULIH=581", "PULIH COCOK", "SIDIK = AWAL", "BIARKAN=1 PULIH=580", "GAGAL=150"]) expect(uji).toContain(s);
    expect(uji.match(/TIDAK ADA YANG BERUBAH/g)).toHaveLength(2);
    const pindai = readFileSync(path.join(AKAR, "hasil/pindai-sesudah.txt"), "utf8");
    const baris = pindai.split("\n").filter((x) => /^[KS]\d\d\t/.test(x));
    expect(baris.length).toBeGreaterThan(40);
    for (const l of baris) expect(l, l).toMatch(/\t0 kali\t0 berkas/);
  });

  const POHON = process.env.POHON_AUDIT_4NOV ?? "D:/aleta-dev/kerja/audit-abt-4nov/C1/asli";
  it.skipIf(!existsSync(path.join(POHON, "derry_briantono")))("pohon laptop: mekanis lalu ejaan = md5_baru; tidak ada 'diatas'/'dipersidangan'/'dibawah' tersisa", () => {
    const pm = potongan(PM);
    const terapkan = (b: Buffer, ps: Potong[]) => {
      for (const p of [...ps].sort((x, y) => y.off - x.off)) {
        expect(b.subarray(p.off, p.off + p.lama.length).equals(p.lama)).toBe(true);
        b = Buffer.concat([b.subarray(0, p.off), p.baru, b.subarray(p.off + p.lama.length)]);
      }
      return b;
    };
    const mk = new Map(mekanis.map((d) => [d[1], d] as [string, string[]]));
    for (const d of daftar) {
      let b = readFileSync(path.join(POHON, d[1]));
      const m = mk.get(d[1]);
      if (m) { b = terapkan(b, pm.filter((x) => x.kode === m[0])); expect(md5(b), d[1]).toBe(m[3]); }
      expect(md5(b), d[1]).toBe(d[2]);
      b = terapkan(b, potong.filter((x) => x.kode === d[0]));
      expect(md5(b), d[1]).toBe(d[3]);
      expect(tampak(b.toString("latin1")), d[1]).not.toMatch(/\b[Dd]i(?:atas|persidangan|bawah)\b|\bUndang Undang\b/);
    }
  });
});
