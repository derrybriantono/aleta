import { bedaTeks } from "@/lib/aleta-abt-beda";
import { CP1252 } from "@/lib/baca-rtf";

/**
 * ============================================================================
 * PENYUNTING RTF AMAN - ALETA ABT Tahap 3 (5 Nov 2026)
 * ============================================================================
 *
 * Pengguna menyunting TEKS seperti mengetik dokumen; berkas RTF-nya tidak boleh rusak. Karena itu penyunting tidak
 * "membangun ulang" RTF dari model dokumen (cara itu membuang apa pun yang tidak dikenalnya: kepala/kaki halaman, kotak
 * gambar, tabel, format). Yang dilakukan hanya menambal bita:
 *
 *   1. uraiRtf   membaca RTF sebagai deretan paragraf. Setiap AKSARA teks tercatat dengan rentang bitanya
 *                ([s, e) di string latin1): huruf biasa, \'hh, \uN? beserta aksara cadangannya, \tab, \line, dst.
 *                Segala hal lain (kata kendali, kelompok, tabel, kepala/kaki, gambar, kotak) adalah KERANGKA.
 *   2. terapkanSuntingan  membandingkan teks paragraf sebelum/sesudah diketik (beda aksara), lalu hanya mengganti rentang
 *                bita aksara yang berubah. Kerangka tidak pernah disentuh, kecuali dua hal yang disengaja: kata \par
 *                yang disisipkan (Enter) dan kata \par paragraf kosong yang dihapus pengguna.
 *   3. Pemeriksa  hasil diurai ULANG: teks setiap paragraf harus persis seperti yang dimaksudkan, dan kerangka (tanpa
 *                aksara) harus sama dengan kerangka asal. Gagal = tidak ada yang ditulis dan pengguna diberi sebab.
 *
 * Yang dijadikan KOTAK TERKUNCI (satu aksara pengganti ￼ di paragraf, tidak bisa dihapus/diketik):
 *   - bidang ({\field ...}: nomor halaman dst.), gambar ({\pict}), kotak teks/gambar ({\shp ...}), objek;
 * Yang tidak ikut disunting sama sekali (tampil terkunci di bawah/atas): kepala dan kaki halaman.
 * Paragraf yang dikunci seluruhnya: berisi huruf yang dikodekan khusus (fon Arab/simbol lewat \'hh) atau berkas yang
 * kode halamannya bukan 1252.
 */

export const AKSARA_KOTAK = "￼";
export const PEMISAH_PARAGRAF = " ";

const B_TEBAL = 1;
const B_MIRING = 2;
const B_GARIS = 4;
const B_NONANSI = 8;
const GESER_UC = 4; // 3 bit: 4..6
const B_TERSEMBUNYI = 128;

export type JenisKotak = "gambar" | "kotak" | "bidang" | "lain";
export type Kotak = { jenis: JenisKotak; label: string; s: number; e: number };
export type Rata = "kiri" | "tengah" | "kanan" | "rata";

export type Paragraf = {
  indeks: number;
  /** Teks logis; kotak terkunci = AKSARA_KOTAK. */
  teks: string;
  /** Rentang bita tiap aksara. */
  s: number[];
  e: number[];
  /** Bit gaya + keadaan (lihat B_*). */
  st: number[];
  /** Indeks aksara yang berupa kotak terkunci, urut; kotak[k] milik atomPos[k]. */
  atomPos: number[];
  kotak: Kotak[];
  /** Nomor daftar (mis. "1.") bila paragraf bernomor otomatis; tidak ikut disunting. */
  awalan: string;
  terminator: { s: number; e: number; nama: string } | null;
  /** Titik sisip bila paragraf tanpa aksara: sebelum terminator. */
  titik: number;
  tabel: boolean;
  rata: Rata;
  li: number;
  fi: number;
  /** Sebab terkunci seluruhnya; "" bila boleh disunting. */
  terkunci: string;
};

export type BagianTetap = { jenis: "kepala" | "kaki"; teks: string[] };

export type DokumenRtf = {
  paragraf: Paragraf[];
  tetap: BagianTetap[];
  /** Tidak "" = seluruh berkas tidak dapat disunting (bukan RTF, kode halaman lain, dst.). */
  sebabDokumen: string;
  panjang: number;
};

// ---------------------------------------------------------------------------------------------------------------
// Pembaca tingkat aksara
// ---------------------------------------------------------------------------------------------------------------

const huruf = (c: string | undefined) => {
  if (!c) return false;
  const k = c.charCodeAt(0);
  return (k >= 65 && k <= 90) || (k >= 97 && k <= 122);
};
const angka = (c: string | undefined) => {
  if (!c) return false;
  const k = c.charCodeAt(0);
  return k >= 48 && k <= 57;
};
const heks = (c: string | undefined) => {
  if (!c) return false;
  const k = c.charCodeAt(0);
  return (k >= 48 && k <= 57) || (k >= 65 && k <= 70) || (k >= 97 && k <= 102);
};

type Kata = { n: string; p: number | null; e: number; pembatas: boolean };

/** s[i] === "\\" dan s[i+1] huruf. */
function bacaKata(s: string, i: number): Kata {
  let j = i + 1;
  while (j < s.length && huruf(s[j])) j += 1;
  const n = s.slice(i + 1, j);
  let p: number | null = null;
  let k = j;
  if (s[k] === "-" && angka(s[k + 1])) k += 1;
  if (angka(s[k])) {
    while (k < s.length && angka(s[k])) k += 1;
    p = Number(s.slice(j, k));
    j = k;
  }
  let pembatas = false;
  if (s[j] === " ") {
    j += 1;
    pembatas = true;
  }
  return { n, p, e: j, pembatas };
}

/** s[i] === "{": indeks sesudah "}" pasangannya (melewati \bin dan karakter lolos). */
export function akhirKelompok(s: string, i: number): number {
  let dalam = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 123) {
      dalam += 1;
      i += 1;
    } else if (c === 125) {
      dalam -= 1;
      i += 1;
      if (dalam === 0) return i;
    } else if (c === 92) {
      const d = s[i + 1];
      if (d === undefined) return n;
      if (huruf(d)) {
        const k = bacaKata(s, i);
        i = k.n === "bin" && k.p && k.p > 0 ? k.e + k.p : k.e;
      } else if (d === "'") i += 4;
      else i += 2;
    } else i += 1;
  }
  return n;
}

const KOTAK_GRUP = new Set(["field", "pict", "shppict", "shp", "shpgrp", "do", "object", "footnote", "annotation", "upr", "ud"]);
const NOMOR_GRUP = new Set(["listtext", "pntext"]);
const KEPALA_GRUP = new Set(["header", "headerl", "headerr", "headerf"]);
const KAKI_GRUP = new Set(["footer", "footerl", "footerr", "footerf"]);
const DIAM_GRUP = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "listtable", "listoverridetable", "rsidtbl", "revtbl", "generator", "pgptbl",
  "defchp", "defpap", "pnseclvl", "pntxta", "pntxtb", "filetbl", "template", "xmlnstbl", "mmath", "mmathpr", "datastore",
  "colorschememapping", "wgrffmtfilter", "themedata", "latentstyles", "fchars", "lchars", "nonshppict", "shprslt", "sp", "sn", "sv",
  "bkmkstart", "bkmkend", "xe", "tc", "tcn", "private", "protusertbl", "userprops", "fldinst", "falt", "panose", "ftnsep", "ftnsepc",
  "aftnsep", "aftnsepc", "pn", "pnlvl", "txfieldtext",
]);

type Golongan = "kotak" | "nomor" | "kepala" | "kaki" | "diam" | "biasa";

/** s[i] === "{": nama kata kendali pertama di dalamnya dan apakah bertanda * (tujuan). */
function namaKelompok(s: string, i: number): { nama: string; bintang: boolean } {
  let j = i + 1;
  const lewatiSpasi = () => {
    while (j < s.length && (s[j] === "\r" || s[j] === "\n" || s[j] === " ")) j += 1;
  };
  lewatiSpasi();
  let bintang = false;
  if (s[j] === "\\" && s[j + 1] === "*") {
    bintang = true;
    j += 2;
    lewatiSpasi();
  }
  if (s[j] === "\\" && huruf(s[j + 1])) return { nama: bacaKata(s, j).n.toLowerCase(), bintang };
  return { nama: "", bintang };
}

function golonganKelompok(nama: string, bintang: boolean): Golongan {
  if (KOTAK_GRUP.has(nama)) return "kotak";
  if (NOMOR_GRUP.has(nama)) return "nomor";
  if (KEPALA_GRUP.has(nama)) return "kepala";
  if (KAKI_GRUP.has(nama)) return "kaki";
  if (bintang || DIAM_GRUP.has(nama)) return "diam";
  return "biasa";
}

type OpsiUrai = {
  /** Mode ekstrak (label kotak, kepala/kaki): tanpa catatan rentang dan tanpa kotak. */
  ekstrak: boolean;
  /** Kotak teks: masuki shpinst/shptxt. */
  bentuk: boolean;
  charset: Map<number, number>;
  deff: number;
  kodeHalaman: number;
};

type Keadaan = {
  uc: number;
  b: boolean;
  i: boolean;
  u: boolean;
  f: number;
  v: boolean;
  rata: Rata;
  li: number;
  fi: number;
  intbl: boolean;
};

const SIMBOL_KATA: Record<string, string> = {
  tab: "\t",
  line: "\n",
  emdash: "—",
  endash: "–",
  bullet: "•",
  lquote: "‘",
  rquote: "’",
  ldblquote: "“",
  rdblquote: "”",
  emspace: " ",
  enspace: " ",
};

const nonAnsiFon = (o: OpsiUrai, f: number) => {
  const cs = o.charset.get(f);
  return cs !== undefined && cs !== 0 && cs !== 1 && cs !== 255;
};

function dekodeHeks(v: number): string {
  if (v < 0x80) return String.fromCharCode(v);
  if (v <= 0x9f) return CP1252[v] ?? String.fromCharCode(v);
  return String.fromCharCode(v);
}

function uraiRentang(s: string, awal: number, akhir: number, o: OpsiUrai): { paragraf: Paragraf[]; tetap: BagianTetap[] } {
  const paragraf: Paragraf[] = [];
  const tetap: BagianTetap[] = [];
  let k: Keadaan = { uc: 1, b: false, i: false, u: false, f: o.deff, v: false, rata: "kiri", li: 0, fi: 0, intbl: false };
  const tumpuk: Keadaan[] = [];

  // Penampung paragraf berjalan.
  let ch: string[] = [];
  let ss: number[] = [];
  let ee: number[] = [];
  let st: number[] = [];
  let atomPos: number[] = [];
  let kotak: Kotak[] = [];
  let awalan = "";
  let khusus = false;
  let akhirTerakhir = awal;
  const reset = () => {
    ch = [];
    ss = [];
    ee = [];
    st = [];
    atomPos = [];
    kotak = [];
    awalan = "";
    khusus = false;
  };

  const bitGaya = () =>
    (k.b ? B_TEBAL : 0) | (k.i ? B_MIRING : 0) | (k.u ? B_GARIS : 0) | (nonAnsiFon(o, k.f) ? B_NONANSI : 0) | ((Math.min(7, Math.max(0, k.uc)) & 7) << GESER_UC) | (k.v ? B_TERSEMBUNYI : 0);

  const unit = (c: string, a: number, b: number) => {
    ch.push(c);
    ss.push(a);
    ee.push(b);
    st.push(bitGaya());
    akhirTerakhir = b;
  };

  const tutup = (nama: string, a: number, b: number) => {
    const tabel = k.intbl || nama === "cell" || nama === "nestcell";
    paragraf.push({
      indeks: paragraf.length,
      teks: ch.join(""),
      s: ss,
      e: ee,
      st,
      atomPos,
      kotak,
      awalan,
      terminator: { s: a, e: b, nama },
      titik: a,
      tabel,
      rata: k.rata,
      li: k.li,
      fi: k.fi,
      terkunci: khusus ? SEBAB_HURUF_KHUSUS : "",
    });
    reset();
    akhirTerakhir = b;
  };

  let i = awal;
  while (i < akhir) {
    const c = s[i];
    if (c === "{") {
      const { nama, bintang } = namaKelompok(s, i);
      const gol = golonganKelompok(nama, bintang);
      const bentukMasuk = o.bentuk && (nama === "shpinst" || nama === "shptxt" || nama === "shp" || nama === "shpgrp");
      if (gol === "biasa" || bentukMasuk) {
        tumpuk.push(k);
        k = { ...k };
        i += 1;
        continue;
      }
      const ujung = Math.min(akhirKelompok(s, i), akhir);
      if (gol === "kotak") {
        if (!o.ekstrak) {
          const kt = labelKotak(s, i, ujung, nama, o);
          atomPos.push(ch.length);
          kotak.push({ ...kt, s: i, e: ujung });
          unit(AKSARA_KOTAK, i, ujung);
        }
      } else if (gol === "nomor") {
        if (!o.ekstrak) awalan = ekstrakTeks(s, i + 1, ujung - 1, o).join(" ").trim();
      } else if ((gol === "kepala" || gol === "kaki") && !o.ekstrak) {
        tetap.push({ jenis: gol, teks: ekstrakTeks(s, i + 1, ujung - 1, o) });
      }
      i = ujung;
      continue;
    }
    if (c === "}") {
      if (tumpuk.length) k = tumpuk.pop() as Keadaan;
      i += 1;
      continue;
    }
    if (c === "\r" || c === "\n") {
      i += 1;
      continue;
    }
    if (c === "\\") {
      const d = s[i + 1];
      if (d === undefined) {
        i += 1;
        continue;
      }
      if (huruf(d)) {
        const kata = bacaKata(s, i);
        const n = kata.n;
        const p = kata.p;
        if (n === "u" && p !== null) {
          // Aksara Unicode + aksara cadangan sebanyak \uc.
          let ujung = kata.e;
          let sisa = k.uc;
          while (sisa > 0 && ujung < akhir) {
            const t = s[ujung];
            if (t === "\r" || t === "\n") {
              ujung += 1;
              continue;
            }
            if (t === "\\" && s[ujung + 1] === "'" && heks(s[ujung + 2]) && heks(s[ujung + 3])) ujung += 4;
            else if (t === "\\" || t === "{" || t === "}") break;
            else ujung += 1;
            sisa -= 1;
          }
          unit(String.fromCharCode(p < 0 ? p + 65536 : p & 0xffff), i, ujung);
          i = ujung;
          continue;
        }
        if (n === "par" || n === "cell" || n === "nestcell" || n === "sect") {
          tutup(n, i, kata.e);
          i = kata.e;
          continue;
        }
        const simbol = SIMBOL_KATA[n];
        if (simbol !== undefined) {
          unit(simbol, i, kata.e);
          i = kata.e;
          continue;
        }
        switch (n) {
          case "bin":
            i = p && p > 0 ? kata.e + p : kata.e;
            continue;
          case "uc":
            k.uc = p === null ? 1 : p;
            break;
          case "b":
            k.b = p !== 0;
            break;
          case "i":
            k.i = p !== 0;
            break;
          case "ul":
            k.u = p !== 0;
            break;
          case "ulnone":
            k.u = false;
            break;
          case "v":
            k.v = p !== 0;
            break;
          case "f":
            if (p !== null) k.f = p;
            break;
          case "plain":
            k.b = false;
            k.i = false;
            k.u = false;
            k.v = false;
            k.f = o.deff;
            break;
          case "pard":
            k.rata = "kiri";
            k.li = 0;
            k.fi = 0;
            k.intbl = false;
            break;
          case "ql":
            k.rata = "kiri";
            break;
          case "qc":
            k.rata = "tengah";
            break;
          case "qr":
            k.rata = "kanan";
            break;
          case "qj":
            k.rata = "rata";
            break;
          case "li":
            k.li = p ?? 0;
            break;
          case "fi":
            k.fi = p ?? 0;
            break;
          case "intbl":
            k.intbl = true;
            break;
          default:
            break;
        }
        i = kata.e;
        continue;
      }
      if (d === "'") {
        if (heks(s[i + 2]) && heks(s[i + 3])) {
          const v = parseInt(s.slice(i + 2, i + 4), 16);
          if (v >= 0x80 && (nonAnsiFon(o, k.f) || o.kodeHalaman !== 1252)) khusus = true;
          unit(dekodeHeks(v), i, i + 4);
          i += 4;
        } else i += 2;
        continue;
      }
      if (d === "\\" || d === "{" || d === "}") {
        unit(d, i, i + 2);
        i += 2;
        continue;
      }
      if (d === "~") {
        unit(" ", i, i + 2);
        i += 2;
        continue;
      }
      if (d === "-") {
        unit("­", i, i + 2);
        i += 2;
        continue;
      }
      if (d === "_") {
        unit("‑", i, i + 2);
        i += 2;
        continue;
      }
      if (d === "\n" || d === "\r") {
        tutup("par", i, i + 2);
        i += 2;
        continue;
      }
      i += 2;
      continue;
    }
    const kode = c.charCodeAt(0);
    if (kode < 0x20 || kode === 0x7f) {
      i += 1;
      continue;
    }
    if (kode >= 0x80) {
      if (nonAnsiFon(o, k.f) || o.kodeHalaman !== 1252) khusus = true;
      unit(dekodeHeks(kode), i, i + 1);
    } else unit(c, i, i + 1);
    i += 1;
  }
  if (ch.length) {
    paragraf.push({
      indeks: paragraf.length,
      teks: ch.join(""),
      s: ss,
      e: ee,
      st,
      atomPos,
      kotak,
      awalan,
      terminator: null,
      titik: akhirTerakhir,
      tabel: k.intbl,
      rata: k.rata,
      li: k.li,
      fi: k.fi,
      terkunci: khusus ? SEBAB_HURUF_KHUSUS : "",
    });
  }
  return { paragraf, tetap };
}

const SEBAB_HURUF_KHUSUS = "Berisi huruf yang dikodekan khusus (fon Arab, simbol, atau kode halaman lain). Dikunci agar hurufnya tidak rusak.";

/** Teks tiap paragraf di rentang (label kotak, kepala/kaki) - tanpa kotak di dalamnya. */
function ekstrakTeks(s: string, awal: number, akhir: number, o: OpsiUrai, bentuk = false): string[] {
  const r = uraiRentang(s, awal, akhir, { ...o, ekstrak: true, bentuk });
  return r.paragraf.map((p) => p.teks).filter((t) => t.trim() !== "");
}

function labelKotak(s: string, i: number, ujung: number, nama: string, o: OpsiUrai): { jenis: JenisKotak; label: string } {
  if (nama === "field") {
    const inst = /\\fldinst[^]*?(?:PAGE|NUMPAGES|HYPERLINK|DATE|TIME|MERGEFIELD|SECTION|SEQ)/i.exec(s.slice(i, Math.min(ujung, i + 600)));
    const kunci = inst ? /(NUMPAGES|PAGE|HYPERLINK|DATE|TIME|MERGEFIELD|SECTION|SEQ)/i.exec(inst[0])?.[1]?.toUpperCase() : "";
    if (kunci === "PAGE") return { jenis: "bidang", label: "Nomor halaman" };
    if (kunci === "NUMPAGES") return { jenis: "bidang", label: "Jumlah halaman" };
    const hasil = ekstrakTeks(s, i + 1, ujung - 1, o).join(" ").trim();
    return { jenis: "bidang", label: hasil ? `Bidang: ${hasil.slice(0, 40)}` : "Bidang otomatis" };
  }
  if (nama === "pict" || nama === "shppict") return { jenis: "gambar", label: "Gambar" };
  if (nama === "shp" || nama === "shpgrp" || nama === "do") {
    const teks = ekstrakTeks(s, i + 1, ujung - 1, o, true).join(" ").replace(/\s+/g, " ").trim();
    return { jenis: "kotak", label: teks ? `Kotak: ${teks.slice(0, 60)}${teks.length > 60 ? "..." : ""}` : "Kotak gambar" };
  }
  if (nama === "object") return { jenis: "lain", label: "Objek tertanam" };
  if (nama === "footnote") return { jenis: "lain", label: "Catatan kaki" };
  if (nama === "annotation") return { jenis: "lain", label: "Komentar" };
  return { jenis: "lain", label: "Bagian khusus" };
}

/** Tabel fon: nomor fon -> fcharset, dan fon bawaan (\deffN). */
function bacaFon(s: string): { charset: Map<number, number>; deff: number; kodeHalaman: number } {
  const charset = new Map<number, number>();
  const awal = s.indexOf("{\\fonttbl");
  if (awal >= 0) {
    const akhir = akhirKelompok(s, awal);
    const re = /\\f(\d+)(?![A-Za-z])|\\fcharset(\d+)/g;
    const bagian = s.slice(awal, akhir);
    let cur = -1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(bagian))) {
      if (m[1] !== undefined) cur = Number(m[1]);
      else if (cur >= 0) charset.set(cur, Number(m[2]));
    }
  }
  const d = /\\deff(\d+)/.exec(s.slice(0, 3000));
  const cp = /\\ansicpg(\d+)/.exec(s.slice(0, 3000));
  return { charset, deff: d ? Number(d[1]) : 0, kodeHalaman: cp ? Number(cp[1]) : 1252 };
}

export function tampakRtfBerkas(s: string): boolean {
  return /^\s*\{\\rtf\d/.test(s.slice(0, 200));
}

/** Urai satu berkas RTF (string latin1: satu bita satu aksara). */
export function uraiRtf(s: string): DokumenRtf {
  if (!tampakRtfBerkas(s)) return { paragraf: [], tetap: [], sebabDokumen: "Berkas ini bukan RTF, jadi tidak dapat disunting di sini.", panjang: s.length };
  const fon = bacaFon(s);
  if (fon.kodeHalaman !== 1252) {
    // Tetap diurai untuk dibaca, tetapi tiap paragraf yang memuat huruf non-ASCII terkunci (lihat uraiRentang).
  }
  const r = uraiRentang(s, 0, s.length, { ekstrak: false, bentuk: false, charset: fon.charset, deff: fon.deff, kodeHalaman: fon.kodeHalaman });
  return { paragraf: r.paragraf, tetap: r.tetap, sebabDokumen: "", panjang: s.length };
}

// ---------------------------------------------------------------------------------------------------------------
// Penulisan
// ---------------------------------------------------------------------------------------------------------------

const BALIK_CP1252: Map<string, number> = (() => {
  const m = new Map<string, number>();
  for (const [kode, ch] of Object.entries(CP1252)) m.set(ch, Number(kode));
  return m;
})();

/** Aksara -> RTF. `nonAnsi`: konteks fon khusus (semua di luar ASCII ditulis \uN?). `uc`: jumlah aksara cadangan. */
export function kodeTeks(teks: string, nonAnsi = false, uc = 1): string {
  let h = "";
  for (let i = 0; i < teks.length; i += 1) {
    const c = teks[i];
    const kode = teks.charCodeAt(i);
    if (c === "\\") h += "\\\\";
    else if (c === "{") h += "\\{";
    else if (c === "}") h += "\\}";
    else if (c === "\t") h += "\\tab ";
    else if (c === "\n") h += "\\line ";
    else if (c === PEMISAH_PARAGRAF) h += "\\par ";
    else if (c === " ") h += "\\~";
    else if (kode >= 0x20 && kode < 0x7f) h += c;
    else if (kode >= 0x80) {
      const cp = !nonAnsi ? (kode >= 0xa0 && kode <= 0xff ? kode : BALIK_CP1252.get(c)) : undefined;
      if (cp !== undefined) h += `\\'${cp.toString(16).padStart(2, "0")}`;
      else h += `\\u${kode > 32767 ? kode - 65536 : kode}${uc > 0 ? "?".repeat(uc) : " "}`;
    }
    // aksara kendali lain dibuang
  }
  return h;
}

export type Suntingan = { indeks: number; teks: string };

export type HasilTulis = { ok: true; rtf: string; diubah: number; dihapus: number; dipecah: number } | { ok: false; sebab: string };

type Tambal = { s: number; e: number; ins: string };

const SEBAB_TABEL = "Paragraf di dalam tabel hanya boleh diubah teksnya; menambah atau menghapus baris paragraf di sel dikunci agar tabelnya tidak bergeser.";

/** Teks paragraf yang dibersihkan dari aksara yang tidak boleh diketik. */
function bersihkanTeks(t: string): string {
  let h = "";
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    const k = t.charCodeAt(i);
    if (c === AKSARA_KOTAK || c === PEMISAH_PARAGRAF || c === "\n" || c === "\t") h += c;
    else if (c === "\r") continue;
    else if (k < 0x20 || k === 0x7f) continue;
    else h += c;
  }
  return h;
}

type KelompokUbah = { a0: number; a1: number; ins: string };

/** Beda aksara -> kelompok ganti [a0,a1) dengan ins; kelompok yang dipisah <= 2 aksara digabung. */
function kelompokBeda(lama: string, baru: string): KelompokUbah[] {
  const ops = bedaTeks(lama, baru);
  const k: KelompokUbah[] = [];
  let tunda: KelompokUbah | null = null;
  const sedia = () => tunda ?? (tunda = { a0: -1, a1: -1, ins: "" });
  for (const op of ops) {
    if (op.t === "=") {
      if (tunda) {
        k.push(tunda);
        tunda = null;
      }
      continue;
    }
    const g = sedia();
    if (g.a0 < 0) {
      g.a0 = op.a;
      g.a1 = op.a;
    }
    if (op.t === "-") g.a1 = op.a + op.n;
    else g.ins += baru.slice(op.b, op.b + op.n);
  }
  if (tunda) k.push(tunda);
  // Tiap op "-"/"+" bergantian membentuk satu kelompok sampai bertemu "=": di atas sudah begitu. Gabungkan yang rapat.
  const gabung: KelompokUbah[] = [];
  for (const g of k) {
    const sebelum = gabung[gabung.length - 1];
    if (sebelum) {
      const celah = lama.slice(sebelum.a1, g.a0);
      if (celah.length <= 2 && !celah.includes(AKSARA_KOTAK) && !celah.includes(PEMISAH_PARAGRAF)) {
        sebelum.ins += celah + g.ins;
        sebelum.a1 = g.a1;
        continue;
      }
    }
    gabung.push({ ...g });
  }
  return gabung;
}

function kerangkaNormal(s: string, p: Paragraf[]): string {
  const rentang: Array<[number, number]> = [];
  for (const q of p) for (let i = 0; i < q.s.length; i += 1) if (q.teks[i] !== AKSARA_KOTAK) rentang.push([q.s[i], q.e[i]]);
  rentang.sort((x, y) => x[0] - y[0]);
  let h = "";
  let dari = 0;
  for (const [a, b] of rentang) {
    if (a < dari) continue;
    h += s.slice(dari, a);
    dari = b;
  }
  h += s.slice(dari);
  return h
    .replace(/[\r\n]/g, "")
    .replace(/(\\[A-Za-z]+-?\d*) /g, "$1")
    .replace(/\\par(?![A-Za-z])/g, "");
}

/** Paragraf berikutnya mulai dengan \pard? (syarat aman membuang \par paragraf kosong) */
function berikutnyaPard(s: string, dari: number): boolean {
  let j = dari;
  while (j < s.length && (s[j] === "\r" || s[j] === "\n" || s[j] === " ")) j += 1;
  return s.startsWith("\\pard", j) && !huruf(s[j + 5]);
}

export type OpsiTulis = { hapus?: number[] };

/**
 * Terapkan suntingan teks (dan penghapusan paragraf) ke RTF. `doc` = hasil uraiRtf(s) atas `s` yang sama.
 * Paragraf yang tidak disebut tidak disentuh sedikit pun.
 */
export function terapkanSuntingan(s: string, doc: DokumenRtf, suntingan: Suntingan[], opsi: OpsiTulis = {}): HasilTulis {
  if (doc.sebabDokumen) return { ok: false, sebab: doc.sebabDokumen };
  const tambal: Tambal[] = [];
  /** Teks yang diharapkan tiap paragraf setelah penulisan, sesuai urutan baru. */
  const harapan: Array<{ dari: number; teks: string[] }> = [];
  const hapusSet = new Set(opsi.hapus ?? []);
  const sunting = new Map<number, string>();
  for (const x of suntingan) {
    if (!Number.isInteger(x.indeks) || x.indeks < 0 || x.indeks >= doc.paragraf.length) return { ok: false, sebab: "Ada paragraf yang tidak dikenal. Muat ulang blangko lalu coba lagi." };
    if (sunting.has(x.indeks)) return { ok: false, sebab: "Satu paragraf dikirim dua kali." };
    sunting.set(x.indeks, bersihkanTeks(String(x.teks ?? "")));
  }
  for (const h of hapusSet) {
    if (!Number.isInteger(h) || h < 0 || h >= doc.paragraf.length) return { ok: false, sebab: "Ada paragraf yang tidak dikenal. Muat ulang blangko lalu coba lagi." };
    if (sunting.has(h)) return { ok: false, sebab: "Paragraf yang dihapus tidak boleh sekaligus diubah." };
  }
  let diubah = 0;
  let dihapus = 0;
  let dipecah = 0;

  for (const p of doc.paragraf) {
    const baru = sunting.get(p.indeks);
    const hapus = hapusSet.has(p.indeks);
    if (!hapus && (baru === undefined || baru === p.teks)) {
      harapan.push({ dari: p.indeks, teks: [p.teks] });
      continue;
    }
    if (p.terkunci) return { ok: false, sebab: `Paragraf ${p.indeks + 1} terkunci. ${p.terkunci}` };
    if (hapus) {
      if (p.kotak.length) return { ok: false, sebab: `Paragraf ${p.indeks + 1} memuat ${p.kotak[0].label.toLowerCase()} yang terkunci, jadi tidak dapat dihapus.` };
      if (p.tabel) return { ok: false, sebab: SEBAB_TABEL };
      for (let i = 0; i < p.s.length; i += 1) tambal.push({ s: p.s[i], e: p.e[i], ins: "" });
      const t = p.terminator;
      if (t && t.nama === "par" && berikutnyaPard(s, t.e)) {
        tambal.push({ s: t.s, e: t.e, ins: "" });
        harapan.push({ dari: p.indeks, teks: [] });
      } else harapan.push({ dari: p.indeks, teks: [""] });
      dihapus += 1;
      continue;
    }
    const teksBaru = baru as string;
    if (p.tabel && teksBaru.includes(PEMISAH_PARAGRAF)) return { ok: false, sebab: SEBAB_TABEL };
    // Kotak terkunci harus tetap ada, sama banyak.
    const banyakKotak = (teksBaru.match(/￼/g) ?? []).length;
    if (banyakKotak !== p.kotak.length) {
      const nama = p.kotak[0]?.label.toLowerCase() ?? "kotak";
      return { ok: false, sebab: `Paragraf ${p.indeks + 1}: ${nama} terkunci, tidak dapat ditambah atau dihapus.` };
    }
    const grup = kelompokBeda(p.teks, teksBaru);
    for (const g of grup) {
      for (let i = g.a0; i < g.a1; i += 1) if (p.teks[i] === AKSARA_KOTAK) return { ok: false, sebab: `Paragraf ${p.indeks + 1}: ${p.kotak[p.atomPos.indexOf(i)]?.label.toLowerCase() ?? "kotak"} terkunci, tidak dapat dihapus atau dipindah.` };
    }
    for (const g of grup) {
      const nonAnsi = (i: number) => (p.st[i] & B_NONANSI) !== 0;
      const ucDi = (i: number) => (p.st[i] >> GESER_UC) & 7;
      if (g.a1 > g.a0) {
        // Penggantian: sisipan ikut gaya aksara pertama yang diganti.
        const pertama = g.a0;
        const kode = g.ins ? kodeTeks(g.ins, nonAnsi(pertama), ucDi(pertama)) : "";
        tambal.push({ s: p.s[pertama], e: p.e[pertama], ins: kode });
        for (let i = pertama + 1; i < g.a1; i += 1) tambal.push({ s: p.s[i], e: p.e[i], ins: "" });
      } else {
        const i = g.a0;
        let at: number;
        let gayaDi: number;
        if (i > 0 && p.teks[i - 1] !== AKSARA_KOTAK) {
          at = p.e[i - 1];
          gayaDi = i - 1;
        } else if (i < p.teks.length && p.teks[i] !== AKSARA_KOTAK) {
          at = p.s[i];
          gayaDi = i;
        } else if (i > 0) {
          at = p.e[i - 1];
          gayaDi = i - 1;
        } else if (i < p.teks.length) {
          at = p.s[i];
          gayaDi = i;
        } else {
          at = p.titik;
          gayaDi = -1;
        }
        const nA = gayaDi >= 0 ? nonAnsi(gayaDi) : false;
        const u = gayaDi >= 0 ? ucDi(gayaDi) : 1;
        tambal.push({ s: at, e: at, ins: kodeTeks(g.ins, nA, u) });
      }
    }
    const bagian = teksBaru.split(PEMISAH_PARAGRAF);
    dipecah += bagian.length - 1;
    harapan.push({ dari: p.indeks, teks: bagian });
    diubah += 1;
  }

  // Urutkan dan gabungkan tambalan yang bersentuhan; jaga pembatas kata kendali.
  tambal.sort((x, y) => x.s - y.s || x.e - y.e);
  const bersih: Tambal[] = [];
  for (const t of tambal) {
    const sebelum = bersih[bersih.length - 1];
    if (sebelum && t.s < sebelum.e) return { ok: false, sebab: "Dua perubahan bertumpuk. Simpan lebih dulu, lalu ubah lagi." };
    if (sebelum && t.s === sebelum.e) {
      sebelum.e = t.e;
      sebelum.ins += t.ins;
    } else bersih.push({ ...t });
  }
  let keluar = "";
  let dari = 0;
  for (const t of bersih) {
    let ins = t.ins;
    let berikut = ins.charAt(0);
    if (!ins) {
      let j = t.e;
      while (j < s.length && (s[j] === "\r" || s[j] === "\n")) j += 1;
      berikut = s.charAt(j);
    }
    if (berikut && (huruf(berikut) || angka(berikut) || berikut === "-" || berikut === " ") && /\\[A-Za-z]+-?\d*$/.test(s.slice(Math.max(0, t.s - 40), t.s))) ins = ` ${ins}`;
    keluar += s.slice(dari, t.s) + ins;
    dari = t.e;
  }
  keluar += s.slice(dari);

  // ---- Pemeriksa: urai ulang ------------------------------------------------------------------------------------
  const baruDoc = uraiRtf(keluar);
  const diharap: string[] = [];
  for (const h of harapan) diharap.push(...h.teks);
  if (baruDoc.paragraf.length !== diharap.length) return { ok: false, sebab: "Hasil penulisan tidak sama dengan yang diketik (jumlah paragraf). Tidak ada yang disimpan." };
  for (let i = 0; i < diharap.length; i += 1) {
    if (baruDoc.paragraf[i].teks !== diharap[i]) return { ok: false, sebab: `Hasil penulisan tidak sama dengan yang diketik (paragraf ${i + 1}). Tidak ada yang disimpan.` };
  }
  if (kerangkaNormal(s, doc.paragraf) !== kerangkaNormal(keluar, baruDoc.paragraf)) {
    return { ok: false, sebab: "Perubahan ini menyentuh bagian berkas selain teks, jadi tidak ditulis. Tidak ada yang disimpan." };
  }
  if (JSON.stringify(baruDoc.tetap) !== JSON.stringify(doc.tetap)) return { ok: false, sebab: "Perubahan ini menyentuh kepala atau kaki halaman, jadi tidak ditulis. Tidak ada yang disimpan." };
  return { ok: true, rtf: keluar, diubah, dihapus, dipecah };
}

// ---------------------------------------------------------------------------------------------------------------
// Isian
// ---------------------------------------------------------------------------------------------------------------

export const POLA_ISIAN = /#(\d{3,5})#/g;

export type BagianTeks =
  | { j: "teks"; t: string; g: number }
  /** `no` dibakukan empat angka; `r` = angka seperti tertulis di berkas (agar tidak berubah bila paragraf disunting). */
  | { j: "isian"; no: string; r: string; g: number }
  | { j: "kotak"; label: string; jenis: JenisKotak };

/** Potong teks paragraf menjadi bagian: teks bergaya, isian (#NNNN#), dan kotak terkunci. */
export function bagianParagraf(p: Paragraf): BagianTeks[] {
  const hasil: BagianTeks[] = [];
  const t = p.teks;
  const gaya = (i: number) => (i < p.st.length ? p.st[i] & (B_TEBAL | B_MIRING | B_GARIS) : 0);
  const dorongTeks = (str: string, g: number) => {
    if (!str) return;
    const akhir = hasil[hasil.length - 1];
    if (akhir && akhir.j === "teks" && akhir.g === g) akhir.t += str;
    else hasil.push({ j: "teks", t: str, g });
  };
  let i = 0;
  let kotakKe = 0;
  const isian = new RegExp(POLA_ISIAN.source, "g");
  while (i < t.length) {
    if (t[i] === AKSARA_KOTAK) {
      const kt = p.kotak[kotakKe++];
      hasil.push({ j: "kotak", label: kt?.label ?? "Bagian terkunci", jenis: kt?.jenis ?? "lain" });
      i += 1;
      continue;
    }
    isian.lastIndex = i;
    const m = isian.exec(t);
    if (m && m.index === i) {
      hasil.push({ j: "isian", no: m[1].padStart(4, "0"), r: m[1], g: gaya(i) });
      i += m[0].length;
      continue;
    }
    // Teks biasa sampai penanda/kotak berikutnya, per gaya.
    let j = i;
    const g = gaya(i);
    while (j < t.length && t[j] !== AKSARA_KOTAK && gaya(j) === g) {
      if (t[j] === "#") {
        isian.lastIndex = j;
        const n = isian.exec(t);
        if (n && n.index === j) break;
      }
      j += 1;
    }
    if (j === i) j = i + 1;
    dorongTeks(t.slice(i, j), g);
    i = j;
  }
  return hasil;
}

export const GAYA = { tebal: B_TEBAL, miring: B_MIRING, garis: B_GARIS };

/** Nomor isian (empat angka) yang dipakai di teks. */
export function nomorIsianDi(teks: string): string[] {
  const hasil: string[] = [];
  const re = new RegExp(POLA_ISIAN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(teks))) {
    const no = m[1].padStart(4, "0");
    if (!hasil.includes(no)) hasil.push(no);
  }
  return hasil;
}
