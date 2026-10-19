"use client";

/**
 * Pita ruang sidang satu baris di atas tabel Jadwal Sidang (JADWAL-3 butir 3,
 * 19 Okt 2026) - menggantikan baris "Ruang sidang yang digunakan" dan baris
 * "RUANG SIDANG · ..." di layar itu. Rancangan: docs/rancangan/ruang-sidang-ringkas.html.
 *
 * Satu pil per ruang: titik warna, nama, perkara yang sedang disidang,
 * antrian ke-n, dan lama berjalan. Menekan pil = loncat ke baris yang sedang
 * disidang; ▾ = rincian melayang (jumlah perkara, perlu diperiksa, saring
 * ruang) yang tidak menambah tinggi. Pita tidak pernah melipat: yang tidak
 * muat digeser DI DALAM pita, sehingga halaman tidak ikut menggulir ke samping.
 */
import { ChevronDown, MapPin, PauseCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { DiskorsRingkas } from "@/lib/jadwal-sidang-2okt";
import { jamSingkat } from "@/lib/jadwal-sidang-2okt";
import { menitBerjalan, ringkasPita, sebutLama, type PilRuang } from "@/lib/pita-ruang-sidang";
import { cn } from "@/lib/utils";

type Rincian = { nama: string; kiri: number; atas: number };

export function PitaRuangSidang({
  pil,
  tampilJumlah,
  tampilBerjalan,
  diskors,
  nomorPerkara,
  ruangPilihan,
  onPilih,
  onLihat,
  keteranganPerlu,
  sekarangMs,
}: {
  pil: ReadonlyArray<PilRuang>;
  /** Saklar "kartu-ruang": jumlah perkara dan perlu diperiksa. */
  tampilJumlah: boolean;
  /** Saklar "ringkasan-ruang": yang sedang disidang dan yang diskors. */
  tampilBerjalan: boolean;
  diskors: ReadonlyArray<DiskorsRingkas>;
  nomorPerkara: (kunci: string) => string;
  ruangPilihan: string | null;
  /** Saring tabel ke satu ruang; null = semua. Kosong = tombol saring tidak ada. */
  onPilih?: (nama: string | null) => void;
  onLihat: (kunci: string) => void;
  keteranganPerlu: string;
  /** Jam sekarang menurut patokan bot (bila ada). */
  sekarangMs: () => number;
}) {
  const [rincian, setRincian] = useState<Rincian | null>(null);
  const wadah = useRef<HTMLElement | null>(null);
  // Detak 30 detik untuk "lama berjalan" - hanya pita ini yang dilukis ulang.
  const [, setDetak] = useState(0);
  useEffect(() => {
    if (!tampilBerjalan) return;
    const t = window.setInterval(() => setDetak((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [tampilBerjalan]);

  useEffect(() => {
    if (!rincian) return;
    const tutup = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "mousedown" && wadah.current?.contains(e.target as Node)) return;
      setRincian(null);
    };
    document.addEventListener("mousedown", tutup);
    document.addEventListener("keydown", tutup);
    window.addEventListener("scroll", tutup, true);
    return () => {
      document.removeEventListener("mousedown", tutup);
      document.removeEventListener("keydown", tutup);
      window.removeEventListener("scroll", tutup, true);
    };
  }, [rincian]);

  const tampakDiskors = tampilBerjalan ? diskors : [];
  if (pil.length === 0 && tampakDiskors.length === 0) return null;
  const ringkas = ringkasPita(pil);
  const kini = sekarangMs();
  const buka = (nama: string, tombol: HTMLElement) => {
    if (rincian?.nama === nama) return setRincian(null);
    const r = tombol.getBoundingClientRect();
    const lebar = Math.min(300, window.innerWidth - 32);
    setRincian({ nama, kiri: Math.max(16, Math.min(r.left, window.innerWidth - lebar - 16)), atas: r.bottom + 6 });
  };
  const pilRincian = rincian ? pil.find((p) => p.nama === rincian.nama) : undefined;

  return (
    <section
      ref={wadah}
      data-pita-ruang-sidang=""
      aria-label="Ruang sidang"
      className="relative rounded-xl border bg-muted/20"
    >
      <div className="flex min-h-[2.25rem] items-center gap-1.5 overflow-x-auto whitespace-nowrap px-2 py-1 text-xs [scrollbar-width:thin]">
        <MapPin className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
        {tampilJumlah ? (
          <>
            {/* Di HP ringkasan jumlah disembunyikan supaya pil ruang - yang
                paling dicari - langsung terlihat; angkanya tetap di rincian ▾. */}
            <span className="hidden shrink-0 font-medium text-muted-foreground sm:inline">
              {ringkas.ruang} ruang · {ringkas.perkara} perkara
            </span>
            {ringkas.perlu > 0 ? (
              <span
                className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800 dark:bg-red-950 dark:text-red-200"
                title={keteranganPerlu}
              >
                {ringkas.perlu} perlu<span className="hidden sm:inline"> diperiksa</span>
              </span>
            ) : null}
          </>
        ) : null}
        {pil.map((p) => {
          const b = tampilBerjalan ? p.berjalan : null;
          const lama = b ? sebutLama(menitBerjalan(b.sejak, kini)) : "";
          const tersaring = ruangPilihan === p.nama;
          return (
            <span
              key={p.nama}
              data-pil-ruang={p.nama}
              className={cn(
                "inline-flex shrink-0 items-center overflow-hidden rounded-full border",
                p.warna.kartu,
                tersaring && p.warna.cincin
              )}
            >
              <button
                type="button"
                onClick={(e) => (b ? onLihat(b.kunci) : buka(p.nama, e.currentTarget))}
                title={b ? "Tunjukkan baris yang sedang disidang" : `Rincian ${p.nama}`}
                className="inline-flex items-center gap-1.5 py-0.5 pl-2.5 pr-1.5 text-left"
              >
                {b ? (
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                    <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none", p.warna.titik)} />
                    <span className={cn("relative inline-flex h-2 w-2 rounded-full", p.warna.titik)} />
                  </span>
                ) : (
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", p.warna.titik)} aria-hidden="true" />
                )}
                <span className="font-semibold">{p.nama}</span>
                {b ? (
                  <span className="tabular-nums">
                    {b.nomorPerkara || `perkara ${b.perkaraId}`}
                    {b.nomorAntrian !== null ? ` · antrian ${b.nomorAntrian}` : ""}
                    {lama ? <span className="font-semibold"> · {lama}</span> : null}
                  </span>
                ) : tampilJumlah && p.jumlah !== null ? (
                  <span className="opacity-75">{p.jumlah} perkara</span>
                ) : null}
                {tampilJumlah && p.perlu > 0 ? (
                  <span
                    className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-200"
                    title={`${p.perlu} perlu diperiksa`}
                  >
                    {p.perlu}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={(e) => buka(p.nama, e.currentTarget.parentElement ?? e.currentTarget)}
                aria-expanded={rincian?.nama === p.nama}
                aria-label={`Rincian ${p.nama}`}
                className="self-stretch border-l border-black/10 px-1.5 opacity-70 transition hover:opacity-100 dark:border-white/15"
              >
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          );
        })}
        {tampakDiskors.length > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1" data-pita-diskors="">
            {tampakDiskors.map((d) => (
              <button
                key={d.kunci}
                type="button"
                onClick={() => onLihat(d.kunci)}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-amber-900 transition hover:bg-amber-500/20 dark:text-amber-100"
                title={`Diskors${d.oleh ? ` oleh ${d.oleh}` : ""}${d.alasan ? ` (${d.alasan})` : ""} - belum selesai, dapat dilanjutkan.`}
              >
                <PauseCircle className="h-3 w-3" aria-hidden="true" />
                <span className="tabular-nums">{nomorPerkara(d.kunci) || `perkara ${d.perkaraId}`}</span>
                {d.perkiraanLanjut ? <span className="font-semibold">lanjut ±{jamSingkat(d.perkiraanLanjut).replace(":", ".")}</span> : d.jam ? <span className="opacity-80">{d.jam}</span> : null}
              </button>
            ))}
          </span>
        ) : null}
        {ruangPilihan && onPilih ? (
          <button
            type="button"
            onClick={() => onPilih(null)}
            className="shrink-0 rounded-full border px-2 py-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            semua ruang
          </button>
        ) : null}
      </div>

      {rincian && pilRincian ? (
        <div
          role="dialog"
          aria-label={`Rincian ${pilRincian.nama}`}
          data-pita-rincian={pilRincian.nama}
          style={{ left: rincian.kiri, top: rincian.atas }}
          className="fixed z-40 w-[18.75rem] max-w-[calc(100vw-2rem)] rounded-lg border bg-card p-3 text-xs shadow-lg"
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <span className={cn("h-2.5 w-2.5 rounded-full", pilRincian.warna.titik)} aria-hidden="true" />
            {pilRincian.nama}
          </p>
          {pilRincian.berjalan ? (
            <p className="mt-1">
              <span className="text-muted-foreground">Sedang disidang: </span>
              {pilRincian.berjalan.nomorPerkara || `perkara ${pilRincian.berjalan.perkaraId}`}
              {pilRincian.berjalan.nomorAntrian !== null ? `, antrian ${pilRincian.berjalan.nomorAntrian}` : ""}
              {jamSingkat(pilRincian.berjalan.sejak) ? `, sejak ${jamSingkat(pilRincian.berjalan.sejak)}` : ""}
              {sebutLama(menitBerjalan(pilRincian.berjalan.sejak, kini)) ? ` (${sebutLama(menitBerjalan(pilRincian.berjalan.sejak, kini))})` : ""}
              {pilRincian.berjalan.sumber === "manual" ? " - ditandai manual" : ""}
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground">Belum ada yang sedang disidang.</p>
          )}
          {pilRincian.jumlah !== null ? (
            <p className="mt-1">
              <span className="text-muted-foreground">Jadwal: </span>
              {pilRincian.jumlah} perkara · {pilRincian.perlu} perlu diperiksa
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pilRincian.berjalan ? (
              <button
                type="button"
                onClick={() => {
                  onLihat(pilRincian.berjalan!.kunci);
                  setRincian(null);
                }}
                className="rounded-md border px-2 py-1 transition hover:bg-muted"
              >
                Lihat barisnya
              </button>
            ) : null}
            {onPilih && pilRincian.jumlah !== null ? (
              <button
                type="button"
                aria-pressed={ruangPilihan === pilRincian.nama}
                onClick={() => {
                  onPilih(ruangPilihan === pilRincian.nama ? null : pilRincian.nama);
                  setRincian(null);
                }}
                className="rounded-md border px-2 py-1 transition hover:bg-muted"
              >
                {ruangPilihan === pilRincian.nama ? "Tampilkan semua ruang" : "Saring ruang ini"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
