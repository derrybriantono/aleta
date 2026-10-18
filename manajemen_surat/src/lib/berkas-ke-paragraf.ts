/**
 * ============================================================================
 * BERKAS -> PARAGRAF, DI PERAMBAN (18 Okt 2026)
 * ============================================================================
 *
 * Membaca RTF, DOCX, PDF, atau TXT menjadi daftar paragraf dengan pembaca yang
 * SAMA dengan deteksi sisa blangko (lib/deteksi-sisa-blangko.ts), sehingga
 * grup tersembunyi RTF ({\*\isianasal ...}) dibuang dan tulisan merah tetap
 * diketahui. Dipakai penyusun perintah AI untuk (a) putusan hasil ABT yang
 * masih berisi kekosongan dan (b) contoh format putusan.
 *
 * Tidak ada yang dikirim ke server dan tidak ada yang disimpan; .doc biner
 * lama tidak terbaca (disebut terus terang).
 */

import {
  ambilDariZip,
  bacaDocxXml,
  bacaRtfParagraf,
  kenaliBentuk,
  paragrafDariTeks,
  type BentukBerkas,
  type Paragraf,
} from "@/lib/deteksi-sisa-blangko";

export const BATAS_BERKAS_BYTE = 20 * 1024 * 1024;

export type HasilBacaBerkas =
  | { ok: true; bentuk: BentukBerkas; paragraf: Paragraf[] }
  | { ok: false; bentuk: BentukBerkas; alasan: string };

export async function bacaParagrafBerkas(
  bitaMasuk: Uint8Array | ArrayBuffer,
  nama: string,
  bacaPdf?: (bita: Uint8Array) => Promise<Paragraf[]>
): Promise<HasilBacaBerkas> {
  try {
    const bita = bitaMasuk instanceof Uint8Array ? bitaMasuk : new Uint8Array(bitaMasuk);
    if (!bita.length) return { ok: false, bentuk: "lain", alasan: "Berkasnya kosong." };
    if (bita.length > BATAS_BERKAS_BYTE) return { ok: false, bentuk: "lain", alasan: "Berkas terlalu besar (maksimal 20 MB)." };
    const bentuk = kenaliBentuk(bita, nama);
    if (bentuk === "rtf") {
      return { ok: true, bentuk, paragraf: bacaRtfParagraf(new TextDecoder("windows-1252").decode(bita)) };
    }
    if (bentuk === "docx") {
      const xml = await ambilDariZip(bita, "word/document.xml");
      if (!xml) return { ok: false, bentuk, alasan: "Isi DOCX tidak dapat dibuka." };
      return { ok: true, bentuk, paragraf: bacaDocxXml(new TextDecoder("utf-8").decode(xml)) };
    }
    if (bentuk === "teks") return { ok: true, bentuk, paragraf: paragrafDariTeks(new TextDecoder("utf-8").decode(bita)) };
    if (bentuk === "pdf") {
      if (!bacaPdf) return { ok: false, bentuk, alasan: "Pembaca PDF tidak tersedia." };
      return { ok: true, bentuk, paragraf: await bacaPdf(bita) };
    }
    return { ok: false, bentuk, alasan: "Jenis berkas ini tidak terbaca. Gunakan RTF, DOCX, PDF, atau TXT (.doc lama: simpan dulu sebagai RTF)." };
  } catch {
    return { ok: false, bentuk: "lain", alasan: "Berkas tidak dapat dibaca." };
  }
}

/** Seluruh teks paragraf, satu paragraf per baris. */
export function teksDariParagraf(paragraf: Paragraf[]): string {
  return paragraf.map((p) => p.teks).join("\n");
}
