"use client";

/**
 * Baris "Saksi P (2) ▸" yang dapat dibuka/dilipat - JADWAL-3 butir 4 (19 Okt 2026).
 * Aturannya di @/lib/saksi-lipat; berkas ini hanya menggambar dan mengingat.
 */
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  alihSaksiLipat,
  bacaSaksiLipat,
  kunciSimpananSaksiLipat,
  saksiTerbuka,
  type PetaSaksiLipat,
} from "@/lib/saksi-lipat";

/** Pilihan lipat per baris, diingat peramban atas nama akun yang masuk. */
export function useSaksiLipat(idPengguna: string | number | null | undefined, bawaanTerbuka: boolean) {
  const kunciSimpan = kunciSimpananSaksiLipat(idPengguna);
  const [peta, setPeta] = useState<PetaSaksiLipat>({});
  useEffect(() => {
    let batal = false;
    // Dibaca sesudah gambar pertama: peladen tidak punya localStorage.
    void Promise.resolve().then(() => {
      if (batal) return;
      try {
        setPeta(bacaSaksiLipat(window.localStorage.getItem(kunciSimpan)));
      } catch {
        setPeta({});
      }
    });
    return () => {
      batal = true;
    };
  }, [kunciSimpan]);

  const terbuka = useCallback((kunci: string) => saksiTerbuka(peta, kunci, bawaanTerbuka), [peta, bawaanTerbuka]);
  const alih = useCallback(
    (kunci: string) => {
      setPeta((lama) => {
        const baru = alihSaksiLipat(lama, kunci, bawaanTerbuka);
        try {
          window.localStorage.setItem(kunciSimpan, JSON.stringify(baru));
        } catch {
          // Tidak tersimpan - berlaku sampai halaman ditutup.
        }
        return baru;
      });
    },
    [bawaanTerbuka, kunciSimpan]
  );
  return { terbuka, alih };
}

export function SaksiLipat({
  label,
  jumlah,
  terbuka,
  onAlih,
  namaRingkas,
  children,
}: {
  /** "Saksi P" atau "Saksi T". */
  label: string;
  jumlah: number;
  terbuka: boolean;
  onAlih: () => void;
  /** Nama-nama dalam satu kalimat - untuk title saat terlipat. */
  namaRingkas: string;
  /** Daftar nama (dapat diklik untuk memanggil) - hanya digambar saat terbuka. */
  children?: ReactNode;
}) {
  return (
    <div className="break-words" data-saksi-lipat={terbuka ? "terbuka" : "terlipat"}>
      <button
        type="button"
        onClick={onAlih}
        aria-expanded={terbuka}
        title={terbuka ? "Lipat nama saksi" : namaRingkas || "Tampilkan nama saksi"}
        className="inline-flex items-center gap-0.5 rounded font-medium text-foreground/75 transition hover:text-foreground"
      >
        {label} ({jumlah})
        {terbuka ? (
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        )}
        {terbuka ? ":" : null}
      </button>{" "}
      {terbuka ? <span title={namaRingkas}>{children}</span> : null}
    </div>
  );
}
