"use client";

/**
 * Panel "Ruang sidang yang digunakan" - kartu berwarna per ruang di bawah
 * deretan alat Jadwal Sidang (12 Okt 2026, butir 3). Alasan dan aturannya ada
 * di @/lib/kartu-ruang-sidang; berkas ini hanya menggambar.
 *
 * Bawaannya DICIUTKAN: yang tampak hanya satu baris ringkasan (jumlah ruang,
 * perkara, dan yang perlu diperiksa, beserta titik warna tiap ruang). Pilihan
 * buka/tutup diingat peramban ini saja; peramban yang menolak penyimpanan
 * tetap bekerja, hanya tidak mengingat.
 */
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import {
  muatKartuRuangTerbuka,
  ringkasKartuRuang,
  simpanKartuRuangTerbuka,
  type KartuRuang,
} from "@/lib/kartu-ruang-sidang";
import { cn } from "@/lib/utils";

export function KartuRuangSidang({
  kartu,
  ruangPilihan,
  onPilih,
  keteranganPerlu,
  className,
}: {
  kartu: ReadonlyArray<KartuRuang>;
  /** Ruang yang sedang menyaring tabel, null = semua. */
  ruangPilihan: string | null;
  /** Dipanggil dengan nama ruang, atau null untuk melepas saringan. */
  onPilih: (nama: string | null) => void;
  /** Kalimat penjelas "perlu diperiksa" (lihat keteranganPerluDiperiksa). */
  keteranganPerlu: string;
  className?: string;
}) {
  // Awal SELALU diciutkan agar render peladen dan klien sama; simpanan peramban
  // dibaca sesudah terpasang.
  const [terbuka, setTerbuka] = useState(false);
  useEffect(() => {
    setTerbuka(muatKartuRuangTerbuka());
  }, []);

  if (kartu.length === 0) return null;

  const ringkas = ringkasKartuRuang(kartu);
  const alih = () => {
    const baru = !terbuka;
    setTerbuka(baru);
    simpanKartuRuangTerbuka(baru);
  };

  return (
    <section
      data-kartu-ruang-sidang=""
      data-terbuka={terbuka ? "ya" : "tidak"}
      aria-label="Ruang sidang yang digunakan"
      className={cn("rounded-2xl border bg-muted/20", className)}
    >
      <button
        type="button"
        onClick={alih}
        aria-expanded={terbuka}
        title={terbuka ? "Ciutkan kartu ruang sidang" : "Bentangkan kartu ruang sidang"}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl px-3 py-1.5 text-left text-sm transition hover:bg-muted/50"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-semibold">Ruang sidang yang digunakan</span>
        <span className="text-xs text-muted-foreground">
          {ringkas.ruang} ruang · {ringkas.perkara} perkara
        </span>
        {ringkas.perlu > 0 ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
            {ringkas.perlu} perlu diperiksa
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">tidak ada yang perlu diperiksa</span>
        )}
        {!terbuka ? (
          <span className="flex items-center gap-1" aria-hidden="true">
            {kartu.map((k) => (
              <span key={k.nama} className={cn("h-2.5 w-2.5 rounded-full", k.warna.titik)} title={k.nama} />
            ))}
          </span>
        ) : null}
        {ruangPilihan ? (
          <span className="text-xs text-muted-foreground">
            tersaring: <strong className="text-foreground">{ruangPilihan}</strong>
          </span>
        ) : null}
        <span className="ml-auto text-muted-foreground">
          {terbuka ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>
      </button>

      {terbuka ? (
        <div className="space-y-2 px-3 pb-3">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kartu.map((k) => {
              const aktif = ruangPilihan === k.nama;
              return (
                <button
                  key={k.nama}
                  type="button"
                  aria-pressed={aktif}
                  data-kartu-ruang={k.nama}
                  data-warna={k.warna.kunci}
                  onClick={() => onPilih(aktif ? null : k.nama)}
                  title={
                    aktif
                      ? `Menampilkan ${k.jumlah} perkara di ${k.nama}. Tekan lagi untuk menampilkan semua ruang.`
                      : `Tampilkan hanya ${k.jumlah} perkara yang bersidang di ${k.nama}.`
                  }
                  className={cn(
                    "flex flex-col gap-1 rounded-3xl border px-4 py-3 text-left transition",
                    k.warna.kartu,
                    aktif && k.warna.cincin
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", k.warna.titik)} aria-hidden="true" />
                    <span className="min-w-0 break-words text-sm font-bold leading-tight">{k.nama}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className={cn("rounded-full px-2 py-0.5 font-semibold", k.warna.lencana)}>
                      {k.jumlah} perkara
                    </span>
                    {k.perlu > 0 ? (
                      <span
                        className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800 dark:bg-red-950 dark:text-red-200"
                        title={keteranganPerlu}
                      >
                        {k.perlu} perlu diperiksa
                      </span>
                    ) : (
                      <span className="opacity-70" title={keteranganPerlu}>
                        0 perlu diperiksa
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{keteranganPerlu}</p>
        </div>
      ) : null}
    </section>
  );
}
