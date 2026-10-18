"use client";

import { useCallback, useState } from "react";

/**
 * Nilai kecil yang diingat per pengguna di peramban (localStorage), dibaca
 * sekali saat layar tergambar dan dibaca ulang bila kuncinya berganti
 * (pengguna aktif baru terbaca sesudah layar tergambar). Penurunan dilakukan
 * saat render, bukan lewat efek - efek yang memanggil setState berantai
 * menggambar ulang dan dilarang aturan lint proyek ini.
 *
 * Peramban yang memblokir penyimpanan tetap dapat memakai layar: nilai awal
 * dipakai dan pilihan hanya tidak diingat.
 */
export function useSimpananPeramban<T>(kunci: string, awal: T) {
  const baca = (k: string): T => {
    try {
      const mentah = window.localStorage.getItem(k);
      return mentah === null ? awal : (JSON.parse(mentah) as T);
    } catch {
      return awal;
    }
  };
  const [keadaan, setKeadaan] = useState<{ kunci: string; nilai: T }>(() => ({ kunci, nilai: baca(kunci) }));

  let nilai = keadaan.nilai;
  if (keadaan.kunci !== kunci) {
    nilai = baca(kunci);
    setKeadaan({ kunci, nilai });
  }

  const simpan = useCallback(
    (baru: T) => {
      setKeadaan({ kunci, nilai: baru });
      try {
        window.localStorage.setItem(kunci, JSON.stringify(baru));
      } catch {
        /* hanya tidak diingat */
      }
    },
    [kunci]
  );

  return [nilai, simpan] as const;
}
