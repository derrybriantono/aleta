/**
 * Menggabungkan pilihan Tampilan Jadwal Sidang di peramban dengan BAWAAN dari
 * Super Admin (butir 22, 6 Okt 2026). Fungsi murni - lihat
 * server/modules/aleta-ecourt/tampilan-jadwal-bawaan untuk aturannya.
 *
 *   - belum pernah mengatur sendiri (tidak ada simpanan) -> bawaan berlaku,
 *     dan TIDAK disimpan sebagai pilihan sendiri: perubahan bawaan berikutnya
 *     tetap sampai kepadanya;
 *   - sudah mengatur sendiri -> pilihannya sendiri, KECUALI bawaan ber-"paksa"
 *     dengan versi yang belum pernah diterapkan di peramban ini: ditimpa sekali.
 */
import { bacaTampilan, type PilihanTampilan } from "@/lib/tampilan-antrian-sidang";

export const KUNCI_VERSI_BAWAAN = "aleta.jadwal-sidang.tampilan.versi-bawaan";

export type BawaanDiterima = { pilihan: PilihanTampilan; paksa: boolean; versi: string } | null;

export function pilihanSesudahBawaan(
  simpananLokal: string | null,
  versiTerapan: string | null,
  bawaan: BawaanDiterima
): { pilihan: PilihanTampilan; simpanLokal: boolean; versiBaru: string | null } {
  if (!bawaan) return { pilihan: bacaTampilan(simpananLokal), simpanLokal: false, versiBaru: null };
  const dariBawaan = bacaTampilan(JSON.stringify(bawaan.pilihan));
  if (!simpananLokal) return { pilihan: dariBawaan, simpanLokal: false, versiBaru: bawaan.versi };
  if (bawaan.paksa && versiTerapan !== bawaan.versi) {
    return { pilihan: dariBawaan, simpanLokal: true, versiBaru: bawaan.versi };
  }
  return { pilihan: bacaTampilan(simpananLokal), simpanLokal: false, versiBaru: null };
}
