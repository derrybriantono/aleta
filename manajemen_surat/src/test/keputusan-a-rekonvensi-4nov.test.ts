// @vitest-environment node
/**
 * Paket ABT abt-keputusan-a-rekonvensi-4nov (keputusan Derry 182 butir A2, 4 Nov 2026): "1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F
 * (Mutah iddah nafkah anak)" disusun ulang menjadi kerangka: fakta contoh -> variabel isian, nominal contoh -> isian kosong, catatan kerja dan
 * butir khusus-contoh dibuang. Penjaga: satu berkas, md5 dasar, 42 ubahan teks + 13 paragraf dibuang, tidak ada lagi fakta contoh pada hasil,
 * variabel yang dirujuk lengkap (147), kurung seimbang, MD5SUMS, uji laptop; bila pohon laptop ada: rantai paket = md5_baru.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(REPO, "abt-paket/keputusan-a-rekonvensi-4nov");
const P = path.join(AKAR, "paket-satker");
const baca = (n: string) => readFileSync(path.join(P, n));
const tsv = (p: string) => readFileSync(p, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const KODE = /\\[a-zA-Z]+-?\d* ?|[{}]|\r|\n/g;
const tampak = (s: string) => s.replace(KODE, "");
const seimbang = (b: Buffer) => {
  let d = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 0x5c) { i++; continue; }
    if (b[i] === 0x7b) d++;
    else if (b[i] === 0x7d && --d < 0) return false;
  }
  return d === 0;
};
type Potong = { kode: string; off: number; lama: Buffer; baru: Buffer };
const potongan = (dir: string): Potong[] => tsv(path.join(dir, "tambal.tsv")).map(([k, off, lama, baru]) => ({
  kode: k, off: Number(off), lama: Buffer.from(lama, "base64"), baru: Buffer.from(baru, "base64"),
}));
const REL = "derry_briantono/1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf";
const daftar = tsv(path.join(P, "daftar-tambal.tsv"));
const potong = potongan(P);
const PM = path.join(REPO, "abt-paket/keputusan-a-mekanis-4nov/paket-satker");
const PE = path.join(REPO, "abt-paket/audit-ejaan-4nov/paket-satker");
const PA = path.join(REPO, "abt-paket/audit-mekanis-4nov/paket-satker");

describe("paket keputusan-a-rekonvensi-4nov", () => {
  it("satu berkas, 55 potongan: 42 ubahan teks + 13 paragraf dibuang; kurung seimbang; tanpa nama aplikasi", () => {
    expect(daftar).toHaveLength(1);
    expect(daftar[0][0]).toBe("R0001");
    expect(daftar[0][1]).toBe(REL);
    expect(Number(daftar[0][4])).toBe(55);
    expect(potong).toHaveLength(55);
    expect(potong.filter((p) => p.baru.length === 0)).toHaveLength(13);
    for (const p of potong) {
      expect(p.baru.toString("latin1")).not.toMatch(/aleta/i);
      if (p.baru.length === 0) {
        expect(seimbang(p.lama)).toBe(true);
        expect(p.lama.toString("latin1").startsWith("\\pard \\plain")).toBe(true);
      }
    }
  });

  it("fakta/nominal contoh hilang dari bagian LAMA yang diubah, dan variabel/isian kosong masuk", () => {
    const lama = potong.map((p) => tampak(p.lama.toString("latin1"))).join("\n");
    const baru = potong.map((p) => tampak(p.baru.toString("latin1"))).join("\n");
    for (const s of ["salon", "Rp56.000.000", "Rp. 200.000", "Rp. 400.000", "Rp. 800.000", "IV/a", "emas 10 gram", "APABILA SAKSI SAMA DENGAN SAKSI KONVENSI", "UNTUK PNS", "menjemput", "durhaka", "satu tahun"]) {
      expect(lama, s).toContain(s);
      expect(baru, s).not.toContain(s);
    }
    for (const s of ["#9268# setiap bulan atau #9269# setiap harinya", "#11405#", "#1001#", "#5110#", "#2004#", "#7035#", "#5127#", "#9944#", "#0100# #5171#", "#0104# #5271#", "Rp_ (_ rupiah)", "pegawai negeri sipil dengan pangkat golongan ruang _"]) {
      expect(baru, s).toContain(s);
    }
    // pekerjaan: Tergugat rekonvensi = #0046# (#0100#/#5171#), Penggugat rekonvensi = #0047# (#0104#/#5271#); pasangan lama yang terbalik tidak tersisa
    expect(baru).not.toContain("Tergugat saat ini bekerja sebagai #0104#");
    expect(baru).not.toContain("Penggugat saat ini bekerja sebagai #0100#");
  });

  it("md5 dasar = keadaan sesudah keputusan-a-mekanis-4nov (berkas tidak disentuh paket kerangka)", () => {
    const sesudah = (dir: string) => new Map(tsv(path.join(dir, "daftar-tambal.tsv")).map((b) => [b[1], b[3]] as [string, string]));
    const harap = sesudah(PM).get(REL) ?? sesudah(PE).get(REL) ?? sesudah(PA).get(REL);
    expect(harap, "berkas harus tercakup salah satu paket sebelumnya").toBeTruthy();
    expect(daftar[0][2]).toBe(harap);
    const kerangka = tsv(path.join(REPO, "abt-paket/keputusan-a-kerangka-4nov/paket-satker/daftar-tambal.tsv")).map((d) => d[1]);
    expect(kerangka).not.toContain(REL);
  });

  it("PRASYARAT: 147 variabel yang dirujuk (termasuk 9268/9269/11405); MD5SUMS; tambal_rtf.py sama; uji laptop lengkap", () => {
    const nomor = baca("nomor-dirujuk.txt").toString("utf8").split("\n").filter(Boolean);
    expect(nomor).toHaveLength(147);
    for (const n of ["9268", "9269", "11405", "1001", "5110", "2004", "7035", "5127", "9944", "0100", "5171", "0104", "5271"]) expect(nomor, n).toContain(n);
    expect(baca("harap.txt").toString("utf8").trim()).toBe("147");
    const sql = baca("abt-keputusan-a-rekonvensi-4nov-PRASYARAT.sql").toString("utf8");
    expect(sql).toMatch(/SELECT COUNT\(\*\) AS prasyarat FROM abt_variabel WHERE no_var IN \(/);
    expect(sql).toContain("9268");
    for (const l of baca("MD5SUMS.txt").toString("utf8").split("\n").filter(Boolean)) {
      const h = l.split(/\s+/)[0];
      const rel = l.slice(h.length).replace(/^\s+\*?/, "");
      expect(md5(readFileSync(path.join(P, rel))), rel).toBe(h);
    }
    expect(md5(baca("tambal_rtf.py"))).toBe(md5(readFileSync(path.join(PM, "tambal_rtf.py"))));
    const sh = baca("pasang-satker.sh").toString("utf8");
    expect(sh).toContain("N=abt-keputusan-a-rekonvensi-4nov");
    expect(sh.indexOf("tambal_rtf.py cek")).toBeLessThan(sh.indexOf("tambal_rtf.py pasang"));
    expect(sh.indexOf("PRASYARAT.sql")).toBeLessThan(sh.indexOf("tambal_rtf.py cek"));
    const uji = readFileSync(path.join(AKAR, "hasil/uji-lokal.txt"), "utf8");
    for (const s of ["PRASYARAT COCOK (147)", "TAMBAL=1", "SUDAH=1", "SIDIK TETAP", "PULIH=1", "PULIH COCOK", "SIDIK = AWAL", "SAMA DENGAN PASANG PERTAMA", "prasyarat '145'", "BIARKAN\t"]) expect(uji, s).toContain(s);
    expect(uji.match(/TIDAK ADA YANG BERUBAH/g)).toHaveLength(3);
  });

  const POHON = process.env.POHON_AUDIT_4NOV ?? "D:/aleta-dev/kerja/audit-abt-4nov/pohon";
  it.skipIf(!existsSync(path.join(POHON, "derry_briantono")))("pohon laptop: audit-mekanis -> audit-ejaan -> keputusan-a-mekanis -> paket ini = md5_baru; hasil utuh", () => {
    const terapkan = (b: Buffer, ps: Potong[]) => {
      for (const p of [...ps].sort((x, y) => y.off - x.off)) {
        expect(b.subarray(p.off, p.off + p.lama.length).equals(p.lama)).toBe(true);
        b = Buffer.concat([b.subarray(0, p.off), p.baru, b.subarray(p.off + p.lama.length)]);
      }
      return b;
    };
    let b: Buffer = readFileSync(path.join(POHON, REL));
    for (const dir of [PA, PE, PM]) {
      const d = tsv(path.join(dir, "daftar-tambal.tsv")).find((x) => x[1] === REL);
      if (d) { b = terapkan(b, potongan(dir).filter((x) => x.kode === d[0])); expect(md5(b)).toBe(d[3]); }
    }
    expect(md5(b)).toBe(daftar[0][2]);
    b = terapkan(b, potong);
    expect(md5(b)).toBe(daftar[0][3]);
    expect(seimbang(b)).toBe(true);
    const t = tampak(b.toString("latin1"));
    for (const s of ["salon", "Rp56.000.000", "IV/a", "emas 10 gram", "APABILA SAKSI SAMA DENGAN SAKSI KONVENSI", "UNTUK PNS", "durhaka"]) expect(t, s).not.toContain(s);
    expect(b.toString("latin1")).not.toMatch(/aleta/i);
  });
});
