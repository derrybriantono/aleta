// @vitest-environment node
/**
 * 2 NOV 2026 - paket ABT ke-32 abt-kaidah-fikih-2nov (keputusan 104, 110, 120):
 *   A. kaidah fikih / dalil syar'i yang lazim ditambahkan ke blangko putusan/penetapan akhir Derry yang belum memuatnya (paragraf baru);
 *   B. Izin Poligami [01b]: syarat adil = Pasal 58 ayat (1) huruf b KHI jo. Pasal 5 ayat (1) huruf c UU 1/1974.
 * Yang dijaga dari isi paket SUNGGUHAN (penulisan ke blangko ABT):
 *   - MD5SUMS cocok; md5 lama != baru; kode/berkas unik; hanya derry_briantono, tanpa terhapus/BAS; skrip tanpa CRLF; tanpa nama aplikasi;
 *   - perilaku potongan: tiap sisipan ASCII murni, kurung RTF seimbang, teks polosnya = paragraf kaidah di hasil/kaidah.tsv (tanpa karangan lain);
 *   - tidak ada teks lama yang dibuang selain " dan huruf c" pada Izin Poligami [01b] (Pasal 119 ayat (2) KHI tidak mungkin terhapus);
 *   - urutan: rantai.sh dan URUTAN-PASANG-1nov.md memuat kaidah-fikih-2nov sebagai ke-32 (sebelum bas-halaman-semua-2nov ke-33).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const PAKET = path.join(AKAR, "abt-paket/kaidah-fikih-2nov");
const DIR = path.join(PAKET, "paket-satker");
const baca = (b: string) => readFileSync(path.join(DIR, b), "utf8");
const dekode = (b: string) => Buffer.from(b, "base64").toString("latin1");
const baris = (t: string) => t.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const DAFTAR = baris(baca("daftar-tambal.tsv"));
const TAMBAL = baris(baca("tambal.tsv"));
const KAIDAH = baris(readFileSync(path.join(PAKET, "hasil/kaidah.tsv"), "utf8"));
const RINCI = new Map(baris(readFileSync(path.join(PAKET, "hasil/rincian.tsv"), "utf8")).map((r) => [r[0], r[1]]));

/** Teks polos dari potongan RTF sisipan: \uN -> huruf, \tab -> spasi, kode kendali dibuang. */
function polos(rtf: string): string {
  return rtf
    .replace(/\\uc1 /g, "")
    .replace(/\\u(-?\d+) \?/g, (_m, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)))
    .replace(/\\tab /g, " ")
    .replace(/\\par /g, "\n")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}
function seimbang(s: string): boolean {
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "{") d++;
    else if (c === "}" && --d < 0) return false;
  }
  return d === 0;
}

describe("isi paket sungguhan kaidah-fikih-2nov", () => {
  it("MD5SUMS cocok; daftar unik; hanya blangko Derry non-BAS; skrip tanpa CRLF; tanpa nama aplikasi", () => {
    for (const b of baca("MD5SUMS.txt").trim().split(/\r?\n/)) {
      const [md5, nama] = b.split(/\s+\*?/);
      expect(createHash("md5").update(readFileSync(path.join(DIR, nama))).digest("hex"), nama).toBe(md5);
    }
    expect(DAFTAR.length).toBeGreaterThan(50);
    expect(new Set(DAFTAR.map((d) => d[0])).size).toBe(DAFTAR.length);
    expect(new Set(DAFTAR.map((d) => d[1])).size).toBe(DAFTAR.length);
    for (const [, rel, m0, m1] of DAFTAR) {
      expect(rel.startsWith("derry_briantono/")).toBe(true);
      expect(rel).not.toMatch(/\/terhapus\/| - BAS\/|\/BAS |ALUR /);
      expect(m0).not.toBe(m1);
    }
    for (const f of ["pasang-satker.sh", "pulih-satker.sh"]) expect(baca(f)).not.toContain("\r\n");
    for (const [, , lama, baru] of TAMBAL) expect((dekode(lama) + dekode(baru)).toLowerCase()).not.toContain("aleta");
  });

  it("sisipan ASCII, seimbang, dan teks polosnya persis paragraf kaidah yang terdaftar", () => {
    const paragraf = new Map<string, string[]>();
    for (const [kode, , , teks] of KAIDAH) {
      paragraf.set(kode, teks.split(" || ").map((p) => p.replace(/^\[[a-z]+\] /, "")));
    }
    let sisipan = 0;
    for (const [kode, , lama, baru] of TAMBAL) {
      const a = dekode(lama);
      const z = dekode(baru);
      if (a !== "" || (RINCI.get(kode) ?? "").startsWith("-")) continue; // potongan Izin Poligami [01b] (diuji di bawah)
      sisipan++;
      expect(/^[\x20-\x7e\r\n]*$/.test(z), kode).toBe(true);
      expect(seimbang(z), kode).toBe(true);
      const kd = (RINCI.get(kode) ?? "").replace("+120", "");
      const harap = paragraf.get(kd);
      expect(harap, kode + " " + kd).toBeDefined();
      const isi = polos(z).replace(/#8555#/g, "#8554#").replace(/#7036#/g, "#0046#");
      for (const p of harap!) {
        const t = p.replace(/\{M\}/g, "#8554#").replace(/\{P\}/g, "#0046#").replace(/[ \t]+/g, " ").trim();
        expect(isi, kode).toContain(t);
      }
    }
    expect(sisipan).toBe(DAFTAR.length - 1);
  });

  it("satu-satunya teks yang dibuang: ' dan huruf c' di Izin Poligami [01b]; syarat adil kini Pasal 58 (1) b KHI jo. Pasal 5 (1) c UU 1/1974", () => {
    const buang = TAMBAL.filter((t) => dekode(t[2]) !== "");
    expect(buang.length).toBe(1);
    expect(dekode(buang[0][2])).toBe(" dan huruf c");
    const kode = buang[0][0];
    const rel = DAFTAR.find((d) => d[0] === kode)![1];
    expect(rel).toContain("5 Izin Poligami/[01b] [Kabul] Izin Poligami - Termohon Keberatan (Pasal 59 KHI).rtf");
    const lain = TAMBAL.filter((t) => t[0] === kode && dekode(t[2]) === "").map((t) => dekode(t[3]));
    expect(lain).toEqual([" Kompilasi Hukum Islam jo. Pasal 5 ayat (1) huruf c Undang-Undang Nomor 1 Tahun 1974"]);
  });

  it("urutan: kaidah-fikih-2nov ke-32 (sesudah identitas-pihak-1nov, sebelum bas-halaman-semua-2nov) di rantai.sh dan URUTAN-PASANG-1nov.md", () => {
    const rantai = readFileSync(path.join(AKAR, "abt-paket/uji-rantai-31okt/rantai.sh"), "utf8");
    const urut = rantai.match(/URUT="([^"]+)"/)![1].trim().split(/\s+/);
    const i = urut.indexOf("kaidah-fikih-2nov");
    expect(i).toBe(31);
    expect(urut[i - 1]).toBe("identitas-pihak-1nov");
    expect(urut[i + 1]).toBe("bas-halaman-semua-2nov");
    const md = readFileSync(path.join(AKAR, "abt-paket/URUTAN-PASANG-1nov.md"), "utf8");
    expect(md).toMatch(/### 32\. `kaidah-fikih-2nov`/);
  });
});
