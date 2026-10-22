"use client";

/**
 * Menu alat Jadwal Sidang - SATU tombol "Menu" di baris pencarian yang memuat
 * Hitung skor, Layar antrian, Per panitera sidang, Cetak relaas, Penetapan
 * kembali, Daftarkan ke antrian, Kasir, Kasir harian, dan Pengingat kasir.
 *
 * Sebelumnya semuanya berjajar sebagai tombol di satu baris sendiri dan baris
 * itu penuh sesak. Butirnya TIDAK dikurangi dan hak perannya TIDAK berubah:
 * pemanggil hanya menyerahkan butir yang boleh dilihat peran itu, dan bila
 * tidak ada satu pun butir, tombol Menu tidak digambar sama sekali.
 *
 * Dialog tiap butir dipegang pemanggil, DI LUAR menu: isi menu dilepas begitu
 * menu menutup, dan dialog yang ikut dilepas akan hilang sebelum sempat terbaca.
 */
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, ChevronRight, ExternalLink, Menu as IkonMenu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type TautanMenuAlat = { jalur: string; nama: string; guna: string; href: string };

export type ButirMenuAlat = {
  kunci: string;
  label: string;
  ikon: LucideIcon;
  /** Keterangan panjang (tooltip) - sama dengan title tombol lamanya. */
  judul?: string;
  nonaktif?: boolean;
  /** Butir yang berupa saklar (mis. Per panitera sidang): tanda centang bila menyala. */
  menyala?: boolean;
  /** Butir yang membentangkan daftar tautan di dalam menu (mis. Layar antrian). */
  kelompokTautan?: Array<{ judul: string; daftar: TautanMenuAlat[] }>;
  /** Tulisan lain pada butir, mis. "Memeriksa…" selagi bekerja. */
  labelSibuk?: string;
};

export function MenuAlatJadwal({
  butir,
  onPilih,
}: {
  butir: ButirMenuAlat[];
  /** Dipanggil dengan `kunci` butir yang dipilih (tanpa menyimpan fungsi di dalam butir). */
  onPilih: (kunci: string) => void;
}) {
  const [terbentang, setTerbentang] = useState<string>("");
  if (butir.length === 0) return null;

  return (
    <DropdownMenu modal={false} onOpenChange={(buka) => (buka ? undefined : setTerbentang(""))}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" data-menu-alat-jadwal="" title="Alat lain untuk jadwal sidang ini">
          <IkonMenu className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Menu
          <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 bg-card" data-isi-menu-alat-jadwal="">
        {butir.map((b) => {
          const Ikon = b.ikon;
          if (b.kelompokTautan) {
            const buka = terbentang === b.kunci;
            return (
              <div key={b.kunci}>
                <DropdownMenuItem
                  data-butir-menu={b.kunci}
                  title={b.judul}
                  aria-expanded={buka}
                  // Tidak menutup menu: yang ditekan hanya membentangkan daftarnya.
                  onSelect={(e) => {
                    e.preventDefault();
                    setTerbentang(buka ? "" : b.kunci);
                  }}
                >
                  <Ikon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{b.label}</span>
                  {buka ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                </DropdownMenuItem>
                {buka
                  ? b.kelompokTautan.map((k) => (
                      <div key={k.judul} className="ml-3 border-l pl-2">
                        <DropdownMenuLabel className="px-2 py-1 text-[11px] tracking-wide">{k.judul}</DropdownMenuLabel>
                        {k.daftar.map((t) => (
                          <DropdownMenuItem key={t.jalur} asChild>
                            <a
                              href={t.href}
                              target="_blank"
                              rel="noreferrer"
                              data-butir-menu={`${b.kunci}:${t.jalur}`}
                              className="flex-col items-start gap-0 px-2 py-1.5"
                            >
                              <span className="flex w-full items-center gap-1.5 text-sm font-medium">
                                {t.nama}
                                <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                              </span>
                              <span className="text-[11px] text-muted-foreground">{t.guna}</span>
                            </a>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))
                  : null}
              </div>
            );
          }
          return (
            <DropdownMenuItem
              key={b.kunci}
              data-butir-menu={b.kunci}
              title={b.judul}
              disabled={b.nonaktif}
              onSelect={() => onPilih(b.kunci)}
              className={cn(b.menyala && "bg-primary/10 font-medium")}
            >
              <Ikon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{b.labelSibuk ?? b.label}</span>
              {b.menyala ? <Check className="h-3.5 w-3.5" aria-label="menyala" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
