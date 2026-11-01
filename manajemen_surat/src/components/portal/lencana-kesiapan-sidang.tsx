"use client";

import type { RingkasKesiapan } from "@/lib/kelengkapan-sidang";
import { cn } from "@/lib/utils";

/**
 * N1 (1 Nov 2026): lencana "Kesiapan sidang" di Jadwal Sidang - hijau (siap), kuning (perlu dilengkapi), merah (belum siap)
 * menurut pemeriksaan pagi agen kelengkapan. Rincian tiap butir ada di `title` (satu butir per baris); tanpa kode dan istilah
 * teknis. Siap sidang tampil kecil dan tenang; hanya yang bermasalah menarik mata.
 */
export type RingkasKesiapanTampil = RingkasKesiapan & { butir?: Array<{ judul: string; tingkat: string }> };

const GAYA: Record<RingkasKesiapan["tingkat"], string> = {
  siap: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  perhatian: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "tidak-siap": "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

export function LencanaKesiapanSidang({ ringkas }: { ringkas?: RingkasKesiapanTampil | null }) {
  if (!ringkas) return null;
  return (
    <span data-kesiapan-sidang={ringkas.tingkat} className={cn("rounded px-1.5 py-0.5 text-xs font-medium", GAYA[ringkas.tingkat])} title={ringkas.keterangan}>
      {ringkas.teks}
    </span>
  );
}
