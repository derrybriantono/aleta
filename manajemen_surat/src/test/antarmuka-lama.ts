/**
 * 4 Nov 2026: tampilan baru Jadwal Sidang/Mediasi menjadi bawaan. Uji-uji lama menguji TAMPILAN LAMA (tabel,
 * Pencarian lanjutan, tombol Tampilkan), yang tetap dapat dipilih; berkas ini memilihnya untuk mereka.
 * Uji tampilan baru memilih "baru" sendiri (lihat jadwal-baru-layar-4nov.test.tsx).
 */
export const KUNCI_ANTARMUKA = ["aleta.jadwal-sidang.antarmuka", "aleta.jadwal-mediasi.antarmuka"] as const;

export function pakaiAntarmukaLama(nilai: "lama" | "baru" = "lama"): void {
  try {
    if (typeof window === "undefined") return;
    for (const k of KUNCI_ANTARMUKA) window.localStorage.setItem(k, nilai);
  } catch {
    /* jsdom tanpa localStorage */
  }
}
