"use client";

import { Monitor, Moon, SunMedium } from "lucide-react";

import { usePortal } from "@/lib/app-state";
import type { ThemeMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const PILIHAN: ReadonlyArray<{ mode: ThemeMode; judul: string; Ikon: typeof SunMedium }> = [
  { mode: "light", judul: "Tema terang", Ikon: SunMedium },
  { mode: "dark", judul: "Tema gelap", Ikon: Moon },
  { mode: "system", judul: "Ikuti tema sistem (Windows atau peramban)", Ikon: Monitor },
];

/**
 * Pemilih tema: terang, gelap, atau ikuti sistem.
 *
 * Tiap tombol meneruskan PILIHAN TEGAS yang ditekan - tidak pernah "kebalikan
 * dari state yang kebetulan terbaca". Dulu satu tombol membalik `theme` dari
 * state komponen; state yang basi (tab lain, ekstensi, render tertunda) membuat
 * klik berubah ke kebalikannya atau tampak tidak berbuat apa-apa.
 */
export function ThemeToggle() {
  const { theme, setTheme } = usePortal();
  const indeks = Math.max(
    0,
    PILIHAN.findIndex((p) => p.mode === theme)
  );

  return (
    <div
      role="group"
      aria-label="Tema tampilan"
      className="relative inline-flex h-12 items-center rounded-full border border-border bg-muted/80 p-1 shadow-sm"
    >
      <span
        aria-hidden="true"
        className="absolute top-1 h-10 w-10 rounded-full bg-card shadow-lg transition-transform duration-300"
        style={{ transform: `translateX(${indeks * 40}px)` }}
      />
      {PILIHAN.map(({ mode, judul, Ikon }) => {
        const aktif = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-label={judul}
            aria-pressed={aktif}
            title={`${judul}${aktif ? " (dipakai)" : ""}`}
            data-tema-pilihan={mode}
            onClick={() => setTheme(mode)}
            className="relative z-10 grid h-10 w-10 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Ikon
              aria-hidden="true"
              className={cn(
                "h-4 w-4 transition-colors",
                aktif ? (mode === "light" ? "text-orange-500" : "text-foreground") : "text-muted-foreground"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
