"use client";

import { createElement, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { apiPath } from "@/lib/base-path";
import {
  BATAS_BASI_PENUH_MS,
  SELANG_RINGAN_HARI_INI_MS,
  SELANG_RINGAN_LAIN_MS,
  bacaJawabanRingan,
  gabungRingan,
  kalimatDiperbarui,
} from "@/lib/jadwal-ringan";

/**
 * Penyimpan kecil di luar React untuk waktu bacaan terakhir. Disimpan di luar
 * state supaya layar Jadwal Sidang (belasan ribu baris kode) TIDAK dilukis
 * ulang tiap 8 detik hanya demi satu jam kecil; hanya tandanya yang berlangganan.
 */
export type PenyimpanDiperbarui = {
  /** Waktu bacaan (ringan ATAU lengkap) terakhir yang berhasil. */
  ambil: () => number | null;
  /** Waktu jadwal LENGKAP terakhir yang berhasil (0 = belum pernah). */
  ambilPenuh: () => number;
  /** Mencatat bacaan ringan yang berhasil. */
  catat: (ms: number) => void;
  /** Mencatat jadwal lengkap yang berhasil (juga menyegarkan tanda). */
  catatPenuh: (ms: number) => void;
  dengar: (fn: () => void) => () => void;
};

export function buatPenyimpanDiperbarui(): PenyimpanDiperbarui {
  let terakhir: number | null = null;
  let penuh = 0;
  const pendengar = new Set<() => void>();
  const kabari = () => pendengar.forEach((fn) => fn());
  return {
    ambil: () => terakhir,
    ambilPenuh: () => penuh,
    catat: (ms) => {
      terakhir = ms;
      kabari();
    },
    catatPenuh: (ms) => {
      terakhir = ms;
      penuh = ms;
      kabari();
    },
    dengar: (fn) => {
      pendengar.add(fn);
      return () => {
        pendengar.delete(fn);
      };
    },
  };
}

export type OpsiJadwalRingan<T extends { sidangId: string }> = {
  /** Halaman memuat SATU tanggal (dari === sampai). Selain itu tidak bertanya sama sekali. */
  aktif: boolean;
  dari: string;
  sampai: string;
  /** Tanggal yang dibuka adalah hari ini: selang pendek + jadwal lengkap berkala ikut dipulihkan saat tab kembali. */
  hariIni: boolean;
  adaPencarian: boolean;
  sidang: T[];
  setSidang: (baru: T[]) => void;
  /** Jadwal lengkap sedang dimuat: ia membawa data yang lebih baru, jadi bacaan ringan dilewati. */
  sibuk: () => boolean;
  muatPenuh: () => void | Promise<void>;
  penyimpan: PenyimpanDiperbarui;
};

/**
 * Pembaruan RINGAN Jadwal Sidang - lihat @/lib/jadwal-ringan.
 *
 *   - bertanya ke /api/aleta-ecourt/sidang/ringan tiap 8 detik (hari ini) atau
 *     30 detik (tanggal lain), lalu menggabungkan kolom yang berubah ke baris;
 *   - tab tersembunyi: pengatur waktu DIHENTIKAN; saat terlihat lagi langsung
 *     bertanya, dan (hari ini) memuat jadwal lengkap sekali bila yang terakhir
 *     lebih tua dari BATAS_BASI_PENUH_MS - bukan menunggu putaran berikutnya;
 *   - permintaan sebelumnya belum selesai: putaran dilewati (tidak menumpuk);
 *   - gagal / bot lama tanpa rute ini: diam - jadwal lengkap berjalan seperti semula;
 *   - state HANYA diganti bila ada kolom yang berubah;
 *   - segarkan(): dipanggil sesudah penulisan (tunda/putus) - membuang bacaan
 *     yang sedang terbang (dibaca sebelum penulisan) dan bertanya lagi seketika.
 */
export function useJadwalRingan<T extends { sidangId: string }>(opsi: OpsiJadwalRingan<T>): { segarkan: () => Promise<void> } {
  const opsiRef = useRef(opsi);
  // Diperbarui di efek (dideklarasikan lebih dulu dari efek pengatur waktu, jadi sudah segar saat bertanya).
  useEffect(() => {
    opsiRef.current = opsi;
  });
  const segarkanRef = useRef<() => Promise<void>>(async () => {});
  const { aktif, dari, sampai, hariIni } = opsi;

  useEffect(() => {
    if (!aktif) {
      segarkanRef.current = async () => {};
      return;
    }
    const selangMs = hariIni ? SELANG_RINGAN_HARI_INI_MS : SELANG_RINGAN_LAIN_MS;
    let batal = false;
    let pengatur: ReturnType<typeof setInterval> | undefined;
    let sedangTanya = false;
    let ulang = false;
    let generasi = 0;
    let tandaPenuh = "";

    const tanya = async (): Promise<void> => {
      if (sedangTanya) {
        // Ada bacaan yang terbang: ia mungkin dimulai SEBELUM penulisan - ulangi sesudahnya.
        ulang = true;
        return;
      }
      sedangTanya = true;
      const generasiMulai = generasi;
      try {
        const kueri = new URLSearchParams({ dari, sampai });
        const jawaban = await fetch(`${apiPath("/api/aleta-ecourt/sidang/ringan")}?${kueri.toString()}`, {
          cache: "no-store",
        });
        const isi = (await jawaban.json().catch(() => ({}))) as { data?: unknown };
        if (batal || !jawaban.ok) return;
        const ringan = bacaJawabanRingan(isi?.data ?? isi);
        if (!ringan) return;
        // Rentang yang dibaca sudah bukan rentang bot menjawab (hari diganti di tengah jalan).
        if (ringan.dari !== dari || ringan.sampai !== sampai) return;
        const o = opsiRef.current;
        // Penulisan terjadi selama bacaan ini terbang: jangan menimpa perubahan setempat dengan bacaan lama.
        if (generasiMulai !== generasi) return;
        if (o.sibuk()) return;
        const gabung = gabungRingan(o.sidang, ringan, { adaPencarian: o.adaPencarian });
        if (gabung.berubah) o.setSidang(gabung.sidang);
        o.penyimpan.catat(Date.now());
        if (gabung.perluMuatPenuh && gabung.perluMuatPenuh !== tandaPenuh && !o.sibuk()) {
          tandaPenuh = gabung.perluMuatPenuh;
          void o.muatPenuh();
        }
      } catch {
        // Gangguan sesaat: tanda waktu tidak maju (jujur), jadwal lengkap tetap memuat ulang sendiri.
      } finally {
        sedangTanya = false;
        if (ulang && !batal) {
          ulang = false;
          void tanya();
        }
      }
    };

    segarkanRef.current = async () => {
      generasi += 1;
      await tanya();
    };

    const terlihat = () => typeof document === "undefined" || document.visibilityState === "visible";
    const mulai = () => {
      if (pengatur !== undefined) return;
      const o = opsiRef.current;
      // Kembali ke tab: jadwal lengkap yang basi dimuat sekali, tidak menunggu putaran 45 detik.
      if (hariIni && !o.sibuk() && o.penyimpan.ambilPenuh() > 0 && Date.now() - o.penyimpan.ambilPenuh() > BATAS_BASI_PENUH_MS) {
        void o.muatPenuh();
      }
      void tanya();
      pengatur = setInterval(() => void tanya(), selangMs);
    };
    const henti = () => {
      if (pengatur !== undefined) clearInterval(pengatur);
      pengatur = undefined;
    };
    const saatBerganti = () => (terlihat() ? mulai() : henti());

    if (terlihat()) mulai();
    document.addEventListener("visibilitychange", saatBerganti);
    return () => {
      batal = true;
      henti();
      document.removeEventListener("visibilitychange", saatBerganti);
      segarkanRef.current = async () => {};
    };
  }, [aktif, dari, sampai, hariIni]);

  return { segarkan: () => segarkanRef.current() };
}

/**
 * Tanda kecil "diperbarui hh:mm:ss". Berlangganan penyimpan sendiri dan
 * menghitung ulang kalimatnya tiap 5 detik, jadi layar induk tidak ikut dilukis.
 */
export function TandaDiperbarui({ penyimpan, awalan = "" }: { penyimpan: PenyimpanDiperbarui; awalan?: string }) {
  const terakhir = useSyncExternalStore(penyimpan.dengar, penyimpan.ambil, () => null);
  const [sekarang, setSekarang] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setSekarang(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);
  const { teks, tertunda } = kalimatDiperbarui(terakhir, Math.max(sekarang, terakhir ?? 0));
  if (!teks) return null;
  return createElement(
    "span",
    {
      "data-diperbarui": tertunda ? "tertunda" : "segar",
      className: tertunda ? "text-amber-600 dark:text-amber-400" : undefined,
      title: tertunda
        ? "Bacaan terakhir sudah lebih dari semenit yang lalu. ALETA mencoba lagi sendiri."
        : "Waktu terakhir daftar ini dicocokkan dengan SIPP.",
    },
    `${awalan}${teks}`
  );
}
