/**
 * Hasil satu relaas panggilan: bertemu atau tidak.
 *
 * Panggilan elektronik (sandi SIPP "E") yang dilaksanakan DIANGGAP BERTEMU -
 * ketentuan pengguna 21 Okt 2026. Ini tafsiran tampilan dan hitungan ALETA;
 * data SIPP tidak diubah. SIPP tidak menyimpan keterangan "gagal terkirim"
 * untuk sandi E (status_pos kosong pada seluruh barisnya), jadi tidak ada
 * yang dapat dibedakan sebagai gagal.
 */
export type BahanHasilRelaas = {
  bertemu?: boolean;
  caraRelaas?: { sandi?: string } | null;
};

export function relaasBertemu(baris: BahanHasilRelaas): boolean {
  if (baris.bertemu) return true;
  return String(baris.caraRelaas?.sandi ?? "").trim().toUpperCase() === "E";
}

/** Panggilan elektronik, bukan pertemuan langsung. */
export function relaasElektronik(baris: BahanHasilRelaas): boolean {
  return !baris.bertemu && String(baris.caraRelaas?.sandi ?? "").trim().toUpperCase() === "E";
}
