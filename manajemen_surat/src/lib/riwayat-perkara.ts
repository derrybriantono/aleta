/**
 * ============================================================================
 * PERKARA YANG BARU DIBUKA, DAN YANG SENGAJA DISEMATKAN
 * ============================================================================
 *
 * Petugas kepaniteraan berpindah antar perkara sepanjang hari - memeriksa satu,
 * teringat yang lain, kembali ke yang pertama. Setiap perpindahan menuntut
 * nomor perkara diketik ulang, dua puluh empat huruf beserta garis miring dan
 * titiknya, dan satu huruf yang keliru berarti "perkara tidak ditemukan".
 *
 * ============================================================================
 * DI PERAMBAN, BUKAN DI BASIS DATA
 * ============================================================================
 *
 * Daftar ini menyebutkan perkara mana yang dibuka SESEORANG. Disimpan di
 * peladen, ia menjadi catatan siapa memeriksa perkara siapa - keterangan yang
 * tidak diminta siapa pun dan yang keberadaannya sendiri menimbulkan
 * pertanyaan. Di peramban masing-masing, ia hanya menolong pemiliknya.
 */

const KUNCI_RIWAYAT = "aleta.status-perkara.riwayat";
const KUNCI_SEMAT = "aleta.status-perkara.semat";

/** Sengaja pendek. Daftar dua puluh perkara bukan pintasan lagi. */
export const BATAS_RIWAYAT = 8;

export type PerkaraSingkat = { nomorPerkara: string; jenisPerkara: string; dibuka: string };

function baca(kunci: string): PerkaraSingkat[] {
  try {
    const mentah = window.localStorage.getItem(kunci);
    if (!mentah) return [];
    const isi = JSON.parse(mentah);
    if (!Array.isArray(isi)) return [];
    return isi
      .filter((x) => x && typeof x.nomorPerkara === "string" && x.nomorPerkara)
      .map((x) => ({
        nomorPerkara: String(x.nomorPerkara),
        jenisPerkara: String(x.jenisPerkara || ""),
        dibuka: String(x.dibuka || ""),
      }));
  } catch {
    // Isi yang rusak - peramban lain, versi lama, atau suntingan tangan -
    // dijawab daftar kosong, bukan layar yang gagal digambar.
    return [];
  }
}

function tulis(kunci: string, daftar: PerkaraSingkat[]) {
  try {
    window.localStorage.setItem(kunci, JSON.stringify(daftar));
  } catch {
    /* peramban yang memblokir penyimpanan situs tetap dapat memakai layarnya */
  }
}

export function bacaRiwayat(): PerkaraSingkat[] {
  return baca(KUNCI_RIWAYAT);
}

export function catatRiwayat(perkara: PerkaraSingkat) {
  if (!perkara.nomorPerkara) return;
  const lama = baca(KUNCI_RIWAYAT).filter((x) => x.nomorPerkara !== perkara.nomorPerkara);
  tulis(KUNCI_RIWAYAT, [perkara, ...lama].slice(0, BATAS_RIWAYAT));
}

export function bacaSemat(): PerkaraSingkat[] {
  return baca(KUNCI_SEMAT);
}

/**
 * Menyematkan atau melepas - satu tombol, dua arah.
 *
 * @returns daftar sematan yang baru, supaya pemanggil tidak perlu membacanya lagi
 */
export function balikSemat(perkara: PerkaraSingkat): PerkaraSingkat[] {
  const lama = baca(KUNCI_SEMAT);
  const sudah = lama.some((x) => x.nomorPerkara === perkara.nomorPerkara);
  const baru = sudah
    ? lama.filter((x) => x.nomorPerkara !== perkara.nomorPerkara)
    : [perkara, ...lama];
  tulis(KUNCI_SEMAT, baru);
  return baru;
}

export function tersemat(nomorPerkara: string): boolean {
  return baca(KUNCI_SEMAT).some((x) => x.nomorPerkara === nomorPerkara);
}
