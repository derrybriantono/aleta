// @vitest-environment node
/**
 * 1 NOV 2026 - paket ABT abt-bas-lanjutan-1nov (keputusan 82): kalimat "Sidang ini merupakan lanjutan dari sidang tanggal ...; pada sidang
 * tersebut ... " (variabel 8562) dibuang dari BAS sidang lanjutan; tinggal "Susunan majelis yang bersidang sama dengan sidang yang lalu;"
 * dengan format paragraf biasa (bukan inden gantung).
 * Yang dijaga dari isi paket SUNGGUHAN (penulisan ke blangko ABT, jadi ketat):
 *   - MD5SUMS cocok; tiap berkas punya md5 lama dan baru berbeda; satu berkas = satu potongan teks + paling banyak satu potongan format;
 *   - potongan teks HANYA membuang " #8562#" (variabel 8562 sendiri TIDAK diubah: paket tanpa variabel/menu/data);
 *   - potongan format HANYA mengganti inden paragraf itu (inden gantung/tanpa inden -> inden baris pertama positif, kiri 0), tidak ada kata nama aplikasi;
 *   - perilaku: potongan diterapkan ke paragraf contoh bentuk blangko sungguhan -> teks paragraf tinggal "#5404#" (atau "#5404# #8563#");
 *   - urutan 28 paket: bas-lanjutan-1nov paling akhir, rantai.sh = URUTAN-PASANG-1nov.md.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const DIR = path.join(AKAR, "abt-paket/bas-lanjutan-1nov/paket-satker");
const baca = (b: string) => readFileSync(path.join(DIR, b), "utf8");
const dekode = (b: string) => Buffer.from(b, "base64").toString("latin1");
const DAFTAR = baca("daftar-tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const TAMBAL = baca("tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const per = new Map<string, { off: number; lama: string; baru: string }[]>();
for (const [kode, off, lama, baru] of TAMBAL) {
  const a = per.get(kode) ?? [];
  a.push({ off: Number(off), lama: dekode(lama), baru: dekode(baru) });
  per.set(kode, a);
}
const TEKS_PENANDA = { lama: " #8562#", baru: "" };

/** Teks paragraf: buang kontrol RTF, kurung, dan spasi berlebih. */
function teksParagraf(rtf: string): string {
  return rtf.replace(/\\[a-z]+-?\d* ?/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

describe("isi paket sungguhan", () => {
  it("MD5SUMS cocok; berkas ber-md5 lama != baru; kode unik; tanpa terhapus", () => {
    for (const baris of baca("MD5SUMS.txt").trim().split(/\r?\n/)) {
      const [md5, nama] = baris.split(/\s+\*?/);
      expect(createHash("md5").update(readFileSync(path.join(DIR, nama))).digest("hex"), nama).toBe(md5);
    }
    expect(DAFTAR.length).toBe(676);
    expect(new Set(DAFTAR.map((d) => d[0])).size).toBe(DAFTAR.length);
    for (const d of DAFTAR) {
      expect(d[1]).toMatch(/^derry_briantono\/.+\.rtf$/);
      expect(d[1]).not.toMatch(/terhapus/);
      expect(d[2]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[3]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[2]).not.toBe(d[3]);
    }
    for (const sh of ["pasang-satker.sh", "pulih-satker.sh"]) expect(baca(sh)).not.toMatch(/\r\n/);
  });

  it("tiap berkas: tepat satu potongan teks (buang ' #8562#') + paling banyak satu potongan format paragraf; tanpa nama aplikasi", () => {
    expect(TAMBAL.length).toBe(DAFTAR.reduce((n, d) => n + Number(d[4]), 0));
    let format = 0;
    for (const d of DAFTAR) {
      const p = per.get(d[0])!;
      expect(p.length, d[1]).toBe(Number(d[4]));
      const teks = p.filter((x) => x.lama === TEKS_PENANDA.lama);
      expect(teks.length, d[1]).toBe(1);
      expect(teks[0].baru).toBe(TEKS_PENANDA.baru);
      const fmt = p.filter((x) => x.lama !== TEKS_PENANDA.lama);
      expect(fmt.length, d[1]).toBeLessThanOrEqual(1);
      for (const f of fmt) {
        format += 1;
        // yang diganti hanya pengaturan paragraf (dari \pard sampai sebelum run pertama): tanpa teks, tanpa kurung
        expect(f.lama.startsWith("\\pard"), d[1]).toBe(true);
        expect(f.lama).not.toMatch(/[{}#]/);
        expect(f.baru).not.toMatch(/[{}#]/);
        expect(f.baru).not.toMatch(/\\fi-\d/);
        expect(f.baru).toMatch(/\\fi[1-9]\d* \\li0/);
        expect(f.baru).toMatch(/\\lin0(?![0-9])/);
        // inden gantung (\fi-N \liN \linN) atau tanpa \fi diganti; yang lain tidak berubah
        const tanpaInden = (s: string) => s.replace(/\\fi-?\d+ ?/g, "").replace(/\\lin?\d+ ?/g, "");
        expect(tanpaInden(f.baru), d[1]).toBe(tanpaInden(f.lama));
      }
      for (const x of p) expect(x.lama + x.baru).not.toMatch(/aleta/i);
    }
    // 189 berkas inden gantung + 421 tanpa inden diberi format; 66 sudah biasa (hanya teks)
    expect(format).toBe(610);
  });

  it("perilaku: potongan sungguhan diterapkan ke paragraf bentuk blangko -> paragraf tinggal #5404# (tanpa kalimat sidang sebelumnya), inden biasa", () => {
    const format = TAMBAL.map(([, , l, b]) => ({ lama: dekode(l), baru: dekode(b) })).filter((x) => x.lama !== TEKS_PENANDA.lama);
    const gantung = format.find((x) => /\\fi-2127/.test(x.lama))!;
    const polos = format.find((x) => !/\\fi/.test(x.lama))!;
    expect(gantung).toBeTruthy();
    expect(polos).toBeTruthy();
    for (const [f, isi, sisa] of [[gantung, "#5404# #8562#", "#5404#"], [polos, "#5404# #8562# #8563#", "#5404# #8563#"]] as const) {
      const rtf = `{\\par }${f.lama}{\\fs24 \\loch \\f4 ${isi}}{\\fs24 \\par }\\pard \\plain \\qj \\fi567 \\li0 \\lin0 {\\fs24 Setelah sidang dibuka}{\\par }`;
      const jadi = rtf.replace(f.lama, f.baru).replace(TEKS_PENANDA.lama, TEKS_PENANDA.baru);
      const para = jadi.slice(jadi.indexOf("\\pard"), jadi.indexOf("{\\fs24 \\par }"));
      expect(teksParagraf(para)).toBe(sisa);
      expect(para).not.toMatch(/8562/);
      expect(para).not.toMatch(/\\fi-/);
      expect(para).toMatch(/\\fi\d+ \\li0/);
    }
  });
});

describe("urutan pasang 28 paket", () => {
  const urut = readFileSync(path.join(AKAR, "abt-paket/URUTAN-PASANG-1nov.md"), "utf8");
  const rantai = readFileSync(path.join(AKAR, "abt-paket/uji-rantai-31okt/rantai.sh"), "utf8");
  const daftarRantai = /^URUT="([^"]+)"/m.exec(rantai)![1].split(/\s+/);
  const daftarUrut = [...urut.matchAll(/^### (\d+)\. `([a-z0-9-]+)`/gm)].map((m) => [Number(m[1]), m[2]] as const);

  it("rantai.sh dan URUTAN-PASANG-1nov.md memuat paket yang sama dalam urutan yang sama; nomor 1..28; bas-lanjutan paling akhir sesudah bas-halaman", () => {
    expect(daftarUrut.map((x) => x[1])).toEqual(daftarRantai);
    expect(daftarUrut.map((x) => x[0])).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(daftarRantai[26]).toBe("bas-halaman-1nov");
    expect(daftarRantai[27]).toBe("bas-lanjutan-1nov");
    for (const p of daftarRantai) expect(existsSync(path.join(AKAR, "abt-paket", p, "paket-satker/pasang-satker.sh")), p).toBe(true);
  });
});
