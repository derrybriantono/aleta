"use client";

import { Smartphone, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { pasangPendengarAplikasi, usePasangAplikasi, type KeadaanPasang } from "@/lib/pasang-aplikasi";
import { cn } from "@/lib/utils";

/** Dipasang sekali di layout akar: tawaran pasang dari peramban tidak boleh terlewat. */
export function PendengarPasangAplikasi() {
  useEffect(() => {
    pasangPendengarAplikasi();
  }, []);
  return null;
}

function Langkah({ keadaan }: { keadaan: KeadaanPasang }) {
  if (keadaan === "ios") {
    return (
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Ketuk tombol <strong>Bagikan</strong> (kotak dengan panah ke atas) di bilah Safari.
        </li>
        <li>
          Pilih <strong>Tambah ke Layar Utama</strong>, lalu ketuk <strong>Tambah</strong>.
        </li>
        <li>Buka ALETA dari ikon baru di layar utama.</li>
        <li className="list-none pt-1 text-muted-foreground">Bila pilihan itu tidak ada, buka alamat ini di Safari.</li>
      </ol>
    );
  }
  if (keadaan === "android-menu" || keadaan === "android-perlu-https") {
    return (
      <>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Ketuk menu <strong>⋮</strong> di kanan atas Chrome.
          </li>
          <li>
            Pilih <strong>{keadaan === "android-menu" ? "Instal aplikasi" : "Tambahkan ke layar utama"}</strong>, lalu konfirmasi.
          </li>
          <li>Buka ALETA dari ikon baru di layar utama.</li>
        </ol>
        {keadaan === "android-perlu-https" ? (
          <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-800 dark:text-amber-300" data-perlu-https="">
            Alamat ini belum memakai sambungan aman (https), jadi ikon akan membuka ALETA di Chrome, belum sebagai aplikasi layar penuh. Minta admin
            memasang sertifikat https di server.
          </p>
        ) : null}
      </>
    );
  }
  return (
    <p>
      Buka alamat ALETA ini di HP Android (Chrome) atau iPhone/iPad (Safari) yang tersambung ke jaringan kantor, lalu tekan lagi tombol{" "}
      <strong>Pasang di HP</strong> untuk petunjuknya. Di komputer, Chrome dan Edge juga dapat memasang ALETA lewat ikon pasang di bilah alamat.
    </p>
  );
}

/** Tombol "Pasang di HP" di footer: satu tekan bila peramban menawarkan, selain itu petunjuk sesuai perangkat. */
export function TombolPasangAplikasi({ className, pemisah }: { className?: string; /** Digambar sebelum tombol, hanya bila tombol tampil. */ pemisah?: ReactNode }) {
  const { keadaan, pasang } = usePasangAplikasi();
  const [buka, setBuka] = useState(false);

  useEffect(() => {
    if (!buka) return;
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuka(false);
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [buka]);

  // Sudah dibuka sebagai aplikasi: tombolnya tidak berguna lagi.
  if (!keadaan || keadaan === "terpasang") return null;

  return (
    <>
      {pemisah}
      <button
        type="button"
        onClick={() => {
          if (keadaan === "tombol") void pasang();
          else setBuka(true);
        }}
        className={cn("inline-flex items-center gap-1 font-medium text-primary underline-offset-4 transition hover:underline", className)}
      >
        <Smartphone className="h-3.5 w-3.5" aria-hidden />
        Pasang di HP
      </button>
      {buka ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center tirai-latar p-4 sm:items-center" onClick={() => setBuka(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pasang ALETA di HP"
            className="w-full max-w-sm rounded-xl border bg-card p-4 text-sm text-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold">Pasang ALETA di HP</p>
              <button type="button" aria-label="Tutup" onClick={() => setBuka(false)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Langkah keadaan={keadaan} />
          </div>
        </div>
      ) : null}
    </>
  );
}
