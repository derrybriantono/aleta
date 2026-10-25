/**
 * Tulisan lewat ALETA masuk cermin SEKETIKA (A3, 25 Okt 2026).
 *
 * Dipanggil gerbang bot (tunda, putus, kehadiran, panggilan, penetapan, aksi
 * e-Court, ...) sesudah tulisan: jendela panas cermin (plus tanggal yang
 * disebut badan permintaan) dihitung ulang tanpa menunggu putaran berikutnya.
 *
 * Murah dan tidak pernah melempar:
 *   * tulisan yang pasti tidak menyentuh data perkara (antrean pesan WhatsApp
 *     dan sejenisnya; `terkena.ruang` kosong) dilewati;
 *   * modul cermin dimuat malas, supaya gerbang bot tidak menarik seluruh
 *     modul cermin (dan tidak membuat rujukan berputar) pada tiap permintaan;
 *   * saklar mati atau pemindaian awal belum selesai = tidak melakukan apa pun
 *     (diputuskan segarkanSegera);
 *   * tulisan beruntun digabung di segarkanSegera (satu putaran per 1,5 detik).
 */
import type { Terkena } from "@/server/shared/singgah-singkat";

const TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Tanggal ISO yang disebut badan permintaan (tanggal sidang berikut, tanggal sinkron, ...). */
export function tanggalDariBadanTulisan(bodi: unknown): string[] {
  let isi: unknown = bodi;
  if (typeof bodi === "string") {
    try {
      isi = JSON.parse(bodi);
    } catch {
      return [];
    }
  }
  if (!isi || typeof isi !== "object") return [];
  const x = isi as Record<string, unknown>;
  const hasil = new Set<string>();
  for (const k of ["tanggal", "tanggalSidang", "tanggalBerikut", "tanggalBaru"]) {
    const v = String(x[k] ?? "").trim().slice(0, 10);
    if (TANGGAL_ISO.test(v)) hasil.add(v);
  }
  return [...hasil];
}

export function cerminSetelahTulisan(terkena: Terkena | undefined, bodi?: unknown) {
  if (terkena && terkena.ruang.length === 0) return;
  if (process.env.NODE_ENV === "test" && process.env.ALETA_CERMIN_SETELAH_TULISAN !== "1") return;
  const tanggal = tanggalDariBadanTulisan(bodi);
  void import("@/server/modules/cermin/pembaruan")
    .then((m) => m.segarkanSegera(tanggal))
    .catch(() => undefined);
}
