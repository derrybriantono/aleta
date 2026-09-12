/**
 * ============================================================================
 * OBYEK SENGKETA - MERANGKUM KEBIASAAN SATKER
 * ============================================================================
 *
 * Kotak Obyek Sengketa pada layar Data Umum tidak diisi dari posita. Isinya
 * kebiasaan satker untuk jenis perkara itu: pada 1.345 cerai gugat PA Donggala
 * ditulis "Pernikahan/Perceraian" 895 kali, "Pernikahan / Perceraian" 273
 * kali, "Pernikahan atau Perceraian" 128 kali, "Perkawinan/Perceraian" 9 kali
 * - satu maksud, empat ejaan.
 *
 * Bot memulangkan ejaan-ejaan itu apa adanya beserta jumlahnya. Berkas ini
 * yang menggabungkan varian yang semakna, memilih ejaan yang paling sering
 * dipakai sebagai yang diperlihatkan, dan memutuskan apakah kebiasaannya
 * cukup kuat untuk dicentang sendiri.
 *
 * ============================================================================
 * KAPAN DICENTANG SENDIRI
 * ============================================================================
 *
 * Hanya bila satu maksud dipakai pada sekurang-kurangnya AMBANG_YAKIN dari
 * seluruh perkara sejenis DAN riwayatnya cukup panjang. Cerai gugat memenuhi
 * keduanya (1.296 dari 1.345). Penetapan ahli waris tidak: "Penetapan Ahli
 * Waris" 17, "Ahli Waris" 6, lalu obyek-obyek yang memang berbeda tiap
 * perkara - tanah, dana BPJS. Di sana yang ditulis petugas adalah keadaan
 * perkaranya sendiri, dan kebiasaan tidak berhak menimpanya.
 */

export type BarisObyek = {
  obyek: string;
  jumlah: number;
};

export type KebiasaanObyek = {
  /** Ejaan yang paling sering dipakai untuk maksud ini - inilah yang diusulkan. */
  nilai: string;
  jumlah: number;
  /** Pecahan dari seluruh perkara sejenis, 0..1. */
  bagian: number;
  /** Ejaan lain yang digabungkan ke sini, tanpa yang terpilih. */
  varian: string[];
};

export type UsulanObyek = {
  total: number;
  yakin: boolean;
  usulan: KebiasaanObyek[];
};

/** Pecahan minimum agar kebiasaannya dicentang sendiri. */
export const AMBANG_YAKIN = 0.8;
/** Riwayat minimum agar sebuah kebiasaan dianggap kebiasaan, bukan kebetulan. */
export const RIWAYAT_MINIMUM = 20;

/**
 * Kunci penggabungan: ejaan yang semakna jatuh ke kunci yang sama.
 *
 * Yang disamakan hanya perbedaan yang jelas-jelas ejaan: huruf besar-kecil,
 * spasi di sekitar garis miring, "atau" sebagai pengganti garis miring,
 * "istbat"/"itsbat" lawan "isbat", "perkawinan" lawan "pernikahan". Yang
 * TIDAK disamakan: kata yang berbeda. "Pernikahan" dan "Isbat Nikah" pada
 * perkara itsbat adalah dua kebiasaan yang berbeda, dan keduanya
 * diperlihatkan.
 */
export function kunciObyek(teks: string): string {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+atau\s+/g, "/")
    .replace(/\bi[st]{1,2}bat\b/g, "isbat")
    .replace(/\bperkawinan\b/g, "pernikahan")
    .replace(/[.,;:!]+$/g, "")
    .trim();
}

/**
 * Menggabungkan varian ejaan dan mengurutkannya dari yang paling sering.
 */
export function rangkumKebiasaanObyek(baris: BarisObyek[]): { total: number; daftar: KebiasaanObyek[] } {
  const kelompok = new Map<string, { jumlah: number; ejaan: Map<string, number> }>();
  let total = 0;

  for (const satu of Array.isArray(baris) ? baris : []) {
    const obyek = String(satu?.obyek ?? "").replace(/\s+/g, " ").trim();
    const jumlah = Number(satu?.jumlah ?? 0);
    if (!obyek || !Number.isFinite(jumlah) || jumlah <= 0) continue;

    const kunci = kunciObyek(obyek);
    if (!kunci) continue;
    total += jumlah;

    const ada = kelompok.get(kunci) ?? { jumlah: 0, ejaan: new Map<string, number>() };
    ada.jumlah += jumlah;
    ada.ejaan.set(obyek, (ada.ejaan.get(obyek) ?? 0) + jumlah);
    kelompok.set(kunci, ada);
  }

  const daftar: KebiasaanObyek[] = [];
  for (const { jumlah, ejaan } of kelompok.values()) {
    // Ejaan yang paling sering dipakai menjadi wajah kelompoknya. Bila seri,
    // yang lebih dahulu terdaftar - dan bot mengurutkan dari yang terbanyak.
    const urut = [...ejaan.entries()].sort((a, b) => b[1] - a[1]);
    daftar.push({
      nilai: urut[0][0],
      jumlah,
      bagian: total > 0 ? jumlah / total : 0,
      varian: urut.slice(1).map(([teks]) => teks),
    });
  }

  daftar.sort((a, b) => b.jumlah - a.jumlah || a.nilai.localeCompare(b.nilai, "id"));
  return { total, daftar };
}

/**
 * Usulan untuk kotak Obyek Sengketa.
 *
 * @param batas Berapa kebiasaan teratas yang diperlihatkan sebagai pilihan.
 */
export function usulkanObyekSengketa(baris: BarisObyek[], batas = 3): UsulanObyek {
  const { total, daftar } = rangkumKebiasaanObyek(baris);
  const teratas = daftar[0];
  const yakin = Boolean(teratas) && total >= RIWAYAT_MINIMUM && teratas.bagian >= AMBANG_YAKIN;
  return { total, yakin, usulan: daftar.slice(0, Math.max(1, batas)) };
}
