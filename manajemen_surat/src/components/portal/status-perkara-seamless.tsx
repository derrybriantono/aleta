"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { bacaDaftarBagian, langgananAba, langgananDaftar, siarkanAba } from "@/lib/alat-bagian";
import {
  KELOMPOK_SEAMLESS,
  TAMPILAN_BAWAAN,
  kunciTampilanStatus,
  tampilanSah,
  type KelompokSeamless,
  type TampilanStatus,
  type TitikLinimasa,
} from "@/lib/status-perkara-seamless";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * KOMPONEN TAMPILAN SEAMLESS STATUS PERKARA (18 Okt 2026)
 * ============================================================================
 *
 * Rancangannya: docs/rancangan/status-perkara-seamless.html.
 *
 * Isi tiap bagian TIDAK ditulis ulang di sini - semuanya komponen yang sama
 * dengan tampilan Kompleks. Berkas ini hanya memuat bungkusnya: sakelar
 * tampilan, kartu kelompok yang dapat dilipat, deret pintasan kelompok, dan
 * linimasa.
 *
 * Pilihan tampilan diingat per pengguna di peramban; bawaannya Kompleks
 * sampai pengguna memilih sendiri.
 */

/* ========================================================================== */
/* Pilihan tampilan                                                           */
/* ========================================================================== */

export function useTampilanStatus(idPengguna: string | null | undefined) {
  const kunci = kunciTampilanStatus(idPengguna);
  const baca = (k: string): TampilanStatus => {
    try {
      const tersimpan = window.localStorage.getItem(k);
      return tampilanSah(tersimpan) ? tersimpan : TAMPILAN_BAWAAN;
    } catch {
      return TAMPILAN_BAWAAN;
    }
  };
  const [keadaan, setKeadaan] = useState<{ kunci: string; nilai: TampilanStatus }>(() => ({ kunci, nilai: baca(kunci) }));

  // Pengguna aktif dapat baru terbaca sesudah layar tergambar; pilihannya dibaca
  // ulang begitu kuncinya berganti - diturunkan saat render, bukan lewat efek.
  let tampilan = keadaan.nilai;
  if (keadaan.kunci !== kunci) {
    tampilan = baca(kunci);
    setKeadaan({ kunci, nilai: tampilan });
  }

  const pilih = useCallback(
    (baru: TampilanStatus) => {
      setKeadaan({ kunci, nilai: baru });
      try {
        window.localStorage.setItem(kunci, baru);
      } catch {
        /* pilihannya hanya tidak diingat */
      }
    },
    [kunci]
  );

  return [tampilan, pilih] as const;
}

export function SakelarTampilanStatus({
  nilai,
  onPilih,
}: {
  nilai: TampilanStatus;
  onPilih: (baru: TampilanStatus) => void;
}) {
  const butir: Array<{ kunci: TampilanStatus; label: string }> = [
    { kunci: "kompleks", label: "Kompleks" },
    { kunci: "seamless", label: "Seamless" },
  ];
  return (
    <div
      role="group"
      aria-label="Tampilan Status Perkara"
      className="inline-flex shrink-0 rounded-full border border-border bg-muted/60 p-0.5 print:hidden"
    >
      {butir.map((b) => (
        <button
          key={b.kunci}
          type="button"
          aria-pressed={nilai === b.kunci}
          onClick={() => onPilih(b.kunci)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition",
            nilai === b.kunci
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

/* ========================================================================== */
/* Kelompok                                                                   */
/* ========================================================================== */

function kunciKelompok(id: string) {
  return `aleta.status-perkara.kelompok.${id}`;
}

/**
 * Kartu satu kelompok. Pada tampilan Kompleks ia TIDAK menggambar apa pun
 * selain isinya, sehingga susunan lama tetap persis seperti dulu.
 *
 * Saat dilipat, isinya hanya disembunyikan (bukan dilepas): bagian di
 * dalamnya tetap hidup dan terdaftar, jadi pencarian bagian, "buka semua",
 * dan loncatan dari linimasa tetap bekerja.
 */
export function KelompokKartu({
  id,
  seamless,
  ringkas,
  perluTindakan = 0,
  children,
}: {
  id: KelompokSeamless["id"];
  seamless: boolean;
  /** Satu kalimat keadaan kelompok, disusun dari data yang sudah ada. */
  ringkas: string;
  /** Jumlah butir "Perlu tindakan" yang menyangkut kelompok ini. */
  perluTindakan?: number;
  children: ReactNode;
}) {
  const def = KELOMPOK_SEAMLESS.find((g) => g.id === id);
  const kunci = kunciKelompok(id);
  const [ciut, setCiut] = useState(() => {
    try {
      return window.localStorage.getItem(kunci) === "1";
    } catch {
      return false;
    }
  });

  const atur = useCallback(
    (baru: boolean) => {
      setCiut(baru);
      try {
        window.localStorage.setItem(kunci, baru ? "1" : "0");
      } catch {
        /* lihat di atas */
      }
    },
    [kunci]
  );

  // Aba-aba: "buka semua" dan "buka <bagian di kelompok ini>" membuka kartunya.
  // "tutup semua" hanya menutup bagian di dalamnya - kartu kelompok dibiarkan.
  useEffect(() => {
    if (!seamless || !def) return;
    return langgananAba((aba) => {
      if (aba.jenis === "buka-semua") setCiut(false);
      else if (aba.jenis === "buka" && def.bagian.includes(aba.kunci)) setCiut(false);
    });
  }, [seamless, def]);

  if (!seamless || !def) return <>{children}</>;

  return (
    <section
      id={`kelompok-${id}`}
      data-kelompok={id}
      className={cn(
        "scroll-mt-40 rounded-xl border border-border bg-card",
        def.lebar && "min-[1700px]:col-span-full"
      )}
    >
      <button
        type="button"
        aria-expanded={!ciut}
        onClick={() => atur(!ciut)}
        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition hover:bg-muted/40"
      >
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-sm font-bold text-primary"
        >
          {def.ikon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-tight">
            {def.nama}
            {perluTindakan > 0 ? (
              <span
                title={`${perluTindakan} butir perlu tindakan`}
                className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 align-middle text-[11px] font-medium text-amber-800 dark:text-amber-300"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {perluTindakan} perlu tindakan
              </span>
            ) : null}
          </span>
          {ringkas ? (
            <span className="block text-xs text-muted-foreground sm:truncate">{ringkas}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", ciut && "-rotate-90")}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "border-t border-border/80",
          ciut && "hidden",
          // Bagian di dalam kelompok berdiri rata, tanpa kartu sendiri-sendiri.
          "[&>section]:rounded-none [&>section]:border-0 [&>section]:border-b [&>section]:border-border/60 [&>section]:bg-transparent",
          "[&>section:last-child]:border-b-0",
          "[&>section>button>h5]:normal-case [&>section>button>h5]:tracking-normal [&>section>button>h5]:text-foreground"
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Wadah daftar kelompok: satu kolom, dua kolom pada layar sangat lebar. */
export function DaftarKelompok({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 min-[1700px]:grid-cols-2 min-[1700px]:items-start">{children}</div>;
}

/** Deret pintasan kelompok; lekat di bawah kepala saat menggulir. */
export function NavKelompok({
  ringkasan,
  perluTindakan = {},
}: {
  ringkasan: Record<string, string>;
  /** Jumlah butir "Perlu tindakan" per kelompok. */
  perluTindakan?: Record<string, number>;
}) {
  const [aktif, setAktif] = useState<string>(KELOMPOK_SEAMLESS[0].id);
  // Jumlah bagian yang SEDANG hidup per kelompok - bagian bersyarat (ikrar, upaya
  // hukum, delegasi) yang tidak muncul pada perkara ini tidak ikut dihitung.
  const [hidup, setHidup] = useState<string[]>([]);
  useEffect(() => {
    const perbarui = () => setHidup(bacaDaftarBagian().map((b) => b.kunci));
    perbarui();
    return langgananDaftar(perbarui);
  }, []);
  const menuju = (g: KelompokSeamless) => {
    setAktif(g.id);
    // Membuka lewat aba-aba bagian pertamanya: kartunya ikut terbuka, dan
    // bagiannya sendiri tidak ditutup oleh pintasan ini.
    siarkanAba({ jenis: "buka", kunci: g.bagian[0] });
    window.setTimeout(() => {
      document.getElementById(`kelompok-${g.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };
  return (
    <nav
      aria-label="Kelompok keterangan perkara"
      className="sticky top-0 z-10 sm:top-[var(--tinggi-kepala-seamless,9rem)] -mx-1 flex gap-1.5 overflow-x-auto bg-card/95 px-1 py-1.5 backdrop-blur [scrollbar-width:none] print:hidden"
    >
      {KELOMPOK_SEAMLESS.map((g) => (
        <button
          key={g.id}
          type="button"
          aria-current={aktif === g.id}
          title={ringkasan[g.id] || undefined}
          onClick={() => menuju(g)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
            aktif === g.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-muted/50"
          )}
        >
          {g.nama}
          <span className="text-[11px] opacity-75">{g.bagian.filter((k) => hidup.includes(k)).length}</span>
          {perluTindakan[g.id] ? (
            <span
              role="img"
              aria-label="Ada yang perlu tindakan"
              title="Ada yang perlu tindakan"
              className="h-1.5 w-1.5 rounded-full bg-amber-500"
            />
          ) : null}
        </button>
      ))}
    </nav>
  );
}

/* ========================================================================== */
/* Linimasa                                                                   */
/* ========================================================================== */

function tanggalSingkat(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "belum";
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${Number(m[3])} ${bulan[Number(m[2]) - 1]}`;
}

export function LinimasaPerkara({ titik }: { titik: TitikLinimasa[] }) {
  const loncat = (kunci: string) => {
    siarkanAba({ jenis: "buka", kunci });
    window.setTimeout(() => {
      document.getElementById(`bagian-${kunci}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };
  if (titik.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 pb-1.5 pt-2.5">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold">Linimasa perkara</p>
        <p className="text-xs text-muted-foreground">ketuk satu titik untuk melompat ke bagiannya</p>
      </div>
      <ol className="flex snap-x overflow-x-auto pb-1.5" aria-label="Linimasa perkara">
        {titik.map((t, i) => (
          <li key={t.kunci} className="min-w-[5.6rem] flex-1 snap-center">
            <button
              type="button"
              onClick={() => loncat(t.ke)}
              aria-current={t.keadaan === "kini" ? "step" : undefined}
              className="group relative block w-full px-0.5 text-center"
            >
              {i > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[-50%] top-[0.55rem] h-[3px] w-full",
                    t.keadaan === "depan" ? "bg-border" : "bg-primary"
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-[1] mx-auto block h-[1.15rem] w-[1.15rem] rounded-full border-[3px]",
                  t.ditunda
                    ? "border-amber-500 bg-amber-500"
                    : t.keadaan === "lalu"
                      ? "border-primary bg-primary"
                      : t.keadaan === "kini"
                        ? "border-primary bg-card ring-4 ring-primary/20"
                        : "border-border bg-card"
                )}
              />
              <span className="mt-1 block text-xs font-semibold group-hover:underline">{t.nama}</span>
              <span className="block text-[11px] text-muted-foreground">
                {t.ditunda ? `${tanggalSingkat(t.tanggal)} (ditunda)` : tanggalSingkat(t.tanggal)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ========================================================================== */
/* Tata letak                                                                 */
/* ========================================================================== */

/**
 * Susunan Seamless di bawah kepala: linimasa, kolom ringkasan, deret kelompok.
 *
 * Laptop dan TV: kolom ringkasan di kanan (lekat), linimasa dan kelompok di
 * kiri. HP: satu kolom dengan urutan linimasa, ringkasan, lalu kelompok -
 * "Perlu tindakan" tidak boleh terkubur di bawah lima kelompok. Di atas
 * 1700 px kelompok yang tidak selebar baris dipasang berdampingan.
 */
export function TataLetakSeamless({
  linimasa,
  rail,
  nav,
  children,
}: {
  linimasa: ReactNode;
  rail: ReactNode;
  nav: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] min-[1700px]:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="min-w-0 xl:col-start-1 xl:row-start-1">{linimasa}</div>
      <aside
        aria-label="Ringkasan dan tindakan"
        className="space-y-3 xl:sticky xl:top-[calc(var(--tinggi-kepala-seamless,9rem)+0.75rem)] xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start print:static"
      >
        {rail}
      </aside>
      <div className="min-w-0 space-y-3 xl:col-start-1 xl:row-start-2">
        {nav}
        <DaftarKelompok>{children}</DaftarKelompok>
      </div>
    </div>
  );
}
