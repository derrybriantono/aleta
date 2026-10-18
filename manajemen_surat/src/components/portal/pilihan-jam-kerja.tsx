"use client";

/**
 * Pertanyaan "di luar jam kerja" sebelum menulis ke SIPP (keputusan 104, 18 Okt
 * 2026). Bot menjawab `perluPilihan` bila tombol tulis ditekan di luar jam kerja
 * satker (Senin-Kamis 07.30-16.00, Jumat 07.30-16.30 WITA) atau pada hari libur.
 * Petugas memilih: Antrekan (bawaan - dikerjakan sendiri pada jam kerja
 * berikutnya) atau Tulis sekarang. Tidak pernah diblok diam-diam.
 */
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";

export type PilihJamKerja = "antrekan" | "sekarang";

export function TanyaJamKerja({
  pesan,
  sibuk,
  onPilih,
}: {
  pesan: string;
  sibuk?: boolean;
  onPilih: (pilihan: PilihJamKerja) => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Di luar jam kerja"
      className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <p className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{pesan || "Sekarang di luar jam kerja. Tulisan ini akan dikerjakan pada jam kerja berikutnya."}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" autoFocus disabled={sibuk} onClick={() => onPilih("antrekan")}>
          Antrekan
        </Button>
        <Button size="sm" variant="outline" disabled={sibuk} onClick={() => onPilih("sekarang")}>
          Tulis sekarang
        </Button>
      </div>
    </div>
  );
}

export function KabarDiantrekan({ pesan }: { pesan: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{pesan || "Diantrekan - dikerjakan pada jam kerja berikutnya."}</span>
    </p>
  );
}
