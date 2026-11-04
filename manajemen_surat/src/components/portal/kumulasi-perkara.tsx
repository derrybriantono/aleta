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
import { PEMISAH_RINGKAS } from "@/lib/status-perkara-seamless";

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
      Dari petitum
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
export function RincianKumulasi({
  kumulasi,
  tanpaKotak = false,
  tanpaCatatan = false,
}: {
  kumulasi: KumulasiPerkara | null | undefined;
  /** Status Perkara: tanpa kotak dan judul sendiri - dibuka dari baris Kumulasi di sorotan. */
  tanpaKotak?: boolean;
  /** Catatan "dari petitum ... lengkapi" pindah menjadi butir Perlu dikerjakan. */
  tanpaCatatan?: boolean;
}) {
  const butir = butirKumulasi(kumulasi);
  if (butir.length === 0) return null;
  return (
    <div
      className={tanpaKotak ? "text-sm" : "rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-sm"}
      data-rincian-kumulasi=""
    >
      {tanpaKotak ? null : <div className="mb-1 font-semibold">Kumulasi perkara</div>}
      <ul className="space-y-1">
        {butir.map((x) => (
          <li key={x.kode}>
            <span className="font-medium">{x.nama}</span>{" "}
            {x.sumber === "petitum" ? (
              <Badge variant="warning" className="px-1.5 py-0 text-xs">
                Dari petitum
              </Badge>
            ) : (
              <Badge variant="muted" className="px-1.5 py-0 text-xs">
                SIPP
              </Badge>
            )}
            {x.sumber === "petitum" && x.kutipan ? (
              <div className="mt-0.5 break-words italic text-muted-foreground">&ldquo;{x.kutipan}&rdquo;</div>
            ) : null}
          </li>
        ))}
      </ul>
      {adaDariPetitum(kumulasi) && !tanpaCatatan ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Yang bertanda &ldquo;dari petitum&rdquo; dibaca dari tuntutan primer karena kumulasinya belum diisi di SIPP -
          periksa, lalu lengkapi data kumulasi di SIPP.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Baris "Kumulasi" di sorotan Status Perkara (rancangan 3 Nov 2026): satu baris
 * lencana tiap perkara gabungan beserta sumbernya (SIPP / dari petitum), dan
 * tautan "rincian" yang membuka kutipan petitum. Hanya bila ada kumulasi.
 * Keadaan terbuka dipegang pemanggil supaya butir "Perlu dikerjakan" dapat membukanya.
 */
export function BarisKumulasi({
  kumulasi,
  terbuka,
  onUbah,
}: {
  kumulasi: KumulasiPerkara | null | undefined;
  terbuka: boolean;
  onUbah: (buka: boolean) => void;
}) {
  const butir = butirKumulasi(kumulasi);
  if (butir.length === 0) return null;
  return (
    <div id="baris-kumulasi" className="space-y-1.5 text-sm" data-baris-kumulasi="">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Kumulasi</span>
        {butir.map((x) => (
          <Badge key={x.kode} variant={x.sumber === "petitum" ? "warning" : "muted"}>
            {x.nama}{PEMISAH_RINGKAS}{x.sumber === "petitum" ? "dari petitum" : "SIPP"}
          </Badge>
        ))}
        <button
          type="button"
          aria-expanded={terbuka}
          onClick={() => onUbah(!terbuka)}
          className="text-xs font-semibold text-primary underline underline-offset-2"
        >
          {terbuka ? "tutup rincian" : "rincian"}
        </button>
      </div>
      {terbuka ? (
        <div className="border-l-2 border-border pl-2.5 text-muted-foreground">
          <RincianKumulasi kumulasi={kumulasi} tanpaKotak tanpaCatatan />
        </div>
      ) : null}
    </div>
  );
}
