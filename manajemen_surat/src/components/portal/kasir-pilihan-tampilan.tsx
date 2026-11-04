"use client";

import { useCallback, useEffect, useState } from "react";

import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { KUNCI_SETELAN_KASIR, PILIHAN_KASIR_BAWAAN, kunciSalinanKasir, pilihanKasirDari, type PilihanKasir } from "@/lib/kasir-tampilan-pilihan";
import { cn } from "@/lib/utils";

/**
 * Pilihan tampilan Kasir per pengguna (4 Nov 2026): "Tampilan baru" (bawaan) atau "Tampilan lama".
 * Disimpan di setelan akun (kasir.tampilan) - portal dan ekstensi membaca pilihan yang sama; salinan di peramban
 * hanya cadangan bila server tak terjangkau. Hanya memilih tampilan: tidak ada pekerjaan Kasir yang berubah.
 */

const ALAMAT_SETELAN = "/api/aleta-ecourt/ekstensi/setelan";
const dariServer = new Map<string, PilihanKasir>();

/** Hanya untuk pengujian: melupakan pilihan yang diingat di memori. */
export function lupakanPilihanKasir() {
  dariServer.clear();
}

function bacaSalinan(kunci: string): PilihanKasir | null {
  try {
    return pilihanKasirDari(window.localStorage.getItem(kunci));
  } catch {
    return null;
  }
}

function tulisSalinan(kunci: string, pilihan: PilihanKasir) {
  try {
    window.localStorage.setItem(kunci, pilihan);
  } catch {
    /* peramban menolak penyimpanan: pilihan tetap berlaku selama halaman terbuka */
  }
}

export function useTampilanKasir(): { pilihan: PilihanKasir; ganti: (p: PilihanKasir) => void; kabar: string } {
  const { currentUser } = usePortal();
  const penggunaId = String((currentUser as { id?: string } | null | undefined)?.id || "");
  const kunci = kunciSalinanKasir(penggunaId);
  const [pilihan, setPilihan] = useState<PilihanKasir>(PILIHAN_KASIR_BAWAAN);
  const [kabar, setKabar] = useState("");

  useEffect(() => {
    let hidup = true;
    // Tampil seketika dari yang terakhir diketahui, lalu dikonfirmasi server (pilihan bisa diubah dari ekstensi).
    const awal = dariServer.get(penggunaId) ?? bacaSalinan(kunci);
    if (awal) setPilihan(awal);
    void (async () => {
      try {
        const r = await fetch(apiPath(ALAMAT_SETELAN), { cache: "no-store" });
        if (!r.ok) return;
        const isi = (await r.json().catch(() => null)) as { data?: { setelan?: Record<string, { nilai?: unknown }> } } | null;
        const nilai = pilihanKasirDari(isi?.data?.setelan?.[KUNCI_SETELAN_KASIR]?.nilai);
        if (!hidup) return;
        if (nilai) {
          dariServer.set(penggunaId, nilai);
          setPilihan(nilai);
          tulisSalinan(kunci, nilai);
        }
      } catch {
        /* server tak terjangkau: salinan peramban (atau bawaan) tetap dipakai */
      }
    })();
    return () => {
      hidup = false;
    };
  }, [penggunaId, kunci]);

  const ganti = useCallback(
    (baru: PilihanKasir) => {
      setPilihan(baru);
      setKabar("");
      dariServer.set(penggunaId, baru);
      tulisSalinan(kunci, baru);
      void (async () => {
        try {
          const r = await fetch(apiPath(ALAMAT_SETELAN), {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kunci: KUNCI_SETELAN_KASIR, nilai: { tampilan: baru } }),
          });
          if (!r.ok) setKabar("Pilihan tersimpan di peramban ini saja; belum tersimpan di akun Anda.");
        } catch {
          setKabar("Pilihan tersimpan di peramban ini saja; belum tersimpan di akun Anda.");
        }
      })();
    },
    [penggunaId, kunci]
  );

  return { pilihan, ganti, kabar };
}

/** Dua tombol pilihan di kepala jendela Kasir. `gelap`: kepala berlatar warna utama (tampilan baru). */
export function PilihTampilanKasir({ pilihan, onGanti, gelap = false }: { pilihan: PilihanKasir; onGanti: (p: PilihanKasir) => void; gelap?: boolean }) {
  const butir: Array<[PilihanKasir, string]> = [
    ["baru", "Tampilan baru"],
    ["lama", "Tampilan lama"],
  ];
  return (
    <div
      role="group"
      aria-label="Tampilan Kasir"
      data-pilihan-tampilan-kasir
      className={cn("inline-flex rounded-md p-0.5 text-xs", gelap ? "bg-primary-foreground/15" : "border bg-muted/40")}
    >
      {butir.map(([kunci, judul]) => (
        <button
          key={kunci}
          type="button"
          aria-pressed={pilihan === kunci}
          onClick={() => pilihan !== kunci && onGanti(kunci)}
          className={cn(
            "rounded px-2 py-1 font-semibold focus-visible:outline-none focus-visible:ring-2",
            gelap
              ? pilihan === kunci
                ? "bg-primary-foreground text-primary focus-visible:ring-primary-foreground"
                : "text-primary-foreground hover:bg-primary-foreground/20 focus-visible:ring-primary-foreground"
              : pilihan === kunci
                ? "bg-primary text-primary-foreground focus-visible:ring-ring"
                : "text-muted-foreground hover:bg-muted focus-visible:ring-ring"
          )}
        >
          {judul}
        </button>
      ))}
    </div>
  );
}
