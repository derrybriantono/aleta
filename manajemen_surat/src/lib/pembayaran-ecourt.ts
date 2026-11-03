/**
 * ============================================================================
 * PEMBAYARAN e-COURT: REKENING PENGGUNA DAN e-SKUM (Kasir 3 Nov 2026)
 * ============================================================================
 *
 * Permintaan Derry:
 *   1. nomor rekening pengguna (biasanya Penggugat/Pemohon atau kuasanya) tampil di data pihak Status
 *      Perkara dan di kartu perkara Kasir ALETA;
 *   2. e-SKUM e-Court dapat dicetak dari Kasir ALETA (kolom JUMLAH tidak terpotong).
 *
 * Sumber: halaman detil pendaftaran e-Court yang sudah dibuka jembatan e-Court (bagian "Pembayaran
 * (e-Payment)" dan kotak "Lihat SKUM"), disimpan bot di aleta_bot_ecourt_pembayaran. Tidak ada tulisan ke
 * SIPP maupun e-Court.
 *
 * ============================================================================
 * DATA KEUANGAN PRIBADI - HANYA PERAN YANG DITETAPKAN DERRY (3 Nov 2026 17.55)
 * ============================================================================
 *
 * Yang boleh melihat rekening pembayar - semuanya PENUH: Super Admin, Admin, Ketua/Wakil Ketua, hakim,
 * panitera, kasir (termasuk bendahara/analis keuangan yang menjalankan kasir), dan PTSP. Peran lain
 * (panitera muda, PP, juru sita, mediator, sekretariat, TI, staf, penjaga sidang, dll.) TIDAK menerima apa
 * pun - rute menjawab 403, layar tidak menggambar barisnya. Tidak ada tingkat tersamar.
 */

import { golonganPengguna, type GolonganPeran } from "@/lib/matriks-peran";

type PenggunaGolongan = Parameters<typeof golonganPengguna>[0];

export type RincianSkum = { no: number; uraian: string; jumlah: number | null };

export type SkumEcourt = {
  kop: string[];
  judul: string;
  nama: string;
  alamat: string;
  telp: string;
  pengantar: string;
  rincian: RincianSkum[];
  total: number | null;
  kodePendaftaran: string;
};

export type PembayaranEcourt = {
  nomorPerkara: string;
  diterimaDari: string;
  nomorRekening: string;
  atasNama: string;
  bank: string;
  nomorPendaftaranOnline: string;
  nomorPembayaran: string;
  panjar: number | null;
  status: string;
  tanggal: string;
  jam: string;
  skum: SkumEcourt | null;
};

/** Yang dikirim ke layar: tanpa isi e-SKUM (alamat/telepon pembayar hanya lewat PDF untuk kasir). */
export type PembayaranTampil = Omit<PembayaranEcourt, "skum"> & { adaSkum: boolean };

/** Golongan yang boleh melihat rekening pembayar e-Court (keputusan Derry 3 Nov 2026 17.55). */
export const GOLONGAN_REKENING_PEMBAYAR: readonly GolonganPeran[] = ["super-admin", "admin", "pimpinan", "hakim", "panitera", "kasir", "ptsp"];

/** Boleh melihat rekening pembayar (penuh)? Peran lain tidak menerima apa pun. */
export function bolehLihatRekening(pengguna: PenggunaGolongan): boolean {
  return golonganPengguna(pengguna).some((g) => GOLONGAN_REKENING_PEMBAYAR.includes(g));
}

/** Untuk LAYAR: pengguna undefined = dirender tanpa PortalProvider (uji/layar lepas) - rute tetap penjaganya. */
export function bolehLihatRekeningLayar(pengguna: PenggunaGolongan | undefined): boolean {
  if (pengguna === undefined) return true;
  return bolehLihatRekening(pengguna);
}

/** Bentuk kiriman ke layar: isi SKUM tidak ikut, hanya tanda apakah sudah terbaca. */
export function pembayaranTampil(data: PembayaranEcourt): PembayaranTampil {
  const { skum, ...dasar } = data;
  return { ...dasar, adaSkum: Boolean(skum && skum.rincian && skum.rincian.length) };
}

function bakuNama(nama: string): string {
  return String(nama || "")
    .toLowerCase()
    .replace(/\b(s\.?\s?h\.?|s\.?\s?h\.?i\.?|m\.?\s?h\.?|s\.?\s?ag\.?|s\.?\s?e\.?|s\.?\s?pd\.?|s\.?\s?kom\.?|drs?\.?|ir\.?|hj?\.?)\b/g, " ")
    .replace(/\bbin(ti)?\b.*$/, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type OrangPembayar = { nama: string; jenis: string; pihakKe: number | null };

/**
 * Siapa pembayar e-Court di antara para pihak/kuasa. Cocok nama (gelar dan bin/binti diabaikan); bila tidak
 * ada yang cocok, pembayar dianggap untuk pihak pertama (Penggugat/Pemohon) dan ditandai `cocok: false`.
 */
export function pemilikPembayaran<T extends OrangPembayar>(
  diterimaDari: string,
  orang: T[]
): { orang: T | null; cocok: boolean; kuasa: boolean } {
  const b = bakuNama(diterimaDari);
  if (b) {
    const sama = orang.find((o) => bakuNama(o.nama) === b);
    const mirip =
      sama ??
      orang.find((o) => {
        const x = bakuNama(o.nama);
        return x.length >= 4 && (x.startsWith(b) || b.startsWith(x));
      });
    if (mirip) return { orang: mirip, cocok: true, kuasa: mirip.jenis === "kuasa" };
  }
  const pertama = orang.find((o) => o.jenis !== "kuasa" && o.pihakKe === 1) ?? null;
  return { orang: pertama, cocok: false, kuasa: false };
}

/** 29500 -> "Rp29.500" (titik ribuan, tanpa desimal). */
export function rupiahTitik(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "-";
  const x = Math.round(Number(n));
  const s = Math.abs(x)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${x < 0 ? "-" : ""}Rp${s}`;
}

/** 355000 -> "355.000,00" (bentuk e-SKUM e-Court). */
export function angkaSkum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "-";
  const x = Math.round(Number(n));
  return `${x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},00`;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-05-14" -> "14 Mei 2026". */
export function tanggalIndonesia(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Satu kalimat ringkas pembayar untuk kartu/layar, mis. "Nama · BNI 9900112233". */
export function ringkasPembayar(p: Pick<PembayaranTampil, "diterimaDari" | "bank" | "nomorRekening">): string {
  return [p.diterimaDari, [p.bank, p.nomorRekening].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}
