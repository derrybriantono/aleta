import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * PEMBACAAN BERKAS PDF - menjadi teks yang dapat dicari dan dikutip halamannya.
 *
 * ============================================================================
 * NOMOR HALAMAN IKUT, DAN ITU BUKAN HIASAN
 * ============================================================================
 *
 * Pedoman Badilag dirujuk di ruang sidang dengan menyebut halamannya. Teks
 * yang dapat dicari tetapi tidak dapat disebut halamannya memaksa yang
 * memakainya membuka berkas aslinya lagi untuk menemukan tempatnya - lalu
 * pencariannya tidak menghemat apa pun.
 *
 * Karena itu teks disimpan PER HALAMAN, bukan sebagai satu naskah panjang.
 *
 * ============================================================================
 * PDF-NYA DIGITAL, BUKAN PINDAIAN
 * ============================================================================
 *
 * Sudah diperiksa pada berkas sungguhan: Pedoman Penyusunan BAS & Putusan
 * memuat 393 rujukan huruf dan hanya 12 gambar - ia berlapis teks. Karena itu
 * pembacaannya cukup penguraian, tanpa pengenalan tulisan.
 *
 * Bila kelak ada berkas yang benar-benar pindaian, ia akan menghasilkan
 * halaman kosong - dan itu DILAPORKAN sebagai halaman tanpa teks, bukan
 * dibiarkan terbaca sebagai dokumen yang isinya memang kosong.
 */

export type HalamanPdf = {
  nomor: number;
  teks: string;
};

export type IsiPdf = {
  ada: boolean;
  sebab: string;
  berkas: string;
  jumlahHalaman: number;
  /** Halaman yang terurai tanpa satu pun huruf - petunjuk berkas pindaian. */
  halamanKosong: number[];
  halaman: HalamanPdf[];
};

/**
 * Rintisan DOMMatrix, ImageData, dan Path2D untuk pdfjs di Node.
 *
 * pdfjs menyentuh nama-nama ini saat dimuat meskipun penguraian TEKS tidak
 * memakai satu pun di antaranya - ketiganya untuk menggambar. Tanpa rintisan,
 * yang muncul adalah "DOMMatrix is not defined", galat yang sama sekali tidak
 * menyebut sebab yang sesungguhnya dan mengirim yang membacanya mencari
 * kerusakan pada PDF-nya.
 *
 * Sengaja tidak memakai paket canvas: ia menuntut penyusunan asli saat
 * pemasangan, dan wadah ini tidak punya penyusunnya.
 */
function pasangRintisanPeramban() {
  const lingkup = globalThis as Record<string, unknown>;

  if (!lingkup.DOMMatrix) {
    lingkup.DOMMatrix = class {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      constructor(nilai?: number[]) {
        if (Array.isArray(nilai) && nilai.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = nilai;
        }
      }
      multiply() {
        return this;
      }
      invertSelf() {
        return this;
      }
      translate() {
        return this;
      }
      scale() {
        return this;
      }
    };
  }

  if (!lingkup.ImageData) {
    lingkup.ImageData = class {
      width: number;
      height: number;
      constructor(width = 0, height = 0) {
        this.width = width;
        this.height = height;
      }
    };
  }

  if (!lingkup.Path2D) lingkup.Path2D = class {};
}

function kosong(berkas: string, sebab: string): IsiPdf {
  return { ada: false, sebab, berkas, jumlahHalaman: 0, halamanKosong: [], halaman: [] };
}

/**
 * Menyusun potongan teks satu halaman menjadi baris yang terbaca.
 *
 * pdfjs mengembalikan potongan beserta letaknya. Menyambungnya begitu saja
 * menghasilkan satu baris panjang tanpa jeda kalimat; menyambungnya dengan
 * spasi menghasilkan kata yang terpotong di tengah. Yang dipakai: penanda
 * hasEOL dari pdfjs sendiri untuk pindah baris, dan jarak mendatar untuk
 * memutuskan perlu spasi atau tidak.
 */
type PotonganTeks = { str: string; hasEOL?: boolean };

export function satukanPotongan(potongan: PotonganTeks[]): string {
  let hasil = "";
  for (const bagian of potongan) {
    const teks = String(bagian?.str ?? "");
    if (teks) {
      const perluSpasi = hasil.length > 0 && !hasil.endsWith(" ") && !hasil.endsWith("\n") && !teks.startsWith(" ");
      hasil += perluSpasi ? ` ${teks}` : teks;
    }
    if (bagian?.hasEOL) hasil += "\n";
  }
  return hasil.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Membaca satu berkas PDF menjadi teks per halaman.
 *
 * Jalur harus SUDAH dijaga pemanggilnya - fungsi ini tidak menebak akar mana
 * yang boleh dibaca. Penjagaan yang tersebar di dua tempat meninggalkan celah
 * di antaranya, dan masing-masing mengira yang lain sudah menutupnya.
 */
export async function bacaPdf(jalur: string, batasHalaman = 500): Promise<IsiPdf> {
  const berkas = path.basename(jalur);

  let data: Buffer;
  try {
    data = await readFile(jalur);
  } catch (galat) {
    const kode = (galat as NodeJS.ErrnoException)?.code;
    return kosong(berkas, kode === "ENOENT" ? "Berkas tidak ditemukan." : "Berkas tidak terbaca.");
  }

  try {
    pasangRintisanPeramban();

    // Bangunan "legacy" yang dipakai - bangunan biasa mengandaikan peramban
    // dan gagal di Node dengan galat yang menyebut DOMMatrix, bukan menyebut
    // sebab yang sesungguhnya.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const dokumen = await pdfjs.getDocument({
      data: new Uint8Array(data),
      // Tanpa berkas peta huruf dan tanpa pekerja: keduanya menuntut berkas
      // pendamping yang tidak ikut terpasang pada wadah, dan ketiadaannya
      // memunculkan galat yang tidak berhubungan dengan isi PDF-nya.
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;

    const jumlahHalaman = dokumen.numPages;
    const halaman: HalamanPdf[] = [];
    const halamanKosong: number[] = [];

    for (let nomor = 1; nomor <= Math.min(jumlahHalaman, batasHalaman); nomor += 1) {
      const isi = await dokumen.getPage(nomor);
      const potongan = await isi.getTextContent();
      const teks = satukanPotongan((potongan.items ?? []) as PotonganTeks[]);
      if (!teks) halamanKosong.push(nomor);
      halaman.push({ nomor, teks });
    }

    await dokumen.destroy();

    return { ada: true, sebab: "", berkas, jumlahHalaman, halamanKosong, halaman };
  } catch (galat) {
    return kosong(berkas, galat instanceof Error ? galat.message : "PDF tidak dapat diurai.");
  }
}

export type Temuan = {
  halaman: number;
  /** Kalimat di sekitar kata yang dicari, untuk dibaca tanpa membuka berkasnya. */
  kutipan: string;
};

/**
 * Mencari kata di dalam berkas yang sudah dibaca.
 *
 * Pencocokannya sederhana dan tidak peka huruf besar-kecil. Yang dikembalikan
 * KUTIPAN beserta nomor halamannya - bukan sekadar daftar halaman - supaya
 * yang mencari dapat menilai kecocokannya tanpa membuka berkas aslinya.
 */
export function cariDalamPdf(isi: IsiPdf, kata: string, batas = 20): Temuan[] {
  const dicari = String(kata ?? "").trim().toLowerCase();
  if (!dicari) return [];

  const hasil: Temuan[] = [];
  for (const halaman of isi.halaman) {
    const teksKecil = halaman.teks.toLowerCase();
    let dari = 0;
    while (hasil.length < batas) {
      const posisi = teksKecil.indexOf(dicari, dari);
      if (posisi < 0) break;

      const mulai = Math.max(0, posisi - 120);
      const akhir = Math.min(halaman.teks.length, posisi + dicari.length + 160);
      hasil.push({
        halaman: halaman.nomor,
        kutipan:
          (mulai > 0 ? "…" : "") +
          halaman.teks.slice(mulai, akhir).replace(/\s+/g, " ").trim() +
          (akhir < halaman.teks.length ? "…" : ""),
      });
      dari = posisi + dicari.length;
    }
    if (hasil.length >= batas) break;
  }
  return hasil;
}
