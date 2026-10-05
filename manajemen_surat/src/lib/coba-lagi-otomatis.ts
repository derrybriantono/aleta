"use client";

/**
 * ============================================================================
 * MUAT ULANG OTOMATIS BILA "Failed to fetch" (5 Oktober 2026, butir 14)
 * ============================================================================
 *
 * Jadwal Sidang, Jadwal Mediasi, dan Status Perkara terbuka sepanjang hari di
 * meja petugas. Server yang dimulai ulang sebentar, Wi-Fi kantor yang putus
 * semenit, atau proksi yang menjawab 502 selama portal dibangun ulang -
 * semuanya meninggalkan "Failed to fetch" merah yang menetap sampai seseorang
 * menekan muat ulang, padahal servernya sudah hidup lagi semenit kemudian.
 *
 * Yang dikerjakan di sini:
 *
 *   - MENGENALI gangguan jaringan: TypeError "Failed to fetch" / NetworkError,
 *     jawaban 502/503/504, dan jawaban yang bukan JSON (halaman galat proksi).
 *     Galat biasa (400, pesan bot "belum dapat dihubungi") BUKAN gangguan -
 *     tidak dicoba ulang, sebab mencobanya lagi tidak mengubah apa pun.
 *   - MENCOBA LAGI dengan jeda yang memanjang: 2, 4, 8, 15 detik, lalu tiap
 *     30 detik. Satu percobaan berjalan pada satu waktu - percobaan berikut
 *     baru dijadwalkan sesudah yang ini selesai, jadi tidak ada badai.
 *   - SEGERA mencoba lagi saat tab kembali terlihat atau jaringan kembali
 *     online; tab tersembunyi menunda percobaannya sampai terlihat lagi.
 *   - Data lama yang sudah tampil TIDAK dikosongkan - itu tugas pemanggil:
 *     cukup jangan menyetel ulang data saat gagal.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { jenisGangguan, pesanGangguan } from "@/lib/pesan-gangguan";

/** Jeda tiap percobaan berturut-turut; sesudah yang terakhir, tetap 30 detik. */
export const JEDA_COBA_LAGI_MS = [2000, 4000, 8000, 15000, 30000] as const;

/** Jeda sebelum percobaan ke-(gagalBeruntun) - gagal pertama = 2 detik. */
export function jedaCobaLagi(gagalBeruntun: number): number {
  const i = Math.max(0, Math.floor(gagalBeruntun) - 1);
  return JEDA_COBA_LAGI_MS[Math.min(i, JEDA_COBA_LAGI_MS.length - 1)];
}

/** Status HTTP yang berarti server/proksi sedang tidak siap - layak dicoba lagi. */
const STATUS_GANGGUAN = new Set([502, 503, 504]);

/** Galat yang membawa status HTTP - dilempar bacaJsonAman. */
export class GalatJawaban extends Error {
  status: number;
  gangguan: boolean;
  constructor(pesan: string, status: number, gangguan: boolean) {
    super(pesan);
    this.name = "GalatJawaban";
    this.status = status;
    this.gangguan = gangguan;
  }
}

/** Apakah kegagalan ini gangguan jaringan / server yang layak dicoba lagi otomatis. */
export function gangguanJaringan(galat: unknown, status = 0): boolean {
  if (galat instanceof GalatJawaban) return galat.gangguan;
  if (STATUS_GANGGUAN.has(status)) return true;
  if (galat instanceof TypeError) return true; // fetch: "Failed to fetch", "NetworkError ...", "Load failed"
  const jenis = jenisGangguan(galat, status);
  return jenis === "tidak-terjangkau" || jenis === "basis-data";
}

/**
 * Membaca jawaban fetch sebagai JSON DENGAN memeriksa statusnya lebih dulu.
 *
 *   badan JSON sah         -> isi JSON-nya, APA PUN statusnya (jawaban !ok
 *                             yang membawa pesan - pemanggil memutuskan sendiri)
 *   badan bukan JSON       -> GalatJawaban; gangguan bila 502/503/504, !ok,
 *                             atau badannya halaman HTML (proksi / server
 *                             sedang dimulai ulang)
 */
export async function bacaJsonAman(jawaban: Response): Promise<unknown> {
  // Tiruan jawaban (uji lama) kadang hanya punya json(): dipakai apa adanya.
  if (typeof (jawaban as Partial<Response>).text !== "function") return jawaban.json();
  const teks = await jawaban.text();
  try {
    // JSON yang sah dipulangkan apa pun statusnya - termasuk 504 BERPESAN dari
    // rute portal sendiri (mis. "Pencarian dihentikan karena melewati batas
    // 15 detik"): itu jawaban, bukan jaringan putus, dan mengulang kueri berat
    // tiap dua detik justru membebani SIPP. Yang dicoba lagi hanya 502/503/504
    // dari proksi (badannya halaman HTML / teks), dan badan bukan JSON lain.
    return teks ? JSON.parse(teks) : {};
  } catch {
    const html = /^\s*</.test(teks);
    throw new GalatJawaban(
      STATUS_GANGGUAN.has(jawaban.status)
        ? `Server menjawab ${jawaban.status}.`
        : `Jawaban server bukan JSON (status ${jawaban.status}).`,
      jawaban.status,
      STATUS_GANGGUAN.has(jawaban.status) || html || !jawaban.ok
    );
  }
}

/**
 * Pesan `available: false` dari rute portal yang berarti ALETA Bot TIDAK
 * TERJANGKAU (sedang dimulai ulang / mati) - layak dicoba lagi sendiri. Pesan
 * lain (kueri SIPP habis waktu, tabel tidak ada, perkara tidak ditemukan)
 * BUKAN gangguan jaringan: mengulangnya tiap beberapa detik hanya membebani
 * SIPP, dan pesannya harus tetap terbaca apa adanya.
 */
export function botTakTerjangkau(pesan: unknown): boolean {
  const teks = String(pesan ?? "").toLowerCase();
  if (/tidak dapat dihubungi|belum dapat dihubungi|koneksi ditolak/.test(teks)) return true;
  return jenisGangguan(teks) === "tidak-terjangkau";
}

/** Kalimat ramah untuk gangguan pemuatan data (bukan halaman masuk). */
export function kalimatGangguan(galat: unknown, status = 0): string {
  return pesanGangguan(
    galat,
    "Server ALETA sedang tidak menjawab seperti biasa. Data yang sudah tampil tetap dapat dibaca; ALETA akan mencoba memuat lagi sendiri.",
    status,
    "data"
  );
}

export type KeadaanCobaLagi = {
  /** Sedang dalam gangguan jaringan - menunggu / sedang mencoba lagi. */
  gangguan: boolean;
  /** Kalimat ramah gangguannya. */
  pesan: string;
  /** Berapa kali gagal berturut-turut. */
  gagalBeruntun: number;
  /** Detik tersisa sampai percobaan berikut; null bila tidak dijadwalkan (mis. tab tersembunyi). */
  sisaDetik: number | null;
  /** Percobaan sedang berjalan. */
  mencoba: boolean;
};

const KEADAAN_AWAL: KeadaanCobaLagi = { gangguan: false, pesan: "", gagalBeruntun: 0, sisaDetik: null, mencoba: false };

/**
 * Pengelola coba-lagi untuk satu pemuat data.
 *
 * Pemanggil memanggil `laporGagal(galat, status)` di catch pemuatnya
 * (jawabannya true bila itu gangguan dan sudah dijadwalkan coba lagi - pemanggil
 * lalu TIDAK menampilkan galat mentahnya), dan `laporBerhasil()` saat pemuatan
 * berhasil. `cobaLagi` dipanggil oleh pengelola ini - satu per satu.
 */
export function useCobaLagiOtomatis(cobaLagi: () => unknown) {
  const [keadaan, setKeadaan] = useState<KeadaanCobaLagi>(KEADAAN_AWAL);
  const cobaRef = useRef(cobaLagi);
  useEffect(() => {
    cobaRef.current = cobaLagi;
  });
  const gagalRef = useRef(0);
  const targetRef = useRef<number | null>(null);
  const mencobaRef = useRef(false);
  const tertundaRef = useRef(false);

  const jalankan = useCallback(() => {
    if (mencobaRef.current) return;
    targetRef.current = null;
    tertundaRef.current = false;
    mencobaRef.current = true;
    setKeadaan((k) => ({ ...k, mencoba: true, sisaDetik: null }));
    void Promise.resolve()
      .then(() => cobaRef.current())
      .catch(() => {
        // Pemuat yang melempar tanpa melapor: dianggap gangguan juga, supaya
        // percobaannya tidak berhenti diam-diam.
      })
      .finally(() => {
        mencobaRef.current = false;
        setKeadaan((k) => ({ ...k, mencoba: false }));
      });
  }, []);

  const laporGagal = useCallback((galat: unknown, status = 0, pesanKhusus = ""): boolean => {
    if (!gangguanJaringan(galat, status)) {
      gagalRef.current = 0;
      targetRef.current = null;
      setKeadaan(KEADAAN_AWAL);
      return false;
    }
    gagalRef.current += 1;
    const jeda = jedaCobaLagi(gagalRef.current);
    targetRef.current = Date.now() + jeda;
    setKeadaan({
      gangguan: true,
      pesan: pesanKhusus || kalimatGangguan(galat, galat instanceof GalatJawaban ? galat.status : status),
      gagalBeruntun: gagalRef.current,
      sisaDetik: Math.ceil(jeda / 1000),
      mencoba: false,
    });
    return true;
  }, []);

  const laporBerhasil = useCallback(() => {
    gagalRef.current = 0;
    targetRef.current = null;
    tertundaRef.current = false;
    setKeadaan((k) => (k.gangguan || k.gagalBeruntun ? KEADAAN_AWAL : k));
  }, []);

  // Detak satu detik HANYA selama gangguan: hitung mundur + menembak percobaan.
  useEffect(() => {
    if (!keadaan.gangguan) return;
    const detak = window.setInterval(() => {
      const target = targetRef.current;
      if (target === null || mencobaRef.current) return;
      const sisa = target - Date.now();
      if (sisa > 0) {
        setKeadaan((k) => ({ ...k, sisaDetik: Math.ceil(sisa / 1000) }));
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        // Tab tersembunyi tidak dibaca siapa pun: tunda sampai terlihat lagi.
        tertundaRef.current = true;
        targetRef.current = null;
        setKeadaan((k) => ({ ...k, sisaDetik: null }));
        return;
      }
      jalankan();
    }, 1000);
    return () => window.clearInterval(detak);
  }, [keadaan.gangguan, jalankan]);

  // Tab terlihat lagi / jaringan kembali: coba seketika (bila sedang gangguan).
  useEffect(() => {
    if (!keadaan.gangguan) return;
    const segera = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      jalankan();
    };
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") segera();
    };
    document.addEventListener("visibilitychange", saatTerlihat);
    window.addEventListener("online", segera);
    return () => {
      document.removeEventListener("visibilitychange", saatTerlihat);
      window.removeEventListener("online", segera);
    };
  }, [keadaan.gangguan, jalankan]);

  return { keadaan, laporGagal, laporBerhasil, cobaSekarang: jalankan };
}
