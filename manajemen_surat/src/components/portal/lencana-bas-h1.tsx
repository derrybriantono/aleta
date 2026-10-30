"use client";

import { teksLencanaH1, type RingkasDrafH1 } from "@/lib/agen-h1-bas";
import { cn } from "@/lib/utils";

/**
 * G2a 2.4 (30 Okt 2026): lencana "BAS disiapkan" di Jadwal Sidang untuk sidang hari ini / hari kerja berikutnya yang
 * BAS-nya sudah disiapkan agen H-1. Keterangan lengkap (blangko, alasan, catatan) di `title`; tanpa kode dan istilah teknis.
 * Membuka BAS-nya memakai tombol BAS yang sudah ada di baris itu (blangko yang sama dibuka di Blangko Derry).
 */
export function LencanaBasH1({ ringkas }: { ringkas?: (RingkasDrafH1 & { keterangan?: string }) | null }) {
  if (!ringkas) return null;
  return (
    <span
      data-bas-h1={ringkas.adaBlangko ? "siap" : "belum"}
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        ringkas.adaBlangko ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
      )}
      title={ringkas.keterangan || ringkas.label}
    >
      {teksLencanaH1(ringkas)}
    </span>
  );
}
