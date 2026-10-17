"use client";

import { useEffect } from "react";

/**
 * Mode layar jauh untuk televisi ruang tunggu dan papan pintu ruang sidang.
 *
 * Memasang kelas `aleta-layar-jauh` pada <html> selama halaman tampil, lalu
 * mencabutnya saat halaman ditinggalkan. Aturannya ada di globals.css: huruf
 * akar mengikuti lebar dan tinggi layar, sehingga semua ukuran rem di halaman
 * ikut membesar sebanding di 1920x1080 sampai 3840x2160.
 */
export function ModeLayarJauh() {
  useEffect(() => {
    const akar = document.documentElement;
    akar.classList.add("aleta-layar-jauh");
    return () => akar.classList.remove("aleta-layar-jauh");
  }, []);

  return null;
}
