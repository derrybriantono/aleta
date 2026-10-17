import { JABATAN_SKP, type JabatanSkp } from "@/lib/skp-jabatan-tipe";
import { ApiError } from "@/server/shared/errors";

/** Pembantu bersama modul SKP: tanggal, jabatan, JSON, dan waktu. */

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" yang sungguh ada di kalender; selain itu null. */
export function tanggalIsiSah(nilai: unknown): string | null {
  const teks = String(nilai ?? "").trim();
  if (!POLA_TANGGAL.test(teks)) return null;
  const d = new Date(`${teks}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== teks) return null;
  return teks;
}

export function jabatanSkpSah(nilai: unknown): nilai is JabatanSkp {
  return (JABATAN_SKP as readonly string[]).includes(String(nilai));
}

/** Teks JSON berisi larik jabatan -> larik jabatan yang dikenal (tanpa pengulangan). */
export function bacaJabatanTambahan(json: unknown): JabatanSkp[] {
  try {
    const nilai = JSON.parse(String(json ?? "[]")) as unknown;
    if (!Array.isArray(nilai)) return [];
    return [...new Set(nilai.map(String))].filter(jabatanSkpSah);
  } catch {
    return [];
  }
}

export function bacaJsonAman<T>(json: unknown, cadangan: T): T {
  try {
    const nilai = JSON.parse(String(json ?? "")) as T;
    return nilai ?? cadangan;
  } catch {
    return cadangan;
  }
}

export function teksAtauNull(nilai: unknown): string | null {
  const teks = String(nilai ?? "").trim();
  return teks ? teks : null;
}

export function sekarangIso(): string {
  return new Date().toISOString();
}

/** Angka berhingga atau null; "" dan null tidak pernah menjadi 0. */
export function angkaAtauNull(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = typeof nilai === "number" ? nilai : Number(String(nilai).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function pastikanTeks(nilai: unknown, nama: string, batas: number): string {
  const teks = String(nilai ?? "").trim();
  if (teks.length > batas) throw new ApiError(400, `${nama} terlalu panjang (paling banyak ${batas} huruf).`);
  return teks;
}

/** Rentang [dari, sampai] bertumpang tindih; sampai kosong = masih berlaku. */
export function rentangBertumpang(
  a: { dari: string; sampai: string | null },
  b: { dari: string; sampai: string | null }
): boolean {
  const akhirA = a.sampai || "9999-12-31";
  const akhirB = b.sampai || "9999-12-31";
  return a.dari <= akhirB && b.dari <= akhirA;
}
