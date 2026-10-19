"use client";

/**
 * Petunjuk kecil di bawah kotak cari Jadwal Sidang / Jadwal Mediasi
 * (JADWAL-3 butir 1, 19 Okt 2026): kata kunci yang dikenali, dan yang sedang
 * berlaku. Tampil hanya selama kotaknya disentuh, melayang, sehingga daftar
 * sidang tidak terdorong turun.
 */
import type { HasilUraiPintar, KataKunciPintar, MedanPintar } from "@/lib/cari-pintar-jadwal";
import { cn } from "@/lib/utils";

export function PetunjukCariPintar({
  terbuka,
  kataKunci,
  medan,
  contohMedan,
  urai,
  onPilih,
  enterKeSipp = false,
  className,
}: {
  terbuka: boolean;
  kataKunci: readonly KataKunciPintar[];
  medan: readonly MedanPintar[];
  contohMedan: readonly string[];
  urai: HasilUraiPintar;
  /** Menambahkan kata kunci ke kotak cari. */
  onPilih: (kata: string) => void;
  /** Sebut bahwa Enter mencari ke SIPP (Jadwal Sidang). */
  enterKeSipp?: boolean;
  className?: string;
}) {
  if (!terbuka) return null;
  const label = (kunci: string) => kataKunci.find((k) => k.kunci === kunci)?.label ?? kunci;
  const labelMedan = (kunci: string) => medan.find((m) => m.kunci === kunci)?.label ?? kunci;
  const berlaku = [
    ...urai.kunci.map(label),
    ...Object.entries(urai.medan).flatMap(([k, v]) => v.map((n) => `${labelMedan(k)}: ${n}`)),
  ];
  return (
    <div
      data-petunjuk-cari-pintar=""
      // Menekan petunjuk tidak boleh mencuri fokus dari kotak cari - kalau
      // dicuri, kotaknya kehilangan fokus dan petunjuknya tertutup sebelum
      // klik sampai ke tombolnya.
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        "absolute left-0 top-full z-30 mt-1 w-[34rem] max-w-[calc(100vw-2rem)] rounded-md border bg-card p-2 text-xs shadow-lg",
        className
      )}
    >
      {berlaku.length > 0 ? (
        <p className="mb-1.5 flex flex-wrap items-center gap-1" data-cari-berlaku="">
          <span className="text-muted-foreground">Menyaring:</span>
          {berlaku.map((b) => (
            <span key={b} className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              {b}
            </span>
          ))}
        </p>
      ) : null}
      <p className="mb-1 text-muted-foreground">Ketik atau pilih kata kunci:</p>
      <div className="flex flex-wrap gap-1">
        {kataKunci.map((k) => (
          <button
            key={k.kunci}
            type="button"
            onClick={() => onPilih(k.frasa[0])}
            className={cn(
              "rounded-full border px-2 py-0.5 transition hover:bg-muted",
              urai.kunci.includes(k.kunci) && "border-primary bg-primary/10 text-primary"
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-muted-foreground">
        Nama orang: {contohMedan.join(" · ")}
        {enterKeSipp ? " · Enter mencari ke SIPP" : ""}
      </p>
    </div>
  );
}
