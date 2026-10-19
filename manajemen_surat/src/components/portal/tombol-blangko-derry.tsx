"use client";

/**
 * Tombol kecil "Blangko" - membuka Blangko ABT by Derry di tab baru dengan
 * perkara dan jenis blangkonya sudah terpilih (JADWAL-3 tambahan B, 19 Okt 2026).
 * Satu jenis = satu tautan; dua jenis = menu kecil dua pilihan. Tidak menulis
 * apa pun. Pembentuk tautannya @/lib/tautan-blangko-derry (dipakai juga
 * Status Perkara).
 */
import { ChevronDown, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  SEBUTAN_BLANGKO,
  tautanBlangkoDerry,
  type DataTautanBlangko,
  type JenisBlangkoDerry,
} from "@/lib/tautan-blangko-derry";
import { cn } from "@/lib/utils";

const KELAS_TOMBOL =
  "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground";

export function TombolBlangkoDerry({
  data,
  jenis,
  setelanAps,
  className,
}: {
  data: DataTautanBlangko;
  /** Sudah disaring hak peran. Kosong = tidak tampil. */
  jenis: readonly JenisBlangkoDerry[];
  setelanAps?: string | null;
  className?: string;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const wadah = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!terbuka) return;
    const tutup = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "mousedown" && wadah.current?.contains(e.target as Node)) return;
      setTerbuka(false);
    };
    document.addEventListener("mousedown", tutup);
    document.addEventListener("keydown", tutup);
    return () => {
      document.removeEventListener("mousedown", tutup);
      document.removeEventListener("keydown", tutup);
    };
  }, [terbuka]);

  if (jenis.length === 0) return null;
  if (jenis.length === 1) {
    return (
      <a
        href={tautanBlangkoDerry(data, jenis[0], setelanAps)}
        target="_blank"
        rel="noopener noreferrer"
        data-tombol-blangko-derry={jenis[0]}
        title={`${SEBUTAN_BLANGKO[jenis[0]]} ${data.nomor} di ABT (tab baru)`}
        className={cn(KELAS_TOMBOL, className)}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Blangko
      </a>
    );
  }
  return (
    <span ref={wadah} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setTerbuka((x) => !x)}
        aria-expanded={terbuka}
        aria-haspopup="menu"
        data-tombol-blangko-derry="menu"
        title={`Pilih blangko ${data.nomor} di ABT`}
        className={cn(KELAS_TOMBOL, "w-full")}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Blangko
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>
      {terbuka ? (
        <span
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 flex w-44 flex-col rounded-md border bg-card p-1 text-xs shadow-lg"
        >
          {jenis.map((j) => (
            <a
              key={j}
              role="menuitem"
              href={tautanBlangkoDerry(data, j, setelanAps)}
              target="_blank"
              rel="noopener noreferrer"
              data-pilihan-blangko-derry={j}
              onClick={() => setTerbuka(false)}
              className="rounded px-2 py-1.5 text-left transition hover:bg-muted"
            >
              {SEBUTAN_BLANGKO[j]}
            </a>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** Tautan teks kecil (Status Perkara) - satu jenis, label bebas. */
export function TautanBlangkoDerry({
  data,
  jenis,
  label,
  setelanAps,
}: {
  data: DataTautanBlangko;
  jenis: JenisBlangkoDerry;
  label: string;
  setelanAps?: string | null;
}) {
  return (
    <a
      href={tautanBlangkoDerry(data, jenis, setelanAps)}
      target="_blank"
      rel="noopener noreferrer"
      data-tautan-blangko-derry={jenis}
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <FileText className="h-3 w-3" aria-hidden="true" />
      {label}
    </a>
  );
}
