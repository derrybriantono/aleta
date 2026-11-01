/**
 * Rak peraturan terverifikasi (P1, 1 Nov 2026) - indeks dimuat SEKALI per proses lalu dipakai ulang.
 *
 * rak.json disusun scripts/rak-peraturan/susun_rak.py dari naskah resmi lokal + korpus ALETA (jangan disunting tangan).
 * Dipakai: rute "Periksa sebelum cetak" Blangko Derry (periksa-kutipan) dan ALETA Ai (saran pasal hanya yang terverifikasi).
 */
import rakJson from "./rak.json";
import {
  buatIndeks,
  bunyiTerverifikasi,
  periksaKutipan,
  rujukanTerverifikasi,
  saringSaranPasal,
  type IndeksRak,
  type OpsiPeriksa,
  type Rak,
  type TemuanKutipan,
} from "./periksa";

let indeks: IndeksRak | null = null;

/** Indeks rak (dibangun sekali). */
export function indeksRak(): IndeksRak {
  if (!indeks) indeks = buatIndeks(rakJson as unknown as Rak);
  return indeks;
}

export function periksaNaskah(teks: string, opsi?: OpsiPeriksa): TemuanKutipan[] {
  return periksaKutipan(indeksRak(), teks, opsi);
}

/** ALETA Ai: rujukan boleh disarankan hanya bila terverifikasi di rak. */
export function bolehDisarankan(teksRujukan: string): { boleh: boolean; sebab: string } {
  return rujukanTerverifikasi(indeksRak(), teksRujukan);
}

export function saringSaranAi(saran: readonly string[]) {
  return saringSaranPasal(indeksRak(), saran);
}

export function bunyiPasal(kode: string, pasal: string): string | null {
  return bunyiTerverifikasi(indeksRak(), kode, pasal);
}

/** Ringkasan rak untuk tampilan (jumlah pasal per status). */
export function ringkasanRak() {
  const r = indeksRak().rak;
  let terverifikasi = 0;
  let belum = 0;
  for (const p of r.pasal) {
    if (p.status === "terverifikasi") terverifikasi++;
    else belum++;
  }
  return { dibuat: r.dibuat, peraturan: Object.keys(r.peraturan).length, pasal: r.pasal.length, terverifikasi, belum };
}

export type { TemuanKutipan } from "./periksa";
