"use client";

/**
 * Tampilan kumulasi perkara (antrian sidang butir 1, 12 Okt 2026) - dipakai
 * Jadwal Sidang, Jadwal Mediasi, dan Status Perkara. Aturannya di
 * lib/kumulasi-perkara.ts; penentu kumulasinya di bot
 * (kumulasiPerkaraService).
 */

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  KUNCI_SAKLAR_KUMULASI,
  adaDariPetitum,
  butirKumulasi,
  keteranganKumulasi,
  namaJenisDenganKumulasi,
  type KumulasiPerkara,
} from "@/lib/kumulasi-perkara";
import { KUNCI_SIMPANAN_TAMPILAN, bacaTampilan, tampil } from "@/lib/tampilan-antrian-sidang";

/**
 * Saklar "Kumulasi perkara" dari panel Tampilan Jadwal Sidang, untuk layar
 * yang tidak memegang pilihan itu sendiri (Jadwal Mediasi, Status Perkara).
 * Satu saklar untuk ketiga layar - begitu keterangannya di panel.
 *
 * Dibaca dari simpanan peramban; bawaannya menyala. Gagal dibaca (mode
 * pribadi, penyimpanan diblokir) = bawaan. Ikut berubah bila panelnya diubah
 * di tab lain (peristiwa storage).
 */
export function useSaklarKumulasi(): boolean {
  const [menyala, setMenyala] = useState(true);
  useEffect(() => {
    const baca = () => {
      try {
        setMenyala(tampil(bacaTampilan(window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN)), KUNCI_SAKLAR_KUMULASI));
      } catch {
        /* bawaan tetap */
      }
    };
    baca();
    const dengar = (e: StorageEvent) => {
      if (e.key === null || e.key === KUNCI_SIMPANAN_TAMPILAN) baca();
    };
    window.addEventListener("storage", dengar);
    return () => window.removeEventListener("storage", dengar);
  }, []);
  return menyala;
}

/**
 * Menulis saklar "Kumulasi perkara" ke simpanan panel Tampilan Jadwal Sidang -
 * dipakai panel Tampilan Jadwal Mediasi (22 Okt 2026), supaya satu saklar tetap
 * satu: mematikannya di sini mematikannya di Jadwal Sidang, Jadwal Mediasi, dan
 * Status Perkara. Layar yang sama di jendela ini diberi tahu lewat peristiwa
 * storage buatan (peristiwa asli hanya sampai ke tab lain).
 */
export function ubahSaklarKumulasi(menyala: boolean): void {
  try {
    const sekarang = bacaTampilan(window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN));
    window.localStorage.setItem(
      KUNCI_SIMPANAN_TAMPILAN,
      JSON.stringify({ ...sekarang, [KUNCI_SAKLAR_KUMULASI]: menyala })
    );
  } catch {
    /* penyimpanan tertutup: tidak tersimpan, layar ini tetap mengikuti pilihannya sendiri */
  }
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: KUNCI_SIMPANAN_TAMPILAN }));
  } catch {
    /* peramban lama tanpa konstruktor StorageEvent */
  }
}

/** Lencana kecil "dari petitum" - bacaan ALETA, bukan catatan SIPP. */
export function LencanaDariPetitum({ kumulasi }: { kumulasi: KumulasiPerkara | null | undefined }) {
  if (!adaDariPetitum(kumulasi)) return null;
  return (
    <Badge
      variant="warning"
      className="px-1.5 py-0 text-[10px] font-semibold"
      data-kumulasi-petitum=""
      title={keteranganKumulasi(kumulasi)}
    >
      dari petitum
    </Badge>
  );
}

/**
 * "Cerai Gugat Kumulasi Hak Asuh Anak" + lencana "dari petitum" bila ada
 * butir yang tidak tercatat di SIPP. Tanpa kumulasi: jenisnya saja.
 */
export function JenisDenganKumulasi({
  jenis,
  kumulasi,
  className = "",
}: {
  jenis: string;
  kumulasi: KumulasiPerkara | null | undefined;
  className?: string;
}) {
  const ada = butirKumulasi(kumulasi).length > 0;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${className}`} data-kumulasi-perkara={ada ? "" : undefined}>
      <span title={ada ? keteranganKumulasi(kumulasi) : undefined}>{namaJenisDenganKumulasi(jenis, kumulasi)}</span>
      <LencanaDariPetitum kumulasi={kumulasi} />
    </span>
  );
}

/**
 * Bagian Kumulasi di rincian: tiap jenis dengan asalnya, dan kutipan butir
 * petitumnya bila dibaca dari petitum. Tidak digambar bila tidak ada.
 */
export function RincianKumulasi({ kumulasi }: { kumulasi: KumulasiPerkara | null | undefined }) {
  const butir = butirKumulasi(kumulasi);
  if (butir.length === 0) return null;
  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-2 text-xs" data-rincian-kumulasi="">
      <div className="mb-1 font-semibold">Kumulasi perkara</div>
      <ul className="space-y-1">
        {butir.map((x) => (
          <li key={x.kode}>
            <span className="font-medium">{x.nama}</span>{" "}
            {x.sumber === "petitum" ? (
              <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                dari petitum
              </Badge>
            ) : (
              <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                SIPP
              </Badge>
            )}
            {x.sumber === "petitum" && x.kutipan ? (
              <div className="mt-0.5 break-words italic text-muted-foreground">&ldquo;{x.kutipan}&rdquo;</div>
            ) : null}
          </li>
        ))}
      </ul>
      {adaDariPetitum(kumulasi) ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Yang bertanda &ldquo;dari petitum&rdquo; dibaca dari tuntutan primer karena kumulasinya belum diisi di SIPP -
          periksa, lalu lengkapi data kumulasi di SIPP.
        </p>
      ) : null}
    </div>
  );
}
