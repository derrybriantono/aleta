import { bacaItemPdf, type ItemTeks } from "../pdf-bubuh-ttd";
import type { LetakJangkar } from "./geometri";

/**
 * LINTASAN 1 - mencari letak kata terakhir sebuah paragraf di PDF hasil render (pdfjs, tanpa alat luar: sama di laptop dan di server).
 *
 * Paragraf dikenali dari EKOR teksnya (beberapa kata terakhir) yang dicocokkan berurutan di seluruh teks PDF, sehingga paragraf yang
 * patah ke baris berikutnya ("...sebagai" / "berikut:") tetap ketemu. Bila ekor yang sama muncul lebih dari sekali, urutan kemunculannya
 * di naskah (ordinal) dipakai.
 */
export type Kata = { t: string; norm: string; halaman: number; x1: number; x2: number; yDasar: number; ukuran: number; baris: number };

export const normKata = (s: string): string => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Item pdfjs (asal kiri-bawah) -> kata berurutan baca (halaman, atas ke bawah, kiri ke kanan) dengan koordinat dari kiri-atas. */
export function susunKata(halamanUkuran: Array<{ lebar: number; tinggi: number }>, item: ItemTeks[]): Kata[] {
  const perHalaman = new Map<number, ItemTeks[]>();
  for (const it of item) {
    if (!it.str || !it.str.trim()) continue;
    const a = perHalaman.get(it.halaman) ?? [];
    a.push(it);
    perHalaman.set(it.halaman, a);
  }
  const hasil: Kata[] = [];
  let nomorBaris = 0;
  for (const [hal, daftar] of [...perHalaman.entries()].sort((a, b) => a[0] - b[0])) {
    const tinggi = halamanUkuran[hal - 1]?.tinggi ?? 842;
    // kelompok baris menurut garis dasar (toleransi 2 pt)
    const urut = [...daftar].sort((a, b) => b.y - a.y || a.x - b.x);
    const baris: ItemTeks[][] = [];
    for (const it of urut) {
      const akhir = baris[baris.length - 1];
      if (akhir && Math.abs(akhir[0].y - it.y) <= 2) akhir.push(it);
      else baris.push([it]);
    }
    for (const b of baris) {
      b.sort((a, c) => a.x - c.x);
      nomorBaris += 1;
      // 3 Nov: Word kadang memecah SATU kata menjadi dua potongan berdempetan ("in" + "i" pada "berikut ini :", BAS ALUR 05 [2]) - potongan
      // yang menempel (tanpa spasi, jarak <= 1,5 pt) disambung ke kata sebelumnya supaya ekor kalimat tetap ketemu.
      let ujungSebelum: { x: number; spasi: boolean } | null = null;
      for (const it of b) {
        const teks = it.str;
        const lebarPerHuruf = teks.length ? it.lebar / teks.length : 0;
        const re = /\S+/g;
        let m: RegExpExecArray | null;
        const potongan: Array<{ t: string; dari: number; sampai: number }> = [];
        while ((m = re.exec(teks))) potongan.push({ t: m[0], dari: m.index, sampai: m.index + m[0].length });
        potongan.forEach((p, ke) => {
          const x1 = it.x + p.dari * lebarPerHuruf;
          // ujung kata: untuk kata terakhir item = ujung item tanpa spasi penutup (lebih pasti daripada pecahan lebar)
          const x2 = p.sampai >= teks.trimEnd().length ? it.x + teks.trimEnd().length * lebarPerHuruf : it.x + p.sampai * lebarPerHuruf;
          const lalu = hasil[hasil.length - 1];
          const menempel = ke === 0 && p.dari === 0 && ujungSebelum && !ujungSebelum.spasi && lalu && lalu.baris === nomorBaris && x1 - ujungSebelum.x <= 1.5;
          if (menempel && lalu) {
            lalu.t += p.t;
            lalu.norm = normKata(lalu.t);
            lalu.x2 = x2;
          } else hasil.push({ t: p.t, norm: normKata(p.t), halaman: hal, x1, x2, yDasar: tinggi - it.y, ukuran: it.tinggi, baris: nomorBaris });
        });
        ujungSebelum = { x: it.x + teks.trimEnd().length * lebarPerHuruf, spasi: /\s$/.test(teks) };
      }
    }
  }
  return hasil;
}

/** Ekor paragraf: kata-kata terakhir yang bermakna (sudah dinormalkan), paling banyak `k`. */
export function ekorParagraf(teks: string, k = 4): string[] {
  const kata = teks
    .split(/\s+/)
    .map(normKata)
    .filter(Boolean);
  return kata.slice(-k);
}

/** Indeks kata terakhir dari kemunculan ke-`ordinal` (mulai 0) urutan `ekor` di antara `kata`; -1 bila tidak ada. */
export function cariEkor(kata: Kata[], ekor: string[], ordinal = 0): { indeks: number; pasti: boolean } {
  if (!ekor.length) return { indeks: -1, pasti: false };
  const hit: number[] = [];
  for (let i = 0; i + ekor.length <= kata.length; i += 1) {
    let cocok = true;
    for (let j = 0; j < ekor.length; j += 1) {
      if (kata[i + j].norm !== ekor[j]) {
        cocok = false;
        break;
      }
    }
    if (cocok) hit.push(i + ekor.length - 1);
  }
  if (!hit.length) return { indeks: -1, pasti: false };
  if (ordinal < hit.length) return { indeks: hit[ordinal], pasti: true };
  return { indeks: hit[hit.length - 1], pasti: false };
}

export type HasilBacaPdf = { halaman: Array<{ lebar: number; tinggi: number }>; kata: Kata[]; jumlahHalaman: number };

export async function bacaKataPdf(pdf: Uint8Array): Promise<HasilBacaPdf> {
  const { halaman, item } = await bacaItemPdf(pdf);
  return { halaman, kata: susunKata(halaman, item), jumlahHalaman: halaman.length };
}

/** Letak jangkar dari pembacaan PDF: kata terakhir ekor + halaman + garis dasar. */
export function letakDariKata(baca: HasilBacaPdf, indeks: number): LetakJangkar | null {
  const k = baca.kata[indeks];
  if (!k) return null;
  const h = baca.halaman[k.halaman - 1];
  const sebaris = baca.kata.filter((x) => x.baris === k.baris);
  return {
    halaman: k.halaman,
    lebarHalaman: h?.lebar ?? 595,
    tinggiHalaman: h?.tinggi ?? 842,
    xAkhir: k.x2,
    yDasar: k.yDasar,
    ukuranHuruf: k.ukuran,
    teksBaris: sebaris.map((x) => x.t).join(" "),
  };
}

/**
 * Halaman fisik tempat kemunculan ke-`ordinal` ekor `ekor` berada (untuk menghitung nomor halaman TAMPIL dari awal bagian); 0 bila tidak ada.
 */
export function halamanEkor(baca: HasilBacaPdf, ekor: string[], ordinal = 0): number {
  const r = cariEkor(baca.kata, ekor, ordinal);
  return r.indeks >= 0 ? baca.kata[r.indeks].halaman : 0;
}
