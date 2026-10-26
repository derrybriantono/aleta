"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
 *
 * 22 Okt 2026 - SATU kalender untuk semua pemilih tanggal Jadwal Sidang (tunda
 * ringkas & Hasil Sidang, Per panitera sidang, tanggal tampilan Jadwal Sidang,
 * Jadwal Mediasi): Libur nasional (merah), Cuti bersama (jingga), Libur tambahan
 * Pengaturan (ungu), Sabtu/Minggu (kelabu), dengan namanya saat diarahkan /
 * disentuh dan di daftar bawah; hari ini dan tanggal usulan bertanda. Papan
 * ketik: panah (hari/pekan), PageUp/PageDown (bulan), Home/End, Enter memilih,
 * Esc menutup. Lebar mengikuti layar HP; sel membesar di layar TV.
 *
 * PILIHAN: tanggal yang MENULIS (tunda, sidang berikutnya) - hari libur TIDAK
 * dapat dipilih sama sekali (SIPP sendiri menolak Sabtu/Minggu; sidang pada hari
 * libur tidak pernah benar, jadi konfirmasi tidak ditawarkan). Tanggal yang
 * hanya MELIHAT (tampilan Jadwal Sidang/Mediasi) memakai `liburBolehDipilih`:
 * tetap bertanda, boleh dibuka - melihat jadwal hari libur tidak menulis apa pun.
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

/**
 * 23 Okt 2026: pemilih tampilan berdiri di baris alat bersama tombol lain.
 * Keterangan "hari libur" yang ikut mengalir menambah tinggi kotaknya dan
 * mendorong tombol di sebelahnya turun - kini ia melayang di bawah kotak.
 */
const keteranganMelayang =
  "pointer-events-none absolute left-0 top-full z-10 mt-0.5 whitespace-nowrap rounded bg-card/90 px-1 leading-tight";

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
  usulan,
  liburBolehDipilih = false,
  tampilKalender = true,
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
  /** Tanggal usulan aturan - bertanda di kalender. */
  usulan?: string;
  /** Hanya untuk tanggal tampilan (tidak menulis): libur bertanda tetapi boleh dipilih. */
  liburBolehDipilih?: boolean;
  /**
   * Saklar Tampilan "kalender-libur" (22 Okt 2026): false = tombol kalender dan
   * keterangan "hari libur (nama)" tidak digambar. Kotak tanggalnya tetap dapat
   * diketik; tanggal libur yang ditolak (pemilih penulis) tetap disebut.
   */
  tampilKalender?: boolean;
}) {
  useHariLibur();
  const [buka, setBuka] = useState(false);
  const [ditolak, setDitolak] = useState("");
  const [bulan, setBulan] = useState(() => (tanggalSah(value) ? value.slice(0, 7) : hariIni().slice(0, 7)));
  const bungkus = useRef<HTMLDivElement | null>(null);
  const barisIsian = useRef<HTMLDivElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const [posisi, setPosisi] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  useEffect(() => {
    if (!buka) return;
    const tutup = (e: MouseEvent) => {
      const t = e.target as Node;
      if (bungkus.current?.contains(t) || panel.current?.contains(t)) return;
      setBuka(false);
    };
    document.addEventListener("mousedown", tutup);
    return () => document.removeEventListener("mousedown", tutup);
  }, [buka]);

  // 26 Okt 2026: kalender digambar di document.body dengan posisi tetap. Sebelumnya ia
  // "absolute" di dalam wadah - pada form Tunda/Putus di Jadwal Sidang wadahnya
  // overflow-x-auto (yang juga memaksa overflow-y) sehingga kalender terpotong.
  // Terbuka ke atas bila ruang di bawah tidak cukup; ikut bergeser saat digulung.
  useLayoutEffect(() => {
    // Tertutup: panel tidak digambar; posisi lama ditimpa oleh hitung() sebelum cat berikutnya saat dibuka lagi.
    if (!buka) return;
    const hitung = () => {
      const r = barisIsian.current?.getBoundingClientRect();
      if (!r) return;
      const tinggi = panel.current?.offsetHeight || 340;
      const lebar = panel.current?.offsetWidth || 304;
      const ruangBawah = window.innerHeight - r.bottom;
      const keAtas = ruangBawah < tinggi + 8 && r.top > ruangBawah;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - lebar - 8));
      setPosisi(keAtas ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 });
    };
    hitung();
    const bingkai = window.requestAnimationFrame(hitung);
    window.addEventListener("scroll", hitung, true);
    window.addEventListener("resize", hitung);
    return () => {
      window.cancelAnimationFrame(bingkai);
      window.removeEventListener("scroll", hitung, true);
      window.removeEventListener("resize", hitung);
    };
  }, [buka, bulan]);

  const pilih = (iso: string) => {
    if (!iso) {
      setDitolak("");
      onChange("");
      return;
    }
    const pesan = liburBolehDipilih ? "" : tolakTanggalLibur(iso, petaLiburBerlaku(), sebutan);
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
      <div ref={barisIsian} className="flex items-center gap-1">
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
          className={cn(
            "min-w-0 flex-1",
            // 23 Okt 2026: ikon kalender bawaan peramban tidak mengenal hari libur -
            // disembunyikan selama tombol kalender libur di sebelahnya tampil.
            tampilKalender && "[&::-webkit-calendar-picker-indicator]:hidden",
            className,
            sebabNilai && tampilKalender && "border-amber-500"
          )}
        />
        {tampilKalender ? (
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
        ) : null}
      </div>
      {ditolak ? (
        <span role="alert" className="text-[0.7rem] font-medium text-amber-700 dark:text-amber-400" data-tanggal-libur-ditolak="">
          {ditolak}
        </span>
      ) : !tampilKalender ? null : sebabNilai ? (
        <span className={cn("text-[0.7rem] font-medium text-amber-700 dark:text-amber-400", liburBolehDipilih && keteranganMelayang)} data-tanggal-libur="">
          {sebutTanggalPanjang(value)} hari libur ({sebabNilai.nama}).{liburBolehDipilih ? "" : " Pilih hari kerja lain."}
        </span>
      ) : tanpaSkb ? (
        <span className={cn("text-[0.7rem] text-muted-foreground", liburBolehDipilih && keteranganMelayang)}>
          Daftar libur nasional tahun {value.slice(0, 4)} belum ada - periksa SKB-nya.
        </span>
      ) : null}
      {buka && tampilKalender && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panel}
              data-kalender-mengambang=""
              className="fixed z-[80]"
              style={posisi ?? { left: -9999, top: 0, visibility: "hidden" }}
            >
              <KalenderLibur
                mengambang
                bulan={bulan}
                gantiBulan={setBulan}
                terpilih={value}
                min={min}
                max={max}
                usulan={usulan}
                liburBolehDipilih={liburBolehDipilih}
                tutup={() => setBuka(false)}
                pilih={(iso) => {
                  pilih(iso);
                  setBuka(false);
                }}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
const LABEL_JENIS: Record<string, string> = {
  nasional: "Libur nasional",
  "cuti-bersama": "Cuti bersama",
  daerah: "Libur tambahan",
  lain: "Libur tambahan",
  sabtu: "Sabtu",
  minggu: "Minggu",
};

/** Kelas warna sel menurut jenis libur - tema terang dan gelap. */
function warnaLibur(jenis: string): string {
  if (jenis === "nasional") return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10";
  if (jenis === "cuti-bersama") return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10";
  if (jenis === "daerah" || jenis === "lain") return "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10";
  // 23 Okt 2026: Sabtu/Minggu merah seperti kalender dinding, tanpa latar - latar merah milik libur nasional.
  return "text-red-600 dark:text-red-400";
}

function geserTanggal(iso: string, hari: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + hari)).toISOString().slice(0, 10);
}

function geserBulan(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const akhir = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, akhir))).toISOString().slice(0, 10);
}

export function KalenderLibur({
  bulan,
  gantiBulan,
  terpilih,
  min,
  max,
  pilih,
  usulan,
  liburBolehDipilih = false,
  tutup,
  mengambang = false,
}: {
  /** true = posisinya diatur pembungkus (portal posisi tetap), bukan "absolute" di bawah isian. */
  mengambang?: boolean;
  bulan: string;
  gantiBulan: (b: string) => void;
  terpilih: string;
  min?: string;
  max?: string;
  pilih: (iso: string) => void;
  usulan?: string;
  liburBolehDipilih?: boolean;
  tutup?: () => void;
}) {
  const [th, bl] = bulan.split("-").map(Number);
  const awal = `${bulan}-01`;
  const kini = hariIni();
  const [fokus, setFokus] = useState(() => (tanggalSah(terpilih) && terpilih.startsWith(bulan) ? terpilih : kini.startsWith(bulan) ? kini : awal));
  const grid = useRef<HTMLDivElement | null>(null);
  const sel = useMemo(() => {
    const geser = (hariKe(awal) + 6) % 7; // Senin = 0
    const jumlah = new Date(Date.UTC(th, bl, 0)).getUTCDate();
    const hasil: Array<string | null> = Array.from({ length: geser }, () => null);
    for (let d = 1; d <= jumlah; d += 1) hasil.push(`${bulan}-${String(d).padStart(2, "0")}`);
    return hasil;
  }, [awal, bulan, th, bl]);
  const liburBulan = sel
    .filter((x): x is string => Boolean(x))
    .map((x) => ({ x, s: sebabLibur(x) }))
    .filter((y) => y.s && y.s.jenis !== "sabtu" && y.s.jenis !== "minggu");
  const pindah = (n: number) => {
    const d = new Date(Date.UTC(th, bl - 1 + n, 1));
    gantiBulan(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  // Fokus papan ketik mengikuti tanggal aktif, juga sesudah bulan berganti.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = grid.current?.querySelector<HTMLButtonElement>(`[data-tanggal="${fokus}"]`);
      if (el && grid.current?.contains(document.activeElement ?? null)) el.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [fokus, bulan]);

  const pindahFokus = (iso: string) => {
    setFokus(iso);
    if (iso.slice(0, 7) !== bulan) gantiBulan(iso.slice(0, 7));
  };

  const tombolKunci = (e: { key: string; preventDefault: () => void; stopPropagation: () => void }, iso: string, bisa: boolean) => {
    const arah: Record<string, () => string> = {
      ArrowLeft: () => geserTanggal(iso, -1),
      ArrowRight: () => geserTanggal(iso, 1),
      ArrowUp: () => geserTanggal(iso, -7),
      ArrowDown: () => geserTanggal(iso, 7),
      PageUp: () => geserBulan(iso, -1),
      PageDown: () => geserBulan(iso, 1),
      Home: () => geserTanggal(iso, -((hariKe(iso) + 6) % 7)),
      End: () => geserTanggal(iso, 6 - ((hariKe(iso) + 6) % 7)),
    };
    if (arah[e.key]) {
      e.preventDefault();
      pindahFokus(arah[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (bisa) pilih(iso);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      tutup?.();
    }
  };

  return (
    <div
      role="dialog"
      aria-label={`Kalender ${BULAN[bl - 1]} ${th}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") tutup?.();
      }}
      className={cn(
        !mengambang && "absolute left-0 top-full z-50 mt-1",
        "w-[min(19rem,calc(100vw-2rem))] rounded-lg border bg-card p-2 text-xs text-foreground shadow-lg 2xl:w-[24rem] 2xl:text-sm"
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <button type="button" aria-label="Bulan sebelumnya" onClick={() => pindah(-1)} className="rounded p-1.5 hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-semibold">
          {BULAN[bl - 1]} {th}
        </span>
        <button type="button" aria-label="Bulan berikutnya" onClick={() => pindah(1)} className="rounded p-1.5 hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div ref={grid} className="grid grid-cols-7 gap-0.5 text-center">
        {HARI_PENDEK.map((h, i) => (
          <span key={h} className={cn("py-0.5 text-[0.65rem] font-medium text-muted-foreground 2xl:text-xs", i >= 5 && "text-red-600 dark:text-red-400")}>
            {h}
          </span>
        ))}
        {sel.map((iso, i) => {
          if (!iso) return <span key={`k${i}`} />;
          const s = sebabLibur(iso);
          const luar = Boolean((min && iso < min) || (max && iso > max));
          const mati = (Boolean(s) && !liburBolehDipilih) || luar;
          const label = s ? LABEL_JENIS[s.jenis] || "Libur" : "";
          const tambahan = [iso === kini ? "hari ini" : "", usulan && iso === usulan ? "tanggal usulan" : ""].filter(Boolean).join(", ");
          const aria = s
            ? `${sebutTanggalPanjang(iso)}, hari libur ${s.nama}${liburBolehDipilih ? "" : ", tidak dapat dipilih"} - ${label}${tambahan ? `, ${tambahan}` : ""}`
            : `${sebutTanggalPanjang(iso)}${tambahan ? `, ${tambahan}` : ""}`;
          return (
            <button
              key={iso}
              type="button"
              data-tanggal={iso}
              tabIndex={iso === fokus ? 0 : -1}
              disabled={mati}
              data-libur={s ? "ya" : undefined}
              data-jenis-libur={s ? s.jenis : undefined}
              data-usulan={usulan && iso === usulan ? "ya" : undefined}
              aria-pressed={iso === terpilih}
              title={s ? `${sebutTanggalPanjang(iso)} - ${label}: ${s.nama}` : sebutTanggalPanjang(iso)}
              aria-label={aria}
              onClick={() => pilih(iso)}
              onKeyDown={(e) => tombolKunci(e, iso, !mati)}
              onFocus={() => setFokus(iso)}
              className={cn(
                "h-9 rounded text-[0.8rem] tabular-nums sm:h-8 2xl:h-10 2xl:text-sm",
                s ? warnaLibur(s.jenis) : "",
                s && !liburBolehDipilih && "cursor-not-allowed line-through",
                s && liburBolehDipilih && !luar && "hover:ring-1 hover:ring-primary/40",
                s && luar && "cursor-not-allowed opacity-50",
                !s && (luar ? "cursor-not-allowed text-muted-foreground/50" : "hover:bg-primary/10"),
                usulan && iso === usulan && iso !== terpilih && "ring-2 ring-sky-500",
                iso === terpilih && (!s || liburBolehDipilih) && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                iso === kini && iso !== terpilih && "font-semibold underline decoration-2 underline-offset-2"
              )}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      {liburBulan.length ? (
        <ul className="mt-1.5 space-y-0.5 border-t pt-1.5 text-[0.7rem] text-muted-foreground 2xl:text-xs">
          {liburBulan.map(({ x, s }) => (
            <li key={x} className="flex items-baseline gap-1">
              <span className={cn("min-w-[1.5rem] rounded px-1 text-center font-medium", warnaLibur(s!.jenis))}>{Number(x.slice(8))}</span>
              <span>
                {s!.nama} <span className="opacity-75">({LABEL_JENIS[s!.jenis] || "Libur"})</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 border-t pt-1 text-[0.65rem] text-muted-foreground 2xl:text-xs" aria-hidden="true">
        <span className="text-red-600 dark:text-red-400">Libur nasional</span>
        <span className="text-orange-600 dark:text-orange-400">Cuti bersama</span>
        <span className="text-violet-600 dark:text-violet-400">Libur tambahan</span>
        <span className="text-red-600 dark:text-red-400">Sabtu/Minggu</span>
        <span className="underline decoration-2 underline-offset-2">Hari ini</span>
        {usulan ? <span className="rounded px-0.5 ring-1 ring-sky-500">Usulan</span> : null}
      </div>
      <p className="mt-1 text-[0.65rem] text-muted-foreground 2xl:text-xs">
        {liburBolehDipilih ? "Hari libur bertanda; boleh dibuka untuk melihat jadwal." : "Hari libur dicoret dan tidak dapat dipilih."}
      </p>
    </div>
  );
}
