import { apiPath } from "@/lib/base-path";

/**
 * Pemanggil API untuk layar Pengaturan Keamanan (Bagian 6). Membaca bentuk
 * jawaban ALETA { ok, data | error: { message, details } } dan melempar
 * GalatKeamanan berisi kalimat untuk pengguna.
 */
export class GalatKeamanan extends Error {
  status: number;
  details: unknown;
  constructor(pesan: string, status = 500, details?: unknown) {
    super(pesan);
    this.name = "GalatKeamanan";
    this.status = status;
    this.details = details;
  }
}

export async function ambilKeamanan<T>(url: string, init?: RequestInit, tambahan?: Record<string, string>): Promise<T> {
  const r = await fetch(apiPath(url), {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(tambahan ?? {}) },
  });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string; details?: unknown } } | null;
  if (!r.ok || !j?.ok) throw new GalatKeamanan(j?.error?.message ?? "Data belum dapat dimuat.", r.status, j?.error?.details);
  return j.data as T;
}

// ─── Pengaman aksi admin (Bagian 6c) ─────────────────────────────────────────

/** Nama header kiriman konfirmasi; SAMA dengan HEADER_PENGAMAN di server/modules/keamanan/pengaman-aksi.ts. */
export const HEADER_PENGAMAN_KLIEN = {
  sandi: "x-aleta-pengaman-sandi",
  ketik: "x-aleta-pengaman-ketik",
  kode: "x-aleta-pengaman-kode",
} as const;

export type PermintaanPengamanKlien = {
  kode: string;
  label: string;
  kataKonfirmasi: string;
  perluKodeKedua: boolean;
  salah: string;
};

/** Membaca jawaban galat ALETA ({ ok:false, error:{ details } }) -> permintaan konfirmasi, atau null bila bukan itu. */
export function bacaPermintaanPengaman(isi: unknown): PermintaanPengamanKlien | null {
  const d = (isi as { error?: { details?: Record<string, unknown> } } | null)?.error?.details;
  if (!d || d.alasan !== "pengaman_aksi" || typeof d.kode !== "string" || typeof d.kataKonfirmasi !== "string") return null;
  return {
    kode: d.kode,
    label: String(d.label ?? ""),
    kataKonfirmasi: d.kataKonfirmasi,
    perluKodeKedua: d.perluKodeKedua === true,
    salah: String(d.salah ?? ""),
  };
}
