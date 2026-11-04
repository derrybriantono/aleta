/**
 * Pilihan tampilan Kasir per pengguna (4 Nov 2026): "baru" (bawaan) atau "lama" (tampilan sebelum rilis 1.205.72,
 * tetap tersedia). Disimpan di setelan akun "kasir.tampilan" (rute /api/aleta-ecourt/ekstensi/setelan) sehingga
 * portal dan ekstensi membaca pilihan yang sama; salinan di peramban hanya sebagai cadangan bila server tak terjangkau.
 * Murni - diuji tanpa peramban.
 */

export type PilihanKasir = "baru" | "lama";

export const KUNCI_SETELAN_KASIR = "kasir.tampilan";
export const PILIHAN_KASIR_BAWAAN: PilihanKasir = "baru";

/** Nilai setelan ({tampilan}) -> pilihan; null bila tidak dikenal (pemanggil memakai bawaan). */
export function pilihanKasirDari(nilai: unknown): PilihanKasir | null {
  if (nilai === "lama" || nilai === "baru") return nilai;
  if (nilai && typeof nilai === "object" && !Array.isArray(nilai)) {
    const t = (nilai as Record<string, unknown>).tampilan;
    if (t === "lama" || t === "baru") return t;
  }
  return null;
}

/** Kunci salinan peramban, per pengguna supaya satu peramban bersama tidak saling menimpa. */
export function kunciSalinanKasir(penggunaId: string | null | undefined): string {
  return `aleta.kasir.tampilan.${String(penggunaId || "tamu").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "tamu"}`;
}
