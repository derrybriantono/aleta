/**
 * ============================================================================
 * RUANG SIDANG + SIDANG KELILING DI BLANGKO TUNDA / PUTUS (5 Okt 2026, butir 25)
 * ============================================================================
 *
 * Blangko "Tunda sidang" dan "Catat putusan" di Jadwal Sidang kini menanyakan
 * RUANG SIDANG dan SIDANG KELILING - seperti blangko tunda SIPP sendiri
 * (views/perkara_tab/jadwal_sidang_p_tunda.php + jadwal_sidang_c.php):
 *
 *   - ruangan_id + ruangan (nama dari ruangan_sidang), sidang_keliling 'Y'/'T'
 *     pada perkara_jadwal_sidang;
 *   - tunda: untuk baris sidang BERIKUTNYA (sebelumnya disalin diam-diam dari
 *     sidang ini - sidang keliling yang ditunda ke dalam gedung tertulis
 *     keliling, dan sebaliknya);
 *   - putus: untuk baris sidang INI, hanya bila diubah.
 *
 * Bawaan: ruangan yang sekarang tercatat untuk sidang itu; sidang keliling
 * tercentang hanya bila sidang itu memang keliling - kolom sidang_keliling
 * 'Y' atau ruangannya ruangan keliling (bendera SIPP / namanya).
 */
import { ruanganKeliling, type Ruangan } from "@/lib/ruangan-sidang";

export type KeadaanRuang = {
  ruanganId?: number | null;
  ruangan?: string | null;
  sidangKeliling?: string | null;
};

export type BawaanRuangSidang = {
  /** id ruangan terpilih sebagai teks; "" = tetap seperti tercatat (ruangannya tidak ada di daftar aktif). */
  ruanganId: string;
  keliling: boolean;
};

/** Ruangan dari daftar menurut id, atau null. */
export function ruanganMenurutId(daftar: readonly Ruangan[], id: string | number | null | undefined): Ruangan | null {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  return daftar.find((r) => Number(r.id) === n) ?? null;
}

/** Bawaan blangko: ruangan yang tercatat, keliling hanya bila sidang itu memang keliling. */
export function bawaanRuangSidang(keadaan: KeadaanRuang | null | undefined, daftar: readonly Ruangan[]): BawaanRuangSidang {
  const ada = ruanganMenurutId(daftar, keadaan?.ruanganId);
  const nama = String(keadaan?.ruangan || ada?.nama || "");
  const kolomY = String(keadaan?.sidangKeliling || "").trim().toUpperCase() === "Y";
  const keliling = kolomY || (nama ? ruanganKeliling(nama, ada ? ada.benderaKeliling : null) : false);
  return { ruanganId: ada ? String(ada.id) : "", keliling };
}

/** Keliling mengikuti ruangan yang baru dipilih - hanya dipakai bila centangnya belum disentuh tangan. */
export function kelilingUntukRuangan(daftar: readonly Ruangan[], id: string): boolean | null {
  const r = ruanganMenurutId(daftar, id);
  return r ? ruanganKeliling(r.nama, r.benderaKeliling) : null;
}

/**
 * Isian yang dikirim ke bot. Ruangan "" (tetap seperti tercatat) tidak
 * dikirim - bot lalu memakai nilai yang tercatat, seperti semula.
 */
export function muatanRuangSidang(
  pilihan: BawaanRuangSidang,
  jalan: "tunda" | "putus"
): Record<string, number | boolean> {
  const id = Number(pilihan.ruanganId);
  const muatan: Record<string, number | boolean> = {};
  if (jalan === "tunda") {
    if (Number.isFinite(id) && id > 0) muatan.ruanganIdBerikut = id;
    muatan.sidangKelilingBerikut = pilihan.keliling;
  } else {
    if (Number.isFinite(id) && id > 0) muatan.ruanganIdSidang = id;
    muatan.sidangKelilingSidang = pilihan.keliling;
  }
  return muatan;
}
