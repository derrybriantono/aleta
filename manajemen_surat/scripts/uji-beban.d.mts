/** Deklarasi tipe untuk uji-beban.mjs - supaya ujinya dapat diperiksa tsc. */
export const VERSI_HASIL: number;
export const SELANG_MS: Readonly<Record<string, number>>;
export const PROFIL: Readonly<Record<string, { jadwal: number; konteks: number; statusPerkara: number; widget: number }>>;

export class SasaranDitolak extends Error {}

export type Sasaran = { url: URL; asal: string; awalan: string; host: string; perluResolusi: boolean };

export function alamatLoopback(alamat: unknown): boolean;
export function periksaSasaran(teks: unknown): Sasaran;
export function pastikanResolusiLoopback(
  host: string,
  cari?: (host: string) => Promise<unknown>
): Promise<void>;

export function persentil(nilai: number[], p: number): number;
export function ringkasLatensi(nilai: number[]): { p50: number; p95: number; p99: number; maks: number };
export function hitungKueriPerMenit(awal: number, akhir: number, durasiDetik: number, sampelSendiri?: number): number;
export function susunPerangkat(
  jumlah: number,
  profil?: string,
  benih?: number
): Array<{ nomor: number; jenis: string[] }>;
export function jalurPermintaan(
  jenis: string,
  ctx: { tanggal?: string; nomor: string; kataCari: string }
): string;

export type Pengumpul = {
  catat(jenis: string, ms: number, status: number, ketGalat?: string): void;
  ringkas(durasiDetik: number): {
    rute: Record<string, Record<string, unknown>>;
    total: Record<string, number>;
  };
};
export function buatPengumpul(): Pengumpul;

export function mulaiPengukurSipp(
  env: Record<string, string | undefined>,
  selangMs?: number,
  muatMysql?: () => Promise<unknown>
): Promise<{ tersedia: boolean; alasan?: string; berhenti: () => Promise<Record<string, unknown>> }>;

export function masukKembaran(
  sasaran: Sasaran,
  email: string | undefined,
  sandi: string | undefined,
  ambil?: typeof fetch
): Promise<string>;

export type HasilPutaran = {
  perangkat: number;
  durasiDetik: number;
  pemanasanDetik: number;
  rute: Record<string, Record<string, unknown>>;
  total: Record<string, number>;
  sumberDaya: Record<string, number>;
  sipp: Record<string, unknown>;
};
export function jalankanPutaran(opsi: Record<string, unknown>): Promise<HasilPutaran>;

export function teksRingkasan(hasil: Record<string, unknown>): string;
export function bacaArgumen(argv: string[]): Record<string, unknown> & { _: string[] };
export function utama(
  argv: string[],
  env?: Record<string, string | undefined>,
  deps?: {
    keluar?: (teks: string) => void;
    ambil?: typeof fetch;
    cariDns?: (host: string) => Promise<unknown>;
    muatMysql?: () => Promise<unknown>;
  }
): Promise<number>;
