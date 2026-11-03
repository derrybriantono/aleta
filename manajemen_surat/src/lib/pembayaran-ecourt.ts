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
 * DATA KEUANGAN PRIBADI - PENUH HANYA UNTUK PERAN KEUANGAN PERKARA
 * ============================================================================
 *
 * Nomor rekening dan email atas-nama tampil UTUH hanya bagi peran yang mengurus uang perkara: kasir /
 * keuangan perkara / bendahara / analis keuangan, panitera dan panitera muda (pengawas keuangan perkara,
 * aksi `sidang.kasir-baca`), Admin dan Super Admin. Peran lain yang boleh melihat data pihak
 * (`status.data-pihak`) melihat nama pembayar, bank, dan rekening TERSAMAR (****2233) tanpa email.
 * Penyamaran dikerjakan di PELADEN (rute pembayaran-ecourt) - nilai utuh tidak pernah dikirim ke peramban
 * peran itu. Peran tanpa `status.data-pihak` tidak menerima apa pun (403).
 */

import { bolehAksi } from "@/lib/matriks-peran";

type PenggunaGolongan = Parameters<typeof bolehAksi>[0];

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

/** Yang dikirim ke layar: rekening utuh ATAU tersamar, menurut peran. */
export type PembayaranTampil = Omit<PembayaranEcourt, "skum"> & {
  penuh: boolean;
  adaSkum: boolean;
};

/** Rekening utuh: peran keuangan perkara (sidang.kasir-baca) + Admin/Super Admin. */
export function bolehRekeningPenuh(pengguna: PenggunaGolongan): boolean {
  return bolehAksi(pengguna, "sidang.kasir-baca");
}

/** "9900112233" -> "****2233"; kosong tetap kosong. */
export function samarkanRekening(nomor: string): string {
  const angka = String(nomor || "").replace(/\D/g, "");
  if (!angka) return "";
  return `****${angka.slice(-4)}`;
}

/** Saring satu pembayaran untuk peran: tersamar = rekening ****1234, email dan nomor pembayaran dibuang. */
export function pembayaranUntukPeran(data: PembayaranEcourt, penuh: boolean): PembayaranTampil {
  const { skum, ...dasar } = data;
  if (penuh) return { ...dasar, penuh: true, adaSkum: Boolean(skum && skum.rincian && skum.rincian.length) };
  return {
    ...dasar,
    nomorRekening: samarkanRekening(dasar.nomorRekening),
    atasNama: "",
    nomorPembayaran: "",
    penuh: false,
    adaSkum: Boolean(skum && skum.rincian && skum.rincian.length),
  };
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

/** Satu kalimat ringkas pembayar untuk kartu/layar, mis. "Nama · BNI ****2233". */
export function ringkasPembayar(p: Pick<PembayaranTampil, "diterimaDari" | "bank" | "nomorRekening">): string {
  return [p.diterimaDari, [p.bank, p.nomorRekening].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}
