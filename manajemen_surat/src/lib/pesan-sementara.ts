"use client";

/**
 * ============================================================================
 * PESAN BERHASIL HILANG SENDIRI, PESAN GAGAL MENETAP (5 Oktober 2026, butir 3)
 * ============================================================================
 *
 * Diminta pengguna: di Jadwal Sidang, Jadwal Mediasi, dan Status Perkara
 * kotak "berhasil" ("N perkara didaftarkan ke antrian", "Sidang ditandai
 * selesai", ...) tidak boleh menetap - ia menutupi tabel dan lama-lama tidak
 * dibaca lagi, sehingga pesan GAGAL yang muncul di tempat yang sama ikut
 * terlewat. Yang gagal tetap tampil sampai keadaannya berubah (aksi berikutnya
 * menggantinya) atau ditutup dengan tombol x.
 */
import { useEffect, useRef, useState } from "react";

/** Berapa lama pesan berhasil tampil sebelum hilang sendiri. */
export const LAMA_PESAN_BERHASIL_MS = 4000;

export type PesanSementara = { ok: boolean; teks: string };

/**
 * State pesan { ok, teks }: yang ok hilang sendiri sesudah `lamaMs`, yang
 * tidak ok menetap. Pesan yang diganti sebelum waktunya tidak ikut terhapus
 * oleh pewaktu pesan lama.
 */
export function usePesanSementara(lamaMs = LAMA_PESAN_BERHASIL_MS) {
  const [pesan, setPesan] = useState<PesanSementara | null>(null);
  useHilangSendiri(pesan, Boolean(pesan?.ok), () => setPesan((kini) => (kini === pesan ? null : kini)), lamaMs);
  return [pesan, setPesan] as const;
}

/**
 * Untuk state pesan yang bentuknya sudah ada (teks, objek hasil): bila
 * `berhasil` dan `nilai` tidak kosong, `hapus` dipanggil sesudah `lamaMs`.
 * Pewaktunya dimulai ulang tiap kali `nilai` berganti (identitasnya).
 */
export function useHilangSendiri(nilai: unknown, berhasil: boolean, hapus: () => void, lamaMs = LAMA_PESAN_BERHASIL_MS) {
  const hapusRef = useRef(hapus);
  useEffect(() => {
    hapusRef.current = hapus;
  });
  useEffect(() => {
    if (!nilai || !berhasil) return;
    const pewaktu = window.setTimeout(() => hapusRef.current(), lamaMs);
    return () => window.clearTimeout(pewaktu);
  }, [nilai, berhasil, lamaMs]);
}
