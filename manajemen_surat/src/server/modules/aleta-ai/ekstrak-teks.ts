import { bacaBerkas } from "@/server/modules/aleta-ecourt/berkas-gugatan";
import { bacaPdfDariBita } from "@/server/modules/aleta-ecourt/baca-pdf";
import { ApiError } from "@/server/shared/errors";

/**
 * Ekstraksi teks berkas pengetahuan proyek ALETA Ai: PDF, Word (.docx; .doc lama dengan
 * hasil kasar), RTF, Markdown, dan teks biasa. Memakai pembaca yang SUDAH terpasang
 * (pdfjs-dist, pembaca ZIP/DOCX/RTF e-Court); tidak ada pustaka baru. Tidak ada yang
 * ditulis ke disk dan nama berkas tidak pernah dipakai sebagai jalur.
 */

export const BATAS_BERKAS_UNGGAH = 15 * 1024 * 1024;
export const BATAS_TEKS_BERKAS = 3_000_000;
export const JENIS_PENGETAHUAN = ["pdf", "docx", "doc", "rtf", "md", "txt"] as const;
export type JenisPengetahuan = (typeof JENIS_PENGETAHUAN)[number];

export function jenisPengetahuanDariNama(nama: string): JenisPengetahuan | null {
  const akhiran = String(nama ?? "").toLowerCase().split(".").pop() ?? "";
  if (akhiran === "markdown") return "md";
  if (akhiran === "csv" || akhiran === "json" || akhiran === "text") return "txt";
  return (JENIS_PENGETAHUAN as readonly string[]).includes(akhiran) ? (akhiran as JenisPengetahuan) : null;
}

function teksUtf8(b: Buffer): string {
  // Bukan UTF-8 yang sah (mis. Windows-1252 dari Word lama): baca sebagai Windows-1252 agar huruf beraksen tidak rusak.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b).replace(/^\ufeff/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(b);
  }
}

export function rapikanTeks(t: string): string {
  return String(t ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/\u0000/g, "")
    .trim();
}

export type HasilEkstrak = { jenis: JenisPengetahuan; teks: string; peringatan: string[] };

/** Menebak bentuk dari kepala berkas; nama berkas hanya petunjuk. */
function bentukAsli(bita: Buffer, jenisNama: JenisPengetahuan): JenisPengetahuan {
  const kepala = bita.subarray(0, 8).toString("latin1");
  if (kepala.startsWith("%PDF")) return "pdf";
  if (kepala.startsWith("PK") && (jenisNama === "doc" || jenisNama === "docx")) return "docx";
  if (kepala.startsWith("{\\rtf")) return "rtf";
  return jenisNama;
}

export async function ekstrakTeksBerkas(nama: string, bita: Buffer): Promise<HasilEkstrak> {
  const jenisNama = jenisPengetahuanDariNama(nama);
  if (!jenisNama) throw new ApiError(400, `Jenis berkas "${nama.slice(0, 80)}" belum didukung. Gunakan PDF, Word (.docx), RTF, Markdown, atau teks.`);
  if (!bita.length) throw new ApiError(400, `Berkas "${nama.slice(0, 80)}" kosong.`);
  if (bita.length > BATAS_BERKAS_UNGGAH) throw new ApiError(413, `Berkas "${nama.slice(0, 80)}" melampaui ${BATAS_BERKAS_UNGGAH / 1024 / 1024} MB.`);
  const jenis = bentukAsli(bita, jenisNama);
  const peringatan: string[] = [];
  let teks = "";

  if (jenis === "md" || jenis === "txt") {
    teks = teksUtf8(bita);
  } else if (jenis === "pdf") {
    const isi = await bacaPdfDariBita(new Uint8Array(bita), nama, 800);
    if (!isi.ada) throw new ApiError(400, `PDF "${nama.slice(0, 80)}" tidak dapat dibaca: ${isi.sebab || "rusak atau terkunci"}.`);
    teks = isi.halaman.map((h) => h.teks).filter((t) => t.trim()).join("\n\n");
    if (!teks.trim()) throw new ApiError(400, `PDF "${nama.slice(0, 80)}" tidak memuat teks (kemungkinan hasil pindai). Simpan sebagai PDF berteks atau kirim berkas Word.`);
    if (isi.halamanKosong.length) peringatan.push(`${isi.halamanKosong.length} halaman PDF tanpa teks (kemungkinan gambar/pindaian) tidak ikut terbaca.`);
    if (isi.jumlahHalaman > 800) peringatan.push("Hanya 800 halaman pertama yang dibaca.");
  } else {
    const hasil = await bacaBerkas(nama.replace(/\.[^.]+$/, `.${jenis}`), bita);
    if (hasil.alasan) throw new ApiError(400, `Berkas "${nama.slice(0, 80)}" tidak dapat dibaca (${hasil.alasan}).`);
    teks = hasil.teks;
    if (hasil.kasar) peringatan.push("Berkas .doc lama terbaca kasar; simpan ulang sebagai .docx bila hasilnya kurang tepat.");
  }

  teks = rapikanTeks(teks);
  if (!teks) throw new ApiError(400, `Berkas "${nama.slice(0, 80)}" tidak memuat teks yang dapat dibaca.`);
  if (teks.length > BATAS_TEKS_BERKAS) {
    teks = teks.slice(0, BATAS_TEKS_BERKAS);
    peringatan.push(`Teks dipotong pada ${BATAS_TEKS_BERKAS.toLocaleString("id-ID")} karakter.`);
  }
  return { jenis, teks, peringatan };
}
