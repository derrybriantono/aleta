"use client";

/**
 * ============================================================================
 * LAYAR YANG TERSAMBUNG PENGERAS SUARA MEMUTAR PANGGILAN PETUGAS (BUTIR 33)
 * ============================================================================
 *
 * Tidak ada pengeras suara yang dapat dikendalikan server ALETA: satu-satunya
 * jalan suara yang sudah ada adalah Web Speech API di peramban layar antrian
 * dan papan panggil (suara-panggilan.ts). Karena itu "Panggil (audio
 * speaker)" mencatat pengumuman di server, dan tiap layar yang suaranya
 * MENYALA menanyai /api/pengumuman-suara tiap beberapa detik lalu
 * mengucapkannya - di pengeras suara yang tersambung ke komputer layar itu.
 *
 * Keterbatasannya, disebut apa adanya:
 *   - hanya berbunyi bila ada layar antrian / papan panggil yang TERBUKA dan
 *     suaranya dinyalakan (peramban menuntut satu tekan sebelum boleh
 *     bersuara);
 *   - jeda sampai sekitar 6 detik (POLA_PENGUMUMAN_MS);
 *   - semua layar memutarnya (ruang di SIPP berupa teks, layar antrian berupa
 *     nomor - pemetaannya tidak ditebak);
 *   - pengumuman berumur lebih dari 3 menit tidak diputar lagi.
 */

import { useEffect, useRef } from "react";

import { apiPath } from "@/lib/base-path";

export const POLA_PENGUMUMAN_MS = 6000;

type Jawaban = { terakhirId?: number; daftar?: Array<{ id: number; teks: string }> };

/** Langkah murni satu putaran: apa yang diucapkan dan id berikutnya. Diuji tersendiri. */
export function langkahPengumuman(
  sejakId: number | null,
  jawaban: Jawaban
): { ucapkan: string[]; sejakId: number } {
  const terakhir = Number(jawaban.terakhirId) || 0;
  // Putaran pertama (belum punya titik mula): hanya mencatat id terakhir,
  // tidak memutar apa pun yang sudah ada sebelum layar dibuka.
  if (sejakId === null) return { ucapkan: [], sejakId: terakhir };
  const baru = (jawaban.daftar ?? []).filter((x) => Number(x.id) > sejakId && String(x.teks || "").trim());
  const puncak = baru.reduce((m, x) => Math.max(m, Number(x.id)), Math.max(sejakId, terakhir));
  return { ucapkan: baru.map((x) => String(x.teks)), sejakId: puncak };
}

export function usePengumumanSuara({ nyala, bunyikan }: { nyala: boolean; bunyikan: (kalimat: string) => void }) {
  const sejak = useRef<number | null>(null);
  const ucap = useRef(bunyikan);
  useEffect(() => {
    ucap.current = bunyikan;
  }, [bunyikan]);

  useEffect(() => {
    if (!nyala) {
      sejak.current = null;
      return;
    }
    let berhenti = false;
    let sedang = false;
    const putar = async () => {
      if (sedang || berhenti) return;
      sedang = true;
      try {
        const kueri = sejak.current === null ? "" : `?sejakId=${sejak.current}`;
        const jawaban = await fetch(apiPath(`/api/pengumuman-suara${kueri}`), { cache: "no-store" });
        const isi = await jawaban.json().catch(() => ({}));
        if (berhenti || !jawaban.ok) return;
        const data = (isi?.data ?? isi) as Jawaban & { available?: boolean };
        if (data.available === false) return;
        const langkah = langkahPengumuman(sejak.current, data);
        sejak.current = langkah.sejakId;
        for (const kalimat of langkah.ucapkan) ucap.current(kalimat);
      } catch {
        /* jaringan putus - dicoba lagi pada putaran berikutnya */
      } finally {
        sedang = false;
      }
    };
    void putar();
    const pewaktu = window.setInterval(() => void putar(), POLA_PENGUMUMAN_MS);
    return () => {
      berhenti = true;
      window.clearInterval(pewaktu);
    };
  }, [nyala]);
}
