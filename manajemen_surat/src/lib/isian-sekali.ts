import { ISIAN_SEKALI_DATA, type IsianSekaliData } from "@/lib/isian-sekali-data";
import { menyebutAleta } from "@/lib/tanda-aleta";

/**
 * ============================================================================
 * ISIAN SEKALI PER PERKARA - ATURAN MURNI (25 Okt 2026, rantai D butir D2 = U11)
 * ============================================================================
 *
 * Dari 345 isian popup blangko Derry, 134 belum punya pengisi otomatis dan 53 di antaranya memang tidak
 * punya sumber di SIPP (penilaian hakim, atau tidak tercatat). Isian itu diketik petugas. Aturan ini
 * membuat ketikan itu cukup SEKALI per perkara:
 *
 *   1. Begitu petugas menyimpan salah satunya ke ABT, ALETA mengingatnya per perkara
 *      (aleta_isian_perkara, migrasi 0035: kunci perkara + nomor variabel).
 *   2. Di blangko lain perkara yang sama, isian yang masih kosong di ABT diberi SARAN dari ingatan
 *      itu. Saran, bukan tulisan: petugas yang menekan Tab / "Input ke ABT". ALETA tidak pernah
 *      mengisi ABT sendiri dari ingatan ini, supaya isian yang sengaja dikosongkan petugas tidak
 *      diisi lagi diam-diam.
 *   3. Tidak ada nilai bawaan dan tidak ada tebakan dari perkara lain yang mirip: ingatan ini hanya
 *      menyimpan apa yang pernah diketik atau diterima petugas untuk perkara ITU.
 *
 * Daftar isiannya (ISIAN_SEKALI_DATA) dibangun dari docs/isi-sipp-abt/DAFTAR-CEK.json; urutannya
 * mengikuti BEBAN-MANUAL.json (isian yang paling sering diketik dikerjakan dahulu), dan layar Admin
 * menambahkan hitungan hidup dari jejak isian (C1).
 *
 * Saklar: Fitur Satker "isian-sekali", bawaan MATI. Mati = tidak ada yang diingat dan tidak ada saran.
 */

export const KODE_FITUR_ISIAN_SEKALI = "isian-sekali";

/** Batas panjang satu nilai yang diingat. */
export const BATAS_NILAI_SEKALI = 4000;
/** Isian tanggal pendek. */
export const BATAS_TANGGAL_SEKALI = 60;

export type IsianSekali = IsianSekaliData;

const PETA = new Map<string, IsianSekali>(ISIAN_SEKALI_DATA.map((i) => [i.kode, i]));

const teks = (x: unknown): string => String(x ?? "").trim();

/** Nomor variabel dirapikan menjadi 4 angka bila murni angka. */
export function kodeSekali(x: unknown): string {
  const t = teks(x).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 20);
  return /^\d{1,4}$/.test(t) ? t.padStart(4, "0") : t;
}

export function infoIsianSekali(kode: unknown): IsianSekali | null {
  return PETA.get(kodeSekali(kode)) ?? null;
}

export const adalahIsianSekali = (kode: unknown): boolean => PETA.has(kodeSekali(kode));

/** Daftar kode yang dikenal, menurut urutan beban (terbanyak diketik dahulu). */
export function daftarKodeSekali(): string[] {
  return ISIAN_SEKALI_DATA.map((i) => i.kode);
}

export type MasukanSekali = { perkaraId: string; nomorPerkara: string; kode: string; nilai: string };

export type TolakSekali = { ditolak: true; sebab: string };

/**
 * Membersihkan satu masukan dari ekstensi. Kode di luar daftar ditolak (bukan isian sekali), nilai yang
 * memuat kata ALETA ditolak (tidak boleh sampai ke SIPP/ABT lewat saran), nilai dipotong tanpa diam
 * tidak diizinkan: terlalu panjang ditolak.
 */
export function bersihkanMasukanSekali(mentah: unknown): MasukanSekali | TolakSekali {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return { ditolak: true, sebab: "Masukan tidak sah." };
  const o = mentah as Record<string, unknown>;
  const perkaraId = teks(o.perkaraId).slice(0, 60);
  if (!perkaraId) return { ditolak: true, sebab: "Perkara tidak disebutkan." };
  const kode = kodeSekali(o.kode);
  const info = PETA.get(kode);
  if (!info) return { ditolak: true, sebab: "Bukan isian sekali per perkara." };
  const nilai = String(o.nilai ?? "").replace(/\r\n/g, "\n").trim();
  const batas = info.jenis === "tanggal" ? BATAS_TANGGAL_SEKALI : BATAS_NILAI_SEKALI;
  if (nilai.length > batas) return { ditolak: true, sebab: "Isian terlalu panjang untuk diingat." };
  if (menyebutAleta(nilai)) return { ditolak: true, sebab: "Isian memuat tanda sistem dan tidak diingat." };
  return { perkaraId, nomorPerkara: teks(o.nomorPerkara).slice(0, 100), kode, nilai };
}

// ─── Urutan beban ───────────────────────────────────────────────────────────

export type BarisBeban = {
  kode: string;
  nama: string;
  jenis: string;
  keadaan: string;
  /** Perkara sejak 2023 yang isiannya diketik petugas (daftar cek, luring). */
  bebanDaftar: number;
  /** Penyimpanan ketikan di ALETA (jejak isian, hidup); 0 bila jejak mati. */
  diketikHidup: number;
  /** Perkara yang isiannya sudah diingat per perkara. */
  diingat: number;
  blangko: number;
  tanpaSumber: boolean;
  sumber: string;
};

/**
 * Menyusun urutan kerja: yang paling sering diketik di lapangan dahulu (hitungan hidup), lalu beban daftar cek,
 * lalu yang dipakai paling banyak blangko. Murni.
 */
export function urutkanBeban(hidup: Record<string, number>, diingat: Record<string, number>): BarisBeban[] {
  return ISIAN_SEKALI_DATA.map((i) => ({
    kode: i.kode,
    nama: i.nama,
    jenis: i.jenis,
    keadaan: i.keadaan,
    bebanDaftar: i.beban,
    diketikHidup: Math.max(0, Math.round(Number(hidup[i.kode]) || 0)),
    diingat: Math.max(0, Math.round(Number(diingat[i.kode]) || 0)),
    blangko: i.blangko,
    tanpaSumber: i.tanpaSumber,
    sumber: i.sumber,
  })).sort((a, b) => b.diketikHidup - a.diketikHidup || b.bebanDaftar - a.bebanDaftar || b.blangko - a.blangko || a.kode.localeCompare(b.kode));
}
