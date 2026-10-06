/**
 * ============================================================================
 * TOMBOL RUANG SIDANG DI DERETAN ALAT JADWAL SIDANG (6 Okt 2026, butir 5)
 * ============================================================================
 *
 * Di ujung kanan deretan Hitung skor ... Daftarkan ke antrian berdiri satu
 * tombol untuk tiap ruang sidang yang DIPAKAI pada jadwal yang dibuka. Ditekan
 * = tabel hanya memuat perkara yang bersidang di ruang itu (urutannya tetap
 * urutan tabel); ditekan lagi = kembali semua. Tidak ada ruang terbaca = tidak
 * ada tombol.
 *
 * Jumlahnya dihitung dari SELURUH sidang pada rentang itu, bukan dari yang
 * sudah tersaring - sama seperti kotak keadaan: angka yang ikut menyusut
 * membuat tombol lain tampak nol dan mustahil dipilih kembali.
 */

export type RuangAktif = { nama: string; jumlah: number };

function bersih(nilai: unknown): string {
  return String(nilai ?? "").replace(/\s+/g, " ").trim();
}

/** Ruang yang dipakai pada daftar sidang, urut nama (alami: "Ruang 2" sebelum "Ruang 10"). */
export function daftarRuangAktif(sidang: ReadonlyArray<{ ruangan?: string | null }>): RuangAktif[] {
  const hitung = new Map<string, number>();
  for (const b of sidang) {
    const nama = bersih(b.ruangan);
    if (!nama) continue;
    hitung.set(nama, (hitung.get(nama) ?? 0) + 1);
  }
  return [...hitung.entries()]
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id", { numeric: true, sensitivity: "base" }));
}

/**
 * Ruang pilihan yang masih berlaku - pilihan yang ruangnya tidak lagi ada pada
 * jadwal (tanggal sudah diganti) gugur sendiri, supaya tabel tidak kosong oleh
 * saringan yang tombolnya sudah tidak terlihat.
 */
export function ruangPilihanBerlaku(pilihan: string | null, daftar: ReadonlyArray<RuangAktif>): string | null {
  if (!pilihan) return null;
  return daftar.some((r) => r.nama === pilihan) ? pilihan : null;
}

/** Menyaring baris tabel ke satu ruang; tanpa pilihan = apa adanya. */
export function saringKeRuang<T extends { ruangan?: string | null }>(baris: T[], ruang: string | null): T[] {
  if (!ruang) return baris;
  return baris.filter((b) => bersih(b.ruangan) === ruang);
}
