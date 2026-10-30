import type { KodeKertas } from "@/lib/berkas-perkara";

/**
 * ============================================================================
 * TATA CETAK BLANGKO BERKAS PERKARA (paket ABT sampul-rapi-30okt) - MURNI
 * ============================================================================
 *
 * Permintaan Derry 30 Okt: sampul, lampiran, daftar isi, ceklist dicetak PENUH satu halaman dan rapi. Blangko paket sampul-rapi-30okt memakai
 * margin 1,27 cm kiri-kanan (lebar isi = lebar kertas - 1440 twip) dan menerbitkan tabel dokumen langsung dari ABT lewat variabel berikut;
 * lewat panel, portal menimpa variabel itu dengan penanda lalu menempelkan tabel susunannya sendiri (halaman otomatis, OTO e-Court, alasan).
 * Jumlah baris tabel = baris yang mengisi bidang cetak (diukur atas render Word A4/F4/Legal; sama dengan argumen fungsi ABT di paket).
 */

export const LEBAR_ISI: Readonly<Record<KodeKertas, number>> = { a4: 10466, f4: 10749, legal: 10806 };
/** Tinggi bidang cetak (twip) = tinggi kertas - margin atas 680 - margin bawah 600 (alat/rtf_dasar.py paket). */
export const TINGGI_ISI: Readonly<Record<KodeKertas, number>> = { a4: 15558, f4: 17429, legal: 18903 };
/**
 * Cadangan aman perkiraan tinggi sampul lewat panel (twip): menyerap beda tata letak Word / LibreOffice / WPS terhadap perkiraan lib/tinggi-rtf.ts.
 * Diukur 30 Okt atas render Word perkara terpadat, cerai gugat biasa, dan dispensasi 2 sidang di tiga kertas.
 */
export const CADANGAN_TINGGI = 300;

/** Variabel tabel ABT paket sampul-rapi-30okt, per kertas. */
export const VAR_TABEL_DAFTAR_ISI: Readonly<Record<KodeKertas, string>> = { a4: "11600", f4: "11601", legal: "11602" };
export const VAR_TABEL_CEKLIST: Readonly<Record<KodeKertas, string>> = { a4: "11603", f4: "11604", legal: "11605" };
/** Lampiran sampul cetak awal dari ABT (empat varian x tiga kertas): lewat panel diganti lampiran susunan portal. */
/** Ciri berbingkai ganda sampul cetak awal: ghaib (isian 5807) dan mafqud (5808) tampil lewat variabel ini (kosong = tanpa titik-titik). */
export const VAR_CIRI_GANDA: Readonly<Record<"5807" | "5808", string>> = { "5807": "11618", "5808": "11619" };
export const VAR_LAMPIRAN_ABT: readonly string[] = Array.from({ length: 12 }, (_x, i) => String(11606 + i));

/** Baris tabel yang memenuhi halaman (data + judul bagian + baris kosong). */
export const BARIS_DAFTAR_ISI: Readonly<Record<KodeKertas, number>> = { a4: 21, f4: 27, legal: 29 };
export const BARIS_CEKLIST: Readonly<Record<KodeKertas, number>> = { a4: 20, f4: 25, legal: 29 };

export const PENANDA_LAMPIRAN_ABT = "@@LAMPIRAN-ABT@@";

/** Membuang paragraf yang memuat penanda (dari \pard terdekat sebelum penanda sampai \par sesudahnya). RTF tanpa penanda tak berubah. */
export function buangParagrafPenanda(rtf: string, penanda: string): string {
  const i = rtf.indexOf(penanda);
  if (i < 0) return rtf;
  const awal = rtf.lastIndexOf("\\pard", i);
  const akhir = rtf.indexOf("\\par", i + penanda.length);
  if (awal < 0 || akhir < 0) return rtf;
  let sesudah = akhir + 4;
  if (/[a-z]/i.test(rtf[sesudah] ?? "")) return rtf; // \pard dan sejenisnya - bukan \par
  if (rtf[sesudah] === " ") sesudah += 1;
  if (rtf[sesudah] === "\r") sesudah += 1;
  if (rtf[sesudah] === "\n") sesudah += 1;
  return `${rtf.slice(0, awal)}${rtf.slice(sesudah)}`;
}
