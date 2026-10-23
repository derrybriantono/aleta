"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, ChevronUp, Paperclip, Square, X } from "lucide-react";

import { formatRupiah, type Pemicu } from "@/lib/aleta-ai/kontrak";
import { cn } from "@/lib/utils";

type Props = {
  pemicu: Pemicu[];
  mengalir: boolean;
  /** Pemicu yang dipilih untuk pesan berikutnya (kode) atau null. */
  dipilih: string | null;
  onPilihPemicu: (kode: string | null) => void;
  onKirim: (teks: string, pemicu?: string) => void;
  onHentikan: () => void;
  saldoKurang?: boolean;
  /** Teks yang diisikan dari luar (mis. contoh pertanyaan) - berubah = isi ulang. */
  isianLuar?: { teks: string; nomor: number } | null;
  /** Tahap 4: perkiraan biaya SEBELUM kirim (server; tidak menahan dana). Tanpa ini, perkiraan tidak ditampilkan. */
  perkirakan?: (teks: string, pemicu?: string) => Promise<PerkiraanTampil | null>;
};

export type PerkiraanTampil = { perkiraanRp: number; label: string; bolehJalan: boolean; alasan?: string; gratis?: boolean };

const JEDA_PERKIRAAN_MS = 600;

const BATAS_CHIP_RINGKAS = 8;

export function KotakTulis({ pemicu, mengalir, dipilih, onPilihPemicu, onKirim, onHentikan, saldoKurang, isianLuar, perkirakan }: Props) {
  const [teks, setTeks] = useState("");
  // Perkiraan beserta kunci (teks|pemicu) yang diperkirakannya; yang tidak cocok dengan isian sekarang tidak ditampilkan.
  const [perkiraanUntuk, setPerkiraanUntuk] = useState<{ kunci: string; hasil: PerkiraanTampil | null } | null>(null);
  const [semua, setSemua] = useState(false);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const sedangMenyusun = useRef(false);

  const pemicuTerpilih = pemicu.find((p) => p.kode === dipilih) ?? null;
  const bisaKirim = !mengalir && (teks.trim().length > 0 || Boolean(pemicuTerpilih));

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [teks]);

  // Perkiraan biaya ditampilkan sebelum kirim; diminta ulang sesudah pengguna berhenti mengetik sebentar.
  useEffect(() => {
    if (!perkirakan || mengalir) return;
    const isi = teks.trim();
    if (!isi && !dipilih) return;
    let batal = false;
    const kunci = `${isi}|${dipilih ?? ""}`;
    const pewaktu = setTimeout(() => {
      void perkirakan(isi, dipilih ?? undefined).then((hasil) => {
        if (!batal) setPerkiraanUntuk({ kunci, hasil });
      });
    }, JEDA_PERKIRAAN_MS);
    return () => {
      batal = true;
      clearTimeout(pewaktu);
    };
  }, [teks, dipilih, perkirakan, mengalir]);

  useEffect(() => {
    if (isianLuar) {
      setTeks(isianLuar.teks);
      area.current?.focus();
    }
  }, [isianLuar]);

  function kirim() {
    if (!bisaKirim) return;
    const isi = teks.trim() || pemicuTerpilih?.label || "";
    onKirim(isi, pemicuTerpilih?.kode);
    setTeks("");
    onPilihPemicu(null);
  }

  function klikChip(p: Pemicu) {
    if (mengalir) return;
    if (teks.trim()) {
      onKirim(teks.trim(), p.kode);
      setTeks("");
      onPilihPemicu(null);
      return;
    }
    onPilihPemicu(dipilih === p.kode ? null : p.kode);
    area.current?.focus();
  }

  const tampil = semua ? pemicu : pemicu.slice(0, BATAS_CHIP_RINGKAS);
  const perkiraan = perkiraanUntuk && perkiraanUntuk.kunci === `${teks.trim()}|${dipilih ?? ""}` && (teks.trim() || pemicuTerpilih) ? perkiraanUntuk.hasil : null;

  return (
    <div className="border-t border-border/60 bg-card/60 px-3 pb-3 pt-2 sm:px-4">
      <div className="mx-auto w-full max-w-3xl xl:max-w-4xl 2xl:max-w-5xl">
        {pemicu.length ? (
          <div className="mb-2 flex items-start gap-1.5">
            <ul aria-label="Pintasan permintaan" className={cn("flex min-w-0 flex-1 gap-1.5", semua ? "flex-wrap" : "overflow-x-auto pb-1")}>
              {tampil.map((p) => {
                const aktif = p.kode === dipilih;
                return (
                  <li key={p.kode} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => klikChip(p)}
                      aria-pressed={aktif}
                      disabled={mengalir}
                      title={p.perkiraanRp ? `${p.kelompok} - perkiraan ${formatRupiah(p.perkiraanRp)}` : p.kelompok}
                      className={cn(
                        "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                        aktif ? "border-primary bg-primary text-primary-foreground" : "border-border/80 bg-card/80 hover:border-primary/40 hover:bg-accent/60"
                      )}
                    >
                      {p.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            {pemicu.length > BATAS_CHIP_RINGKAS ? (
              <button
                type="button"
                onClick={() => setSemua((s) => !s)}
                aria-expanded={semua}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {semua ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
                {semua ? "Ringkas" : "Semua"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-input/90 bg-card shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/40">
          {pemicuTerpilih ? (
            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 text-xs text-muted-foreground" data-testid="pemicu-terpilih">
              <span className="min-w-0 truncate">
                Pintasan: <strong className="font-semibold text-foreground">{pemicuTerpilih.label}</strong>. Tulis bahan lalu kirim.
                {pemicuTerpilih.perkiraanRp ? ` Perkiraan ${formatRupiah(pemicuTerpilih.perkiraanRp)}.` : ""}
              </span>
              <button type="button" aria-label="Lepas pintasan" onClick={() => onPilihPemicu(null)} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <label htmlFor="aleta-ai-kotak" className="sr-only">
            Tulis pesan untuk ALETA Ai
          </label>
          <textarea
            id="aleta-ai-kotak"
            ref={area}
            rows={1}
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            onCompositionStart={() => {
              sedangMenyusun.current = true;
            }}
            onCompositionEnd={() => {
              sedangMenyusun.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !sedangMenyusun.current && !e.nativeEvent.isComposing) {
                e.preventDefault();
                kirim();
              }
            }}
            placeholder="Tulis pertanyaan atau bahan di sini. Enter untuk kirim, Shift+Enter untuk baris baru."
            className="block max-h-56 min-h-[3rem] w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-[0.95rem] leading-6 placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <button
              type="button"
              disabled
              aria-label="Lampirkan berkas (tahap berikutnya)"
              title="Lampiran: tahap berikutnya"
              className="inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground opacity-50"
            >
              <Paperclip className="size-4" aria-hidden="true" />
            </button>
            {mengalir ? (
              <button
                type="button"
                onClick={onHentikan}
                aria-label="Hentikan jawaban"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Square className="size-3.5 fill-current" aria-hidden="true" /> Hentikan
              </button>
            ) : (
              <button
                type="button"
                onClick={kirim}
                disabled={!bisaKirim}
                aria-label="Kirim"
                className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {perkiraan && !mengalir ? (
          <p className={cn("mt-2 text-center text-xs", perkiraan.bolehJalan ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")} data-testid="perkiraan-biaya" aria-live="polite">
            {perkiraan.bolehJalan
              ? perkiraan.gratis
                ? `Mode ${perkiraan.label}. Tanpa biaya untuk akun Anda.`
                : `Perkiraan biaya: ${formatRupiah(perkiraan.perkiraanRp)} (mode ${perkiraan.label}). Dana ditahan dulu; yang dipotong biaya sebenarnya, sisanya kembali.`
              : perkiraan.alasan}
          </p>
        ) : null}
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {saldoKurang ? "Saldo Anda hampir habis; hubungi admin untuk mengisi. " : ""}
          ALETA Ai dapat keliru. Periksa kembali sebelum dipakai dalam perkara.
        </p>
      </div>
    </div>
  );
}
