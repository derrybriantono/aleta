"use client";

import { RefreshCw, WifiOff } from "lucide-react";

import type { KeadaanCobaLagi } from "@/lib/coba-lagi-otomatis";

/**
 * Kotak gangguan jaringan dengan hitung mundur dan "Coba sekarang" (butir 14,
 * 5 Okt 2026). Kuning, bukan merah: datanya yang sudah tampil masih sah, dan
 * ALETA sedang memulihkannya sendiri - bukan petugas yang harus bertindak.
 */
export function BannerGangguan({ keadaan, onCobaSekarang }: { keadaan: KeadaanCobaLagi; onCobaSekarang: () => void }) {
  if (!keadaan.gangguan) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-banner-gangguan=""
      className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {keadaan.pesan}{" "}
        <span className="whitespace-nowrap font-medium tabular-nums">
          {keadaan.mencoba
            ? "Sedang mencoba lagi…"
            : keadaan.sisaDetik !== null
              ? `Mencoba lagi dalam ${keadaan.sisaDetik} dtk.`
              : "Mencoba lagi saat tab ini dibuka."}
        </span>
      </span>
      <button
        type="button"
        onClick={onCobaSekarang}
        disabled={keadaan.mencoba}
        className="inline-flex items-center gap-1 rounded-md border border-amber-400 px-2 py-1 text-xs font-medium transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:hover:bg-amber-900/40"
      >
        <RefreshCw className={keadaan.mencoba ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        Coba sekarang
      </button>
    </div>
  );
}
