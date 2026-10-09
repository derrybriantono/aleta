"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { apiPath } from "@/lib/base-path";
import type { DataVerifikasi } from "@/lib/penanda-verifikasi-ecourt";
import {
  PESAN_MEMERIKSA,
  gantiPerkaraVerifikasi,
  kunciTarik,
  tarikBelumUpload,
  type HasilTarik,
  type KeadaanTarik,
} from "@/lib/tarik-belum-upload";

/** Rute portal tarik ulang satu perkara (POST mulai, GET keadaan). */
export const ALAMAT_TARIK_BELUM_UPLOAD = "/api/aleta-ecourt/sidang/verifikasi-ecourt/tarik";

/**
 * Penanda "belum upload" yang ditekan (7 Okt 2026) - lihat @/lib/tarik-belum-upload.
 *
 *   - satu tarikan berjalan per perkara di tab ini (kunci di ref, bukan state:
 *     dua klik dalam satu detak gambar sama-sama melihat state lama);
 *   - hasilnya menimpa keadaan perkara itu di data verifikasi (setVerifikasi)
 *     - barisnya berubah warna, tabelnya tidak dimuat ulang;
 *   - keadaan "Memeriksa e-Court..." / hasil / sebab disimpan per perkara untuk
 *     digambar di samping penandanya.
 */
export function useTarikBelumUpload(
  setVerifikasi: Dispatch<SetStateAction<DataVerifikasi>>,
  pilihan: { tarik?: typeof tarikBelumUpload } = {}
) {
  const [keadaan, setKeadaan] = useState<Record<string, KeadaanTarik>>({});
  const berjalanRef = useRef<Set<string>>(new Set());
  const hidupRef = useRef(true);
  const tarikFn = pilihan.tarik ?? tarikBelumUpload;

  useEffect(() => {
    hidupRef.current = true;
    return () => {
      hidupRef.current = false;
    };
  }, []);

  const tarik = useCallback(
    async (baris: { nomorPerkara: string; tanggalSidang: string }): Promise<HasilTarik | null> => {
      const k = kunciTarik(baris.nomorPerkara);
      if (!k || berjalanRef.current.has(k)) return null;
      berjalanRef.current.add(k);
      setKeadaan((lama) => ({ ...lama, [k]: { tahap: "berjalan", pesan: PESAN_MEMERIKSA, dokumenBaru: [] } }));
      try {
        const hasil = await tarikFn({
          nomorPerkara: baris.nomorPerkara,
          tanggal: String(baris.tanggalSidang || "").slice(0, 10),
          alamat: apiPath(ALAMAT_TARIK_BELUM_UPLOAD),
          // Butir 8 (1.189.x): persen + tahap nyata selama bot menarik.
          padaKemajuan: (kemajuan) => {
            if (hidupRef.current) setKeadaan((lama) => ({ ...lama, [k]: kemajuan }));
          },
        });
        if (!hidupRef.current) return hasil;
        const { perkara, ...tampil } = hasil;
        if (perkara) setVerifikasi((v) => (v.terbaca ? gantiPerkaraVerifikasi(v, perkara) : v));
        setKeadaan((lama) => ({ ...lama, [k]: tampil }));
        return hasil;
      } finally {
        berjalanRef.current.delete(k);
      }
    },
    [setVerifikasi, tarikFn]
  );

  const keadaanUntuk = useCallback((nomorPerkara: string) => keadaan[kunciTarik(nomorPerkara)], [keadaan]);

  return { tarik, keadaanUntuk };
}
