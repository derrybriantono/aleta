/**
 * Detak Cermin Perkara: pemindai awal, pembaruan berkala, dan pencocokan
 * mingguan dalam SATU pewaktu (dinyalakan instrumentation.ts sekali saat
 * portal berdiri). Tiap detak (5 detik) memeriksa ketiganya; masing-masing
 * menolak sendiri bila saklar mati, belum waktunya, atau prasyaratnya belum
 * ada (pembaruan dan pencocokan menunggu pemindaian awal selesai). Saklar
 * pemindai MATI bawaan: saat mati, detak ini tidak menembak bot sama sekali.
 *
 * Matikan seluruh detak dengan ALETA_CERMIN_PEMINDAI=0 (instrumentation.ts).
 */
import { pencocokanJatuhTempo } from "@/lib/cermin";
import { depsPembaruanAsli, putaranPembaruan, type DepsPembaruan } from "@/server/modules/cermin/pembaruan";
import { pencocokanBilaJatuhTempo } from "@/server/modules/cermin/pencocokan";
import { DETAK_PEMINDAI_MS, putaranPemindai } from "@/server/modules/cermin/pemindai";

type Wadah = { detak: NodeJS.Timeout | null; sedang: boolean };
const SIMPAN = globalThis as unknown as { __aletaCerminBerkala?: Wadah };
function wadah(): Wadah {
  SIMPAN.__aletaCerminBerkala ??= { detak: null, sedang: false };
  return SIMPAN.__aletaCerminBerkala;
}

/** Hanya untuk uji. */
export function aturUlangCerminBerkala() {
  const w = wadah();
  if (w.detak) clearInterval(w.detak);
  SIMPAN.__aletaCerminBerkala = { detak: null, sedang: false };
}

/** Satu detak: pemindai awal lalu pembaruan lalu pencocokan (urut, tidak bertumpuk). */
export async function detakCermin(deps: DepsPembaruan = depsPembaruanAsli) {
  const w = wadah();
  if (w.sedang) return;
  w.sedang = true;
  try {
    await putaranPemindai(deps);
    await putaranPembaruan(deps);
    await pencocokanBilaJatuhTempo(deps, pencocokanJatuhTempo);
  } catch {
    // Tiap tahap sudah mencatat galatnya sendiri; detak tidak boleh mati.
  } finally {
    w.sedang = false;
  }
}

export function mulaiCerminBerkala(deps: DepsPembaruan = depsPembaruanAsli) {
  const w = wadah();
  if (w.detak) return false;
  w.detak = setInterval(() => void detakCermin(deps), DETAK_PEMINDAI_MS);
  w.detak.unref?.();
  return true;
}
