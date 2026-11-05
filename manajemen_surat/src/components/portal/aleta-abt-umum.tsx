"use client";

import type { ReactNode } from "react";

import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Bagian bersama layar alur kerja ALETA ABT (Tahap 6 dan 7): Siap diperiksa, Hak folder, Berdampingan. Hanya Super Admin yang sampai ke rute
 * di baliknya (diputuskan di server). Warna hanya warna status; selebihnya mengikuti tema panel (token bg-card, text-muted-foreground, dst.).
 */

export async function panggilAlur<T>(jalur: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(`/api/aleta-abt/${jalur}`), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}

export const kirimAlur = <T,>(jalur: string, badan: Record<string, unknown>) =>
  panggilAlur<T>(jalur, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

export function GalatAlur({ pesan }: { pesan: string }) {
  if (!pesan) return null;
  return (
    <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
      {pesan}
    </div>
  );
}

export type StatusTanda = "hijau" | "kuning" | "merah" | "abu";

const WARNA: Record<StatusTanda, string> = {
  hijau: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  kuning: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  merah: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  abu: "border-border bg-muted text-muted-foreground",
};

export function TandaAlur({ status, children }: { status: StatusTanda; children: ReactNode }) {
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${WARNA[status]}`}>{children}</span>;
}

/** Batang kemajuan: lebar mengikuti nilai, dibatasi 0-100. */
export function BatangKemajuan({ nilai, maks, label }: { nilai: number; maks: number; label: string }) {
  const persen = maks > 0 ? Math.max(0, Math.min(100, Math.round((nilai / maks) * 100))) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={maks} aria-valuenow={Math.min(nilai, maks)} className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${persen}%` }} />
    </div>
  );
}
