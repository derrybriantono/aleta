"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { apiPath } from "@/lib/base-path";
import {
  hariKe,
  pasangTambahanLibur,
  petaLiburBerlaku,
  sebabLibur,
  sebutTanggalPanjang,
  tahunTanpaSkb,
  tanggalSah,
  tolakTanggalLibur,
  type TambahanLibur,
} from "@/lib/hari-libur";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PEMILIH TANGGAL SIDANG - HARI LIBUR TIDAK DAPAT DIPILIH (18 Okt 2026)
 * ============================================================================
 *
 * Kotak tanggal yang sama (input type=date, dapat diketik) ditambah kalender
 * kecil: Sabtu, Minggu, libur nasional, cuti bersama, dan libur tambahan
 * Pengaturan tampil kelabu bergaris beserta namanya dan tidak dapat ditekan.
 * Tanggal libur yang diketik ditolak - nilai lama tetap - dan sebabnya disebut.
 */

let muatan: Promise<void> | null = null;
let versiLibur = 0;
const pendengar = new Set<() => void>();

/** Membaca libur tambahan Pengaturan sekali per halaman. Daftar SKB berlaku sejak awal. */
export function muatHariLibur(): Promise<void> {
  if (!muatan) {
    muatan = (async () => {
      try {
        const r = await fetch(apiPath("/api/hari-libur"), { cache: "no-store" });
        const isi = (await r.json().catch(() => null)) as { data?: { tambahan?: TambahanLibur[] } } | null;
        if (r.ok && isi?.data?.tambahan) {
          pasangTambahanLibur(isi.data.tambahan);
          versiLibur += 1;
          pendengar.forEach((f) => f());
        }
      } catch {
        // Tanpa jaringan: daftar SKB tetap berlaku.
      }
    })();
  }
  return muatan;
}

/** Versi peta libur - berubah sesudah tambahan Pengaturan terbaca, supaya layar menggambar ulang. */
export function useHariLibur(): number {
  const [versi, setVersi] = useState(versiLibur);
  useEffect(() => {
    const f = () => setVersi(versiLibur);
    pendengar.add(f);
    void muatHariLibur();
    return () => {
      pendengar.delete(f);
    };
  }, []);
  return versi;
}

const HARI_PENDEK = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function hariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PemilihTanggalSidang({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  kelasBungkus,
  sebutan = "Tanggal sidang",
  "aria-label": ariaLabel,
  id,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  kelasBungkus?: string;
  sebutan?: string;
  "aria-label"?: string;
  id?: string;
}) {
  useHariLibur();
  const [buka, setBuka] = useState(false);
  const [ditolak, setDitolak] = useState("");
  const [bulan, setBulan] = useState(() => (tanggalSah(value) ? value.slice(0, 7) : hariIni().slice(0, 7)));
  const bungkus = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!buka) return;
    const tutup = (e: MouseEvent) => {
      if (bungkus.current && !bungkus.current.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener("mousedown", tutup);
    return () => document.removeEventListener("mousedown", tutup);
  }, [buka]);

  const pilih = (iso: string) => {
    if (!iso) {
      setDitolak("");
      onChange("");
      return;
    }
    const pesan = tolakTanggalLibur(iso, petaLiburBerlaku(), sebutan);
    if (pesan) {
      setDitolak(pesan);
      return;
    }
    setDitolak("");
    onChange(iso);
  };

  const sebabNilai = tanggalSah(value) ? sebabLibur(value) : null;
  const tanpaSkb = tanggalSah(value) && tahunTanpaSkb(value);

  return (
    <div ref={bungkus} className={cn("relative flex flex-col gap-0.5", kelasBungkus)}>
      <div className="flex items-center gap-1">
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={sebabNilai ? true : undefined}
          onChange={(e) => pilih(e.target.value)}
          className={cn("min-w-0 flex-1", className, sebabNilai && "border-amber-500")}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (tanggalSah(value)) setBulan(value.slice(0, 7));
            setBuka((x) => !x);
          }}
          aria-label="Buka kalender - hari libur tidak dapat dipilih"
          aria-expanded={buka}
          title="Kalender: hari libur bergaris dan tidak dapat dipilih"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
      {ditolak ? (
        <span role="alert" className="text-[0.7rem] font-medium text-amber-700 dark:text-amber-400" data-tanggal-libur-ditolak="">
          {ditolak}
        </span>
      ) : sebabNilai ? (
        <span className="text-[0.7rem] font-medium text-amber-700 dark:text-amber-400" data-tanggal-libur="">
          {sebutTanggalPanjang(value)} hari libur ({sebabNilai.nama}). Pilih hari kerja lain.
        </span>
      ) : tanpaSkb ? (
        <span className="text-[0.7rem] text-muted-foreground">Daftar libur nasional tahun {value.slice(0, 4)} belum ada - periksa SKB-nya.</span>
      ) : null}
      {buka ? (
        <KalenderLibur
          bulan={bulan}
          gantiBulan={setBulan}
          terpilih={value}
          min={min}
          max={max}
          pilih={(iso) => {
            pilih(iso);
            setBuka(false);
          }}
        />
      ) : null}
    </div>
  );
}

function KalenderLibur({
  bulan,
  gantiBulan,
  terpilih,
  min,
  max,
  pilih,
}: {
  bulan: string;
  gantiBulan: (b: string) => void;
  terpilih: string;
  min?: string;
  max?: string;
  pilih: (iso: string) => void;
}) {
  const [th, bl] = bulan.split("-").map(Number);
  const awal = `${bulan}-01`;
  const sel = useMemo(() => {
    const geser = (hariKe(awal) + 6) % 7; // Senin = 0
    const jumlah = new Date(Date.UTC(th, bl, 0)).getUTCDate();
    const hasil: Array<string | null> = Array.from({ length: geser }, () => null);
    for (let d = 1; d <= jumlah; d += 1) hasil.push(`${bulan}-${String(d).padStart(2, "0")}`);
    return hasil;
  }, [awal, bulan, th, bl]);
  const liburBulan = sel.filter((x): x is string => Boolean(x)).map((x) => ({ x, s: sebabLibur(x) })).filter((y) => y.s && y.s.jenis !== "sabtu" && y.s.jenis !== "minggu");
  const pindah = (n: number) => {
    const d = new Date(Date.UTC(th, bl - 1 + n, 1));
    gantiBulan(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const kini = hariIni();

  return (
    <div
      role="dialog"
      aria-label={`Kalender ${BULAN[bl - 1]} ${th}`}
      className="absolute left-0 top-full z-50 mt-1 w-[17.5rem] rounded-lg border bg-card p-2 text-xs text-foreground shadow-lg"
    >
      <div className="mb-1 flex items-center justify-between">
        <button type="button" aria-label="Bulan sebelumnya" onClick={() => pindah(-1)} className="rounded p-1 hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-semibold">
          {BULAN[bl - 1]} {th}
        </span>
        <button type="button" aria-label="Bulan berikutnya" onClick={() => pindah(1)} className="rounded p-1 hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {HARI_PENDEK.map((h) => (
          <span key={h} className="py-0.5 text-[0.65rem] font-medium text-muted-foreground">
            {h}
          </span>
        ))}
        {sel.map((iso, i) => {
          if (!iso) return <span key={`k${i}`} />;
          const s = sebabLibur(iso);
          const luar = Boolean((min && iso < min) || (max && iso > max));
          const mati = Boolean(s) || luar;
          const nama = s ? s.nama : "";
          return (
            <button
              key={iso}
              type="button"
              disabled={mati}
              data-libur={s ? "ya" : undefined}
              title={s ? `${sebutTanggalPanjang(iso)} - libur: ${nama}` : sebutTanggalPanjang(iso)}
              aria-label={s ? `${sebutTanggalPanjang(iso)}, hari libur ${nama}, tidak dapat dipilih` : sebutTanggalPanjang(iso)}
              onClick={() => pilih(iso)}
              className={cn(
                "h-7 rounded text-[0.75rem] tabular-nums",
                s
                  ? "cursor-not-allowed text-muted-foreground line-through [background-image:repeating-linear-gradient(135deg,transparent_0_4px,rgba(127,127,127,0.18)_4px_6px)]"
                  : luar
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : "hover:bg-primary/10",
                iso === terpilih && !s && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                iso === kini && iso !== terpilih && "ring-1 ring-primary/50"
              )}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      {liburBulan.length ? (
        <ul className="mt-1.5 space-y-0.5 border-t pt-1.5 text-[0.7rem] text-muted-foreground">
          {liburBulan.map(({ x, s }) => (
            <li key={x}>
              <span className="font-medium text-foreground">{Number(x.slice(8))}</span> {s!.nama}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-[0.65rem] text-muted-foreground">Tanggal bergaris: hari libur, tidak dapat dipilih.</p>
    </div>
  );
}
