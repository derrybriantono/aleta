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
