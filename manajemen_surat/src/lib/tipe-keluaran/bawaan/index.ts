import { CERMIN_ALASAN } from "@/lib/tipe-keluaran/bawaan/bawaan-alasan";
import { CERMIN_BAS_SAKSI } from "@/lib/tipe-keluaran/bawaan/bawaan-bas-saksi";
import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";
import { CERMIN_PORTAL } from "@/lib/tipe-keluaran/bawaan/bawaan-portal";
import { CERMIN_PUTUSAN_MEDAN } from "@/lib/tipe-keluaran/bawaan/bawaan-putusan-medan";
import {
  KUNCI_DAFTAR,
  type Cermin,
  type EntriCermin,
  type KunciDaftar,
  type PemilikCermin,
} from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * RANGKAIAN CERMIN BAWAAN (K10)
 * ============================================================================
 *
 * Satu-satunya tempat yang menyatukan cermin tiap pemilik. Modul peladen
 * tipe-keluaran.ts membaca cermin HANYA lewat sini.
 *
 * YANG SUDAH DIRANGKAI: seluruh lima pemilik - CERMIN_EKSTENSI, CERMIN_PORTAL,
 * CERMIN_BAS_SAKSI, CERMIN_PUTUSAN_MEDAN (bawaan-putusan-medan.ts), dan
 * CERMIN_ALASAN (bawaan-alasan.ts). Dua yang terakhir dibuat pekerjaannya
 * masing-masing pada Tahap 1 dan dirangkai orkestrator sesudahnya
 * (26 September 2026).
 *
 * Daftar yang pemilik cerminnya BELUM dirangkai disebut "tanpa cermin":
 *   - tidak dikirim ke pemakainya sama sekali, sehingga bot/ekstensi/portal
 *     memakai konstanta tertanamnya (K6: "bila sebuah daftar hilang, dipakai
 *     konstanta tertanam");
 *   - tidak menerima usulan. Tambahan atas daftar yang bawaannya tidak
 *     diketahui akan dikirim SENDIRIAN dan menggantikan seluruh konstanta
 *     tertanam - atau, bila ditahan, disahkan tanpa pernah dipakai. Keduanya
 *     gagal diam-diam; menolaknya di depan tidak.
 */
export const CERMIN_PER_PEMILIK: Partial<Record<PemilikCermin, Cermin>> = {
  CERMIN_EKSTENSI,
  CERMIN_PORTAL,
  CERMIN_BAS_SAKSI,
  CERMIN_PUTUSAN_MEDAN,
  CERMIN_ALASAN,
};

export const CERMIN_BAWAAN: Cermin = Object.assign({}, ...Object.values(CERMIN_PER_PEMILIK));

/** Entri cermin sebuah daftar, atau null bila pemilik cerminnya belum dirangkai. */
export function cerminDaftar(daftar: KunciDaftar): readonly EntriCermin[] | null {
  return Object.prototype.hasOwnProperty.call(CERMIN_BAWAAN, daftar) ? (CERMIN_BAWAAN[daftar] ?? null) : null;
}

/** Daftar yang cerminnya sudah dirangkai, dalam urutan registri. */
export function daftarBercermin(): KunciDaftar[] {
  return KUNCI_DAFTAR.filter((k) => cerminDaftar(k) !== null);
}

export { CERMIN_ALASAN, CERMIN_BAS_SAKSI, CERMIN_EKSTENSI, CERMIN_PORTAL, CERMIN_PUTUSAN_MEDAN };
