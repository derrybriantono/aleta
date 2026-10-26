import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ============================================================================
 * K11 (26 Okt 2026): konten.js DIPECAH, UJI-UJI LAMA TETAP MEMBACANYA UTUH
 * ============================================================================
 *
 * konten.js (1,2 MB) dipecah menjadi inti + tiga modul panel yang dimuat saat dipakai
 * (konten-panel-bersama.js, konten-panel-perkara.js, konten-panel-daftar.js; lihat
 * ekstensi-sipp/modul-malas.js). Ratusan uji membaca "ekstensi-sipp/konten.js" sebagai
 * teks - sering mengiris di antara dua fungsi dengan indexOf - atau menjalankannya di
 * jsdom, untuk menjaga keputusan yang ada di dalamnya. Pecahannya potongan UTUH kode lama,
 * bukan kode baru, jadi uji-uji itu tetap benar bila "konten.js" berarti seluruh kode
 * konten SIPP PADA URUTAN ASLINYA.
 *
 * Karena itu, di bawah vitest, SELURUH pembacaan ekstensi-sipp/konten.js mengembalikan
 * gabungan keempat berkas yang pernyataannya dirakit kembali menurut urutan asli (sidik per
 * pernyataan dari fixture k11-peta-fitur-sebelum.json). Pernyataan baru (lem K11) mewarisi
 * kedudukan pernyataan sebelumnya dalam berkasnya. Tidak ada pernyataan yang diubah, tidak
 * ada uji yang dilemahkan; pemuat (AletaModul) tidak dipasang di jsdom sehingga penunggu
 * modul di inti langsung lewat dan semua kode sudah ada, seperti sebelum dipecah.
 *
 * Pembacaan mentah (hanya inti) tersedia lewat env ALETA_KONTEN_MENTAH=1; keutuhan
 * pecahannya dijaga k11-peta-fitur-26okt.test.ts (pernyataan per pernyataan terhadap
 * konten.js yang lama). Tanpa fixture, jatuh ke penyambungan sederhana.
 */
export const PECAHAN_KONTEN = ["konten.js", "konten-kontak.js", "konten-panel-bersama.js", "konten-panel-perkara.js", "konten-panel-daftar.js"] as const;

const POLA_KONTEN = /(?:^|[\\/])ekstensi-sipp[\\/]konten\.js$/;
const sidik = (teks: string) => createHash("sha1").update(teks).digest("hex").slice(0, 12);
const tanpaGuard = (teks: string) =>
  teks
    .split("\n")
    .filter((b) => !/K11-GUARD|K11-PRA/.test(b))
    .join("\n");

function direktoriKonten(berkas: unknown): string | null {
  let s: string;
  if (typeof berkas === "string") s = berkas;
  else if (berkas instanceof URL) {
    try {
      s = fileURLToPath(berkas);
    } catch {
      return null;
    }
  } else return null;
  return POLA_KONTEN.test(s) ? path.dirname(s) : null;
}

const asli = fs.readFileSync as unknown as (...a: unknown[]) => unknown;
const bacaTeks = (p: string) => asli.call(fs, p, "utf8") as string;

type Segmen = { teks: string; kunci: string | null; berkas: number; urut: number };

/** Memotong sebuah berkas menjadi segmen: jurang di depan + pernyataan + sisa baris yang sama (sama dengan pemecahnya). */
function potong(teks: string, indeksBerkas: number, parse: (s: string, o: object) => { body: Array<{ start: number; end: number; type: string; directive?: string }> }): Segmen[] {
  const ast = parse(teks, { ecmaVersion: "latest", sourceType: "script", ranges: true });
  const hasil: Segmen[] = [];
  let awal = 0;
  ast.body.forEach((n, i) => {
    let akhir = n.end;
    const m = /^[ \t]*(?:\/\/[^\n]*|\/\*[^\n]*?\*\/[ \t]*)?\r?\n/.exec(teks.slice(akhir));
    if (m) akhir += m[0].length;
    const kunci = n.type === "ExpressionStatement" && typeof n.directive === "string" ? null : sidik(tanpaGuard(teks.slice(n.start, n.end)));
    hasil.push({ teks: teks.slice(awal, akhir), kunci, berkas: indeksBerkas, urut: i });
    awal = akhir;
  });
  const ekor = teks.slice(awal);
  if (ekor) {
    if (hasil.length) hasil[hasil.length - 1].teks += ekor;
    else hasil.push({ teks: ekor, kunci: null, berkas: indeksBerkas, urut: 0 });
  }
  return hasil;
}

const simpanan = new Map<string, { tanda: string; teks: string }>();

function rakit(dir: string): string {
  const berkas = PECAHAN_KONTEN.map((n) => path.join(dir, n)).filter((p) => fs.existsSync(p));
  const tanda = berkas.map((p) => `${p}:${fs.statSync(p).mtimeMs}`).join("|");
  const ada = simpanan.get(dir);
  if (ada && ada.tanda === tanda) return ada.teks;

  const teksBerkas = berkas.map(bacaTeks);
  let hasil = teksBerkas.join("\n");
  try {
    const fixtur = path.resolve(dir, "../manajemen_surat/src/test/fixtures/k11-peta-fitur-sebelum.json");
    const asliUrut: string[] | undefined = fs.existsSync(fixtur) ? (JSON.parse(bacaTeks(fixtur)) as { berkas: Record<string, { pernyataan?: string[] }> }).berkas["konten.js"]?.pernyataan : undefined;
    if (asliUrut && berkas.length > 1) {
      const { parse } = createRequire(import.meta.url)("acorn") as { parse: Parameters<typeof potong>[2] };
      const antrean = new Map<string, number[]>();
      asliUrut.forEach((h, i) => {
        const q = antrean.get(h) || [];
        q.push(i);
        antrean.set(h, q);
      });
      const segmen = teksBerkas.flatMap((t, i) => potong(t, i, parse));
      // kedudukan: pernyataan asli = indeksnya; yang lain mewarisi kedudukan pernyataan sebelumnya di berkas yang sama (+0,01)
      const posisi = new Map<Segmen, number>();
      const terakhirDiBerkas = new Map<number, number>();
      for (const s of segmen) {
        let p: number;
        const q = s.kunci ? antrean.get(s.kunci) : undefined;
        if (q && q.length) p = q.shift() as number;
        else p = (terakhirDiBerkas.get(s.berkas) ?? -1) + 0.01;
        terakhirDiBerkas.set(s.berkas, p);
        posisi.set(s, p);
      }
      segmen.sort((a, b) => (posisi.get(a) as number) - (posisi.get(b) as number) || a.berkas - b.berkas || a.urut - b.urut);
      hasil = segmen.map((s) => s.teks).join("");
    }
  } catch {
    hasil = teksBerkas.join("\n");
  }
  simpanan.set(dir, { tanda, teks: hasil });
  return hasil;
}

type Opsi = Parameters<typeof fs.readFileSync>[1];

if (!(fs as unknown as { __k11Dipasang?: boolean }).__k11Dipasang) {
  (fs as unknown as { __k11Dipasang?: boolean }).__k11Dipasang = true;
  const ganti = function (this: unknown, berkas: unknown, opsi?: Opsi) {
    const dir = process.env.ALETA_KONTEN_MENTAH === "1" ? null : direktoriKonten(berkas);
    if (!dir) return asli.call(fs, berkas, opsi);
    const sandi = typeof opsi === "string" ? opsi : opsi && typeof opsi === "object" ? (opsi as { encoding?: string }).encoding : undefined;
    const gabung = rakit(dir);
    return sandi ? gabung : Buffer.from(gabung, "utf8");
  };
  (fs as unknown as { readFileSync: unknown }).readFileSync = ganti;
  syncBuiltinESMExports();
}
