"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { bacaDaftarBagian, langgananAba, langgananDaftar, siarkanAba } from "@/lib/alat-bagian";
import {
  PEMISAH_RINGKAS,
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

/** Pilihan buka-tutup kelompok diingat PER PERKARA (rancangan 3 Nov 2026, keputusan 2a). */
function kunciKelompok(kunciPerkara: string, id: string) {
  return `aleta.status-perkara.kelompok2.${kunciPerkara || "-"}.${id}`;
}

/** Bagian di dalam kelompok berdiri rata, tanpa kartu sendiri-sendiri. */
const KELAS_ISI_KELOMPOK = [
  "[&>section]:rounded-none [&>section]:border-0 [&>section]:border-b [&>section]:border-border/60 [&>section]:bg-transparent",
  "[&>section:last-child]:border-b-0",
  "[&>section>button>h5]:normal-case [&>section>button>h5]:tracking-normal [&>section>button>h5]:text-foreground",
].join(" ");

/**
 * Kartu satu kelompok.
 *
 * Seamless: kartu berlipatan; terbuka bawaan menurut TAHAP perkara
 * (`terbukaBawaan`), pilihan pengguna diingat per perkara. Kompleks: judul
 * kelompok kecil dan semua bagiannya terbentang dalam satu kartu.
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
  terbukaBawaan = true,
  kunciPerkara = "",
  children,
}: {
  id: KelompokSeamless["id"];
  seamless: boolean;
  /** Satu kalimat keadaan kelompok, disusun dari data yang sudah ada. */
  ringkas: string;
  /** Jumlah butir "Perlu tindakan" yang menyangkut kelompok ini. */
  perluTindakan?: number;
  /** Seamless: terbuka sendiri bila tahap perkara menuntutnya. */
  terbukaBawaan?: boolean;
  /** Nomor perkara - kunci ingatan buka-tutup. */
  kunciPerkara?: string;
  children: ReactNode;
}) {
  const def = KELOMPOK_SEAMLESS.find((g) => g.id === id);
  const kunci = kunciKelompok(kunciPerkara, id);
  const [ciut, setCiut] = useState(() => {
    try {
      const tersimpan = window.localStorage.getItem(kunci);
      if (tersimpan === "buka") return false;
      if (tersimpan === "tutup") return true;
    } catch {
      /* bawaan tahap */
    }
    return !terbukaBawaan;
  });

  const atur = useCallback(
    (baru: boolean) => {
      setCiut(baru);
      try {
        window.localStorage.setItem(kunci, baru ? "tutup" : "buka");
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

  if (!def) return <>{children}</>;

  if (!seamless) {
    return (
      <section id={`kelompok-${id}`} data-kelompok-kompleks={id} className="scroll-mt-28 space-y-2">
        <h4 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border">
          {def.nama}
          {perluTindakan > 0 ? (
            <span
              role="img"
              aria-label="Ada yang perlu tindakan"
              title={`${perluTindakan} butir perlu tindakan`}
              className="h-1.5 w-1.5 rounded-full bg-amber-500"
            />
          ) : null}
        </h4>
        <div className={cn("space-y-2", "[&>section]:bg-card")}>{children}</div>
      </section>
    );
  }

  return (
    <section
      id={`kelompok-${id}`}
      data-kelompok={id}
      className={cn("scroll-mt-28 rounded-xl border border-border bg-card", def.lebar && "min-[1700px]:col-span-full")}
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
          {ringkas ? <span className="block text-xs text-muted-foreground sm:truncate">{ringkas}</span> : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", ciut && "-rotate-90")}
          aria-hidden
        />
      </button>
      <div className={cn("border-t border-border/80", ciut && "hidden", KELAS_ISI_KELOMPOK)}>{children}</div>
    </section>
  );
}

/** Wadah daftar kelompok: satu kolom, dua kolom pada layar sangat lebar (Seamless). */
export function DaftarKelompok({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 min-[1700px]:grid-cols-2 min-[1700px]:items-start">{children}</div>;
}

/** Membuka bagian (dan kelompoknya), lalu menggulung ke sana SESUDAH terbuka. */
export function loncatKeBagian(...kunci: string[]) {
  for (const k of kunci) siarkanAba({ jenis: "buka", kunci: k });
  window.setTimeout(() => {
    for (const k of kunci) {
      const el = document.getElementById(`bagian-${k}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
  }, 60);
}

/** Deret pintasan kelompok, satu baris yang dapat digulir mendatar. */
export function NavKelompok({
  ringkasan,
  perluTindakan = {},
  sembunyiDiLebar = false,
}: {
  ringkasan: Record<string, string>;
  /** Jumlah butir "Perlu tindakan" per kelompok. */
  perluTindakan?: Record<string, number>;
  /** Kompleks layar lebar: indeks kiri yang memegang tugas ini. */
  sembunyiDiLebar?: boolean;
}) {
  const [aktif, setAktif] = useState<string>(KELOMPOK_SEAMLESS[0].id);
  // Jumlah bagian yang SEDANG hidup per kelompok - bagian bersyarat (ikrar, upaya
  // hukum, delegasi, jawaban, eksekusi) yang tidak muncul pada perkara ini tidak ikut dihitung.
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
      className={cn(
        "flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] print:hidden",
        sembunyiDiLebar && "lg:hidden"
      )}
    >
      {KELOMPOK_SEAMLESS.map((g) => (
        <button
          key={g.id}
          type="button"
          aria-current={aktif === g.id}
          title={ringkasan[g.id] || undefined}
          onClick={() => menuju(g)}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
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

/**
 * Indeks bagian di kiri (Kompleks, layar lebar): kelompok dan bagiannya yang
 * SEDANG hidup, satu ketukan menuju bagiannya. Di layar sempit deret
 * kelompok di bilah lekat yang memegang tugas ini.
 */
export function IndeksKompleks({ perluTindakan = {} }: { perluTindakan?: Record<string, number> }) {
  const [daftar, setDaftar] = useState<Array<{ kunci: string; judul: string }>>([]);
  useEffect(() => {
    const perbarui = () => setDaftar(bacaDaftarBagian());
    perbarui();
    return langgananDaftar(perbarui);
  }, []);
  return (
    <nav
      aria-label="Indeks bagian"
      data-indeks-kompleks=""
      className="sticky top-16 hidden max-h-[calc(100vh-6rem)] flex-col gap-3 overflow-auto rounded-xl border border-border bg-card p-3 text-sm lg:flex print:hidden"
    >
      {KELOMPOK_SEAMLESS.map((g) => {
        const anggota = g.bagian
          .map((k) => daftar.find((d) => d.kunci === k))
          .filter((x): x is { kunci: string; judul: string } => Boolean(x));
        if (anggota.length === 0) return null;
        return (
          <div key={g.id}>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.nama}
              {perluTindakan[g.id] ? (
                <span
                  role="img"
                  aria-label="Ada yang perlu tindakan"
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
                />
              ) : null}
            </h4>
            {anggota.map((b) => (
              <button
                key={b.kunci}
                type="button"
                onClick={() => loncatKeBagian(b.kunci)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-[13px] transition hover:bg-muted/60"
              >
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                {b.judul}
              </button>
            ))}
          </div>
        );
      })}
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

/** Linimasa tipis: satu baris titik di dalam sorotan; titik yang diketuk membuka bagiannya. */
export function LinimasaPerkara({ titik }: { titik: TitikLinimasa[] }) {
  if (titik.length === 0) return null;
  return (
    // Tanpa gulir dalam di lebar mana pun: titik membungkus ke baris berikutnya di layar
    // sempit; garis penyambung hanya digambar di lebar xl ke atas, tempat satu baris cukup.
    <ol className="flex flex-wrap gap-y-2" aria-label="Linimasa perkara">
      {titik.map((t, i) => (
        <li key={t.kunci} className="min-w-[4.2rem] flex-1">
          <button
            type="button"
            onClick={() => loncatKeBagian(t.ke)}
            aria-current={t.keadaan === "kini" ? "step" : undefined}
            className="group relative block w-full px-0.5 text-center"
          >
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[-50%] top-[0.4rem] hidden h-[2.5px] w-full xl:block",
                  t.keadaan === "depan" ? "bg-border" : "bg-primary"
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-[1] mx-auto block h-[0.85rem] w-[0.85rem] rounded-full border-[2.5px]",
                t.ditunda
                  ? "border-amber-500 bg-amber-500"
                  : t.keadaan === "lalu"
                    ? "border-primary bg-primary"
                    : t.keadaan === "kini"
                      ? "border-primary bg-card ring-4 ring-primary/20"
                      : "border-border bg-card"
              )}
            />
            <span className="mt-0.5 block text-[11.5px] font-semibold group-hover:underline">{t.nama}</span>
            <span className="block text-[11px] text-muted-foreground">
              {t.ditunda ? `${tanggalSingkat(t.tanggal)}${PEMISAH_RINGKAS}tunda` : tanggalSingkat(t.tanggal)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/* ========================================================================== */
/* Sorotan perkara (rancangan 3 Nov 2026)                                     */
/* ========================================================================== */

/**
 * Sorotan: perkara yang sedang dibuka, dengan Sidang berikutnya dan Perlu
 * dikerjakan sebagai yang paling menonjol. Menggantikan kepala perkara, kartu
 * Keadaan/Sidang berikutnya/Majelis, kotak angka, dan kolom kanan. Isinya
 * disusun pemanggil dari muatan yang SUDAH ada - tidak ada pembacaan baru.
 */
export function SorotanPerkara({
  kepala,
  aksi,
  berikutnya,
  kerja,
  linimasa,
  fakta,
}: {
  kepala: ReactNode;
  aksi: ReactNode;
  berikutnya: ReactNode;
  kerja: ReactNode;
  linimasa: ReactNode;
  fakta: ReactNode;
}) {
  return (
    <section
      id="sorotan-perkara"
      aria-label="Perkara yang sedang dibuka"
      data-cetak-status-perkara=""
      className="space-y-3.5 overflow-visible rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 space-y-1.5 basis-[18rem]">{kepala}</div>
        <div className="print:hidden">{aksi}</div>
      </div>
      {/* Satu kolom di bawah ±900 px; tanpa tinggi tetap dan tanpa overflow - isi tidak boleh terpotong. */}
      <div className="grid gap-2.5 min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] [&>*]:min-w-0">
        {berikutnya}
        {kerja}
      </div>
      {linimasa}
      {fakta}
    </section>
  );
}

/** Kotak "Sidang berikutnya" / "Putusan": tanggal, agenda, dan pintasan. */
export function KotakBerikutnya({
  label,
  waktu,
  agenda,
  bawah,
}: {
  label: string;
  waktu: string;
  agenda?: ReactNode;
  bawah?: ReactNode;
}) {
  return (
    <div data-kotak-berikutnya="" className="flex flex-col gap-1 rounded-xl bg-primary/10 px-3.5 py-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</span>
      <span className="text-xl font-bold leading-tight">{waktu}</span>
      {agenda ? <span className="text-sm">{agenda}</span> : null}
      {bawah ? <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">{bawah}</div> : null}
    </div>
  );
}

export type ButirKerja = { pesan: string; sebab?: string; berat: boolean; ke: string[] };

/** Kotak "Perlu dikerjakan": tiap butir dapat diketuk dan membuka bagiannya. */
export function KotakKerja({ butir, onKe }: { butir: ButirKerja[]; onKe: (ke: string[]) => void }) {
  return (
    <div
      data-kotak-kerja=""
      className="flex flex-col gap-2 rounded-xl border border-border px-3.5 py-3"
    >
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          butir.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
        )}
      >
        {butir.length > 0 ? `Perlu dikerjakan${PEMISAH_RINGKAS}${butir.length}` : "Tidak ada yang perlu dikerjakan"}
      </span>
      {butir.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {butir.map((x) => (
            <li key={x.pesan}>
              <button
                type="button"
                title={x.sebab || undefined}
                onClick={() => onKe(x.ke)}
                className="group flex w-full items-start gap-2 text-left text-sm"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full",
                    x.berat ? "bg-amber-600 dark:bg-amber-400" : "bg-muted-foreground/60"
                  )}
                />
                <span className="group-hover:underline">{x.pesan}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Butir-butir ringkas satu baris, disambung pemisah redup berspasi (PEMISAH_RINGKAS). */
export function RingkasBerpemisah({ butir }: { butir: ReactNode[] }) {
  return (
    <>
      {butir.map((b, i) => (
        <span key={i}>
          {i > 0 ? (
            <span aria-hidden className="whitespace-pre text-muted-foreground/60">
              {PEMISAH_RINGKAS}
            </span>
          ) : null}
          {b}
        </span>
      ))}
    </>
  );
}

/** Satu baris fakta kecil di dasar sorotan. */
export function BarisFakta({
  fakta,
  majelis,
}: {
  fakta: Array<{ label: string; nilai: string; nada?: "baik" | "perhatian" | "kurang" }>;
  /** Butir majelis dan petugas; disambung pemisah redup (PEMISAH_RINGKAS). */
  majelis: string[];
}) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3" data-fakta-sorotan="">
      {fakta.map((f) => (
        <div key={f.label} className="flex min-w-0 flex-col">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd
            className={cn(
              "text-sm font-semibold tabular-nums",
              f.nada === "baik" && "text-emerald-700 dark:text-emerald-300",
              f.nada === "perhatian" && "text-amber-700 dark:text-amber-300",
              f.nada === "kurang" && "text-rose-700 dark:text-rose-300"
            )}
          >
            {f.nilai}
          </dd>
        </div>
      ))}
      {majelis.length > 0 ? (
        <div className="flex min-w-0 basis-[18rem] flex-1 flex-col">
          <dt className="text-xs text-muted-foreground">Majelis</dt>
          <dd className="text-[13.5px] font-medium">
            <RingkasBerpemisah butir={majelis} />
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * Bilah lekat: di atas, menyusut menjadi satu baris (nomor, keadaan, sidang
 * berikutnya) begitu sorotan tergulir keluar; di bawahnya cari di perkara ini
 * dan deret kelompok. Tanpa IntersectionObserver (uji, peramban tua) bilahnya
 * tetap berfungsi, hanya baris ringkasnya tidak muncul.
 */
export function BilahLekat({
  ringkas,
  cari,
  deret,
}: {
  ringkas: ReactNode;
  cari: ReactNode;
  deret: ReactNode;
}) {
  const [mengambang, setMengambang] = useState(false);
  useEffect(() => {
    const sorot = document.getElementById("sorotan-perkara");
    if (!sorot || typeof IntersectionObserver === "undefined") return;
    const pengamat = new IntersectionObserver(
      (masuk) => {
        const e = masuk[0];
        setMengambang(!e.isIntersecting && e.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    pengamat.observe(sorot);
    return () => pengamat.disconnect();
  }, []);
  return (
    <div
      data-bilah-lekat=""
      data-mengambang={mengambang ? "ya" : "tidak"}
      className={cn(
        "sticky top-0 z-20 flex flex-col gap-2 rounded-xl border border-border bg-card/95 px-2.5 py-2 shadow-sm backdrop-blur print:static",
        mengambang && "shadow-md"
      )}
    >
      {mengambang ? (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px]" data-lekat-ringkas="">
          {ringkas}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-[0_1_20rem] basis-52 [&>div]:!mt-0">{cari}</div>
        {deret}
      </div>
    </div>
  );
}
