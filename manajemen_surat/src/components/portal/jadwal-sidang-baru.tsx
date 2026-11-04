"use client";

/**
 * Bahan tampilan BARU Jadwal Sidang dan Jadwal Mediasi (4 Nov 2026).
 *
 * Berkas ini hanya PENYUSUN TAMPILAN: bilah lekat, kotak cari berpil, kepala
 * lajur yang dapat diurutkan, kartu berlajur lebar tetap, pita bawah kartu.
 * Isinya diterima sebagai `ReactNode` dari layar yang memanggil - sehingga
 * seluruh logika data, izin, dan penulisan (tunda, putus, antrian, relaas,
 * hasil mediasi) tetap satu-satunya di komponen lama dan tidak disalin ke sini.
 *
 * Tampilan lama tetap utuh di tempatnya dan dapat dipilih kembali per
 * pengguna (lihat @/lib/jadwal-baru: bacaAntarmuka).
 */

import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import type { Antarmuka, KeadaanSegmen, LangkahTahap, PerkiraanBht, Saran } from "@/lib/jadwal-baru";
import { cn } from "@/lib/utils";

// ============================================================================
// BILAH LEKAT
// ============================================================================

/** Satu bilah lekat di atas daftar: judul, tanggal, cari, saringan, pilihan tampilan. */
export function BilahLekat({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-bilah-jadwal=""
      className={cn(
        "sticky top-0 z-30 flex min-w-0 max-w-full flex-col gap-1.5 rounded-xl border bg-card p-2 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Satu baris di dalam bilah: di HP tidak melipat ke bawah, menggulir di dalam bilah (halaman tidak bergeser). */
export function BarisBilah({ children, className, ...sisa }: { children: ReactNode; className?: string } & Record<string, unknown>) {
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-wrap items-center gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-0.5 [&>*]:max-w-full max-sm:[&>*]:shrink-0",
        className
      )}
      {...sisa}
    >
      {children}
    </div>
  );
}

export function TombolIkon({
  label,
  judul,
  onClick,
  tekan,
  badge,
  children,
  className,
  ...sisa
}: {
  label: string;
  judul?: string;
  onClick?: () => void;
  tekan?: boolean;
  badge?: number | string | null;
  children: ReactNode;
  className?: string;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={judul ?? label}
      aria-pressed={tekan}
      className={cn(
        "relative inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md border px-1.5 text-xs transition",
        tekan ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
      {...sisa}
    >
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** Dua/tiga pilihan berdempet: Saya | Semua, Ringkas | Lengkap, Tampilan lama | baru. */
export function SegmenPilihan<N extends string>({
  label,
  nilai,
  pilihan,
  onPilih,
  className,
  ...sisa
}: {
  label: string;
  nilai: N;
  pilihan: ReadonlyArray<{ nilai: N; label: string; judul?: string }>;
  onPilih: (nilai: N) => void;
  className?: string;
} & Record<string, unknown>) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex shrink-0 overflow-hidden rounded-md border text-xs", className)} {...sisa}>
      {pilihan.map((p, i) => (
        <button
          key={p.nilai}
          type="button"
          aria-pressed={nilai === p.nilai}
          title={p.judul}
          onClick={() => onPilih(p.nilai)}
          className={cn(
            "h-8 px-2.5 transition",
            i > 0 && "border-l",
            nilai === p.nilai ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Pilihan "Tampilan lama / Tampilan baru" (menu ⋯ dan panel Tampilan). */
export function PilihanAntarmuka({
  nilai,
  onPilih,
  nama,
  className,
}: {
  nilai: Antarmuka;
  onPilih: (a: Antarmuka) => void;
  nama: string;
  className?: string;
}) {
  return (
    <SegmenPilihan<Antarmuka>
      label={`Tampilan ${nama}: lama atau baru`}
      nilai={nilai}
      onPilih={onPilih}
      className={className}
      data-pilihan-antarmuka=""
      pilihan={[
        { nilai: "baru", label: "Tampilan baru", judul: `Tampilan baru ${nama}` },
        { nilai: "lama", label: "Tampilan lama", judul: `Kembali ke tampilan ${nama} yang lama` },
      ]}
    />
  );
}

/** Menu ⋯ sederhana: tombol yang membuka kotak isian dan menutup saat di luar ditekan atau Esc. */
export function MenuTitik({
  children,
  label = "Menu lain",
  ikon,
  className,
  kelasTombol,
}: {
  children: ReactNode;
  label?: string;
  ikon?: ReactNode;
  className?: string;
  /** Mengganti gaya tombol pembuka (mis. tombol teks kecil "Lainnya" di pita kartu). */
  kelasTombol?: string;
}) {
  const [buka, setBuka] = useState(false);
  const wadah = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!buka) return;
    const luar = (e: MouseEvent) => {
      if (!wadah.current?.contains(e.target as Node)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuka(false);
    };
    document.addEventListener("mousedown", luar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", luar);
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);
  return (
    <div ref={wadah} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={buka}
        aria-haspopup="menu"
        onClick={() => setBuka((x) => !x)}
        className={cn(
          kelasTombol ?? "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-sm transition",
          buka ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {ikon ?? "⋯"}
      </button>
      {buka ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 flex w-64 max-w-[calc(100vw-1rem)] flex-col gap-1.5 rounded-lg border bg-card p-2 text-sm text-card-foreground shadow-lg"
          onClick={(e) => {
            // Tombol di dalam yang menandai dirinya sebagai penutup menutup menu.
            if ((e.target as HTMLElement).closest("[data-tutup-menu]")) setBuka(false);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// KOTAK CARI BERPIL
// ============================================================================

export function KotakCariBerpil({
  nilai,
  onUbah,
  onEnter,
  saran,
  medanLabel,
  onPilihSaran,
  placeholder,
  ariaLabel,
  kakiTanpaTeks,
  kakiDenganTeks,
  className,
  disabled,
}: {
  nilai: string;
  onUbah: (teks: string) => void;
  /** Enter tanpa saran yang disorot: cari ke SIPP/server. */
  onEnter: () => void;
  saran: readonly Saran[];
  medanLabel: (medan: string) => string;
  onPilihSaran: (s: Saran) => void;
  placeholder: string;
  ariaLabel: string;
  kakiTanpaTeks: string;
  kakiDenganTeks: (teks: string) => string;
  className?: string;
  disabled?: boolean;
}) {
  const [fokus, setFokus] = useState(false);
  const [ke, setKe] = useState(-1);
  const input = useRef<HTMLInputElement | null>(null);
  const wadah = useRef<HTMLDivElement | null>(null);
  const popup = useRef<HTMLDivElement | null>(null);
  const [kotak, setKotak] = useState<{ left: number; top: number; width: number } | null>(null);
  const buka = fokus && !disabled;

  useLayoutEffect(() => {
    if (!buka) return;
    const hitung = () => {
      const r = input.current?.getBoundingClientRect();
      if (!r) return;
      const lebar = Math.min(window.innerWidth - 16, Math.max(r.width, 420));
      setKotak({ left: Math.max(8, Math.min(r.left, window.innerWidth - lebar - 8)), top: r.bottom + 4, width: lebar });
    };
    hitung();
    window.addEventListener("resize", hitung);
    window.addEventListener("scroll", hitung, true);
    return () => {
      window.removeEventListener("resize", hitung);
      window.removeEventListener("scroll", hitung, true);
    };
  }, [buka, saran.length]);

  useEffect(() => {
    if (!fokus) return;
    const luar = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wadah.current?.contains(t) || popup.current?.contains(t)) return;
      setFokus(false);
    };
    document.addEventListener("mousedown", luar);
    return () => document.removeEventListener("mousedown", luar);
  }, [fokus]);

  const pilih = useCallback(
    (s: Saran) => {
      onPilihSaran(s);
      setKe(-1);
      setFokus(false);
      input.current?.blur();
    },
    [onPilihSaran]
  );

  return (
    <div ref={wadah} className={cn("relative min-w-[11rem] flex-1 basis-56", className)} data-cari-berpil="">
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={input}
        type="search"
        value={nilai}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={buka}
        aria-autocomplete="list"
        onChange={(e) => {
          onUbah(e.target.value);
          setKe(-1);
          setFokus(true);
        }}
        onFocus={() => setFokus(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setFokus(true);
            setKe((k) => Math.min(saran.length - 1, k + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setKe((k) => Math.max(-1, k - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (ke >= 0 && saran[ke]) pilih(saran[ke]);
            else {
              setFokus(false);
              onEnter();
            }
          } else if (e.key === "Escape") {
            setFokus(false);
            setKe(-1);
          }
        }}
        className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {buka && kotak ? (
        <div
          ref={popup}
          role="listbox"
          aria-label="Saran pencarian"
          data-saran-cari=""
          style={{ position: "fixed", left: kotak.left, top: kotak.top, width: kotak.width }}
          className="z-[85] flex max-h-[min(420px,calc(100vh-1rem))] flex-col gap-px overflow-auto rounded-xl border bg-card p-1.5 text-card-foreground shadow-xl"
        >
          {saran.map((s, i) => (
            <button
              key={`${s.medan}|${s.nilai}`}
              type="button"
              role="option"
              aria-selected={i === ke}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pilih(s)}
              className={cn(
                "grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                i === ke && "bg-muted"
              )}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.medan === "tag" ? "Tag" : medanLabel(s.medan)}</span>
              <span className="min-w-0 break-words">{s.teks ?? s.nilai}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{s.jumlah}</span>
            </button>
          ))}
          {saran.length === 0 && nilai.trim() ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada yang cocok di data yang sedang tampil.</p>
          ) : null}
          <p className="border-t px-2 pt-1.5 text-xs text-muted-foreground">{nilai.trim() ? kakiDenganTeks(nilai.trim()) : kakiTanpaTeks}</p>
        </div>
      ) : null}
    </div>
  );
}

/** Pil yang sedang berlaku (sama medan = atau, antarmedan = dan), dilepas satu per satu. */
export function BarisPil({
  pil,
  tambahan,
  onLepas,
  onLepasSemua,
}: {
  pil: ReadonlyArray<{ label: string; nilai: string }>;
  /** Pil lain yang bukan milik kotak cari (mis. "Dicari ke SIPP"). */
  tambahan?: ReactNode;
  onLepas: (indeks: number) => void;
  onLepasSemua: () => void;
}) {
  if (pil.length === 0 && !tambahan) return null;
  return (
    <BarisBilah data-baris-pil="">
      {pil.map((p, i) => (
        <button
          key={`${p.label}|${p.nilai}`}
          type="button"
          onClick={() => onLepas(i)}
          title="Lepaskan saringan ini"
          className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition hover:bg-primary/20"
        >
          {p.label}: {p.nilai}
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ))}
      {tambahan}
      {pil.length > 1 ? (
        <button type="button" onClick={onLepasSemua} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Lepaskan semua
        </button>
      ) : null}
    </BarisBilah>
  );
}

// ============================================================================
// KEPALA LAJUR (dapat diurutkan) DAN KARTU BERLAJUR LEBAR TETAP
// ============================================================================

/** Lebar lajur TETAP (tidak dinamis): Waktu | Perkara & para pihak | Agenda | Majelis & putusan | Aksi. */
export const KISI_LAJUR =
  "grid-cols-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] lg:grid-cols-[8.5rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_11rem]";

export type UrutanLajur = { kunci: string; arah: "naik" | "turun" } | null;

function TombolUrut({
  kunci,
  urutan,
  onTekan,
  judul,
  children,
}: {
  kunci: string;
  urutan: UrutanLajur;
  onTekan: (kunci: string) => void;
  judul?: string;
  children: ReactNode;
}) {
  const aktif = urutan?.kunci === kunci;
  const naik = aktif && urutan?.arah === "naik";
  return (
    <button
      type="button"
      onClick={() => onTekan(kunci)}
      aria-sort={aktif ? (naik ? "ascending" : "descending") : "none"}
      title={judul ?? `Urutkan menurut ${typeof children === "string" ? children : kunci}: naik, turun, lalu kembali ke urutan antrian`}
      className={cn(
        "inline-flex items-center gap-1 rounded uppercase tracking-wide transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        aktif ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <span>{children}</span>
      {aktif ? naik ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

/** Kepala lajur untuk layar lebar; di layar sempit kartu menulis nama lajurnya sendiri. */
export function KepalaLajurSidang({
  urutan,
  onTekan,
  adaSiap,
}: {
  urutan: UrutanLajur;
  onTekan: (kunci: string) => void;
  adaSiap?: boolean;
}) {
  return (
    <div
      role="row"
      data-kepala-lajur=""
      className={cn("hidden gap-x-4 px-[17px] pb-0.5 text-[10.5px] font-extrabold lg:grid", KISI_LAJUR)}
    >
      <div role="columnheader" className="flex flex-wrap items-center gap-x-2">
        <TombolUrut kunci="antrian" urutan={urutan} onTekan={onTekan} judul="Urutkan menurut nomor antrian (urutan bawaan); yang belum mengambil jatuh ke bawah">
          Waktu
        </TombolUrut>
        {adaSiap ? (
          <TombolUrut kunci="siap" urutan={urutan} onTekan={onTekan} judul="Urutkan menurut skor kesiapan sidang">
            Siap
          </TombolUrut>
        ) : null}
      </div>
      <div role="columnheader">
        <TombolUrut kunci="perkara" urutan={urutan} onTekan={onTekan}>
          Perkara &amp; para pihak
        </TombolUrut>
      </div>
      <div role="columnheader">
        <TombolUrut kunci="agenda" urutan={urutan} onTekan={onTekan}>
          Agenda
        </TombolUrut>
      </div>
      <div role="columnheader" className="flex flex-wrap items-center gap-x-2">
        <TombolUrut kunci="majelis" urutan={urutan} onTekan={onTekan}>
          Majelis
        </TombolUrut>
        <span aria-hidden="true">&amp;</span>
        <TombolUrut kunci="putusan" urutan={urutan} onTekan={onTekan} judul="Urutkan menurut tanggal putusan; yang belum putus jatuh ke bawah">
          Putusan
        </TombolUrut>
      </div>
      <div role="columnheader" className="text-muted-foreground">
        Aksi
      </div>
    </div>
  );
}

/** Kepala lajur Jadwal Mediasi: Waktu | Perkara | Mediator & tempat | Tenggang & hasil | Aksi. */
export function KepalaLajurMediasi({ urutan, onTekan }: { urutan: UrutanLajur; onTekan: (kunci: string) => void }) {
  return (
    <div role="row" data-kepala-lajur="" className={cn("hidden gap-x-4 px-[17px] pb-0.5 text-[10.5px] font-extrabold lg:grid", KISI_LAJUR)}>
      <div role="columnheader">
        <TombolUrut kunci="waktu" urutan={urutan} onTekan={onTekan}>
          Waktu
        </TombolUrut>
      </div>
      <div role="columnheader">
        <TombolUrut kunci="perkara" urutan={urutan} onTekan={onTekan}>
          Perkara
        </TombolUrut>
      </div>
      <div role="columnheader" className="flex flex-wrap items-center gap-x-2">
        <TombolUrut kunci="mediator" urutan={urutan} onTekan={onTekan}>
          Mediator
        </TombolUrut>
        <span aria-hidden="true">&amp;</span>
        <TombolUrut kunci="tempat" urutan={urutan} onTekan={onTekan}>
          Tempat
        </TombolUrut>
      </div>
      <div role="columnheader" className="flex flex-wrap items-center gap-x-2">
        <TombolUrut kunci="tenggang" urutan={urutan} onTekan={onTekan} judul="Urutkan menurut sisa hari tenggang; yang laporannya sudah masuk jatuh ke bawah">
          Tenggang
        </TombolUrut>
        <span aria-hidden="true">&amp;</span>
        <TombolUrut kunci="hasil" urutan={urutan} onTekan={onTekan}>
          Hasil
        </TombolUrut>
      </div>
      <div role="columnheader" className="text-muted-foreground">
        Aksi
      </div>
    </div>
  );
}

export function Lajur({
  nama,
  className,
  children,
  ...sisa
}: {
  /** Nama lajur untuk layar sempit (di layar lebar sudah ada di kepala lajur). */
  nama?: string;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)} {...sisa}>
      {nama ? <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground lg:hidden">{nama}</span> : null}
      {children}
    </div>
  );
}

export type KeadaanKartu = "selesai" | "berjalan" | "diskors" | "perlu" | "";

const GARIS_KARTU: Record<KeadaanKartu, string> = {
  selesai: "border-l-emerald-500 dark:border-l-emerald-400",
  berjalan: "border-l-sky-500 ring-1 ring-sky-500/60 dark:border-l-sky-400",
  diskors: "border-l-amber-500 dark:border-l-amber-400",
  perlu: "border-l-rose-500 dark:border-l-rose-400",
  "": "border-l-border",
};

/** Kartu satu sidang: lajur-lajur berlebar tetap lalu pita bawah. */
export function KartuSidang({
  keadaan,
  terbuka,
  ringkas,
  ariaLabel,
  waktu,
  perkara,
  agenda,
  majelis,
  aksi,
  pita,
  bawah,
  namaLajur = ["Perkara & para pihak", "Agenda", "Majelis & putusan", "Aksi"],
  ...sisa
}: {
  /** Nama keempat lajur terakhir di layar sempit (Jadwal Mediasi memakai nama lain). */
  namaLajur?: readonly [string, string, string, string];
  keadaan: KeadaanKartu;
  terbuka?: boolean;
  ringkas?: boolean;
  ariaLabel: string;
  waktu: ReactNode;
  perkara: ReactNode;
  agenda: ReactNode;
  majelis: ReactNode;
  aksi: ReactNode;
  pita?: ReactNode;
  /** Isian di bawah pita: pencatat hasil, rincian terbuka. */
  bawah?: ReactNode;
} & Record<string, unknown>) {
  return (
    <article
      aria-label={ariaLabel}
      className={cn(
        "relative min-w-0 rounded-xl border border-l-[5px] bg-card text-card-foreground",
        GARIS_KARTU[keadaan],
        keadaan === "selesai" && "bg-emerald-500/[0.04]",
        keadaan === "perlu" && "bg-rose-500/[0.03]",
        terbuka && "ring-1 ring-primary/40"
      )}
      {...sisa}
    >
      <div className={cn("grid gap-x-4 gap-y-2.5 px-3", ringkas ? "py-2" : "pb-2.5 pt-3", KISI_LAJUR)}>
        <Lajur className="min-w-0 sm:flex-col lg:flex-col">{waktu}</Lajur>
        <Lajur nama={namaLajur[0]}>{perkara}</Lajur>
        <Lajur nama={namaLajur[1]} className="sm:col-start-2 lg:col-auto">
          {agenda}
        </Lajur>
        <Lajur nama={namaLajur[2]} className="sm:col-start-2 lg:col-auto">
          {majelis}
        </Lajur>
        <Lajur nama={namaLajur[3]} className="sm:col-span-2 lg:col-span-1 lg:items-stretch">
          <div className="flex flex-wrap gap-1 lg:flex-col lg:items-stretch [&_button]:justify-center">{aksi}</div>
        </Lajur>
      </div>
      {pita}
      {bawah}
    </article>
  );
}

// ============================================================================
// PITA BAWAH KARTU: Tunda|Putus, Konseptor, Keterangan, dan alat di ujung kanan
// ============================================================================

export function PitaBawahKartu({
  perlu,
  kanan,
  children,
}: {
  perlu?: boolean;
  kanan?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-pita-bawah=""
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-br-[7px] border-t px-3 py-2",
        perlu ? "border-rose-500/30 bg-rose-500/10" : "border-primary/25 bg-primary/[0.06]"
      )}
    >
      {perlu ? <b className="text-sm font-extrabold text-rose-700 dark:text-rose-300">Catat hasil sidang:</b> : null}
      {children}
      {kanan ? <span className="ml-auto flex flex-wrap items-center justify-end gap-1">{kanan}</span> : null}
    </div>
  );
}

/** Kelas ruas penanda (Konseptor, Keterangan): terisi disorot, kosong bergaris putus biru. */
export function kelasRuasPita(terisi: boolean): string {
  return cn(
    "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-left text-[13px] leading-tight transition",
    terisi
      ? "border-primary/50 bg-primary/15 text-foreground hover:bg-primary/25 [&_b]:font-extrabold"
      : "border-dashed border-primary/60 bg-transparent text-primary hover:bg-primary/10"
  );
}

/** Segmen Tunda | Putus: tegas; yang terisi disorot. Tombolnya memanggil pemicu yang sudah ada. */
export function SegmenTundaPutus({
  keadaan,
  tundaTekan,
  putusTekan,
  onTunda,
  onPutus,
  judulTunda,
  judulPutus,
  nomorPerkara,
  perlu,
}: {
  keadaan: KeadaanSegmen;
  tundaTekan: boolean;
  putusTekan: boolean;
  onTunda: () => void;
  onPutus: () => void;
  judulTunda: string;
  judulPutus: string;
  nomorPerkara: string;
  perlu?: boolean;
}) {
  if (!keadaan.tampil) return null;
  const dasar = "px-3.5 py-1.5 text-[13px] font-extrabold whitespace-nowrap transition";
  const warnaKosong = perlu
    ? "bg-card text-rose-700 hover:bg-rose-600 hover:text-white dark:text-rose-300"
    : "bg-card text-primary hover:bg-primary hover:text-primary-foreground";
  const kelasTunda = cn(
    dasar,
    keadaan.tundaNyala || tundaTekan ? "bg-amber-600 text-white" : warnaKosong
  );
  const kelasPutus = cn(dasar, "border-l-[1.5px]", keadaan.putusNyala || putusTekan ? "bg-primary text-primary-foreground" : warnaKosong);
  const sel = (kelas: string, label: string, judul: string, tekan: boolean, onClick: () => void, aria: string) =>
    keadaan.bisa ? (
      <button type="button" onClick={onClick} title={judul} aria-label={aria} aria-pressed={tekan} className={kelas}>
        {label}
      </button>
    ) : (
      <span title={judul} className={kelas}>
        {label}
      </span>
    );
  return (
    <span
      role="group"
      aria-label="Hasil sidang"
      data-tombol-tunda-putus=""
      className={cn("inline-flex max-w-full overflow-hidden rounded-lg border-[1.5px] align-middle", perlu ? "border-rose-600" : "border-primary")}
    >
      {sel(kelasTunda, keadaan.labelTunda, judulTunda, tundaTekan, onTunda, `Tunda sidang ${nomorPerkara}`)}
      {sel(kelasPutus, keadaan.labelPutus, judulPutus, putusTekan, onPutus, `Catat putusan ${nomorPerkara}`)}
    </span>
  );
}

// ============================================================================
// ISI LAJUR
// ============================================================================

export function TitikTahap({ tahap }: { tahap: LangkahTahap }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px]" title={`Proses sidang: ${tahap.daftar.join(" → ")}`} data-tahap-sidang="">
      <span className="inline-flex gap-[3px]" aria-hidden="true">
        {tahap.daftar.map((nama, i) => (
          <i
            key={nama}
            className={cn(
              "h-[7px] w-[7px] rounded-full border",
              i < tahap.ke ? "border-primary bg-primary/50" : i === tahap.ke ? "border-primary bg-primary" : "border-muted-foreground/50"
            )}
          />
        ))}
      </span>
      <b className="font-bold">{tahap.nama}</b>
    </span>
  );
}

/** Baris "Ditunda 10 Nov · agenda" (kuning) dan "Rencana CC 10 Nov · agenda" (biru), terpisah + peringatan bila tanggal beda. */
export function SidangBerikutnya({
  tunda,
  cc,
  beda,
}: {
  tunda: { tanggal: string; agenda: string; judul: string } | null;
  cc: { tanggal: string; agenda: string } | null;
  beda: boolean;
}) {
  if (!tunda && !cc) {
    return <span className="text-[12.5px] text-muted-foreground">Sidang berikutnya belum dijadwalkan</span>;
  }
  return (
    <div className="flex flex-col gap-1" data-sidang-berikutnya="">
      {tunda ? (
        <span className="grid grid-cols-[5.6em_minmax(0,1fr)] items-baseline gap-1.5 text-[12.5px] text-amber-700 dark:text-amber-300" data-s="hasil-tundaan" title={tunda.judul}>
          <i className="rounded bg-amber-500/15 px-1 py-px text-center text-[10.5px] font-extrabold not-italic">Ditunda</i>
          <span className="min-w-0 break-words">
            <b>{tunda.tanggal}</b>
            {tunda.agenda ? ` · ${tunda.agenda}` : ""}
          </span>
        </span>
      ) : null}
      {cc ? (
        <span className="grid grid-cols-[5.6em_minmax(0,1fr)] items-baseline gap-1.5 text-[12.5px]" title="Rencana di Court Calendar, belum tentu jadi tundaan">
          <i className="rounded bg-primary/15 px-1 py-px text-center text-[10.5px] font-extrabold not-italic text-primary">Rencana CC</i>
          <span className="min-w-0 break-words">
            <b>{cc.tanggal}</b>
            {cc.agenda ? ` · ${cc.agenda}` : ""}
          </span>
        </span>
      ) : null}
      {beda ? (
        <span className="text-xs font-bold text-rose-700 dark:text-rose-300" title="Tanggal tundaan berbeda dari jadwal berikutnya di Court Calendar. Sesuaikan salah satunya.">
          ⚠ Tanggal tunda berbeda dari Court Calendar
        </span>
      ) : null}
    </div>
  );
}

/** Tindak lanjut sesudah putus: Minutasi, Unggah, perkiraan BHT. PBT tidak ada sumbernya di data jadwal, jadi tidak digambar. */
export function TindakLanjutPutusan({
  minutasi,
  unggah,
  bht,
  tampilBht,
  formatTanggal,
  judulMinutasi,
}: {
  /** Rincian sebab bila minutasi belum bertanggal (tooltip). */
  judulMinutasi?: string;
  minutasi: boolean;
  unggah: boolean;
  bht: PerkiraanBht | null;
  tampilBht: boolean;
  formatTanggal: (iso: string) => string;
}) {
  const pil = (ok: boolean, label: string, judul: string, s: string) => (
    <span
      key={label}
      data-s={s}
      title={judul}
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1.5 py-px text-[11.5px] font-semibold",
        ok ? "bg-transparent px-0.5 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
      )}
    >
      {label} {ok ? "✓" : "✗"}
    </span>
  );
  return (
    <span className="flex flex-wrap items-center gap-1" data-tindak-lanjut="">
      {pil(minutasi, "Minutasi", minutasi ? "Minutasi sudah bertanggal" : (judulMinutasi ?? "Naskah belum diminutasi"), "belum-minutasi")}
      {pil(unggah, "Unggah", unggah ? "Naskah sudah diunggah ke SIPP" : "Naskah belum diunggah ke SIPP", "belum-unggah-putusan")}
      {tampilBht && bht ? (
        <span
          className="whitespace-nowrap px-0.5 text-[11.5px] font-semibold text-muted-foreground"
          title={bht.sumber === "sipp" ? "Berkekuatan hukum tetap menurut SIPP" : "Perkiraan berkekuatan hukum tetap: tanggal putusan + 14 hari"}
        >
          {bht.sumber === "sipp" ? "BHT" : "Perkiraan BHT"} {formatTanggal(bht.iso)}
        </span>
      ) : null}
    </span>
  );
}

/** Tombol lencana kecil berangka untuk Court Calendar: polos, sewarna tema, bukan kartu tanggal. */
export function IkonCc({ className }: { className?: string }) {
  return <CalendarClock className={cn("h-3.5 w-3.5", className)} aria-hidden="true" />;
}

/** Nama hakim ketua + kode yang membuka anggota saat ditekan. */
export function KodeMajelisTekan({
  kode,
  terbuka,
  onAlih,
  judul,
}: {
  kode: string;
  terbuka: boolean;
  onAlih: () => void;
  judul: string;
}) {
  return (
    <button
      type="button"
      onClick={onAlih}
      aria-expanded={terbuka}
      title={judul}
      data-kode-majelis=""
      className="inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-px font-mono text-[12px] font-bold hover:bg-muted/70"
    >
      {kode}
      {terbuka ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
    </button>
  );
}

/** Tombol kecil di pita bawah (Status, Blangko, Lainnya, Rincian). */
export const KELAS_TOMBOL_PITA =
  "inline-flex items-center justify-center gap-1 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground";

// ============================================================================
// PANEL SARINGAN (menulis pil yang sama dengan kotak cari)
// ============================================================================

export function PanelSaringan({
  daftar,
  pil,
  onAlih,
  onRentangJam,
  tersimpan,
  onSimpan,
  onPakai,
  onHapus,
  onLepasSemua,
  onTutup,
  rentangJam = true,
}: {
  daftar: ReadonlyArray<{ kunci: string; label: string; nilai: ReadonlyArray<readonly [string, number]> }>;
  pil: ReadonlyArray<{ medan: string; nilai: string }>;
  onAlih: (medan: string, nilai: string) => void;
  onRentangJam: (dari: string, sampai: string) => void;
  tersimpan: ReadonlyArray<{ nama: string }>;
  onSimpan: (nama: string) => void;
  onPakai: (indeks: number) => void;
  onHapus: (indeks: number) => void;
  onLepasSemua: () => void;
  onTutup: () => void;
  rentangJam?: boolean;
}) {
  const [nama, setNama] = useState("");
  const [jamA, setJamA] = useState("08:00");
  const [jamB, setJamB] = useState("16:00");
  const ada = (m: string, v: string) => pil.some((p) => p.medan === m && p.nilai === v);
  const kelasChip = (aktif: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
      aktif ? "border-primary bg-primary/15 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );
  return (
    <div data-panel-saringan="" className="flex max-h-[45vh] flex-col gap-2 overflow-auto border-t pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tersimpan.length > 0 ? <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tersimpan</span> : null}
        {tersimpan.map((t, i) => (
          <span key={`${t.nama}-${i}`} className="inline-flex items-center overflow-hidden rounded-full border">
            <button type="button" onClick={() => onPakai(i)} className="px-2 py-0.5 text-xs hover:bg-muted" title="Pakai saringan tersimpan ini">
              {t.nama}
            </button>
            <button type="button" onClick={() => onHapus(i)} aria-label={`Hapus saringan ${t.nama}`} className="border-l px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted">
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <span className="ml-auto inline-flex flex-wrap items-center gap-1.5">
          {pil.length > 0 ? (
            <button type="button" onClick={onLepasSemua} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Lepaskan semua
            </button>
          ) : null}
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama saringan"
            aria-label="Nama saringan yang akan disimpan"
            maxLength={40}
            className="h-7 w-36 rounded-md border border-input bg-background px-2 text-xs"
          />
          <button
            type="button"
            disabled={pil.length === 0 || !nama.trim()}
            onClick={() => {
              onSimpan(nama.trim());
              setNama("");
            }}
            className="h-7 rounded-md border px-2 text-xs transition hover:bg-muted disabled:opacity-50"
            title={pil.length === 0 ? "Pilih saringan dulu" : "Simpan pilihan saringan ini di peramban"}
          >
            Simpan saringan
          </button>
          <button type="button" onClick={onTutup} className="h-7 rounded-md border px-2 text-xs transition hover:bg-muted">
            Tutup
          </button>
        </span>
      </div>
      {daftar
        .filter((d) => d.nilai.length > 0)
        .map((d) => (
          <div key={d.kunci} className="flex flex-wrap items-center gap-1.5" data-saring-medan={d.kunci}>
            <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{d.label}</span>
            {d.nilai.map(([v, n]) => (
              <button key={v} type="button" aria-pressed={ada(d.kunci, v)} onClick={() => onAlih(d.kunci, v)} className={kelasChip(ada(d.kunci, v))}>
                {v} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            ))}
          </div>
        ))}
      {rentangJam ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Rentang jam</span>
          <input type="time" value={jamA} onChange={(e) => setJamA(e.target.value)} aria-label="Jam dari" className="h-7 rounded-md border border-input bg-background px-1.5 text-xs" />
          <span aria-hidden="true">–</span>
          <input type="time" value={jamB} onChange={(e) => setJamB(e.target.value)} aria-label="Jam sampai" className="h-7 rounded-md border border-input bg-background px-1.5 text-xs" />
          <button type="button" onClick={() => onRentangJam(jamA, jamB)} className="h-7 rounded-md border px-2 text-xs transition hover:bg-muted">
            Pakai
          </button>
        </div>
      ) : null}
    </div>
  );
}
