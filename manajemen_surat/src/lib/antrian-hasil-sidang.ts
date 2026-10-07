/**
 * ============================================================================
 * BLANGKO TUNDA / PUTUSAN MENGIKUTI ANTRIAN SIDANG (7 Okt 2026, kasus 273)
 * ============================================================================
 *
 * Bot mengirim, bersama keadaan jadwal sidang, ringkasan barisnya di
 * sipp_turunan_antrian.antrian_sidang (sidangHasilService.ringkasAntrian) dan
 * atas nama siapa tombolnya akan menulis ke SIPP (panitera sidang perkara).
 *
 * Aplikasi antrian satker mengisi kehadiran dari pihak_1/pihak_2 yang sudah
 * mengambil nomor: keduanya -> 1, hanya pihak_1 -> 2, hanya pihak_2 -> 3.
 * Perkara 273: hanya pihak_1 -> 2 ("pihak pertama saja"); ALETA mengusulkan 1
 * dari riwayat sidang, lalu PP menulis 2 sendiri di SIPP.
 *
 * Kosong-kosong = tidak diketahui (null), BUKAN "tidak hadir": perkara yang
 * tidak mengambil nomor antrian juga kosong-kosong.
 */

export type AntrianSidangRingkas = {
  jadwalId?: number | null;
  ruanganId?: number | null;
  keadaan?: string;
  /** Jam masuk ruang (HH:MM:SS) bila perkaranya sudah diproses masuk ruang. */
  jamMasuk?: string;
  hadirPihak1?: boolean;
  hadirPihak2?: boolean;
  /** 1/2/3 menurut aplikasi antrian; null = tidak diketahui. */
  dihadiriOleh?: number | null;
} | null;

export type AtasNamaSipp =
  | { ok: true; username: string; namaLengkap: string; peran?: string }
  | { ok: false; kode?: string; pesan?: string; nama?: string[] }
  | null
  | undefined;

/** Kehadiran usulan antrian - hanya 1/2/3; selain itu null (biarkan usulan riwayat). */
export function kehadiranDariAntrian(antrian: AntrianSidangRingkas | undefined): number | null {
  const n = Number(antrian?.dihadiriOleh);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

/**
 * Keadaan untuk bawaan ruang sidang blangko: ruang menurut antrian sidang bila
 * berbeda dari yang tercatat di SIPP (aplikasi antrian memakai ruang tempat
 * perkaranya disidangkan). Nama ruangannya lalu dibaca dari daftar ruangan.
 */
export function keadaanRuangMenurutAntrian<T extends { ruanganId?: number | null; ruangan?: string | null }>(
  keadaan: T,
  antrian: AntrianSidangRingkas | undefined
): T {
  const id = Number(antrian?.ruanganId);
  if (!Number.isFinite(id) || id <= 0 || id === Number(keadaan.ruanganId)) return keadaan;
  return { ...keadaan, ruanganId: id, ruangan: null };
}

/** Kalimat di blangko SEBELUM menulis: atas nama siapa tercatat di SIPP. */
export function kalimatAtasNama(atasNama: AtasNamaSipp): { ok: boolean; teks: string } | null {
  if (!atasNama) return null;
  if (atasNama.ok) {
    const nama = atasNama.namaLengkap || atasNama.username;
    return { ok: true, teks: `Akan tercatat di SIPP atas nama ${nama} (panitera sidang perkara ini).` };
  }
  return {
    ok: false,
    teks:
      atasNama.pesan ||
      "Panitera sidang perkara ini tidak tercatat di SIPP - isi dulu PP di SIPP. Tombol ini mencatat atas nama PP perkara.",
  };
}

/** Keterangan singkat asal kehadiran, untuk ditampilkan di bawah pilihan kehadiran. */
export function keteranganAntrian(antrian: AntrianSidangRingkas | undefined): string {
  if (!antrian) return "";
  const bagian: string[] = [];
  if (antrian.hadirPihak1 || antrian.hadirPihak2) {
    bagian.push(
      `Antrian sidang: pihak pertama ${antrian.hadirPihak1 ? "hadir" : "belum mengambil nomor"}, pihak kedua ${
        antrian.hadirPihak2 ? "hadir" : "belum mengambil nomor"
      }`
    );
  }
  if (antrian.jamMasuk) bagian.push(`masuk ruang pukul ${antrian.jamMasuk.slice(0, 5)}`);
  return bagian.length ? `${bagian.join(", ")}.` : "";
}
