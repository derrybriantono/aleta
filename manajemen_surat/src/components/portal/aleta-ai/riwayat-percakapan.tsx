"use client";

import { useMemo, useState } from "react";
import { Check, EyeOff, PanelLeftClose, Pencil, Plus, Search, X } from "lucide-react";

import { kelompokkanRiwayat, type RingkasPercakapan } from "@/lib/aleta-ai/kontrak";
import { cn } from "@/lib/utils";

type Props = {
  daftar: RingkasPercakapan[];
  memuat: boolean;
  aktifId: string | null;
  /** Kelas tata letak (laci di HP, kolom tetap di layar lebar) dari induknya. */
  className?: string;
  onPilih: (id: string) => void;
  onBaru: () => void;
  onUbahNama: (id: string, judul: string) => void | Promise<void>;
  onSembunyikan: (id: string) => void | Promise<void>;
  onTutup: () => void;
};

export function RiwayatPercakapan({ daftar, memuat, aktifId, className, onPilih, onBaru, onUbahNama, onSembunyikan, onTutup }: Props) {
  const [cari, setCari] = useState("");
  const [mengubah, setMengubah] = useState<string | null>(null);
  const [judulBaru, setJudulBaru] = useState("");
  const [menyembunyikan, setMenyembunyikan] = useState<string | null>(null);

  const disaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    if (!kata) return daftar;
    return daftar.filter((p) => p.judul.toLowerCase().includes(kata) || (p.perkara ?? "").toLowerCase().includes(kata));
  }, [daftar, cari]);
  const kelompok = useMemo(() => kelompokkanRiwayat(disaring), [disaring]);

  function mulaiUbah(p: RingkasPercakapan) {
    setMenyembunyikan(null);
    setMengubah(p.id);
    setJudulBaru(p.judul);
  }

  async function simpanUbah() {
    const id = mengubah;
    const judul = judulBaru.trim();
    setMengubah(null);
    if (id && judul) await onUbahNama(id, judul);
  }

  return (
    <aside aria-label="Riwayat percakapan" className={cn("flex-col border-r border-border/70 bg-card lg:bg-muted/30", className)}>
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onBaru}
          className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Percakapan baru</span>
        </button>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Ciutkan riwayat"
          title="Ciutkan riwayat"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent/75 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PanelLeftClose className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <label className="relative block">
          <span className="sr-only">Cari percakapan</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari percakapan"
            className="h-9 w-full rounded-lg border border-input/90 bg-card/70 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
        </label>
      </div>

      <nav aria-label="Daftar percakapan" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {memuat ? (
          <p role="status" className="px-2 py-3 text-sm text-muted-foreground">
            Memuat riwayat...
          </p>
        ) : null}
        {!memuat && kelompok.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {cari.trim() ? "Tidak ada percakapan yang cocok." : "Belum ada percakapan. Mulai dengan mengetik pertanyaan."}
          </p>
        ) : null}
        {kelompok.map((k) => (
          <section key={k.nama} className="mb-3" aria-label={k.nama}>
            <h3 className="px-2 pb-1 pt-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{k.nama}</h3>
            <ul className="space-y-0.5">
              {k.isi.map((p) => {
                const aktif = p.id === aktifId;
                if (mengubah === p.id) {
                  return (
                    <li key={p.id} className="flex items-center gap-1 rounded-lg bg-card p-1">
                      <input
                        autoFocus
                        aria-label="Nama percakapan"
                        value={judulBaru}
                        maxLength={120}
                        onChange={(e) => setJudulBaru(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void simpanUbah();
                          if (e.key === "Escape") setMengubah(null);
                        }}
                        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      />
                      <button type="button" aria-label="Simpan nama" onClick={() => void simpanUbah()} className="inline-flex size-8 items-center justify-center rounded-md text-primary hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Check className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" aria-label="Batal ubah nama" onClick={() => setMengubah(null)} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                }
                if (menyembunyikan === p.id) {
                  return (
                    <li key={p.id} className="rounded-lg border border-border/70 bg-card p-2 text-sm">
                      <p className="mb-2 leading-5">Sembunyikan percakapan ini dari riwayat?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMenyembunyikan(null);
                            void onSembunyikan(p.id);
                          }}
                          className="h-8 rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Ya, sembunyikan
                        </button>
                        <button type="button" onClick={() => setMenyembunyikan(null)} className="h-8 rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          Batal
                        </button>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={p.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onPilih(p.id)}
                      aria-current={aktif ? "page" : undefined}
                      className={cn(
                        "flex w-full min-w-0 flex-col rounded-lg px-3 py-2 pr-16 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        aktif ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                      )}
                    >
                      <span className="truncate font-medium">{p.judul || "Percakapan baru"}</span>
                      {p.perkara ? <span className="truncate text-xs text-muted-foreground">{p.perkara}</span> : null}
                    </button>
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-100 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                      <button type="button" aria-label={`Ubah nama ${p.judul}`} title="Ubah nama" onClick={() => mulaiUbah(p)} className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Sembunyikan ${p.judul}`}
                        title="Sembunyikan"
                        onClick={() => {
                          setMengubah(null);
                          setMenyembunyikan(p.id);
                        }}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <EyeOff className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
}
