/**
 * Sandi `perkara_jadwal_sidang.dihadiri_oleh` yang berarti PIHAK KEDUA (Tergugat/Termohon) atau PIHAK PERTAMA (Penggugat/Pemohon)
 * hadir - satu sumber (30 Okt 2026, agen G2B).
 *
 * Arti sandi menurut borang SIPP (views/perkara_tab/jadwal_sidang_p_edit.php): 1 Semua Pihak, 2 Pihak Pertama saja, 3 Pihak Kedua saja,
 * 4 Para Pihak Tidak Hadir, 5 Intervensi saja, 7 P + Intervensi, 8 T + Intervensi, 9 P + T (ada intervensi), 10 Sebagian Penggugat,
 * 11 Sebagian Tergugat, 13 Turut Tergugat saja, 14 P + Turut T, 15 T + Turut T.
 *
 * Tergugat hadir = 1, 3, 8, 9, 11, 15 - IDENTIK dengan aturan "pernah hadir" paket ABT relaas-penetapan-30okt (#11211# upaya hukum
 * pemberitahuan putusan, catatan temuan "amar verstek tetapi sandi hadir"). Dulu ALETA hanya mengenal 1 dan 3, sehingga Tergugat yang
 * hadir bersama intervensi/turut tergugat dianggap tidak pernah hadir (saran verstek keliru). SIPP mencatat kehadiran per SIDANG, bukan
 * per orang: pada Tergugat banyak, "hadir" = salah satu Tergugat/Termohon hadir.
 *
 * Penggugat hadir = 1, 2, 7, 9, 10, 14 (kembaran arti yang sama untuk pihak pertama).
 *
 * Kembaran bot: aleta_bot/services/sandiKehadiranService.js (dijaga sandi-kehadiran-g2b-30okt.test.ts).
 */
export const SANDI_TERGUGAT_HADIR: readonly number[] = Object.freeze([1, 3, 8, 9, 11, 15]);
export const SANDI_PENGGUGAT_HADIR: readonly number[] = Object.freeze([1, 2, 7, 9, 10, 14]);

const angka = (x: unknown): number | null => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));

/** Sandi kehadiran berarti Tergugat/Termohon (salah satunya) hadir. Kosong/tidak dikenal = false. */
export function tergugatHadirSandi(sandi: unknown): boolean {
  const n = angka(sandi);
  return n !== null && SANDI_TERGUGAT_HADIR.includes(n);
}

/** Sandi kehadiran berarti Penggugat/Pemohon (salah satunya) hadir. Kosong/tidak dikenal = false. */
export function penggugatHadirSandi(sandi: unknown): boolean {
  const n = angka(sandi);
  return n !== null && SANDI_PENGGUGAT_HADIR.includes(n);
}
