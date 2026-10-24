import type { AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * ALETA Ai - SAKLAR DARURAT (tahap 4)
 * ============================================================================
 *
 * Saklar tersimpan di aleta_ai_pengaturan (kunci "aktif"; "0" = mati). Mematikan
 * saklar harus menghentikan ALETA Ai SEKETIKA, termasuk giliran yang sedang
 * mengalir dan tugas panjang (T9, cowork) yang sedang berjalan:
 *
 *   1. aletaAiDihentikan(db)        - baca saklar SEGAR dari basis data (tanpa
 *                                      tembolok). Pekerjaan panjang memanggilnya
 *                                      di antara langkah dan berhenti bila true.
 *   2. daftarkanPekerjaanAi(kendali) - pekerjaan yang berjalan mendaftarkan
 *                                      AbortController-nya; simpanPengaturan
 *                                      ({aktif:false}) membatalkan semuanya di
 *                                      proses ini (alasan ALASAN_SAKLAR).
 *   3. pantauSaklar(db, kendali)    - gabungan keduanya: mendaftar dan memeriksa
 *                                      basis data berkala (untuk saklar yang
 *                                      dimatikan proses lain/server lain).
 *
 * Berkas ini sengaja tidak mengimpor pengaturan.ts (pengaturan.ts yang
 * mengimpor berkas ini) supaya tidak ada impor melingkar.
 */

/** Alasan pembatalan (AbortSignal.reason) bila saklar darurat dimatikan. */
export const ALASAN_SAKLAR = "aleta-ai-saklar-darurat";

const berjalan = new Set<AbortController>();

/** true = ALETA Ai dimatikan Super Admin. Tidak ada baris = bawaan (hidup). Galat baca = anggap mati (aman). */
export async function aletaAiDihentikan(db: AletaDatabase): Promise<boolean> {
  try {
    const baris = await db.queryOne<{ nilai: string }>(`SELECT nilai FROM aleta_ai_pengaturan WHERE kunci = 'aktif'`);
    return baris ? String(baris.nilai).trim() !== "1" : false;
  } catch {
    return true;
  }
}

/** Mendaftarkan pekerjaan yang sedang berjalan. Kembalian = pelepas (panggil di finally). */
export function daftarkanPekerjaanAi(kendali: AbortController): () => void {
  berjalan.add(kendali);
  return () => {
    berjalan.delete(kendali);
  };
}

/** Membatalkan seluruh pekerjaan ALETA Ai yang terdaftar di proses ini. Kembalian = jumlah yang dibatalkan. */
export function hentikanSemuaPekerjaanAi(): number {
  let n = 0;
  for (const k of [...berjalan]) {
    if (!k.signal.aborted) {
      k.abort(ALASAN_SAKLAR);
      n += 1;
    }
    berjalan.delete(k);
  }
  return n;
}

export function jumlahPekerjaanAiBerjalan(): number {
  return berjalan.size;
}

/** true bila sinyal dibatalkan oleh saklar darurat (bukan oleh pengguna yang menutup sambungan). */
export function dibatalkanSaklar(sinyal: AbortSignal | undefined): boolean {
  return Boolean(sinyal?.aborted && sinyal.reason === ALASAN_SAKLAR);
}

/**
 * Mendaftarkan `kendali` dan memeriksa saklar di basis data tiap `selangMs`
 * (bawaan 2 detik). Kembalian = penghenti pemantauan (panggil di finally).
 */
export function pantauSaklar(db: AletaDatabase, kendali: AbortController, opsi: { selangMs?: number } = {}): () => void {
  const lepas = daftarkanPekerjaanAi(kendali);
  let sedang = false;
  const pewaktu = setInterval(() => {
    if (sedang || kendali.signal.aborted) return;
    sedang = true;
    void aletaAiDihentikan(db)
      .then((mati) => {
        if (mati && !kendali.signal.aborted) kendali.abort(ALASAN_SAKLAR);
      })
      .finally(() => {
        sedang = false;
      });
  }, Math.max(50, opsi.selangMs ?? 2000));
  pewaktu.unref?.();
  return () => {
    clearInterval(pewaktu);
    lepas();
  };
}
