import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import type { AlineaDocx } from "@/lib/docx";

/**
 * Mesin cetak PDF (Tahap 4 - Kemandirian Blangko).
 *
 * ============================================================================
 * SATU SUSUNAN, DUA KELUARAN
 * ============================================================================
 *
 * Alinea yang sama menghasilkan DOCX dan PDF. Dua penyusun terpisah pasti
 * berselisih cepat atau lambat, dan wujud selisihnya adalah PDF yang diunggah
 * ke e-Court berbeda dari DOCX yang ditandatangani - dua dokumen atas satu
 * perkara yang tidak sama bunyinya.
 *
 * ============================================================================
 * HURUF YANG TIDAK DAPAT DICETAK DILAPORKAN, BUKAN DIBUANG DIAM-DIAM
 * ============================================================================
 *
 * Huruf baku PDF hanya memuat abjad Latin. Naskah putusan memuat kaidah fikih
 * berhuruf Arab, dan huruf itu tidak dapat dicetak tanpa menyisipkan berkas
 * huruf tersendiri. Membuangnya diam-diam akan menghasilkan kutipan kitab yang
 * kosong di tengah pertimbangan hukum - dan yang membacanya tidak akan tahu
 * ada yang hilang.
 *
 * Karena itu huruf yang tidak tercetak DIGANTI penanda dan jumlahnya
 * dilaporkan, supaya yang menandatangani tahu persis apa yang belum tampil.
 */

export type HasilPdf = {
  berkas: Buffer;
  jumlahHalaman: number;
  /** Berapa huruf yang tidak dapat dicetak huruf baku - nol berarti utuh. */
  hurufTakTercetak: number;
  /** Alinea yang memuatnya, supaya dapat diperiksa. */
  alineaTerdampak: number[];
};

const UKURAN: Record<string, [number, number]> = {
  // Titik PostScript: 1 inci = 72 titik.
  A4: [595.28, 841.89],
  F4: [609.45, 935.43],
  Letter: [612, 792],
};

function cmKeTitik(cm: number): number {
  return (cm / 2.54) * 72;
}

/**
 * Huruf yang dapat dicetak huruf baku WinAnsi.
 *
 * Diperiksa dengan mencoba mengukurnya: pdf-lib melempar galat untuk huruf di
 * luar sandi yang didukung, dan itulah pemeriksaan yang paling jujur - lebih
 * jujur daripada daftar julat yang harus dijaga tetap cocok.
 */
function dapatDicetak(huruf: PDFFont, karakter: string): boolean {
  try {
    huruf.widthOfTextAtSize(karakter, 12);
    return true;
  } catch {
    return false;
  }
}

function bersihkan(huruf: PDFFont, teks: string): { teks: string; hilang: number } {
  let hasil = "";
  let hilang = 0;
  for (const k of String(teks ?? "")) {
    if (k === "\n" || k === "\r" || k === "\t") {
      hasil += " ";
      continue;
    }
    if (dapatDicetak(huruf, k)) {
      hasil += k;
      continue;
    }
    hilang += 1;
    // Penandanya sengaja ASCII dan sengaja jelek: ia harus dapat dicetak huruf
    // baku (kotak kosong "□" sendiri tidak dapat), dan harus tidak mungkin
    // disangka bagian dari naskah. Tanda tanya tunggal tidak memenuhi syarat
    // kedua - persis itulah yang membuat kerusakan Unicode pada jalur RTF lama
    // luput dari perhatian selama bertahun-tahun.
    hasil += "[?]";
  }
  return { teks: hasil, hilang };
}

/** Memotong satu alinea menjadi baris selebar ruang yang tersedia. */
function pecahBaris(huruf: PDFFont, teks: string, ukuran: number, lebar: number): string[] {
  const kata = teks.split(" ").filter((x) => x.length > 0);
  if (kata.length === 0) return [""];

  const baris: string[] = [];
  let sekarang = "";
  for (const k of kata) {
    const calon = sekarang ? `${sekarang} ${k}` : k;
    if (huruf.widthOfTextAtSize(calon, ukuran) <= lebar || !sekarang) {
      sekarang = calon;
      continue;
    }
    baris.push(sekarang);
    sekarang = k;
  }
  if (sekarang) baris.push(sekarang);
  return baris;
}

export type BerkasPdf = {
  alinea: AlineaDocx[];
  ukuran?: number;
  margin?: [number, number, number, number];
  kertas?: "A4" | "F4" | "Letter";
};

/** Menyusun PDF dari susunan alinea yang sama dengan yang dipakai DOCX. */
export async function buatPdf(berkas: BerkasPdf): Promise<HasilPdf> {
  const dokumen = await PDFDocument.create();
  const biasa = await dokumen.embedFont(StandardFonts.TimesRoman);
  const tebal = await dokumen.embedFont(StandardFonts.TimesRomanBold);

  const [lebarHal, tinggiHal] = UKURAN[berkas.kertas ?? "F4"] ?? UKURAN.F4;
  const [atas, kanan, bawah, kiri] = berkas.margin ?? [2, 2, 2, 3];
  const mAtas = cmKeTitik(atas);
  const mKanan = cmKeTitik(kanan);
  const mBawah = cmKeTitik(bawah);
  const mKiri = cmKeTitik(kiri);

  const ukuran = berkas.ukuran ?? 12;
  const tinggiBaris = ukuran * 1.5;

  let halaman = dokumen.addPage([lebarHal, tinggiHal]);
  let y = tinggiHal - mAtas;
  let jumlahHalaman = 1;
  let hurufTakTercetak = 0;
  const alineaTerdampak: number[] = [];

  const halamanBaru = () => {
    halaman = dokumen.addPage([lebarHal, tinggiHal]);
    y = tinggiHal - mAtas;
    jumlahHalaman += 1;
  };

  for (let i = 0; i < berkas.alinea.length; i += 1) {
    const a = berkas.alinea[i];
    const huruf = a.tebal ? tebal : biasa;
    const jorok = a.jorok ? cmKeTitik(a.jorok) : 0;
    const lebar = lebarHal - mKiri - mKanan - jorok;

    const isiMentah = a.nomor ? `${a.nomor}. ${a.teks}` : a.teks;
    const { teks: isi, hilang } = bersihkan(huruf, isiMentah);
    if (hilang > 0) {
      hurufTakTercetak += hilang;
      alineaTerdampak.push(i);
    }

    for (const baris of pecahBaris(huruf, isi, ukuran, lebar)) {
      if (y - tinggiBaris < mBawah) halamanBaru();

      const lebarBaris = huruf.widthOfTextAtSize(baris, ukuran);
      let x = mKiri + jorok;
      if (a.rata === "tengah") x = (lebarHal - lebarBaris) / 2;
      else if (a.rata === "kanan") x = lebarHal - mKanan - lebarBaris;

      halaman.drawText(baris, { x, y: y - ukuran, size: ukuran, font: huruf, color: rgb(0, 0, 0) });
      y -= tinggiBaris;
    }

    y -= (a.jarakSesudah ?? 6) * 1.33;
  }

  const bita = await dokumen.save();
  return {
    berkas: Buffer.from(bita),
    jumlahHalaman,
    hurufTakTercetak,
    alineaTerdampak,
  };
}
