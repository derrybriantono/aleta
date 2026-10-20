/**
 * Saringan tampilan daftar akun Admin: akun nonaktif disembunyikan bawaan,
 * dan dapat diperlihatkan kembali lewat saklar. Hanya memengaruhi tampilan.
 */

export const KUNCI_TAMPIL_AKUN_NONAKTIF = "aleta.admin.tampilAkunNonaktif";

type AkunBerStatus = { isActive?: boolean | number | string | null };

/** Akun dianggap nonaktif bila isActive jelas salah (false/0/"0"/"false"). */
export function akunNonaktif(akun: AkunBerStatus): boolean {
  const nilai = akun.isActive;
  if (nilai === false || nilai === 0 || nilai === "0" || nilai === "false") return true;
  return false;
}

/** Jumlah akun nonaktif pada daftar yang sudah melewati saringan lain. */
export function hitungAkunNonaktif<T extends AkunBerStatus>(daftar: readonly T[]): number {
  return daftar.reduce((jumlah, akun) => jumlah + (akunNonaktif(akun) ? 1 : 0), 0);
}

/** Bila tampilkanNonaktif mati, akun nonaktif dibuang dari daftar. */
export function saringAkunNonaktif<T extends AkunBerStatus>(daftar: readonly T[], tampilkanNonaktif: boolean): T[] {
  return tampilkanNonaktif ? [...daftar] : daftar.filter((akun) => !akunNonaktif(akun));
}

/** Saklar hanya perlu terlihat bila ada akun nonaktif, atau sedang menyala. */
export function saklarNonaktifTerlihat(jumlahNonaktif: number, tampilkanNonaktif: boolean): boolean {
  return jumlahNonaktif > 0 || tampilkanNonaktif;
}

export function bacaPilihanAkunNonaktif(): boolean {
  try {
    return window.localStorage.getItem(KUNCI_TAMPIL_AKUN_NONAKTIF) === "1";
  } catch {
    return false;
  }
}

export function simpanPilihanAkunNonaktif(nilai: boolean): void {
  try {
    window.localStorage.setItem(KUNCI_TAMPIL_AKUN_NONAKTIF, nilai ? "1" : "0");
  } catch {
    // penyimpanan peramban tidak tersedia; pilihan hanya berlaku di sesi ini
  }
}
