import { type AletaDatabase } from "@/server/db/client";
import { type UserPersona } from "@/lib/types";

/**
 * ============================================================================
 * KAIT ANTAR-FITUR KEAMANAN (25 Okt 2026) - tanpa saling bergantung keras
 * ============================================================================
 *
 * Dua fitur Bagian 6 menyambung ke pekerjaan yang dikerjakan di cabang lain
 * (OTP/authenticator = rantai E5, Pusat kesehatan = rantai E2). Supaya cabang
 * ini berdiri sendiri DAN tersambung begitu yang lain digabung, penyambungnya
 * lewat daftar pendaftar di sini. Cabang lain cukup memanggil daftarkan...()
 * sekali saat modulnya dimuat; tanpa pendaftar, perilaku jatuh ke yang aman:
 *
 *   langkah kedua (6c)       tanpa pendaftar -> pengaman memakai sandi ulang +
 *                            ketik konfirmasi saja.
 *   penerima laporan         tanpa pendaftar -> hasil uji pulih hanya masuk
 *                            tabel hasil dan lonceng/WhatsApp admin.
 *
 * Wadahnya di globalThis: Next.js dapat memuat modul ini lebih dari sekali
 * (rute dan instrumentation dibundel terpisah), dan pendaftar harus terlihat
 * oleh semuanya.
 */

export type KonteksVerifikasi = {
  userId: string;
  sessionId?: string | null;
  ip: string;
  /** Alasan penantang: "masuk" saat membuat sesi, "sesi" saat sesi lama dipakai dari luar kantor. */
  tahap: "masuk" | "sesi";
};

/** Langkah kedua untuk aksi berdampak besar (6c): kode WhatsApp/authenticator. */
export type PemeriksaLangkahKedua = {
  nama: string;
  /** Apakah aktor ini punya cara memberi kode (mis. OTP aktif untuknya)? Bila tidak, langkah kedua dilewati untuknya. */
  tersedia: (db: AletaDatabase, aktor: UserPersona) => Promise<boolean>;
  periksa: (db: AletaDatabase, aktor: UserPersona, kode: string) => Promise<boolean>;
};

export type LaporanKesehatan = {
  /** Kunci tetap fitur, mis. "uji-pulih-cadangan". */
  sumber: string;
  tingkat: "baik" | "peringatan" | "gagal";
  judul: string;
  rincian: string;
  waktu: string;
  data?: Record<string, unknown>;
};
export type PenerimaLaporanKesehatan = { nama: string; terima: (db: AletaDatabase, laporan: LaporanKesehatan) => Promise<void> };

type Wadah = {
  langkahKedua: PemeriksaLangkahKedua | null;
  penerimaKesehatan: PenerimaLaporanKesehatan[];
};

const G = globalThis as unknown as { __aletaKaitKeamanan?: Wadah };
function wadah(): Wadah {
  G.__aletaKaitKeamanan ??= { langkahKedua: null, penerimaKesehatan: [] };
  return G.__aletaKaitKeamanan;
}

export function daftarkanLangkahKedua(p: PemeriksaLangkahKedua) {
  wadah().langkahKedua = p;
}
export function langkahKeduaTerdaftar() {
  return wadah().langkahKedua;
}

export function daftarkanPenerimaLaporanKesehatan(p: PenerimaLaporanKesehatan) {
  const w = wadah();
  w.penerimaKesehatan = [...w.penerimaKesehatan.filter((x) => x.nama !== p.nama), p];
}

/** Mengirim laporan ke semua penerima terdaftar; galat satu penerima tidak menghentikan yang lain. */
export async function laporkanKeKesehatan(db: AletaDatabase, laporan: LaporanKesehatan) {
  let sampai = 0;
  for (const p of wadah().penerimaKesehatan) {
    try {
      await p.terima(db, laporan);
      sampai += 1;
    } catch (galat) {
      console.warn("[KAIT KESEHATAN] penerima", p.nama, "gagal:", galat instanceof Error ? galat.message : "tidak diketahui");
    }
  }
  return sampai;
}

export function __setelUlangKaitUntukUji() {
  G.__aletaKaitKeamanan = { langkahKedua: null, penerimaKesehatan: [] };
}
