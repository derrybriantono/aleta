"use client";

import { useEffect, useRef, useState } from "react";

import { apiPath } from "@/lib/base-path";
import {
  bacaDisidangLangsung,
  DISIDANG_LANGSUNG_KOSONG,
  SELANG_DISIDANG_MS,
  type DisidangLangsung,
} from "@/lib/disidang-langsung";

/**
 * Keadaan `disidang` aplikasi antrian hari ini, ditanyakan tiap
 * SELANG_DISIDANG_MS - lihat @/lib/disidang-langsung.
 *
 *   - aktif false (bukan hari ini): tidak bertanya sama sekali.
 *   - tab tersembunyi: pengatur waktunya DIHENTIKAN; saat terlihat lagi
 *     langsung bertanya, lalu berdetak lagi.
 *   - permintaan sebelumnya belum selesai: putaran ini dilewati (tidak menumpuk).
 *   - gagal: keadaan terakhir dibiarkan (layar memakai jadwal penuh seperti semula).
 *
 * State hanya diganti bila isinya berubah, supaya layar tidak melukis ulang
 * tiap 5 detik untuk jawaban yang sama.
 */
export function useDisidangLangsung(aktif: boolean, selangMs: number = SELANG_DISIDANG_MS): DisidangLangsung {
  const [data, setData] = useState<DisidangLangsung>(DISIDANG_LANGSUNG_KOSONG);
  const sibukRef = useRef(false);
  const sidikRef = useRef("");

  useEffect(() => {
    if (!aktif) return;
    let batal = false;
    let pengatur: ReturnType<typeof setInterval> | undefined;

    const tanya = async () => {
      if (sibukRef.current) return;
      sibukRef.current = true;
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/sidang/disidang"), { cache: "no-store" });
        const isi = (await jawaban.json().catch(() => ({}))) as { data?: unknown };
        if (batal || !jawaban.ok) return;
        const baru = bacaDisidangLangsung(isi?.data ?? isi);
        if (!baru.terbaca) return;
        const sidik = `${baru.hariIni}|${baru.baris.map((b) => `${b.perkaraId}:${b.disidang ?? ""}`).sort().join(",")}`;
        if (sidik === sidikRef.current) return;
        sidikRef.current = sidik;
        setData(baru);
      } catch {
        // Gangguan sesaat: keadaan terakhir tetap; jadwal penuh tetap memuat ulang sendiri.
      } finally {
        sibukRef.current = false;
      }
    };

    const terlihat = () => typeof document === "undefined" || document.visibilityState === "visible";
    const mulai = () => {
      if (pengatur !== undefined) return;
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
    };
  }, [aktif, selangMs]);

  return aktif ? data : DISIDANG_LANGSUNG_KOSONG;
}
