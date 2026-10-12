"use client";

/**
 * Penanda "pernah diskors" di bawah tombol Selesai (12 Okt 2026, butir 25).
 * Ikon panah melingkar berputar seperti memuat; diam bila pengguna meminta
 * gerak dikurangi (prefers-reduced-motion). Aturan dan teksnya di
 * @/lib/pernah-diskors.
 */
import { RefreshCw } from "lucide-react";

import type { PenandaPernahDiskors } from "@/lib/pernah-diskors";
import { cn } from "@/lib/utils";

export function PenandaPernahDiskorsView({
  penanda,
  className,
}: {
  penanda: PenandaPernahDiskors | null;
  className?: string;
}) {
  if (!penanda) return null;
  return (
    <span
      data-pernah-diskors=""
      role="img"
      aria-label={`${penanda.label}. ${penanda.keterangan.replace(/\n/g, " ")}`}
      title={penanda.keterangan}
      className={cn(
        "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-amber-500/70 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold leading-none text-amber-800 dark:border-amber-400/70 dark:text-amber-200",
        className
      )}
    >
      <RefreshCw
        data-pernah-diskors-ikon=""
        className="h-3 w-3 animate-spin [animation-duration:2.4s] motion-reduce:animate-none"
        aria-hidden
      />
      {penanda.label}
    </span>
  );
}
