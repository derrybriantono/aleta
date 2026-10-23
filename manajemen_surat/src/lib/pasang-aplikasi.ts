"use client";

import { useEffect, useState } from "react";

import { withBasePath } from "@/lib/base-path";

/**
 * ============================================================================
 * PASANG ALETA SEBAGAI APLIKASI DI HP (Android & iPhone/iPad) - 23 Okt 2026
 * ============================================================================
 *
 * Portal dipasang lewat peramban, tanpa toko aplikasi: manifest
 * (src/app/manifest.ts), ikon (src/app/ikon-aplikasi), dan pekerja latar
 * (public/sw.js) membuatnya tampil sebagai aplikasi layar penuh.
 *
 * Batas yang tidak bisa diakali dari kode:
 * - Android (Chrome/Edge/Samsung Internet) hanya menawarkan "Instal aplikasi"
 *   bila halaman dibuka lewat HTTPS. Lewat http://alamat-ip, yang tersedia hanya
 *   pintasan "Tambahkan ke layar utama" yang membuka tab peramban biasa.
 * - iPhone/iPad tidak punya tombol pasang otomatis: pengguna memakai
 *   Bagikan > Tambah ke Layar Utama. Itu berjalan juga lewat http.
 * - Pekerja latar hanya terdaftar di konteks aman (HTTPS atau localhost).
 *
 * Pekerja latar TIDAK menyimpan halaman atau data portal (semuanya milik akun
 * yang masuk); ia hanya menampilkan halaman "tidak tersambung" bila server
 * tidak terjangkau.
 */

export type Perangkat = "ios" | "android" | "lain";

export type KeadaanPasang =
  /** Sudah dibuka sebagai aplikasi terpasang. */
  | "terpasang"
  /** Peramban menawarkan pasang - satu tombol cukup. */
  | "tombol"
  /** iPhone/iPad: Bagikan > Tambah ke Layar Utama. */
  | "ios"
  /** Android lewat http: hanya pintasan layar utama; pasang penuh perlu HTTPS. */
  | "android-perlu-https"
  /** Android lewat HTTPS, tetapi tawaran pasang belum datang: lewat menu peramban. */
  | "android-menu"
  /** Komputer atau peramban lain. */
  | "lain";

/** Mengenali iPhone/iPad (iPadOS melapor sebagai "MacIntel" dengan layar sentuh). */
export function kenaliPerangkat(ua: string, platform = "", titikSentuh = 0): Perangkat {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (platform === "MacIntel" && titikSentuh > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "lain";
}

export function tentukanKeadaanPasang({
  terpasang,
  adaTawaran,
  aman,
  perangkat,
}: {
  terpasang: boolean;
  adaTawaran: boolean;
  aman: boolean;
  perangkat: Perangkat;
}): KeadaanPasang {
  if (terpasang) return "terpasang";
  if (adaTawaran) return "tombol";
  if (perangkat === "ios") return "ios";
  if (perangkat === "android") return aman ? "android-menu" : "android-perlu-https";
  return "lain";
}

type TawaranPasang = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Tawaran pasang datang SEKALI, sering sebelum footer tergambar - ditangkap di
// tingkat modul oleh pasangPendengarAplikasi() yang dipanggil dari layout.
let tawaran: TawaranPasang | null = null;
let sudahDipasang = false;
let pendengarTerpasang = false;
const pemberitahu = new Set<() => void>();

function beriTahu() {
  pemberitahu.forEach((f) => f());
}

function bukaSebagaiAplikasi(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone);
}

/** Dipanggil sekali per halaman: menangkap tawaran pasang dan mendaftarkan pekerja latar. */
export function pasangPendengarAplikasi() {
  if (typeof window === "undefined" || pendengarTerpasang) return;
  pendengarTerpasang = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    tawaran = e as TawaranPasang;
    beriTahu();
  });
  window.addEventListener("appinstalled", () => {
    tawaran = null;
    sudahDipasang = true;
    beriTahu();
  });

  if (window.isSecureContext && "serviceWorker" in navigator) {
    void navigator.serviceWorker.register(withBasePath("/sw.js"), { scope: withBasePath("/") }).catch(() => undefined);
  }
}

/** Untuk uji: kembalikan keadaan modul ke awal. */
export function aturUlangPasangAplikasi() {
  tawaran = null;
  sudahDipasang = false;
  pendengarTerpasang = false;
  pemberitahu.clear();
}

export function usePasangAplikasi() {
  const [, setVersi] = useState(0);
  const [lingkungan, setLingkungan] = useState<{ perangkat: Perangkat; aman: boolean; terpasang: boolean } | null>(null);

  useEffect(() => {
    const segarkan = () => setVersi((v) => v + 1);
    pemberitahu.add(segarkan);
    const t = window.setTimeout(() => {
      setLingkungan({
        perangkat: kenaliPerangkat(navigator.userAgent, navigator.platform, navigator.maxTouchPoints || 0),
        aman: window.isSecureContext,
        terpasang: bukaSebagaiAplikasi(),
      });
    }, 0);
    return () => {
      pemberitahu.delete(segarkan);
      window.clearTimeout(t);
    };
  }, []);

  const keadaan: KeadaanPasang | null = lingkungan
    ? tentukanKeadaanPasang({
        terpasang: lingkungan.terpasang || sudahDipasang,
        adaTawaran: Boolean(tawaran),
        aman: lingkungan.aman,
        perangkat: lingkungan.perangkat,
      })
    : null;

  const pasang = async (): Promise<boolean> => {
    const t = tawaran;
    if (!t) return false;
    await t.prompt();
    const pilihan = await t.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    // Tawaran hanya dapat dipakai sekali, diterima atau tidak.
    tawaran = null;
    if (pilihan.outcome === "accepted") sudahDipasang = true;
    beriTahu();
    return pilihan.outcome === "accepted";
  };

  return { keadaan, pasang };
}
