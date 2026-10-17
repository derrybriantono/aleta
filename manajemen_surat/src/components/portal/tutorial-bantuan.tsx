"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

// Data tutorial dan catatan rilis besar: dimuat hanya saat panel dibuka.
const IsiBantuan = dynamic(() => import("@/components/portal/tutorial-bantuan-isi"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Memuat langkah-langkah...</p>,
});

/**
 * Tombol "?" kecil di kepala halaman. Membuka panel samping berisi langkah
 * fitur halaman yang sedang dibuka (hanya yang menjadi hak akun ini).
 * Esc atau tekan di luar panel untuk menutup.
 */
export function TombolBantuanTutorial() {
  const jalur = usePathname() ?? "/";
  // Panel hanya terbuka di halaman tempat ia dibuka: pindah halaman menutupnya.
  const [bukaPada, setBukaPada] = useState<string | null>(null);
  const buka = bukaPada === jalur;
  const tombolTutup = useRef<HTMLButtonElement | null>(null);
  const pemicu = useRef<HTMLButtonElement | null>(null);

  const tutup = useCallback(() => {
    setBukaPada(null);
    pemicu.current?.focus();
  }, []);

  useEffect(() => {
    if (!buka) return;
    tombolTutup.current?.focus();
    const saatTekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
    };
    document.addEventListener("keydown", saatTekan);
    return () => document.removeEventListener("keydown", saatTekan);
  }, [buka, tutup]);

  return (
    <>
      <Button
        ref={pemicu}
        type="button"
        variant="outline"
        size="icon"
        aria-label="Bantuan: langkah memakai halaman ini"
        title="Bantuan: langkah memakai halaman ini"
        aria-haspopup="dialog"
        aria-expanded={buka}
        data-testid="tombol-bantuan-tutorial"
        onClick={() => setBukaPada(jalur)}
      >
        <CircleHelp className="h-4 w-4" />
      </Button>

      {/* Lewat portal ke body: kepala halaman berlatar buram membuat anak "fixed" terkurung di dalamnya. */}
      {buka
        ? createPortal(
        <div className="fixed inset-0 z-[80]" data-testid="panel-bantuan-tutorial">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Tutup bantuan"
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
            onClick={tutup}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Bantuan halaman ini"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Bantuan</p>
                <h2 className="text-base font-semibold text-foreground">Cara memakai halaman ini</h2>
              </div>
              <Button ref={tombolTutup} type="button" variant="outline" size="icon" aria-label="Tutup bantuan" onClick={tutup}>
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <IsiBantuan jalur={jalur} tutupPanel={tutup} />
            </div>
            <footer className="border-t border-border px-4 py-3 text-sm">
              <Link href="/panduan" onClick={tutup} className="font-medium text-primary underline-offset-4 hover:underline">
                Lihat semua tutorial
              </Link>
            </footer>
          </aside>
        </div>,
            document.body
          )
        : null}
    </>
  );
}
