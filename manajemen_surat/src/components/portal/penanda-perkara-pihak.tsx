"use client";

/**
 * ============================================================================
 * LENCANA PERKARA DAN PIHAK (12 Okt 2026, butir 5)
 * ============================================================================
 *
 * Dua komponen kecil yang dipakai Jadwal Sidang (baris dan rincian):
 *
 *   <LencanaPerkaraBaris>      Ghaib, Prodeo, Non e-Court di samping NOMOR perkara;
 *   <LencanaPekerjaanBaris>    PNS, PPPK, POLRI, TNI, BUMN/BUMD di samping NAMA pihak.
 *
 * Pemilihan lencananya ada di @/lib/penanda-perkara-pihak (murni, diuji). Saklar
 * tampilan (`penanda-perkara`, `penanda-pekerjaan`) dibaca layar induk dengan
 * tampil(tampilan, ...) lalu dikirim sebagai `aktif` - berkas ini tidak membaca
 * simpanan peramban sendiri.
 *
 * Warna sengaja BUKAN merah/kuning: di layar ini merah berarti menuntut tindakan
 * dan kuning berarti perlu dicermati. Keterangan hukum (ghaib, prodeo, jabatan)
 * hanya memberi tahu perlakuan perkaranya, tidak menuntut apa pun.
 */

import {
  judulLencanaPekerjaan,
  lencanaPekerjaanUntukNama,
  lencanaPerkara,
  tulisanLencanaPekerjaan,
  type BahanPenandaBaris,
  type KunciLencanaPerkara,
} from "@/lib/penanda-perkara-pihak";
import { cn } from "@/lib/utils";

const KELAS_DASAR = "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium align-middle";

const KELAS_PERKARA: Record<KunciLencanaPerkara, string> = {
  ghaib: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  prodeo: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "non-ecourt": "border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300",
};

const KELAS_PEKERJAAN = "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200";

export function LencanaPerkaraBaris({
  baris,
  aktif,
  className,
}: {
  baris: BahanPenandaBaris;
  /** Saklar `penanda-perkara`. */
  aktif: boolean;
  className?: string;
}) {
  if (!aktif) return null;
  const daftar = lencanaPerkara(baris);
  if (daftar.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)} data-lencana-perkara="">
      {daftar.map((l) => (
        <span
          key={l.kunci}
          className={cn(KELAS_DASAR, KELAS_PERKARA[l.kunci])}
          title={l.judul}
          data-lencana={l.kunci}
        >
          {l.label}
        </span>
      ))}
    </span>
  );
}

export function LencanaPekerjaanBaris({
  baris,
  nama,
  aktif,
  className,
}: {
  baris: BahanPenandaBaris;
  /** Nama pihak yang sedang ditampilkan pada baris ini (P, T, Turut T, atau Int). */
  nama: ReadonlyArray<string>;
  /** Saklar `penanda-pekerjaan`. */
  aktif: boolean;
  className?: string;
}) {
  if (!aktif) return null;
  const daftar = lencanaPekerjaanUntukNama(baris, nama);
  if (daftar.length === 0) return null;
  return (
    <span className={cn("ml-1 inline-flex flex-wrap gap-1", className)} data-lencana-pekerjaan="">
      {daftar.map((l, ke) => (
        <span
          key={`${l.nama}-${l.label}-${ke}`}
          className={cn(KELAS_DASAR, KELAS_PEKERJAAN)}
          title={judulLencanaPekerjaan(l)}
          data-lencana={l.kunci}
        >
          {tulisanLencanaPekerjaan(l, nama.length)}
        </span>
      ))}
    </span>
  );
}
