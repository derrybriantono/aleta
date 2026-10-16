/**
 * ============================================================================
 * NASKAH HASIL MEDIASI MENJADI RTF - TANPA PUSTAKA
 * ============================================================================
 *
 * Blok dari susunNaskah (lib/hasil-mediasi.ts) ditulis sebagai RTF yang
 * dibuka Word dan WPS apa adanya. Tata halamannya meniru contoh satker
 * (371_Pdt.G_2025_PA.Dgl - Laporan Mediasi Berhasil Sebagian.rtf):
 *
 *   A4 tegak 11906 x 16838 twip, kiri 1701 (3 cm), kanan/atas/bawah 1134
 *   (2 cm), Arial 12, spasi 1,5 (\sl360\slmult1); lembar Jadwal Mediasi
 *   pada seksi LANSKAP sendiri, sama dengan contohnya.
 *
 * ============================================================================
 * PENYANDIAN - SUPAYA "MUT’AH" DAN "Rp" TAMPIL BENAR DI WORD
 * ============================================================================
 *
 * Berkasnya ASCII murni. Huruf di luar ASCII ditulis dua kali:
 *
 *   \u8217\'92   pembaca Unicode memakai \u8217 (’) lalu MELEWATI satu
 *                aksara cadangan (\uc1); pembaca lama yang hanya mengenal
 *                laman kode 1252 membaca \'92 - yang juga ’.
 *
 * Aksara yang tidak punya padanan 1252 memakai cadangan "?" - lebih baik
 * tanda tanya daripada huruf yang salah diam-diam. \ { } selalu dilarikan.
 */

import type { Blok } from "@/lib/hasil-mediasi";

/** Padanan laman kode 1252 untuk 0x80-0x9F - kebalikan peta di baca-rtf.ts. */
const KE_CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function hex2(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/** Teks biasa -> potongan RTF yang aman. */
export function lariRtf(teks: string): string {
  let hasil = "";
  for (const huruf of String(teks ?? "")) {
    const kode = huruf.codePointAt(0) ?? 0;
    if (huruf === "\\" || huruf === "{" || huruf === "}") {
      hasil += `\\${huruf}`;
      continue;
    }
    if (huruf === "\t") {
      hasil += "\\tab ";
      continue;
    }
    if (huruf === "\n") {
      hasil += "\\line ";
      continue;
    }
    if (kode < 0x20) continue;
    if (kode < 0x80) {
      hasil += huruf;
      continue;
    }
    if (kode <= 0xff && kode >= 0xa0) {
      // Latin-1: sama di 1252 - cukup \'xx, tanpa \u.
      hasil += `\\'${hex2(kode)}`;
      continue;
    }
    if (kode > 0xffff) {
      // Di luar BMP - dua unit UTF-16, masing-masing bertanda.
      for (const unit of [huruf.charCodeAt(0), huruf.charCodeAt(1)]) {
        hasil += `\\u${unit > 0x7fff ? unit - 0x10000 : unit}?`;
      }
      continue;
    }
    const cadangan = KE_CP1252[kode];
    const n = kode > 0x7fff ? kode - 0x10000 : kode;
    hasil += cadangan !== undefined ? `\\u${n}\\'${hex2(cadangan)}` : `\\u${n}?`;
  }
  return hasil;
}

// Tata halaman contoh 371.
const HALAMAN_TEGAK = "\\paperw11906\\paperh16838\\margl1701\\margr1134\\margt1134\\margb1134";
const SEKSI_TEGAK = "\\sectd\\pgwsxn11906\\pghsxn16838\\marglsxn1701\\margrsxn1134\\margtsxn1134\\margbsxn1134";
const SEKSI_LANSKAP = "\\sectd\\lndscpsxn\\pgwsxn16838\\pghsxn11906\\marglsxn1134\\margrsxn1134\\margtsxn1134\\margbsxn1134";
/** Lebar isi tegak: 11906 - 1701 - 1134. */
const LEBAR_TEGAK = 9071;
/** Lebar isi lanskap: 16838 - 1134 - 1134. */
const LEBAR_LANSKAP = 14570;
const HURUF = "\\f0\\fs24";
const SPASI = "\\sl360\\slmult1";

function rata(r: "kiri" | "tengah" | "kanan" | "penuh" | undefined): string {
  switch (r) {
    case "kiri":
      return "\\ql";
    case "tengah":
      return "\\qc";
    case "kanan":
      return "\\qr";
    default:
      return "\\qj";
  }
}

/** Satu sel teks - baris kosong di dalam sel dipisah \line. */
function isiSel(baris: string[]): string {
  return baris.map((b) => lariRtf(b)).join("\\line ");
}

function tabelTtd(kiri: string[], kanan: string[], lebar: number): string {
  const separuh = Math.round(lebar / 2);
  return (
    `\\trowd\\trgaph108\\trleft0\\trqc` +
    `\\clvertalt\\cellx${separuh}\\clvertalt\\cellx${lebar}\n` +
    `\\pard\\intbl\\qc${HURUF} ${isiSel(kiri)}\\cell` +
    `\\pard\\intbl\\qc${HURUF} ${isiSel(kanan)}\\cell\\row\n`
  );
}

function tabelBergaris(kepala: string[], lebar: number[], baris: string[][]): string {
  const garis = "\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10";
  let x = 0;
  const batas = lebar.map((l) => (x += l));
  const definisi = (atasTebal: boolean) =>
    `\\trowd\\trgaph80\\trleft0\\trqc${atasTebal ? "\\trhdr" : ""}` +
    batas.map((b) => `${garis}\\clvertalc\\cellx${b}`).join("") +
    "\n";
  const satuBaris = (sel: string[], tebal: boolean) =>
    definisi(tebal) +
    sel.map((s) => `\\pard\\intbl\\qc\\f0\\fs20 ${tebal ? "{\\b " : ""}${lariRtf(s)}${tebal ? "}" : ""}\\cell`).join("") +
    "\\row\n";
  return satuBaris(kepala, true) + baris.map((b) => satuBaris(b, false)).join("");
}

/** Blok naskah -> RTF utuh. */
export function naskahKeRtf(blok: Blok[]): string {
  const keluar: string[] = [];
  keluar.push(
    "{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1\\deflang1057",
    "{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}{\\f1\\froman\\fcharset0 Times New Roman;}}",
    "{\\colortbl;\\red0\\green0\\blue0;}",
    // Tanpa {\author ALETA}: laporan ini dapat diunggah petugas ke SIPP (keputusan 17 Okt butir 45).
    "{\\info{\\title Laporan Mediasi}}",
    `${HALAMAN_TEGAK}\\widowctrl\\ftnbj\\viewkind1`,
    SEKSI_TEGAK
  );

  let halamanBaru = false;
  // Lebar isi seksi yang sedang ditulis - tabel tanda tangan mengikutinya.
  let lebarIsi = LEBAR_TEGAK;
  for (const b of blok) {
    switch (b.jenis) {
      case "judul":
        // \pagebb: paragraf ini memulai halaman baru - tanpa paragraf kosong
        // di puncak halaman yang \page tinggalkan.
        keluar.push(
          `\\pard\\plain${b.halamanBaru ? "\\pagebb" : ""}\\qc${SPASI}${HURUF} {\\b ${b.garisBawah ? "\\ul " : ""}${lariRtf(b.teks)}}\\par`
        );
        break;
      case "paragraf":
        keluar.push(
          `\\pard\\plain${rata(b.rata)}${SPASI}${b.menjorok ? "\\fi720" : ""}${HURUF} ${b.tebal ? "{\\b " : ""}${lariRtf(b.teks)}${b.tebal ? "}" : ""}\\par`
        );
        break;
      case "butir": {
        const kiri = 567 * ((b.lekuk ?? 0) + 1);
        keluar.push(`\\pard\\plain\\qj${SPASI}\\li${kiri}\\fi-567\\tx${kiri}${HURUF} ${lariRtf(b.nomor)}\\tab ${lariRtf(b.teks)}\\par`);
        break;
      }
      case "kosong":
        keluar.push(`\\pard\\plain${SPASI}${HURUF}\\par`);
        break;
      case "ttd":
        keluar.push(tabelTtd(b.kiri, b.kanan, lebarIsi));
        keluar.push(`\\pard\\plain${HURUF}`);
        break;
      case "seksi-lanskap":
        // \sect menutup seksi tegak; seksi baru bermula lanskap pada halaman baru.
        keluar.push(`\\sect${SEKSI_LANSKAP}\\sbkpage`);
        lebarIsi = LEBAR_LANSKAP;
        break;
      case "tabel":
        keluar.push(tabelBergaris(b.kepala, b.lebar, b.baris));
        keluar.push(`\\pard\\plain${HURUF}`);
        break;
    }
  }
  // Paragraf penutup: Word menuntut paragraf sesudah tabel terakhir.
  keluar.push(`\\pard\\plain${HURUF}\\par`, "}");
  return keluar.join("\n");
}

/** RTF -> bita ASCII untuk diunduh. Seluruh aksaranya sudah ASCII. */
export function rtfKeBita(rtf: string): Uint8Array<ArrayBuffer> {
  const hasil = new Uint8Array(new ArrayBuffer(rtf.length));
  for (let i = 0; i < rtf.length; i += 1) {
    const k = rtf.charCodeAt(i);
    hasil[i] = k < 0x80 ? k : 0x3f;
  }
  return hasil;
}
