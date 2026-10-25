"use client";

/**
 * ============================================================================
 * TABEL JADWAL RINGAN - HANYA BARIS YANG BERUBAH DIGAMBAR ULANG (K13, 25 Okt 2026)
 * ============================================================================
 *
 * Tabel Jadwal Sidang menggambar ulang SEMUA barisnya tiap kali satu keadaan di
 * layar berubah (muat ulang tiap beberapa detik, antrian, penanda ...), walau
 * hanya satu baris yang isinya berbeda. Baris Jadwal memuat ratusan elemen
 * (kolom pihak, majelis, penanda, tombol), sehingga di PC tua satu pembaruan
 * dapat memakan ratusan milidetik.
 *
 * Di sini baris dibungkus `memo` dengan pembanding berupa DAFTAR KEBERGANTUNGAN
 * yang disusun layar: nilai-nilai yang dibaca baris itu (bukan seluruh peta
 * keadaan). Baris digambar ulang bila SATU saja di antaranya berbeda.
 *
 * Pegangan keselamatan:
 *   - SAKLAR MATI bawaan. Mati = jalur lama persis (baris digambar langsung,
 *     tanpa pembungkus). Menyalakan: NEXT_PUBLIC_ALETA_TABEL_RINGAN=1 saat build,
 *     atau di peramban `localStorage["aleta-tabel-ringan"] = "1"` lalu muat ulang.
 *   - Fungsi pemicu (klik) dipanggil lewat pembungkus STABIL yang selalu
 *     meneruskan ke versi TERBARU, jadi baris yang tidak digambar ulang tidak
 *     pernah menjalankan fungsi basi.
 *   - Tidak ada virtualisasi: tinggi baris beragam (rincian terbuka, borang
 *     catat hasil) dan hasil cetak/unduh membaca seluruh baris; yang dipangkas
 *     hanya pekerjaan menggambar ulang.
 */
import { memo, useMemo, useRef, type ReactNode } from "react";

/** Saklar. Mati bawaan; tidak pernah melempar. */
export function tabelRinganAktif(): boolean {
  try {
    if (process.env.NEXT_PUBLIC_ALETA_TABEL_RINGAN === "1") return true;
    return typeof window !== "undefined" && window.localStorage.getItem("aleta-tabel-ringan") === "1";
  } catch {
    return false;
  }
}

const TANDA_TAK_ADA = "\u0000u";
const SANDI_OBJEK = new WeakMap<object, string>();

/**
 * Sidik nilai: teks JSON stabil untuk obyek/larik data (hasil muat ulang yang
 * isinya sama menghasilkan sidik yang sama walau identitas obyeknya baru).
 * Obyek yang sama disidik sekali.
 */
export function sidik(nilai: unknown): string {
  if (nilai === undefined) return TANDA_TAK_ADA;
  if (nilai === null || typeof nilai !== "object") return JSON.stringify(nilai) ?? TANDA_TAK_ADA;
  const lama = SANDI_OBJEK.get(nilai);
  if (lama !== undefined) return lama;
  try {
    const baru = JSON.stringify(nilai) ?? TANDA_TAK_ADA;
    SANDI_OBJEK.set(nilai, baru);
    return baru;
  } catch {
    // Berputar / tak dapat diserialkan: tanda unik (tidak disimpan) supaya baris selalu digambar ulang.
    return `\u0000x${Math.random()}`;
  }
}

function samaDaftar(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false;
  return true;
}

type PropsBaris = {
  /** Semua yang dibaca baris; satu berbeda = digambar ulang. */
  deps: readonly unknown[];
  /** Penggambar baris - dipanggil hanya saat deps berbeda. */
  gambar: () => ReactNode;
};

export const BarisTabelRingan = memo(
  function BarisTabelRingan({ gambar }: PropsBaris) {
    return <>{gambar()}</>;
  },
  (lama, baru) => samaDaftar(lama.deps, baru.deps)
);

type FungsiApa = (...argumen: any[]) => any;

/**
 * Alat pemicu baris. `stabil` mati = fungsi apa adanya (jalur lama). `stabil`
 * menyala = pembungkus STABIL: identitasnya tetap antar-gambar, tetapi tiap
 * panggilan diteruskan ke versi paling baru - supaya baris yang dilewati memo
 * tidak pernah menjalankan fungsi basi. Fungsi yang tidak diberikan (undefined)
 * tetap undefined agar pemeriksaan "ada tidaknya" di baris tidak berubah arti.
 *
 * Dipakai untuk fungsi yang dijalankan saat KEJADIAN (klik) dan untuk dua
 * penghitung yang dipanggil anak saat ia digambar bersama barisnya.
 */
export function useAlatBaris<F extends Record<string, FungsiApa | undefined>>(stabil: boolean, fungsi: F): F {
  const terbaru = useRef(fungsi);
  // Diisi SAAT MENGGAMBAR (bukan di efek): anak yang memanggil fungsi ini ketika ia
  // sendiri digambar, pada putaran yang sama, harus sudah melihat versi putaran itu.
  // eslint-disable-next-line react-hooks/refs
  terbaru.current = fungsi;
  const pembungkus = useMemo(() => {
    const keluar: Record<string, FungsiApa> = {};
    for (const kunci of Object.keys(fungsi)) {
      keluar[kunci] = (...argumen) => terbaru.current[kunci]?.(...argumen);
    }
    return keluar;
    // Daftar kuncinya tetap seumur komponen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!stabil) return fungsi;
  const hasil: Record<string, FungsiApa | undefined> = {};
  for (const kunci of Object.keys(fungsi)) hasil[kunci] = fungsi[kunci] === undefined ? undefined : pembungkus[kunci];
  return hasil as F;
}
