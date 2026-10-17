/**
 * ============================================================================
 * DETEKSI SISA BLANGKO / PERBAIKAN PADA PUTUSAN, BAS, DAN RELAAS (17 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim PA Donggala: setiap naskah putusan, BAS, dan relaas yang
 * diunggah atau diunduh diperiksa dulu - masih adakah sisa tulisan blangko atau
 * catatan perbaikan yang lupa dibersihkan:
 *
 *   - kurung siku: [ ]  [...]  [nama]  [[...]]
 *   - tanda isian: #1234#  {{...}}  <<...>>  "placeholder"  "isi di sini"  XXXX
 *   - catatan perbaikan: "perlu di review", "perlu dicek", "periksa kembali", TODO
 *   - titik-titik isian (...., ......) dan garis isian (____)
 *   - tulisan berwarna MERAH (tabel warna RTF + \cfN, atau w:color di DOCX)
 *   - kalimat yang masih berbentuk blangko ("bin/binti", "pilih salah satu")
 *
 * PENGECUALIAN: "..." atau "…" di dalam kutipan yang dipotong (ayat, hadis,
 * kitab fiqh, pasal) BUKAN blangko - lihat dalamKutipan().
 *
 * TIDAK MENAHAN: modul ini hanya MENEMUKAN. Yang menampilkan peringatan dan
 * pilihan "Unduh daftar masalah (.txt) lalu lanjut" / "Lanjut saja" / "Batal"
 * adalah src/lib/dialog-sisa-blangko.ts (portal) dan salinan di ekstensi.
 *
 * SATU ATURAN, DUA SALINAN: berkas ini adalah salinan TS dari
 * ekstensi-sipp/deteksi-sisa-blangko.js (JS murni untuk ekstensi). Uji
 * deteksi-sisa-blangko-17okt mengadu keduanya atas masukan yang sama - ubah
 * aturan di KEDUA berkas.
 *
 * Murni (tanpa DOM): dapat dipakai di peramban maupun Node >= 18
 * (DecompressionStream untuk DOCX).
 */

export type JenisTemuan = "merah" | "kurung" | "tanda" | "perbaikan" | "titik" | "garis" | "kalimat";
export type JenisNaskah = "putusan" | "bas" | "relaas";

export type Temuan = {
  jenis: JenisTemuan;
  label: string;
  sebelum: string;
  cocok: string;
  sesudah: string;
  paragraf: number;
  halaman: number;
};

export type HasilPeriksa = {
  temuan: Temuan[];
  jumlahParagraf: number;
  jumlahHalaman: number;
  terpotong: number;
};

export type Paragraf = {
  teks: string;
  /** Rentang [dari, sampai) yang berwarna merah. */
  merah: Array<[number, number]>;
  halaman: number;
  nomor: number;
  /** Halaman tempat tulisan paragraf dimulai (diisi pembangun). */
  halamanMulai?: number;
};

export const LABEL: Record<JenisTemuan, string> = {
  merah: "Tulisan berwarna merah",
  kurung: "Kurung siku yang belum diganti",
  tanda: "Tanda isian yang belum terganti",
  perbaikan: "Catatan perbaikan yang masih tertinggal",
  titik: "Titik-titik isian yang belum diisi",
  garis: "Garis isian yang belum diisi",
  kalimat: "Kalimat yang masih berbentuk blangko",
};
export const URUTAN_JENIS: JenisTemuan[] = ["merah", "kurung", "tanda", "perbaikan", "titik", "garis", "kalimat"];
export const NAMA_NASKAH: Record<JenisNaskah, string> = { putusan: "putusan", bas: "berita acara sidang (BAS)", relaas: "relaas" };

const BATAS_TEMUAN = 500;
const HURUF_PER_HALAMAN = 2800;

// ============================================================================
// Warna
// ============================================================================
/** Merah atau mirip merah (C00000, FF0000, FF3333, 990000, FF6600...), bukan jingga/merah muda pucat. */
export function merahKah(r: number, g: number, b: number): boolean {
  return r >= 140 && g <= 110 && b <= 110 && r - Math.max(g, b) >= 80;
}

const WARNA_HIGHLIGHT_MERAH = new Set(["red", "darkred"]);

// ============================================================================
// Pembaca RTF -> paragraf
// ============================================================================
const CP1252: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰",
  0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•",
  0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};
const RTF_BUANG = new Set([
  "fonttbl", "colortbl", "stylesheet", "listtable", "listoverridetable", "rsidtbl", "generator", "info",
  "pict", "object", "themedata", "colorschememapping", "latentstyles", "datastore", "xmlnstbl",
  "wgrffmtfilter", "template", "filetbl", "revtbl", "background", "shppict", "nonshppict", "fchars",
  "lchars", "upr", "header", "headerl", "headerr", "headerf", "footer", "footerl", "footerr", "footerf",
  "pgdsctbl", "fldinst", "listtext", "pnseclvl",
]);
const RTF_TEKS_KENDALI: Record<string, string> = {
  emdash: "—", endash: "–", lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”", bullet: "•",
  emspace: " ", enspace: " ", qmspace: " ",
};

/** Tabel warna RTF -> daftar indeks yang merah (indeks 0 = otomatis). */
function indeksMerahRtf(rtf: string): Set<number> {
  const awal = rtf.indexOf("{\\colortbl");
  const hasil = new Set<number>();
  if (awal < 0) return hasil;
  let dalam = 0;
  let akhir = awal;
  for (; akhir < rtf.length; akhir += 1) {
    const c = rtf[akhir];
    if (c === "{") dalam += 1;
    else if (c === "}") {
      dalam -= 1;
      if (dalam === 0) break;
    }
  }
  const isi = rtf.slice(awal + "{\\colortbl".length, akhir);
  const bagian = isi.split(";");
  for (let k = 0; k < bagian.length - 1; k += 1) {
    const r = /\\red(\d+)/.exec(bagian[k]);
    const g = /\\green(\d+)/.exec(bagian[k]);
    const b = /\\blue(\d+)/.exec(bagian[k]);
    if (r && g && b && merahKah(Number(r[1]), Number(g[1]), Number(b[1]))) hasil.add(k);
  }
  return hasil;
}

type Bangun = {
  tulis(teks: string, merah: boolean): void;
  akhiriParagraf(): void;
  halamanBaru(nyata: boolean): void;
  selesai(): Paragraf[];
};

function pembangunParagraf(): Bangun {
  const daftar: Paragraf[] = [];
  let cur: Paragraf = { teks: "", merah: [], halaman: 1, nomor: 0 };
  let keras = 0;
  let muatan = 0;
  let lastRendered = false;
  const api: Bangun = {
    tulis(teks, merah) {
      if (!teks) return;
      const dari = cur.teks.length;
      // Halaman paragraf = halaman tempat tulisannya DIMULAI (pemisah halaman di tengah paragraf tidak memecahnya).
      if (cur.halamanMulai === undefined && /\S/.test(teks)) cur.halamanMulai = lastRendered ? keras + 1 : keras + 1 + Math.floor(muatan / HURUF_PER_HALAMAN);
      cur.teks += teks;
      if (merah && /\S/.test(teks)) {
        const akhir = cur.merah[cur.merah.length - 1];
        if (akhir && akhir[1] === dari) akhir[1] = cur.teks.length;
        else cur.merah.push([dari, cur.teks.length]);
      }
    },
    akhiriParagraf() {
      if (/\S/.test(cur.teks)) {
        muatan += cur.teks.length;
        cur.halaman = cur.halamanMulai === undefined ? 1 : cur.halamanMulai;
        cur.nomor = daftar.length + 1;
        daftar.push(cur);
      }
      cur = { teks: "", merah: [], halaman: 1, nomor: 0 };
    },
    halamanBaru(nyata) {
      keras += 1;
      muatan = 0;
      if (nyata) lastRendered = true;
    },
    selesai() {
      api.akhiriParagraf();
      return daftar;
    },
  };
  return api;
}

type KeadaanRtf = { cf: number; hl: number; uc: number; buang: boolean };

export function bacaRtfParagraf(rtfMasuk: string): Paragraf[] {
  const rtf = String(rtfMasuk == null ? "" : rtfMasuk);
  const merahIdx = indeksMerahRtf(rtf);
  const bangun = pembangunParagraf();
  const tumpuk: KeadaanRtf[] = [];
  let k: KeadaanRtf = { cf: 0, hl: 0, uc: 1, buang: false };
  let lewati = 0;
  let i = 0;
  const merahSekarang = () => merahIdx.has(k.cf) || merahIdx.has(k.hl);
  const tulis = (masuk: string) => {
    let t = masuk;
    if (k.buang || !t) return;
    if (lewati > 0) {
      const pakai = Math.min(lewati, t.length);
      lewati -= pakai;
      t = t.slice(pakai);
      if (!t) return;
    }
    bangun.tulis(t, merahSekarang());
  };
  while (i < rtf.length) {
    const h = rtf[i];
    if (h === "{") {
      tumpuk.push(k);
      k = { cf: k.cf, hl: k.hl, uc: k.uc, buang: k.buang };
      // Tujuan yang bukan naskah: {\*...} atau kata tujuan yang dikenal tepat sesudah "{".
      const m = /^\{\s*\\(\*)?\s*\\?([a-zA-Z]+)?/.exec(rtf.slice(i, i + 40));
      if (m && (m[1] === "*" || (m[2] && RTF_BUANG.has(m[2])))) k.buang = true;
      i += 1;
      continue;
    }
    if (h === "}") {
      k = tumpuk.pop() || { cf: 0, hl: 0, uc: 1, buang: false };
      lewati = 0;
      i += 1;
      continue;
    }
    if (h === "\\") {
      const s = rtf[i + 1];
      if (s === "\\" || s === "{" || s === "}") {
        tulis(s);
        i += 2;
        continue;
      }
      if (s === "'") {
        const kode = Number.parseInt(rtf.slice(i + 2, i + 4), 16);
        if (!Number.isNaN(kode) && (kode >= 0x20 || kode === 0x09)) tulis(CP1252[kode] || String.fromCharCode(kode));
        i += 4;
        continue;
      }
      if (s === "~") {
        tulis(" ");
        i += 2;
        continue;
      }
      if (s === "-" || s === "_" || s === "|" || s === ":") {
        i += 2;
        continue;
      }
      if (s === "*") {
        i += 2;
        continue;
      }
      if (s === "\n" || s === "\r") {
        bangun.akhiriParagraf();
        i += 2;
        continue;
      }
      const c = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i, i + 64));
      if (!c) {
        i += 1;
        continue;
      }
      const kata = c[1];
      const angka = c[2] === undefined ? null : Number(c[2]);
      i += c[0].length;
      if (RTF_BUANG.has(kata)) {
        k.buang = true;
        continue;
      }
      switch (kata) {
        case "par":
        case "sect":
        case "cell":
        case "row":
          if (!k.buang) bangun.akhiriParagraf();
          break;
        case "line":
        case "tab":
          tulis(" ");
          break;
        case "page":
        case "pagebb":
          if (!k.buang) bangun.halamanBaru(false);
          break;
        case "cf":
          if (angka !== null) k.cf = angka;
          break;
        case "highlight":
        case "chcbpat":
          if (angka !== null) k.hl = angka;
          break;
        case "plain":
          k.cf = 0;
          k.hl = 0;
          break;
        case "uc":
          if (angka !== null) k.uc = angka;
          break;
        case "u":
          if (angka !== null) {
            tulis(String.fromCharCode(angka < 0 ? angka + 65536 : angka));
            lewati = k.uc;
          }
          break;
        case "bin":
          if (angka && angka > 0) i += angka;
          break;
        default:
          if (Object.prototype.hasOwnProperty.call(RTF_TEKS_KENDALI, kata)) tulis(RTF_TEKS_KENDALI[kata]);
          break;
      }
      continue;
    }
    if (h === "\r" || h === "\n") {
      i += 1;
      continue;
    }
    let j = i;
    while (j < rtf.length && rtf[j] !== "\\" && rtf[j] !== "{" && rtf[j] !== "}" && rtf[j] !== "\r" && rtf[j] !== "\n") j += 1;
    tulis(rtf.slice(i, j));
    i = j;
  }
  return bangun.selesai();
}

// ============================================================================
// Pembaca DOCX (word/document.xml) -> paragraf
// ============================================================================
function dekodeXml(s: string): string {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function bacaDocxXml(xmlMasuk: string): Paragraf[] {
  const xml = String(xmlMasuk == null ? "" : xmlMasuk);
  const bangun = pembangunParagraf();
  const adaRender = /<w:lastRenderedPageBreak\b/.test(xml);
  const paragrafRe = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = paragrafRe.exec(xml))) {
    const p = pm[0];
    if (/<w:pageBreakBefore\b(?![^>]*w:val="(?:0|false)")/.test(p) && !adaRender) bangun.halamanBaru(false);
    const runRe = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
    let rm: RegExpExecArray | null;
    while ((rm = runRe.exec(p))) {
      const r = rm[0];
      const rpr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(r);
      let merah = false;
      if (rpr) {
        const w = /<w:color\b[^>]*\bw:val="([0-9A-Fa-f]{6})"/.exec(rpr[1]);
        if (w) {
          const n = parseInt(w[1], 16);
          merah = merahKah((n >> 16) & 255, (n >> 8) & 255, n & 255);
        }
        const hl = /<w:highlight\b[^>]*\bw:val="([A-Za-z]+)"/.exec(rpr[1]);
        if (hl && WARNA_HIGHLIGHT_MERAH.has(hl[1].toLowerCase())) merah = true;
      }
      // Isi run berurutan: teks, tab, penanda halaman.
      const isiRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b([^>]*)\/>|<w:lastRenderedPageBreak\s*\/>/g;
      let im: RegExpExecArray | null;
      while ((im = isiRe.exec(r))) {
        if (im[1] !== undefined) bangun.tulis(dekodeXml(im[1]), merah);
        else if (im[0].startsWith("<w:tab")) bangun.tulis(" ", false);
        else if (im[0].startsWith("<w:lastRendered")) bangun.halamanBaru(true);
        else if (/w:type="page"/.test(im[2] || "")) {
          if (!adaRender) bangun.halamanBaru(false);
        } else bangun.tulis(" ", false);
      }
    }
    bangun.akhiriParagraf();
  }
  return bangun.selesai();
}

// ============================================================================
// Teks biasa -> paragraf
// ============================================================================
export function paragrafDariTeks(teks: string): Paragraf[] {
  const bangun = pembangunParagraf();
  for (const baris of String(teks == null ? "" : teks).split(/\r\n|\r|\n|\f/)) {
    bangun.tulis(baris, false);
    bangun.akhiriParagraf();
  }
  return bangun.selesai();
}

// ============================================================================
// Aturan
// ============================================================================
const ARAB = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const PEMICU_KUTIPAN = /(?:firman\s+allah|firman[-\s]nya|sabda|bersabda|dalam\s+kitab|kitab|q\.?\s?s\.?|surat|surah|ayat|hadis|hadits|al[-\s]?qur['’]?an|hr\.|diriwayatkan|riwayat|pasal)\b/gi;

// Aksara Arab yang terbaca sebagai deretan huruf Latin-1 beraksen (RTF berkode laman 1256) juga dianggap teks Arab.
const ARAB_RUSAK = /[À-ÿ]{3,}/;
function dekatArab(p: string, dari: number, sampai: number): boolean {
  const w = `${p.slice(Math.max(0, dari - 40), dari)} ${p.slice(sampai, sampai + 40)}`;
  return ARAB.test(w) || ARAB_RUSAK.test(w);
}

/** Apakah posisi ini di dalam tanda kutip yang belum tertutup (lurus, miring, atau guillemet)? */
function diapitKutip(p: string, dari: number): boolean {
  const sebelum = p.slice(0, dari);
  if ((sebelum.match(/"/g) || []).length % 2 === 1) return true;
  if (Math.max(sebelum.lastIndexOf("“"), sebelum.lastIndexOf("«")) > Math.max(sebelum.lastIndexOf("”"), sebelum.lastIndexOf("»"))) return true;
  if (sebelum.lastIndexOf("‘") > sebelum.lastIndexOf("’")) return true;
  // Kutip tunggal lurus yang BUKAN apostrof (tidak diapit huruf/angka di kedua sisi).
  const tunggal = sebelum.match(/(?<![\p{L}\p{N}])'|'(?![\p{L}\p{N}])/gu) || [];
  return tunggal.length % 2 === 1;
}

/** Didahului kata pemicu kutipan dan sudah ada isi kutipan (>= 15 huruf) sebelum titik-titiknya. */
function didahuluiPemicu(p: string, dari: number): boolean {
  const jendela = p.slice(Math.max(0, dari - 260), dari);
  let akhirPemicu = -1;
  const re = new RegExp(PEMICU_KUTIPAN.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(jendela))) akhirPemicu = m.index + m[0].length;
  if (akhirPemicu < 0) return false;
  const antara = jendela.slice(akhirPemicu);
  return (antara.match(/\p{L}/gu) || []).length >= 15;
}

const TANDA_KUTIP = /["“”‘’'«»]/;
/** Titik-titik di dalam kutipan yang dipotong (ayat, hadis, kitab, pasal) bukan blangko. */
function dalamKutipan(p: string, dari: number, sampai: number): boolean {
  // "…" dihitung 2 titik. Titik-titik panjang tetap blangko walau berada di dalam kutip.
  const potongan = p.slice(dari, sampai);
  const satuan = (potongan.match(/\./g) || []).length + 2 * (potongan.match(/…/g) || []).length;
  const kiri = p.slice(0, dari).trimEnd().slice(-1);
  const kanan = p.slice(sampai).trimStart().slice(0, 1);
  const kutipKiri = TANDA_KUTIP.test(kiri);
  const kutipKanan = TANDA_KUTIP.test(kanan);
  // Kutipan yang isinya HANYA titik-titik ("...." / '....') adalah isian kosong.
  if (kutipKiri && kutipKanan) return false;
  // Berdampingan dengan teks Arab: titik-titik pengganti bagian yang dipotong (sampai 8 titik).
  if (dekatArab(p, dari, sampai)) return satuan <= 8;
  if (satuan > 4) return false;
  // Pemotongan di awal atau akhir kutipan: tepat di samping satu tanda kutip.
  if (kutipKiri || kutipKanan) return true;
  return diapitKutip(p, dari) || didahuluiPemicu(p, dari);
}

type Aturan = {
  jenis: JenisTemuan;
  re: RegExp;
  lewat?: (isi: string, p: string, dari: number, sampai: number) => boolean;
};

const ATURAN: Aturan[] = [
  {
    jenis: "kurung",
    re: /\[\[[^\]]{0,200}\]\]|\[[^[\]]{0,200}\]/g,
    lewat(isi, p, dari, sampai) {
      const dalam = isi.replace(/^\[+|\]+$/g, "").trim();
      if (/^\d+$/.test(dalam) || /^sic$/i.test(dalam)) return true;
      // Keterangan terbitan pustaka ([Beirut: Dar al-Fikr, 1990], [t.th.]) bukan isian.
      if (/\b(?:1[3-9]|20)\d{2}\b|\bt\.?\s?th\b/i.test(dalam) && /[:,]/.test(dalam)) return true;
      if (dekatArab(p, dari, sampai) && /^[….\s]*$/.test(dalam)) return true;
      if (/^[….\s]+$/.test(dalam) && dalam && dalamKutipan(p, dari, sampai)) return true;
      return false;
    },
  },
  { jenis: "tanda", re: /#\d{2,6}#/g },
  { jenis: "tanda", re: /\{\{[^{}]{0,120}\}\}/g },
  { jenis: "tanda", re: /<<[^<>]{0,120}>>/g },
  { jenis: "tanda", re: /\bplace\s?holder\b/gi },
  { jenis: "tanda", re: /\bisi\s+(?:di\s?)?sini\b/gi },
  { jenis: "tanda", re: /(?<![A-Za-z0-9])X{4,}(?![A-Za-z0-9])/g },
  { jenis: "perbaikan", re: /\bperlu\s+(?:di\s?)?(?:review|reviu|cek|check)\w*/gi },
  { jenis: "perbaikan", re: /\bperiksa\s+kembali\b/gi },
  { jenis: "perbaikan", re: /\bTODO\b/gi },
  {
    jenis: "titik",
    // Satu "gugus" titik: tiga titik atau lebih (boleh berspasi satu) atau "…", dengan sambungan titik di sebelahnya.
    re: /(?:…|\.{3}|(?:\.[  ]){2}\.)(?:[  ]?(?:…|\.))*/g,
    lewat(_isi, p, dari, sampai) {
      // Titik pengantar antara uraian dan nominal biaya ("Biaya panggilan ........ Rp. 60.000,-") bukan isian.
      if (/^[  ]*Rp\b/i.test(p.slice(sampai, sampai + 12))) return true;
      return dalamKutipan(p, dari, sampai);
    },
  },
  {
    jenis: "garis",
    re: /_{3,}/g,
    lewat(_isi, p) {
      // Baris pemisah yang seluruhnya garis bawah/strip bukan isian.
      return /^[\s_\-=*+]*$/.test(p);
    },
  },
  { jenis: "kalimat", re: /\bbin\s*\/\s*binti\b|\bbinti\s*\/\s*bin\b/gi },
  { jenis: "kalimat", re: /\b(?:pilih|pilihlah)\s+salah\s+satu(?:nya)?\b|\b(?:coret|hapus)\s+yang\s+tidak\s+(?:perlu|sesuai|diperlukan)\b/gi },
];

function potong(teks: string, maks: number): string {
  const t = String(teks).replace(/\s+/g, " ").trim();
  return t.length > maks ? `${t.slice(0, maks - 1).trimEnd()}…` : t;
}

function kutipanSekitar(p: string, dari: number, sampai: number) {
  const lebarKiri = 50;
  const lebarKanan = 50;
  let sebelum = p.slice(Math.max(0, dari - lebarKiri), dari);
  let sesudah = p.slice(sampai, sampai + lebarKanan);
  if (dari > lebarKiri) sebelum = `…${sebelum.replace(/^\S*\s/, "")}`;
  if (sampai + lebarKanan < p.length) sesudah = `${sesudah.replace(/\s\S*$/, "")}…`;
  return {
    sebelum: sebelum.replace(/\s+/g, " ").trimStart(),
    cocok: potong(p.slice(dari, sampai), 120),
    sesudah: sesudah.replace(/\s+/g, " ").trimEnd(),
  };
}

/** Periksa daftar paragraf -> { temuan, jumlahParagraf, jumlahHalaman, terpotong }. */
export function periksaParagraf(daftar: Paragraf[]): HasilPeriksa {
  const temuan: Temuan[] = [];
  let terpotong = 0;
  for (const par of daftar) {
    const p = par.teks.replace(/ /g, " ");
    const rentang: Array<{ jenis: JenisTemuan; dari: number; sampai: number }> = [];
    // Rentang merah yang hanya dipisah spasi digabung: "Saksi kenal dengan" satu temuan, bukan tiga.
    const gabung: Array<[number, number]> = [];
    for (const r of par.merah) {
      const akhir = gabung[gabung.length - 1];
      if (akhir && /^\s*$/.test(p.slice(akhir[1], r[0]))) akhir[1] = r[1];
      else gabung.push([r[0], r[1]]);
    }
    for (const [dari, sampai] of gabung) {
      // Tanda baca saja yang berwarna merah (",", ";", "-") bukan sisa tulisan.
      if (!/[\p{L}\p{N}]/u.test(p.slice(dari, sampai))) continue;
      rentang.push({ jenis: "merah", dari, sampai });
    }
    for (const a of ATURAN) {
      for (const m of p.matchAll(a.re)) {
        const dari = m.index ?? 0;
        const sampai = dari + m[0].length;
        if (a.lewat && a.lewat(m[0], p, dari, sampai)) continue;
        rentang.push({ jenis: a.jenis, dari, sampai });
      }
    }
    // Sisihkan yang seluruhnya berada di dalam rentang lain yang lebih "besar" (merah, kurung, tanda).
    const pemenang = rentang.filter((r) => {
      for (const o of rentang) {
        if (o === r) continue;
        const lebihBesar =
          o.sampai - o.dari > r.sampai - r.dari ||
          (o.sampai - o.dari === r.sampai - r.dari && URUTAN_JENIS.indexOf(o.jenis) < URUTAN_JENIS.indexOf(r.jenis));
        if (o.dari <= r.dari && o.sampai >= r.sampai && lebihBesar) return false;
      }
      return true;
    });
    pemenang.sort((x, y) => x.dari - y.dari);
    for (const r of pemenang) {
      if (temuan.length >= BATAS_TEMUAN) {
        terpotong += 1;
        continue;
      }
      const k = kutipanSekitar(p, r.dari, r.sampai);
      temuan.push({
        jenis: r.jenis,
        label: LABEL[r.jenis],
        sebelum: k.sebelum,
        cocok: k.cocok,
        sesudah: k.sesudah,
        paragraf: par.nomor,
        halaman: par.halaman,
      });
    }
  }
  const jumlahHalaman = daftar.length ? daftar[daftar.length - 1].halaman : 0;
  return { temuan, jumlahParagraf: daftar.length, jumlahHalaman, terpotong };
}

export function periksaTeks(teks: string): HasilPeriksa {
  return periksaParagraf(paragrafDariTeks(teks));
}
export function periksaRtf(rtf: string): HasilPeriksa {
  return periksaParagraf(bacaRtfParagraf(rtf));
}
export function periksaDocxXml(xml: string): HasilPeriksa {
  return periksaParagraf(bacaDocxXml(xml));
}

// ============================================================================
// ZIP -> word/document.xml (DecompressionStream; tanpa pustaka)
// ============================================================================
function u16(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}
function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

async function lepasDeflate(bita: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "function") throw new Error("pelepas tidak tersedia");
  const alir = new Blob([bita as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(alir).arrayBuffer());
}

/** Isi satu berkas di dalam ZIP, atau null. */
async function ambilDariZip(bita: Uint8Array, nama: string): Promise<Uint8Array | null> {
  let eocd = -1;
  for (let i = bita.length - 22; i >= Math.max(0, bita.length - 65557); i -= 1) {
    if (u32(bita, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const jumlah = u16(bita, eocd + 10);
  let o = u32(bita, eocd + 16);
  for (let n = 0; n < jumlah; n += 1) {
    if (u32(bita, o) !== 0x02014b50) return null;
    const metode = u16(bita, o + 10);
    const ukuranKompres = u32(bita, o + 20);
    const panjangNama = u16(bita, o + 28);
    const panjangEkstra = u16(bita, o + 30);
    const panjangKomentar = u16(bita, o + 32);
    const lokal = u32(bita, o + 42);
    const namaBerkas = new TextDecoder().decode(bita.subarray(o + 46, o + 46 + panjangNama));
    if (namaBerkas === nama) {
      const awalData = lokal + 30 + u16(bita, lokal + 26) + u16(bita, lokal + 28);
      const data = bita.subarray(awalData, awalData + ukuranKompres);
      if (metode === 0) return data;
      if (metode === 8) return lepasDeflate(data);
      return null;
    }
    o += 46 + panjangNama + panjangEkstra + panjangKomentar;
  }
  return null;
}

export async function periksaDocxBita(bita: Uint8Array): Promise<HasilPeriksa | null> {
  const isi = await ambilDariZip(bita, "word/document.xml");
  if (!isi) return null;
  return periksaDocxXml(new TextDecoder("utf-8").decode(isi));
}

// ============================================================================
// Mengenali dan memeriksa berkas dari bita
// ============================================================================
export type BentukBerkas = "rtf" | "docx" | "pdf" | "teks" | "lain";

export function kenaliBentuk(bita: Uint8Array, nama?: string): BentukBerkas {
  const n = String(nama || "").toLowerCase();
  const kepala = String.fromCharCode.apply(null, Array.from(bita.subarray(0, 8)));
  if (/^\s*\{\\rtf/.test(kepala) || kepala.startsWith("{\\rtf")) return "rtf";
  if (kepala.startsWith("PK\u0003\u0004")) return "docx";
  if (kepala.startsWith("%PDF")) return "pdf";
  if (kepala.startsWith("ÐÏ\u0011à")) return "lain"; // .doc biner lama
  if (/\.txt$/.test(n)) return "teks";
  return "lain";
}

export type HasilBerkas = { dibaca: boolean; bentuk: BentukBerkas; hasil: HasilPeriksa | null };

/**
 * Memeriksa satu berkas. hasil = null bila bentuknya tidak terbaca (PDF tanpa
 * pembaca, .doc biner, rusak). Tidak pernah melempar.
 * opsi.bacaPdf: fungsi (bita) => paragraf bila pemanggil punya pembaca PDF.
 */
export async function periksaBita(
  bitaMasuk: Uint8Array | ArrayBuffer,
  nama?: string,
  opsi?: { bacaPdf?: (bita: Uint8Array) => Promise<Paragraf[]> }
): Promise<HasilBerkas> {
  try {
    const bita = bitaMasuk instanceof Uint8Array ? bitaMasuk : new Uint8Array(bitaMasuk);
    if (!bita.length || bita.length > 40 * 1024 * 1024) return { dibaca: false, bentuk: "lain", hasil: null };
    const bentuk = kenaliBentuk(bita, nama);
    if (bentuk === "rtf") return { dibaca: true, bentuk, hasil: periksaRtf(new TextDecoder("windows-1252").decode(bita)) };
    if (bentuk === "docx") {
      const h = await periksaDocxBita(bita);
      return { dibaca: Boolean(h), bentuk, hasil: h };
    }
    if (bentuk === "teks") return { dibaca: true, bentuk, hasil: periksaTeks(new TextDecoder("utf-8").decode(bita)) };
    if (bentuk === "pdf" && opsi && typeof opsi.bacaPdf === "function") {
      const paragraf = await opsi.bacaPdf(bita);
      return { dibaca: true, bentuk, hasil: periksaParagraf(paragraf) };
    }
    return { dibaca: false, bentuk, hasil: null };
  } catch {
    return { dibaca: false, bentuk: "lain", hasil: null };
  }
}

// ============================================================================
// Jenis naskah dari nama / alamat
// ============================================================================
/** "putusan" | "bas" | "relaas" | "" - dari nama berkas. */
export function jenisNaskahDariNama(nama?: string): JenisNaskah | "" {
  const n = String(nama || "");
  if (/relaas/i.test(n)) return "relaas";
  if (/(?:^|[^A-Za-z])BAS(?:[^A-Za-z]|$)|berita\s+acara/i.test(n)) return "bas";
  if (/putusan/i.test(n) && !/penetapan\s+putusan|ikrar/i.test(n)) return "putusan";
  return "";
}

/**
 * Jenis naskah dari alamat rute portal (unduh/unggah): berkas-sipp?jenis=relaas|bas|putusan,
 * putusan/unggah-*, bas/unggah-sipp, bas-massal, relaas-massal/cetak, ecourt-putusan/unggah.
 */
export function jenisNaskahDariAlamat(alamat?: string): JenisNaskah | "" {
  const a = String(alamat || "");
  const jenisQuery = /[?&]jenis=([a-z-]+)/i.exec(a);
  if (jenisQuery) {
    const j = jenisQuery[1].toLowerCase();
    if (j === "relaas") return "relaas";
    if (j === "bas") return "bas";
    if (j === "putusan" || j === "putusan-anonim") return "putusan";
  }
  if (/\/relaas-massal\//i.test(a)) return "relaas";
  if (/\/bas-massal(?:[/?#]|$)|\/bas\/unggah-sipp/i.test(a)) return "bas";
  if (/\/putusan\/unggah-|\/ecourt-putusan\/unggah/i.test(a)) return "putusan";
  return "";
}

// ============================================================================
// Ringkasan dan daftar masalah (.txt)
// ============================================================================
export function ringkasJenis(temuan: Temuan[]): Array<{ jenis: JenisTemuan; label: string; jumlah: number }> {
  const hitung = new Map<JenisTemuan, number>();
  for (const t of temuan) hitung.set(t.jenis, (hitung.get(t.jenis) || 0) + 1);
  return URUTAN_JENIS.filter((j) => hitung.has(j)).map((j) => ({ jenis: j, label: LABEL[j], jumlah: hitung.get(j) || 0 }));
}

export function letakTemuan(t: Temuan): string {
  return `paragraf ke-${t.paragraf}, kira-kira halaman ${t.halaman}`;
}

export function kalimatTemuan(t: Temuan): string {
  const s = t.sebelum ? `${t.sebelum} ` : "";
  const e = t.sesudah ? ` ${t.sesudah}` : "";
  return `${s}«${t.cocok}»${e}`.trim();
}

/** Isi berkas .txt daftar masalah (CRLF supaya terbuka rapi di Notepad). */
export function susunDaftarTxt(temuan: Temuan[], opsi?: { nama?: string; jenis?: string; terpotong?: number }): string {
  const o = opsi || {};
  const baris: string[] = [];
  baris.push("DAFTAR MASALAH PADA NASKAH");
  baris.push("");
  baris.push(`Berkas : ${o.nama || "(tanpa nama)"}`);
  if (o.jenis && (NAMA_NASKAH as Record<string, string>)[o.jenis]) baris.push(`Jenis  : ${(NAMA_NASKAH as Record<string, string>)[o.jenis]}`);
  baris.push(`Jumlah : ${temuan.length} hal${o.terpotong ? ` (ditambah ${o.terpotong} lagi yang tidak ditampilkan)` : ""}`);
  baris.push("");
  baris.push("Ringkasan:");
  for (const r of ringkasJenis(temuan)) baris.push(`  - ${r.label}: ${r.jumlah}`);
  baris.push("");
  baris.push("Rincian (tulisan yang bermasalah ditandai « »; letak hanya perkiraan):");
  baris.push("");
  temuan.forEach((t, i) => {
    baris.push(`${i + 1}. ${t.label} - ${letakTemuan(t)}`);
    baris.push(`   ${kalimatTemuan(t)}`);
    baris.push("");
  });
  baris.push("Perbaiki naskah di Word, lalu unduh atau unggah lagi bila perlu.");
  return baris.join("\r\n");
}
