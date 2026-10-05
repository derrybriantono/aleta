"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tombol x kecil untuk menutup pesan GAGAL yang menetap (butir 3, 5 Okt 2026).
 * Pesan berhasil tidak memerlukannya - ia hilang sendiri.
 */
export function TombolTutupPesan({ onTutup, className }: { onTutup: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onTutup}
      aria-label="Tutup pesan"
      title="Tutup pesan"
      className={cn(
        "ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10",
        className
      )}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
