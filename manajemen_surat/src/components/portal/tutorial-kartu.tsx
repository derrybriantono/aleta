"use client";

import Link from "next/link";
import { AlertTriangle, ChevronDown, ExternalLink, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { GOLONGAN_PERAN, LABEL_GOLONGAN } from "@/lib/matriks-peran";
import {
  KELOMPOK_TUTORIAL,
  alamatTutorial,
  golonganPelihatTutorial,
  tandaBaru,
  type Tutorial,
} from "@/lib/tutorial-hidup";
import { cn } from "@/lib/utils";

/** "Semua pegawai" atau daftar golongan yang berhak melihat fitur ini. */
export function tulisPelihat(t: Tutorial): string {
  const boleh = golonganPelihatTutorial(t);
  const biasa = GOLONGAN_PERAN.filter((g) => g !== "super-admin" && g !== "admin");
  if (biasa.every((g) => boleh.has(g))) return "Semua pegawai";
  const nama = GOLONGAN_PERAN.filter((g) => boleh.has(g) && g !== "super-admin").map((g) => LABEL_GOLONGAN[g]);
  if (nama.length === 0) return "Super Admin";
  return nama.join(", ");
}

/**
 * Satu fitur: judul + ringkasan selalu terlihat, langkah terbuka bila ditekan.
 * Dipakai halaman Panduan dan panel bantuan "?" - satu bentuk, dua tempat.
 */
export function KartuTutorial({
  tutorial,
  bukaAwal = false,
  ringkas = false,
  tampilkanKelompok = true,
}: {
  tutorial: Tutorial;
  bukaAwal?: boolean;
  /** Mode panel samping: tanpa tautan "salin alamat" dan jarak lebih rapat. */
  ringkas?: boolean;
  tampilkanKelompok?: boolean;
}) {
  const [buka, setBuka] = useState(bukaAwal);
  const akar = useRef<HTMLElement | null>(null);
  const baru = tandaBaru(tutorial);

  useEffect(() => {
    if (bukaAwal && akar.current && typeof akar.current.scrollIntoView === "function") {
      akar.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [bukaAwal]);

  return (
    <article
      ref={akar}
      id={`fitur-${tutorial.id}`}
      data-testid={`tutorial-${tutorial.id}`}
      className={cn("scroll-mt-24 rounded-2xl border border-border bg-card", buka && "shadow-panel")}
    >
      <button
        type="button"
        aria-expanded={buka}
        aria-controls={`isi-${tutorial.id}`}
        onClick={() => setBuka((x) => !x)}
        className={cn(
          "flex w-full items-start justify-between gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          ringkas ? "p-3" : "p-4 sm:p-5"
        )}
      >
        <span className="min-w-0 space-y-1.5">
          <span className="flex flex-wrap items-center gap-1.5">
            {tampilkanKelompok ? <Badge variant="outline">{KELOMPOK_TUTORIAL[tutorial.kelompok].label}</Badge> : null}
            {baru ? <Badge variant="success">{baru}</Badge> : null}
          </span>
          <span className={cn("block font-semibold text-foreground", ringkas ? "text-sm" : "text-base sm:text-lg")}>
            {tutorial.judul}
          </span>
          <span className="block text-sm leading-6 text-muted-foreground">{tutorial.ringkas}</span>
        </span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", buka && "rotate-180")} />
      </button>

      {buka ? (
        <div
          id={`isi-${tutorial.id}`}
          className={cn("space-y-4 border-t border-border", ringkas ? "p-3" : "p-4 sm:p-5")}
        >
          <section>
            <h3 className="text-sm font-semibold text-foreground">Langkah-langkah</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-foreground/90 marker:font-semibold marker:text-primary">
              {tutorial.langkah.map((langkah) => (
                <li key={langkah}>{langkah}</li>
              ))}
            </ol>
          </section>

          {tutorial.peringatan && tutorial.peringatan.length > 0 ? (
            <section className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
              <h3 className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Perhatikan
              </h3>
              <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
                {tutorial.peringatan.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {tutorial.tautan ? (
              <Link
                href={tutorial.tautan.href}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {tutorial.tautan.teks}
              </Link>
            ) : null}
            {ringkas ? (
              <Link href={alamatTutorial(tutorial.id)} className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline">
                <Link2 className="h-4 w-4" aria-hidden="true" />
                Lihat di halaman Tutorial
              </Link>
            ) : null}
            <span className="text-xs text-muted-foreground">Untuk: {tulisPelihat(tutorial)}</span>
          </div>
        </div>
      ) : null}
    </article>
  );
}
