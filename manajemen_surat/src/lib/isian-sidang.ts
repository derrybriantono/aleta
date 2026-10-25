import { menyebutAleta } from "@/lib/tanda-aleta";

/**
 * ============================================================================
 * ISIAN BAS PER SIDANG - ATURAN MURNI (25 Okt 2026, rantai D butir D6 = U12)
 * ============================================================================
 *
 * ABT menyimpan isian teks/tanggal per (nomor variabel, perkara), bukan per sidang. BAS beruntun
 * (sidang pertama, kedua, ketiga ...) karena itu saling menimpa: mengetik isian BAS sidang kedua mengubah
 * isian yang tercetak pada BAS sidang pertama bila dicetak ulang.
 *
 * Lapisan ALETA menyimpan isian ketikan BAS PER SIDANG (aleta_isian_sidang, migrasi 0103). Saat petugas
 * mencetak BAS sidang tertentu, ekstensi:
 *
 *   1. menyimpan nilai ABT sekarang untuk isian yang berbeda (daftar pemulihan, juga di penyimpanan peramban),
 *   2. menulis nilai SIDANG ITU ke ABT,
 *   3. mengambil naskah BAS dari ABT,
 *   4. memulihkan nilai ABT semula (dan menghapus daftar pemulihan).
 *
 * Bila tahap 2 gagal di tengah, yang sudah ditulis dipulihkan dan cetak dibatalkan (tidak mencetak BAS
 * sidang yang salah). Bila peramban tertutup di antara 2 dan 4, daftar pemulihan yang tersimpan memulihkan
 * ABT begitu perkara itu dibuka lagi.
 *
 * Saklar: Fitur Satker "isian-per-sidang", bawaan MATI. Mati = tidak ada yang disimpan, tidak ada catatan,
 * cetak persis seperti sebelumnya. Tidak ada yang ditulis ke SIPP/e-Court.
 */

export const KODE_FITUR_ISIAN_SIDANG = "isian-per-sidang";
export const BATAS_NILAI_SIDANG = 4000;
export const BATAS_SIDANG = 99;

const teks = (x: unknown): string => String(x ?? "").trim();

/** Nomor variabel ABT: 1-5 angka, dirapikan menjadi 4 angka bila lebih pendek. */
export function kodeSidang(x: unknown): string {
  const t = teks(x).replace(/[^0-9]/g, "").slice(0, 5);
  return t.length >= 1 && t.length < 4 ? t.padStart(4, "0") : t;
}

export type MasukanSidang = { perkaraId: string; nomorPerkara: string; sidang: number; kode: string; nilai: string };
export type TolakSidang = { ditolak: true; sebab: string };

/** Membersihkan satu masukan dari ekstensi; kata ALETA, nilai terlalu panjang, sidang di luar 1..99 ditolak. */
export function bersihkanMasukanSidang(mentah: unknown): MasukanSidang | TolakSidang {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return { ditolak: true, sebab: "Masukan tidak sah." };
  const o = mentah as Record<string, unknown>;
  const perkaraId = teks(o.perkaraId).slice(0, 60);
  if (!perkaraId) return { ditolak: true, sebab: "Perkara tidak disebutkan." };
  const sidang = Math.round(Number(o.sidang) || 0);
  if (sidang < 1 || sidang > BATAS_SIDANG) return { ditolak: true, sebab: "Sidang tidak sah." };
  const kode = kodeSidang(o.kode);
  if (kode.length < 4) return { ditolak: true, sebab: "Nomor isian tidak sah." };
  const nilai = String(o.nilai ?? "").replace(/\r\n/g, "\n").trim();
  if (nilai.length > BATAS_NILAI_SIDANG) return { ditolak: true, sebab: "Isian terlalu panjang." };
  if (menyebutAleta(nilai)) return { ditolak: true, sebab: "Isian memuat tanda sistem dan tidak disimpan." };
  return { perkaraId, nomorPerkara: teks(o.nomorPerkara).slice(0, 100), sidang, kode, nilai };
}
