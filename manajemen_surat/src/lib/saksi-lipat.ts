/**
 * Nama saksi yang dapat dilipat di baris Jadwal Sidang (JADWAL-3 butir 4, 19 Okt 2026).
 *
 * Bawaannya TERLIPAT: yang tampak hanya "Saksi P (2) ▸". Saklar Tampilan
 * "Nama saksi dilipat" (menyala bawaan) yang dimatikan membalik bawaan itu. Tiap baris dapat dibuka/ditutup
 * sendiri, dan pilihan per baris itu diingat peramban ini atas nama akun yang
 * masuk - pengguna lain di komputer yang sama tidak mewarisinya.
 *
 * Yang disimpan hanya baris yang BERBEDA dari bawaan, dibatasi jumlahnya supaya
 * simpanan tidak tumbuh tanpa batas.
 */

export const AWALAN_SIMPANAN_SAKSI_LIPAT = "aleta:jadwal-sidang:saksi-lipat:";
export const BATAS_SIMPANAN_SAKSI_LIPAT = 300;

/** Peta "perkaraId|sisi" -> true (terbuka) / false (terlipat). */
export type PetaSaksiLipat = Record<string, boolean>;

export function kunciSimpananSaksiLipat(idPengguna: string | number | null | undefined): string {
  const id = String(idPengguna ?? "").trim();
  return `${AWALAN_SIMPANAN_SAKSI_LIPAT}${id || "tamu"}`;
}

export function kunciBarisSaksi(perkaraId: string | number, sisi: "P" | "T"): string {
  return `${String(perkaraId)}|${sisi}`;
}

export function bacaSaksiLipat(mentah: string | null | undefined): PetaSaksiLipat {
  if (!mentah) return {};
  try {
    const isi = JSON.parse(mentah) as unknown;
    if (!isi || typeof isi !== "object" || Array.isArray(isi)) return {};
    const hasil: PetaSaksiLipat = {};
    for (const [k, v] of Object.entries(isi as Record<string, unknown>)) {
      if (typeof v === "boolean" && /^[^|]+\|[PT]$/.test(k)) hasil[k] = v;
    }
    return hasil;
  } catch {
    return {};
  }
}

/** Terbuka atau tidak, menurut pilihan baris itu lalu bawaannya. */
export function saksiTerbuka(peta: PetaSaksiLipat, kunci: string, bawaanTerbuka: boolean): boolean {
  const v = peta[kunci];
  return typeof v === "boolean" ? v : bawaanTerbuka;
}

/**
 * Membalik satu baris. Baris yang kembali sama dengan bawaan DIHAPUS dari peta,
 * sehingga mengubah saklar bawaan berlaku lagi bagi baris itu.
 */
export function alihSaksiLipat(peta: PetaSaksiLipat, kunci: string, bawaanTerbuka: boolean): PetaSaksiLipat {
  const baru = !saksiTerbuka(peta, kunci, bawaanTerbuka);
  const hasil: PetaSaksiLipat = { ...peta };
  delete hasil[kunci];
  if (baru !== bawaanTerbuka) hasil[kunci] = baru;
  const kunciSemua = Object.keys(hasil);
  if (kunciSemua.length > BATAS_SIMPANAN_SAKSI_LIPAT) {
    for (const k of kunciSemua.slice(0, kunciSemua.length - BATAS_SIMPANAN_SAKSI_LIPAT)) delete hasil[k];
  }
  return hasil;
}
