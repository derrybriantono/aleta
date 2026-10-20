"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Copy, RotateCcw, Sparkles } from "lucide-react";

import { formatRupiah, labelAman, type PesanAi, type Pemicu } from "@/lib/aleta-ai/kontrak";
import { cn } from "@/lib/utils";

import { MarkdownAman } from "./markdown-aman";

export type AlirAktif = {
  teks: string;
  perkiraan?: { mode: string; label?: string; perkiraanRp: number };
};

export const CONTOH_PERTANYAAN = [
  "Jelaskan tahapan perkara cerai gugat sejak pendaftaran sampai putusan.",
  "Rapikan keterangan saksi berikut menjadi kalimat baku untuk berita acara sidang.",
  "Susun kerangka pertimbangan hukum untuk perkara itsbat nikah.",
  "Bagaimana cara memakai blangko ABT by Derry di ALETA?",
];

async function salinKepapan(teks: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch {
    /* jatuh ke cara lama */
  }
  try {
    const t = document.createElement("textarea");
    t.value = teks;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(t);
    return ok;
  } catch {
    return false;
  }
}

function Lencana({ pesan }: { pesan: PesanAi }) {
  if (!pesan.mode && !pesan.label && pesan.biayaRp == null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span data-testid="lencana-mode" className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-medium text-primary">
        {labelAman(pesan.mode, pesan.label)}
      </span>
      {pesan.biayaRp != null ? <span data-testid="biaya-jawaban">{formatRupiah(pesan.biayaRp)}</span> : null}
    </span>
  );
}

function PesanPengguna({ pesan }: { pesan: PesanAi }) {
  return (
    <div className="flex justify-end" data-testid="pesan-pengguna">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-primary/20 bg-primary/10 px-4 py-2.5 text-[0.95rem] leading-6 text-foreground sm:max-w-[75%]">
        <span className="sr-only">Anda: </span>
        {pesan.isi}
      </div>
    </div>
  );
}

function PesanAiTampil({ pesan, bisaUlang, onUlangi }: { pesan: PesanAi; bisaUlang: boolean; onUlangi: () => void }) {
  const [tersalin, setTersalin] = useState(false);
  useEffect(() => {
    if (!tersalin) return;
    const t = window.setTimeout(() => setTersalin(false), 1800);
    return () => window.clearTimeout(t);
  }, [tersalin]);

  return (
    <article className="group/jawaban flex gap-3" data-testid="pesan-ai" aria-label="Jawaban ALETA Ai">
      <span aria-hidden="true" className="mt-1 hidden size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary sm:flex">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="sr-only">ALETA Ai: </span>
        <MarkdownAman teks={pesan.isi} />
        {pesan.terputus ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleAlert className="size-3.5" aria-hidden="true" /> Jawaban berhenti sebelum selesai.
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => setTersalin(await salinKepapan(pesan.isi))}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-accent/75 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tersalin ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {tersalin ? "Tersalin" : "Salin"}
          </button>
          {bisaUlang ? (
            <button
              type="button"
              onClick={onUlangi}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-accent/75 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" /> Ulangi
            </button>
          ) : null}
          <Lencana pesan={pesan} />
        </div>
      </div>
    </article>
  );
}

function JawabanMengalir({ alir }: { alir: AlirAktif }) {
  const ada = alir.teks.length > 0;
  return (
    <article className="flex gap-3" data-testid="jawaban-mengalir" aria-label="ALETA Ai sedang menjawab">
      <span aria-hidden="true" className="mt-1 hidden size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary sm:flex">
        <Sparkles className="size-4 motion-safe:animate-pulse" />
      </span>
      <div className="min-w-0 flex-1" aria-live="off">
        {alir.perkiraan ? (
          <p className="mb-1 text-xs text-muted-foreground" data-testid="perkiraan-biaya">
            Mode {labelAman(alir.perkiraan.mode, alir.perkiraan.label)} - perkiraan biaya {formatRupiah(alir.perkiraan.perkiraanRp)}
          </p>
        ) : null}
        {ada ? (
          <div>
            <MarkdownAman teks={alir.teks} />
            <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-sm bg-primary motion-safe:animate-pulse" />
          </div>
        ) : (
          <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground" data-testid="indikator-berpikir">
            <span className="flex gap-1" aria-hidden="true">
              <span className="size-1.5 rounded-full bg-primary/70 motion-safe:animate-bounce [animation-delay:-0.3s]" />
              <span className="size-1.5 rounded-full bg-primary/70 motion-safe:animate-bounce [animation-delay:-0.15s]" />
              <span className="size-1.5 rounded-full bg-primary/70 motion-safe:animate-bounce" />
            </span>
            ALETA Ai sedang menyusun jawaban
          </p>
        )}
      </div>
    </article>
  );
}

type SambutanProps = {
  pemicu: Pemicu[];
  onContoh: (teks: string) => void;
  onPemicu: (p: Pemicu) => void;
};

export function Sambutan({ pemicu, onContoh, onPemicu }: SambutanProps) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-8" data-testid="sambutan">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Sparkles className="size-7" />
        </span>
        <h2 className="font-serif text-2xl text-foreground sm:text-3xl 2xl:text-4xl">Apa yang bisa saya bantu hari ini?</h2>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Tanyakan apa saja seputar perkara dan naskah di pengadilan, atau pilih salah satu pintasan. Setiap jawaban perlu Anda periksa kembali sebelum dipakai.
        </p>
      </div>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contoh pertanyaan</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {CONTOH_PERTANYAAN.map((c) => (
          <li key={c}>
            <button
              type="button"
              onClick={() => onContoh(c)}
              className="h-full w-full rounded-xl border border-border/80 bg-card/80 px-4 py-3 text-left text-sm leading-5 transition hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {c}
            </button>
          </li>
        ))}
      </ul>

      {pemicu.length ? (
        <>
          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pintasan</h3>
          <ul className="flex flex-wrap gap-2">
            {pemicu.slice(0, 8).map((p) => (
              <li key={p.kode}>
                <button
                  type="button"
                  onClick={() => onPemicu(p)}
                  title={p.kelompok}
                  className="rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-sm transition hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

type DaftarProps = {
  pesan: PesanAi[];
  alir: AlirAktif | null;
  memuat: boolean;
  galat: string;
  onUlangi: (teks: string) => void;
  /** Teks status untuk pembaca layar. */
  status: string;
};

export function DaftarPesan({ pesan, alir, memuat, galat, onUlangi, status }: DaftarProps) {
  const ujung = useRef<HTMLDivElement | null>(null);
  const wadah = useRef<HTMLDivElement | null>(null);
  const dekatDasar = useRef(true);

  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    if (dekatDasar.current) el.scrollTop = el.scrollHeight;
  }, [pesan, alir?.teks, alir?.perkiraan, galat]);

  return (
    <div
      ref={wadah}
      onScroll={(e) => {
        const el = e.currentTarget;
        dekatDasar.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      }}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      <div
        role="log"
        aria-label="Percakapan"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={alir ? true : undefined}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 xl:max-w-4xl 2xl:max-w-5xl 2xl:text-lg"
      >
        {memuat ? (
          <p role="status" className="text-sm text-muted-foreground">
            Memuat percakapan...
          </p>
        ) : null}
        {pesan.map((p, idx) => {
          if (p.peran === "pengguna") return <PesanPengguna key={p.id} pesan={p} />;
          // "Ulangi" mengirim ulang pertanyaan pengguna tepat sebelum jawaban ini.
          const sebelum = [...pesan.slice(0, idx)].reverse().find((x) => x.peran === "pengguna");
          return (
            <PesanAiTampil
              key={p.id}
              pesan={p}
              bisaUlang={Boolean(sebelum) && !alir}
              onUlangi={() => sebelum && onUlangi(sebelum.isi)}
            />
          );
        })}
        {alir ? <JawabanMengalir alir={alir} /> : null}
        {galat ? (
          <p role="alert" className={cn("flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300")}>
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{galat}</span>
          </p>
        ) : null}
        <div ref={ujung} />
      </div>
    </div>
  );
}
