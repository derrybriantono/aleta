/**
 * Saklar isi otomatis dari berkas e-Court (G2) sebagai butir Fitur Satker (keputusan Derry 26 Okt 2026:
 * dipindah dari layar Tenggat ke Fitur Satker bersama saklar fitur lain). Ketiganya MATI bawaan
 * (mati = perilaku persis seperti sebelum G2) dan hanya Super Admin yang dapat mengubahnya (layar Fitur Satker).
 */
export const KODE_FITUR_EC_BUKTI = "ecourt-bukti-otomatis";
export const KODE_FITUR_EC_KESIMPULAN = "ecourt-kesimpulan-otomatis";
export const KODE_FITUR_EC_BUKTI_SAKSI = "ecourt-bukti-saksi-usulan";

export const KODE_FITUR_BERKAS_ECOURT: readonly string[] = [KODE_FITUR_EC_BUKTI, KODE_FITUR_EC_KESIMPULAN, KODE_FITUR_EC_BUKTI_SAKSI];
