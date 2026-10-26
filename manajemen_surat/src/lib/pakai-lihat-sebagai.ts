"use client";

import { useEffect, useState } from "react";

import { apiPath } from "@/lib/base-path";

/**
 * Apakah saklar Fitur Satker "Lihat sebagai" menyala (keputusan Derry 26 Okt 2026: mati bawaan)?
 * null = belum diketahui; kartu menu dan halamannya tersembunyi sampai terbukti menyala, dan gagal baca = tersembunyi
 * (sama dengan server, yang menolak rutenya bila saklar mati).
 */
export function useLihatSebagaiAktif(): boolean | null {
  const [aktif, setAktif] = useState<boolean | null>(null);
  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const r = await fetch(apiPath("/api/hak-akses/saya"), { credentials: "include", cache: "no-store" });
        const j = (await r.json().catch(() => null)) as { data?: { lihatSebagaiAktif?: boolean } } | null;
        if (!batal) setAktif(r.ok ? j?.data?.lihatSebagaiAktif === true : false);
      } catch {
        if (!batal) setAktif(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, []);
  return aktif;
}
