"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { daftarkanBagian, kunciCiut, langgananAba } from "@/lib/alat-bagian";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * SATU BAGIAN KETERANGAN YANG DAPAT DICIUTKAN
 * ============================================================================
 *
 * Isinya DIPINDAHKAN utuh dari aleta-ecourt-status-perkara.tsx, bukan disalin.
 * Di sana ia fungsi lokal yang dipakai dua puluh empat kali dan sudah matang;
 * yang dibutuhkan layar Antrian Sidang persis komponen yang sama, dan dua
 * salinan komponen yang sama akan menyimpang diam-diam - yang satu diperbaiki,
 * yang lain tidak, dan tidak ada yang berbunyi ketika itu terjadi.
 *
 * ============================================================================
 * KENAPA DAPAT DICIUTKAN
 * ============================================================================
 *
 * Layar yang memakainya memuat belasan bagian, dan tidak ada satu orang pun
 * yang memerlukan semuanya sekaligus. Panitera memeriksa berkas; kasir
 * memeriksa panjar; hakim memeriksa tahapan. Yang tidak sedang dipakai hanya
 * membuat yang dipakai berada jauh di bawah.
 *
 * Keadaan ciut disimpan di peramban masing-masing, sehingga tiap orang
 * mendapatkan susunan yang ia tinggalkan - bukan susunan orang lain.
 *
 * ============================================================================
 * KUNCINYA HARUS BERAWALAN, DAN ITU BUKAN KERAPIAN
 * ============================================================================
 *
 * kunciCiut() memaku satu awalan untuk seluruh pemakai. Layar Status Perkara
 * sudah memakai nama majelis, pihak, relaas, putusan, dan berkas - lima nama
 * yang justru paling wajar dipakai juga di tempat lain. Dua layar yang memakai
 * kunci yang sama akan saling menutup bagian: menciutkan "relaas" di satu
 * layar menutup "relaas" di layar yang lain, dan tidak ada yang tahu kenapa.
 *
 * Karena itu pemakai baru memberi awalan sendiri - panel Rincian antrian
 * sidang memakai "sidang-majelis", "sidang-relaas-ini", dan seterusnya.
 */
export function Bagian({
  judul,
  children,
  kunci,
  ciutBawaan = false,
  keterangan = "",
}: {
  judul: string;
  children: ReactNode;
  kunci?: string;
  ciutBawaan?: boolean;
  keterangan?: string;
}) {
  // Bentuk kuncinya milik `alat-bagian` - dua tempat yang menyusunnya
  // sendiri akan menyimpang diam-diam, dan yang menyimpang justru keadaan
  // yang diingat peramban.
  const kunciSimpan = kunci ? kunciCiut(kunci) : "";

  const [ciut, setCiut] = useState(() => {
    if (!kunciSimpan) return ciutBawaan;
    try {
      const tersimpan = window.localStorage.getItem(kunciSimpan);
      return tersimpan === null ? ciutBawaan : tersimpan === "1";
    } catch {
      // Peramban yang memblokir penyimpanan situs tetap harus dapat memakai
      // layar ini - hanya keadaan ciutnya yang tidak diingat.
      return ciutBawaan;
    }
  });

  const ganti = () => {
    const baru = !ciut;
    setCiut(baru);
    if (!kunciSimpan) return;
    try {
      window.localStorage.setItem(kunciSimpan, baru ? "1" : "0");
    } catch {
      /* lihat catatan di atas */
    }
  };

  /**
   * Mendaftarkan diri supaya bilah pintasan tahu bagian apa saja yang hidup,
   * dan mendengarkan aba-aba "buka semua", "tutup semua", serta "buka satu".
   *
   * Keadaan ciutnya TETAP milik bagian ini - yang datang dari luar hanya
   * aba-aba. Menaikkan keadaannya ke induk akan membuat seluruh layar digambar
   * ulang tiap kali satu bagian dibuka, dan sebagian bagian memuat tabel
   * beratus baris.
   */
  useEffect(() => {
    if (!kunci) return;
    const lepasDaftar = daftarkanBagian(kunci, judul);
    const lepasAba = langgananAba((aba) => {
      if (aba.jenis === "buka-semua") setCiut(false);
      else if (aba.jenis === "tutup-semua") setCiut(true);
      else if (aba.jenis === "buka" && aba.kunci === kunci) setCiut(false);
    });
    return () => {
      lepasDaftar();
      lepasAba();
    };
  }, [kunci, judul]);

  return (
    <section id={kunci ? `bagian-${kunci}` : undefined} className="rounded-lg border bg-card scroll-mt-4">
      <button
        type="button"
        onClick={ganti}
        aria-expanded={!ciut}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-muted/40"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            ciut && "-rotate-90"
          )}
          aria-hidden="true"
        />
        <h5 className="flex-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {judul}
        </h5>
        {keterangan ? (
          <span className="text-xs font-normal normal-case text-muted-foreground">{keterangan}</span>
        ) : null}
      </button>
      {ciut ? null : <div className="border-t px-3 py-2.5">{children}</div>}
    </section>
  );
}

export default Bagian;
