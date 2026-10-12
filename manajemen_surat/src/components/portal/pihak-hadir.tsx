"use client";

/**
 * Tanda "sudah hadir" di samping nama pihak (12 Okt 2026, butir 18).
 * Logikanya di @/lib/pihak-hadir. Saklar `pihak-hadir` dibaca layar induk
 * dengan tampil(tampilan, "pihak-hadir") lalu dikirim sebagai `aktif`.
 *
 * Hijau + tulisan "(hadir)": tulisannya agar terbaca tanpa warna (buta warna,
 * cetak hitam-putih). Jamnya sengaja tidak ditulis di sini.
 */
import type { ReactNode } from "react";

import { JUDUL_HADIR, TULISAN_HADIR } from "@/lib/pihak-hadir";

export const KELAS_NAMA_HADIR = "font-medium text-emerald-700 dark:text-emerald-400";

export function NamaPihakHadir({
  hadir,
  aktif,
  children,
}: {
  hadir: boolean;
  /** Saklar `pihak-hadir`. */
  aktif: boolean;
  children: ReactNode;
}) {
  if (!aktif || !hadir) return <>{children}</>;
  return (
    <span className={KELAS_NAMA_HADIR} data-pihak-hadir="" title={JUDUL_HADIR}>
      {children}
      <span className="ml-1 whitespace-nowrap text-xs font-semibold" data-pihak-hadir-tulisan="">
        {TULISAN_HADIR}
      </span>
    </span>
  );
}
