/**
 * ============================================================================
 * SAKLAR TAMPILAN LAYAR JADWAL MEDIASI (7 Okt 2026)
 * ============================================================================
 *
 * Pola yang sama dengan tampilan-antrian-sidang.ts - satu centang untuk tiap
 * fitur baru, diminta pengguna: "setiap fitur baru punya centang". Disimpan
 * di peramban (kunci sendiri, bukan kunci Jadwal Sidang) dan tidak mengubah
 * data apa pun: yang dimatikan hanya tidak digambar.
 *
 * Saklar TIDAK memberi hak. Tombol hasil mediasi tetap hanya bagi mediator
 * perkara itu dan Super Admin; mematikan saklarnya hanya menyembunyikannya
 * dari yang memang berhak.
 */

export type SaklarTampilanMediasi = {
  kunci: string;
  label: string;
  keterangan: string;
  bawaanMati?: boolean;
};

export const SAKLAR_TAMPILAN_MEDIASI: readonly SaklarTampilanMediasi[] = [
  {
    kunci: "tombol-hasil-mediasi",
    label: "Tombol Buat hasil mediasi (.rtf)",
    keterangan:
      "Tombol di ujung kanan tiap baris: pop-up hasil mediasi dan butir kesepakatan, lalu unduh laporan mediator + kesepakatan perdamaian dalam satu berkas .rtf. Hanya tampil bagi mediator perkara itu dan Super Admin.",
  },
];

export type PilihanTampilanMediasi = Record<string, boolean>;

export const KUNCI_SIMPANAN_TAMPILAN_MEDIASI = "aleta.jadwal-mediasi.tampilan";

export function tampilanMediasiBawaan(): PilihanTampilanMediasi {
  const hasil: PilihanTampilanMediasi = {};
  for (const s of SAKLAR_TAMPILAN_MEDIASI) hasil[s.kunci] = !s.bawaanMati;
  return hasil;
}

/** Simpanan peramban -> pilihan sah; kunci asing dibuang, yang hilang memakai bawaan. */
export function bacaTampilanMediasi(mentah: string | null): PilihanTampilanMediasi {
  const hasil = tampilanMediasiBawaan();
  if (!mentah) return hasil;
  let urai: unknown;
  try {
    urai = JSON.parse(mentah);
  } catch {
    return hasil;
  }
  if (!urai || typeof urai !== "object" || Array.isArray(urai)) return hasil;
  for (const s of SAKLAR_TAMPILAN_MEDIASI) {
    const nilai = (urai as Record<string, unknown>)[s.kunci];
    if (typeof nilai === "boolean") hasil[s.kunci] = nilai;
  }
  return hasil;
}

export function tampilMediasi(pilihan: PilihanTampilanMediasi | undefined, kunci: string): boolean {
  const nilai = pilihan?.[kunci];
  if (typeof nilai === "boolean") return nilai;
  return !SAKLAR_TAMPILAN_MEDIASI.find((s) => s.kunci === kunci)?.bawaanMati;
}
