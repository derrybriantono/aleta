import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

import type { KolomTabelEvidenSkp } from "@/lib/eviden-skp-tipe";

/**
 * ============================================================================
 * PENGUKUR HURUF EVIDEN SKP - SATU UKURAN UNTUK TIGA FORMAT (2.40.0)
 * ============================================================================
 *
 * Lebar kolom, pemenggalan baris, dan tinggi baris Excel dihitung dengan
 * ukuran huruf Helvetica dari pdf-lib - ukuran yang SAMA dengan yang dipakai
 * PDF-nya. Arial (Word dan Excel) dirancang berukuran sama dengan Helvetica,
 * jadi lebar kolom yang cukup di PDF juga cukup di Word, dan tinggi baris
 * Excel yang dihitung di sini tidak memotong teks yang dilipat.
 *
 * ============================================================================
 * HURUF YANG TIDAK DAPAT DICETAK: DIGANTI BILA ADA PADANANNYA, DITANDAI BILA
 * TIDAK - DAN JUMLAHNYA DILAPORKAN
 * ============================================================================
 *
 * Huruf baku PDF hanya memuat sandi WinAnsi. Tanda kutip melengkung (Ma’ruf)
 * termasuk di dalamnya; "≤" pada dasar hitung ("putus ≤ 150 hari") tidak.
 * Yang punya padanan tanpa mengubah arti diganti ("<="). Sisanya diganti
 * penanda "[?]" - bukan dibuang diam-diam - dan jumlahnya ditulis di catatan
 * PDF itu sendiri, supaya yang menandatanganinya tahu ada huruf yang hanya
 * utuh di versi Word/Excel. Pola yang sama dengan lib/cetak-pdf.ts.
 */

export type HurufUkur = { biasa: PDFFont; tebal: PDFFont };

let siap: Promise<HurufUkur> | null = null;

/** Helvetica biasa dan tebal - disiapkan sekali, dipakai ulang. */
export function hurufUkur(): Promise<HurufUkur> {
  if (!siap) {
    siap = (async () => {
      const dok = await PDFDocument.create();
      return {
        biasa: await dok.embedFont(StandardFonts.Helvetica),
        tebal: await dok.embedFont(StandardFonts.HelveticaBold),
      };
    })().catch((galat) => {
      siap = null;
      throw galat;
    });
  }
  return siap;
}

/** Padanan huruf di luar WinAnsi yang tidak mengubah arti. */
const PADANAN: Record<string, string> = {
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~",
  "−": "-",
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "∙": "·",
  "✓": "V",
  "✔": "V",
  "☑": "V",
  "✗": "X",
  "✘": "X",
  "☒": "X",
  "\u2009": " ",
  "\u200a": " ",
  "\u202f": " ",
  "\u2007": " ",
  "\u2002": " ",
  "\u2003": " ",
};

/** Huruf lebar tak terlihat yang aman dibuang. */
const DIBUANG = new Set(["\u200b", "\u200c", "\u200d", "\u2060", "\ufeff", "\u00ad"]);

export const PENANDA_TAK_TERCETAK = "[?]";

const cacheCetak = new WeakMap<PDFFont, Map<string, boolean>>();

function dapatDicetak(huruf: PDFFont, karakter: string): boolean {
  let peta = cacheCetak.get(huruf);
  if (!peta) {
    peta = new Map();
    cacheCetak.set(huruf, peta);
  }
  const ada = peta.get(karakter);
  if (ada !== undefined) return ada;
  let hasil = true;
  try {
    huruf.widthOfTextAtSize(karakter, 10);
    huruf.encodeText(karakter);
  } catch {
    hasil = false;
  }
  peta.set(karakter, hasil);
  return hasil;
}

/**
 * Menyiapkan teks satu baris untuk huruf baku PDF: padanan dipasang, huruf
 * beraksen di luar WinAnsi dilepas aksennya (Ş -> S), sisanya ditandai.
 * Pindah baris dan tab menjadi spasi - pemenggalan baris urusan pemanggil.
 */
export function siapkanTeksPdf(huruf: PDFFont, teks: string): { teks: string; hilang: number } {
  let hasil = "";
  let hilang = 0;
  for (const k of String(teks ?? "").normalize("NFC")) {
    if (k === "\n" || k === "\r" || k === "\t") {
      hasil += " ";
      continue;
    }
    if (DIBUANG.has(k)) continue;
    if (dapatDicetak(huruf, k)) {
      hasil += k;
      continue;
    }
    const padanan = PADANAN[k];
    if (padanan !== undefined) {
      hasil += padanan;
      continue;
    }
    const tanpaAksen = k.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (tanpaAksen && tanpaAksen !== k && [...tanpaAksen].every((x) => dapatDicetak(huruf, x))) {
      hasil += tanpaAksen;
      continue;
    }
    hilang += 1;
    hasil += PENANDA_TAK_TERCETAK;
  }
  return { teks: hasil, hilang };
}

const cacheLebar = new WeakMap<PDFFont, Map<string, number>>();

/**
 * Lebar teks yang SUDAH disiapkan - sebagaimana DIGAMBAR, tanpa kerning.
 *
 * widthOfTextAtSize pdf-lib mengurangi pasangan kerning AFM ("Ta", "r.",
 * "y,"), padahal drawText pdf-lib menulis teksnya dengan Tj polos TANPA
 * kerning. Diukur 27 September 2026 dengan pdfjs: "Tanggal" tergambar 3,4%
 * lebih lebar daripada yang dilaporkan widthOfTextAtSize - cukup untuk
 * mendorong kata terakhir melewati garis kolom yang sempit. Karena itu lebar
 * dijumlah per huruf; satu huruf tidak punya pasangan kerning.
 */
export function lebarTeks(huruf: PDFFont, teks: string, ukuran: number): number {
  if (!teks) return 0;
  let peta = cacheLebar.get(huruf);
  if (!peta) {
    peta = new Map();
    cacheLebar.set(huruf, peta);
  }
  let total = 0;
  for (const k of teks) {
    let w = peta.get(k);
    if (w === undefined) {
      w = huruf.widthOfTextAtSize(k, 1000);
      peta.set(k, w);
    }
    total += w;
  }
  return (total * ukuran) / 1000;
}

/** Lebar teks apa pun - disiapkan dulu, jadi tidak pernah melempar. */
export function ukurTeks(huruf: PDFFont, teks: string, ukuran: number): number {
  return lebarTeks(huruf, siapkanTeksPdf(huruf, teks).teks, ukuran);
}

/** Tempat memenggal kata panjang, menurut urutan kesukaan. */
const PEMISAH_KATA = ["/", "-", ".,;:)_"];

/**
 * Memenggal SATU alinea (tanpa pindah baris) menjadi baris selebar `lebar`.
 *
 * Kata yang sendirian pun lebih lebar dari kolomnya - nomor perkara
 * "1234/Pdt.G/2026/PA.Dgl" di kolom sempit - dipotong, sebisa mungkin sesudah
 * "/" "-" atau ".", bukan dibiarkan melewati garis kolom dan menimpa kolom di
 * sebelahnya. Tiap baris hasilnya DIJAMIN tidak lebih lebar dari `lebar`,
 * kecuali satu huruf tunggal yang memang lebih lebar dari kolomnya.
 */
export function pecahBaris(huruf: PDFFont, teks: string, ukuran: number, lebar: number): string[] {
  const w = (s: string) => lebarTeks(huruf, s, ukuran);
  const kata = teks.split(" ").filter((k) => k.length > 0);
  if (kata.length === 0) return [""];

  const hasil: string[] = [];
  let baris = "";
  for (const k of kata) {
    const calon = baris ? `${baris} ${k}` : k;
    if (w(calon) <= lebar) {
      baris = calon;
      continue;
    }
    if (baris) {
      hasil.push(baris);
      baris = "";
    }
    if (w(k) <= lebar) {
      baris = k;
      continue;
    }
    let sisa = k;
    while (sisa && w(sisa) > lebar) {
      let n = 1;
      while (n < sisa.length && w(sisa.slice(0, n + 1)) <= lebar) n += 1;
      // "/" lebih dahulu, lalu "-", lalu tanda baca lain: "1000/Pdt.G/" +
      // "2026/PA.Dgl", bukan "1000/Pdt." + "G/2026/PA.Dgl".
      let potong = n;
      cari: for (const kelompok of PEMISAH_KATA) {
        for (let i = n; i > Math.max(1, Math.floor(n / 2)); i -= 1) {
          if (kelompok.includes(sisa[i - 1])) {
            potong = i;
            break cari;
          }
        }
      }
      hasil.push(sisa.slice(0, potong));
      sisa = sisa.slice(potong);
    }
    baris = sisa;
  }
  if (baris) hasil.push(baris);
  return hasil;
}

/**
 * Memenggal isi satu sel: "\n" memulai baris baru, tiap bagiannya dipenggal
 * menurut lebar. Teks disiapkan untuk huruf baku lebih dulu; jumlah huruf
 * yang tidak tercetak ikut dikembalikan.
 */
export function pecahSel(
  huruf: PDFFont,
  teks: string,
  ukuran: number,
  lebar: number
): { baris: string[]; hilang: number } {
  const baris: string[] = [];
  let hilang = 0;
  const bagian = String(teks ?? "").split(/\r?\n/);
  for (const b of bagian) {
    const siapCetak = siapkanTeksPdf(huruf, b);
    hilang += siapCetak.hilang;
    baris.push(...pecahBaris(huruf, siapCetak.teks.replace(/ {2,}/g, " ").trim(), ukuran, Math.max(1, lebar)));
  }
  return { baris: baris.length > 0 ? baris : [""], hilang };
}

/**
 * Ruang dalam sel kiri (= kanan), dalam titik. Tabel padat (lebih dari 20
 * kolom - kumulasi status perkara 25 kolom) memakai ruang lebih tipis: 25
 * kolom x 1,6 titik dikembalikan ke isi. PDF, Word, dan Excel memakai angka
 * yang sama, sehingga lebar kolom ketiganya tetap satu hitungan.
 */
export function ruangSelTabel(jumlahKolom: number): number {
  return jumlahKolom > 20 ? 1.8 : 2.6;
}

/**
 * ============================================================================
 * LEBAR KOLOM: SERENDAH MUNGKIN TABELNYA, JUDUL KOLOM TIDAK TERPENGGAL
 * ============================================================================
 *
 * Katalog memberi bobot (1 sempit, 4 lebar), tetapi bobot saja tidak tahu
 * isinya. Sampai 27 September 2026 lebar dibagi menurut bobot dengan batas
 * bawah per kata; diukur atas SIPP sungguhan (hakim_id 31, Triwulan II 2026,
 * kumulasi 25 kolom, 325 perkara) cara itu gagal dua kali:
 *
 *   - alamat Direktori Putusan (106 titik tanpa spasi) membuat batas bawahnya
 *     tidak muat, lebar jatuh ke bobot murni, dan judul kolom terpenggal di
 *     tengah kata ("Pendaft|aran", "Musyaw|arah") - 39 halaman F4;
 *   - setelah batas bawahnya dibuat bertingkat, batas bawah menghabiskan
 *     ruang: kolom Majelis Hakim (bobot 3) tercekik 50 titik, tiap sel 12
 *     baris - 81 halaman.
 *
 * Sekarang:
 *
 *   1. BATAS BAWAH KERAS: kata judul kolom DAN setiap kata biasa isinya (tanpa
 *      "/" atau "-": nama orang, "Kewarisan", "(Dikabulkan)"; juga tanggal)
 *      muat utuh. Bila tidak muat seluruhnya, kata judul saja. Nomor perkara
 *      dan alamat Direktori tidak ikut: keduanya wajar dipenggal di garis
 *      miringnya.
 *   2. Sisa ruang dibagikan sedikit demi sedikit ke kolom yang PALING
 *      MENGURANGI TINGGI TABEL per titik lebar: jumlah, atas setiap baris
 *      tabel, dari jumlah baris sel tertingginya - ditambah sedikit nilai untuk
 *      jumlah baris seluruh sel dan untuk kata yang tidak lagi terpenggal di
 *      tengah. Jumlah baris tiap sel dihitung PERSIS seperti pecahBaris.
 *   3. Bila tidak ada lagi kolom yang barisnya berkurang, sisa ruang dibagi
 *      menurut BOBOT katalog, supaya tabel tetap selebar halaman.
 *
 * Hasil atas data yang sama (325 perkara, 25 kolom): judul dan setiap nama
 * utuh, nol kata biasa terpenggal di tengah, 39 halaman F4 - sama banyak
 * dengan cara lama yang memenggal judulnya. Bila kata judul pun tidak muat
 * seluruhnya, lebar dibagi murni menurut bobot dan pecahBaris memotong yang
 * kepanjangan. Masukan yang sama selalu memberi lebar yang sama.
 */
export function hitungLebarKolom(p: {
  kolom: KolomTabelEvidenSkp[];
  baris: Array<Record<string, string>>;
  lebarTersedia: number;
  ukuran: number;
  huruf: HurufUkur;
  /** Ruang dalam sel kiri + kanan. */
  ruang: number;
}): number[] {
  const { kolom, baris, lebarTersedia, ukuran, huruf, ruang } = p;
  const n = kolom.length;
  if (n === 0) return [];
  const bobot = kolom.map((k) => (k.bobot && k.bobot > 0 ? k.bobot : 1));
  const jumlahBobot = bobot.reduce((a, b) => a + b, 0);
  const jatah = bobot.map((b) => (lebarTersedia * b) / jumlahBobot);
  const batasKata = lebarTersedia * 0.3;

  // Tiap kata diukur SEKALI (lebar per huruf baru dihitung bila kata itu
  // pernah lebih lebar dari kolomnya). Indeks baris terakhir adalah baris
  // kepala (huruf tebal).
  type KataUkur = { teks: string; lebar: number; font: PDFFont; pref: Float64Array | null };
  const kamus = new Map<string, KataUkur>();
  const kataUkur = (font: PDFFont, teks: string): KataUkur => {
    const kunci = `${font === huruf.tebal ? 1 : 0}${teks}`;
    let k = kamus.get(kunci);
    if (!k) {
      k = { teks, lebar: lebarTeks(font, teks, ukuran), font, pref: null };
      kamus.set(kunci, k);
    }
    return k;
  };
  const alineaUkur = (font: PDFFont, teks: string): KataUkur[][] =>
    String(teks ?? "")
      .split(/\r?\n/)
      .map((alinea) =>
        siapkanTeksPdf(font, alinea)
          .teks.split(" ")
          .filter(Boolean)
          .map((kata) => kataUkur(font, kata))
      );
  const sel: KataUkur[][][][] = kolom.map((k) => [
    ...baris.map((b) => alineaUkur(huruf.biasa, b[k.kunci] ?? "")),
    alineaUkur(huruf.tebal, k.judul),
  ]);
  const spasi = [lebarTeks(huruf.biasa, " ", ukuran), lebarTeks(huruf.tebal, " ", ukuran)];
  const R = baris.length + 1;

  // Batas bawah keras, dua tingkat. Pertama: kata judul DAN setiap kata biasa
  // isi (tanpa "/" atau "-" - nama orang, "Kewarisan", "(Dikabulkan)") utuh.
  // Nomor perkara dan alamat Direktori sengaja tidak ikut: keduanya wajar
  // dipenggal di garis miringnya. Bila tidak muat seluruhnya: kata judul saja.
  const kataJudul = kolom.map((_, i) => Math.max(0, ...sel[i][R - 1].flat().map((k) => k.lebar)));
  // Tanggal ("01-04-2026", "17/11/2025") ikut utuh: pendek, dan terpecah tiga
  // baris di kolom sempit ("01-/04-/2026") ia sulit dibaca.
  const polaTanggal = /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/;
  const kataBiasa = kolom.map((_, i) => {
    let w = 0;
    for (let r = 0; r < R - 1; r += 1) {
      for (const alinea of sel[i][r]) {
        for (const k of alinea) if (k.lebar > w && (!/[/-]/.test(k.teks) || polaTanggal.test(k.teks))) w = k.lebar;
      }
    }
    return w;
  });
  const bawahUtuh = kolom.map((_, i) => Math.min(Math.max(kataJudul[i], kataBiasa[i]), batasKata) + ruang + 0.5);
  const bawahJudul = kolom.map((_, i) => Math.min(kataJudul[i], batasKata) + ruang + 0.5);
  const bawah = bawahUtuh.reduce((a, b) => a + b, 0) <= lebarTersedia ? bawahUtuh : bawahJudul;
  const jumlahBawah = bawah.reduce((a, b) => a + b, 0);
  if (jumlahBawah > lebarTersedia) return jatah;

  /**
   * Kata yang lebih lebar dari batas dipotong PERSIS seperti pecahBaris:
   * potongan terpanjang yang muat, lalu mundur ke "/" "-" atau tanda baca
   * di separuh akhirnya. Menebaknya dengan lebar/batas membuat alamat
   * Direktori tampak tiga baris padahal tergambar tujuh.
   */
  const potongKata = (k: KataUkur, batas: number): { potongan: number; jelek: number; sisa: number } => {
    if (!k.pref) {
      const pref = new Float64Array(k.teks.length + 1);
      for (let j = 0; j < k.teks.length; j += 1) pref[j + 1] = pref[j] + lebarTeks(k.font, k.teks[j], ukuran);
      k.pref = pref;
    }
    const pref = k.pref;
    const panjang = k.teks.length;
    let mulai = 0;
    let potongan = 0;
    // Penggalan di tengah kata ("Moham|mad"), bukan sesudah "/" "-" atau tanda baca.
    let jelek = 0;
    while (mulai < panjang && pref[panjang] - pref[mulai] > batas) {
      let rendah = 1;
      let tinggi = panjang - mulai;
      while (rendah < tinggi) {
        const tengah = Math.ceil((rendah + tinggi) / 2);
        if (pref[mulai + tengah] - pref[mulai] <= batas) rendah = tengah;
        else tinggi = tengah - 1;
      }
      const muat = rendah;
      let potong = muat;
      let diPemisah = false;
      cari: for (const kelompok of PEMISAH_KATA) {
        for (let j = muat; j > Math.max(1, Math.floor(muat / 2)); j -= 1) {
          if (kelompok.includes(k.teks[mulai + j - 1])) {
            potong = j;
            diPemisah = true;
            break cari;
          }
        }
      }
      if (!diPemisah && !PEMISAH_KATA.some((kelompok) => kelompok.includes(k.teks[mulai + potong - 1]))) jelek += 1;
      potongan += 1;
      mulai += potong;
    }
    return { potongan, jelek, sisa: pref[panjang] - pref[mulai] };
  };

  /**
   * Jumlah baris satu alinea - langkah demi langkah seperti pecahBaris -
   * dan berapa kali sebuah kata terpenggal di dalamnya.
   */
  let potongTerakhir = 0;
  const barisAlinea = (kata: KataUkur[], sp: number, batas: number): number => {
    let jumlah = 0;
    let adaIsi = false;
    let isi = 0;
    for (const k of kata) {
      if (adaIsi) {
        if (isi + sp + k.lebar <= batas) {
          isi += sp + k.lebar;
          continue;
        }
        jumlah += 1;
        adaIsi = false;
      }
      if (k.lebar <= batas) {
        isi = k.lebar;
        adaIsi = true;
        continue;
      }
      const { potongan, jelek, sisa } = potongKata(k, batas);
      jumlah += potongan;
      potongTerakhir += jelek;
      isi = sisa;
      adaIsi = true;
    }
    if (adaIsi) jumlah += 1;
    return Math.max(1, jumlah);
  };

  const LANGKAH = Math.max(0.75, lebarTersedia / 600);
  type BarisKolom = { baris: Int32Array; potong: Int32Array };
  const tersimpan = kolom.map(() => new Map<number, BarisKolom>());
  /** Jumlah baris (dan kata terpenggal) tiap sel kolom i bila lebarnya bawah + langkah x LANGKAH. */
  const barisPada = (i: number, langkah: number): BarisKolom => {
    const ada = tersimpan[i].get(langkah);
    if (ada) return ada;
    const batas = Math.max(1, bawah[i] + langkah * LANGKAH - ruang);
    const hasil: BarisKolom = { baris: new Int32Array(R), potong: new Int32Array(R) };
    for (let r = 0; r < R; r += 1) {
      const sp = spasi[r === R - 1 ? 1 : 0];
      let jumlah = 0;
      potongTerakhir = 0;
      for (const alinea of sel[i][r]) jumlah += barisAlinea(alinea, sp, batas);
      hasil.baris[r] = jumlah;
      hasil.potong[r] = potongTerakhir;
    }
    tersimpan[i].set(langkah, hasil);
    return hasil;
  };

  const langkah = kolom.map(() => 0);
  const K = kolom.map((_, i) => barisPada(i, 0));
  const L = K.map((k) => k.baris);
  // Per baris tabel: sel tertinggi, berapa sel setinggi itu, dan tertinggi kedua.
  const maks = new Int32Array(R);
  const banyakMaks = new Int32Array(R);
  const kedua = new Int32Array(R);
  const hitungBaris = (r: number) => {
    let m = 0;
    let c = 0;
    let s = 0;
    for (let i = 0; i < n; i += 1) {
      const v = L[i][r];
      if (v > m) {
        s = m;
        m = v;
        c = 1;
      } else if (v === m) c += 1;
      else if (v > s) s = v;
    }
    maks[r] = m;
    banyakMaks[r] = c;
    kedua[r] = s;
  };
  for (let r = 0; r < R; r += 1) hitungBaris(r);

  // Tinggi baris tabel yang dihemat bernilai 1; tiap baris sel yang dihemat
  // 0,02; tiap kata yang tidak lagi terpenggal di tengah 0,1 - "Moham|mad"
  // lebih buruk daripada satu baris lipatan biasa.
  const ALFA = 0.02;
  const BETA = 0.3;
  let sisa = lebarTersedia - jumlahBawah;
  while (sisa >= LANGKAH) {
    // Lompatan 1, 2, 4, ... sampai SELURUH sisa: kolom alamat Direktori baru
    // turun sebaris sesudah dilebarkan ratusan titik sekaligus - lompatan
    // pendek saja tidak pernah melihat untungnya.
    const lompatMaks = Math.floor((sisa + 1e-9) / LANGKAH);
    const lompatan: number[] = [];
    for (let d = 1; d <= lompatMaks; d *= 2) lompatan.push(d);
    if (lompatan[lompatan.length - 1] !== lompatMaks) lompatan.push(lompatMaks);
    let terbaik = -1;
    let lompatTerbaik = 0;
    let untungTerbaik = 0;
    for (let i = 0; i < n; i += 1) {
      for (const d of lompatan) {
        const calon = barisPada(i, langkah[i] + d);
        const baru = calon.baris;
        let untung = 0;
        for (let r = 0; r < R; r += 1) {
          untung += BETA * (K[i].potong[r] - calon.potong[r]);
          const lama = L[i][r];
          const b = baru[r];
          if (b === lama) continue;
          untung += ALFA * (lama - b);
          if (lama === maks[r] && banyakMaks[r] === 1) untung += maks[r] - Math.max(b, kedua[r]);
        }
        const perTitik = untung / (d * LANGKAH);
        if (perTitik > untungTerbaik + 1e-12) {
          untungTerbaik = perTitik;
          terbaik = i;
          lompatTerbaik = d;
        }
      }
    }
    if (terbaik < 0) break;
    langkah[terbaik] += lompatTerbaik;
    sisa -= lompatTerbaik * LANGKAH;
    K[terbaik] = barisPada(terbaik, langkah[terbaik]);
    L[terbaik] = K[terbaik].baris;
    for (let r = 0; r < R; r += 1) hitungBaris(r);
  }

  const lebar = bawah.map((b, i) => b + langkah[i] * LANGKAH);
  // Sisa ruang dibagi menurut bobot - tabel tetap selebar halaman.
  const tambahan = lebarTersedia - lebar.reduce((a, b) => a + b, 0);
  return lebar.map((w, i) => w + (tambahan * bobot[i]) / jumlahBobot);
}
