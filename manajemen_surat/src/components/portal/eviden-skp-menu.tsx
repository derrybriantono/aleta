"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Archive, Download, Info, LoaderCircle, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import type { KunciPeriodeSkp, PeranEvidenSkp } from "@/lib/eviden-skp-tipe";
import {
  FORMAT_EVIDEN_SKP,
  PILIHAN_PERIODE_EVIDEN_SKP,
  SEBUTAN_FORMAT_EVIDEN_SKP,
  SEMUA_DOKUMEN_EVIDEN_SKP,
  alamatDaftarEvidenSkp,
  alamatUnduhEvidenSkp,
  bacaTanggalIso,
  mulaiPeriodeEvidenSkp,
  namaDariDisposition,
  triwulanDariTanggal,
  triwulanSelesaiTerakhir,
  type FormatEvidenSkp,
} from "@/lib/eviden-skp-unduh";
import { tanggalPanjang } from "@/lib/tanggal-indonesia";
import { cn } from "@/lib/utils";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * MENU UNDUH EVIDEN SKP (2.40.0)
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026: tombol di halaman Rekap Hakim yang
 * "ketika di pencet keluar menu pop up baru apa saja yang bisa di download
 * rekapannya". Pop up ini memilih periode, tahun, dan tanggal tanda tangan,
 * lalu menampilkan daftar dokumen dari rute JSON eviden-skp beserta tombol
 * PDF / Excel / Word per dokumen dan "Unduh semua (ZIP)" per format.
 *
 * Yang sengaja dijaga:
 *
 *   - Dokumen yang tidak dapat disusun dari SIPP tetap TAMPIL, nonaktif,
 *     beserta sebabnya - dokumen yang hilang dari daftar dikira lupa dibuat.
 *   - Unduhan yang gagal menampilkan kalimat rutenya di pop up, bukan
 *     berkas JSON bernama .pdf di folder Downloads. Karena itu unduhan lewat
 *     fetch; href tetap terpasang supaya tautannya dapat disalin/dibuka di tab
 *     baru bila skrip halaman gagal.
 *   - Tanggal "hari ini" menurut WITA, bukan menurut jam komputer yang
 *     membuka halaman. Bawaan periodenya triwulan terakhir yang SUDAH selesai
 *     (telaah 2.40.0): eviden eKinerja diunggah untuk periode yang lewat.
 *   - Catatan untuk PETUGAS (konfigurasi SIPP yang perlu dibetulkan, sumber
 *     data) tampil di sini, terpisah dari yang tercetak di dokumen.
 */

type DokumenDaftar = {
  kunci: string;
  judul: string;
  judulLengkap: string;
  tersedia: boolean;
  sebabTidakTersedia: string;
  jumlahBaris: number | null;
};

type DaftarEviden = {
  labelPeriode: string;
  namaOrang: string;
  namaKetua: string | null;
  dokumen: DokumenDaftar[];
  galat: string[];
  /** Untuk petugas - tidak tercetak di dokumen yang ditandatangani. */
  catatanOperator: string[];
};

const angka = (n: number) => n.toLocaleString("id-ID");

/** Membaca bungkus ok() rute JSON eviden-skp dengan curiga - bentuknya kontrak agen lain. */
function bacaDaftar(data: unknown): DaftarEviden {
  const d = (data ?? {}) as Record<string, unknown>;
  const periode = (d.periode ?? {}) as Record<string, unknown>;
  const orang = (d.orang ?? {}) as Record<string, unknown>;
  const ketua = (d.ketua ?? null) as Record<string, unknown> | null;
  const dokumen = Array.isArray(d.dokumen) ? d.dokumen : [];
  return {
    labelPeriode: String(periode.labelPanjang ?? ""),
    namaOrang: String(orang.nama ?? ""),
    namaKetua: ketua && ketua.nama ? String(ketua.nama) : null,
    dokumen: dokumen
      .map((x) => (x ?? {}) as Record<string, unknown>)
      .filter((x) => typeof x.kunci === "string" && x.kunci)
      .map((x) => ({
        kunci: String(x.kunci),
        judul: String(x.judul ?? x.kunci),
        judulLengkap: String(x.judulLengkap ?? x.judul ?? x.kunci),
        tersedia: x.tersedia === true,
        sebabTidakTersedia: String(x.sebabTidakTersedia ?? ""),
        jumlahBaris: typeof x.jumlahBaris === "number" && Number.isFinite(x.jumlahBaris) ? x.jumlahBaris : null,
      })),
    galat: Array.isArray(d.galat) ? d.galat.map((g) => String(g)).filter(Boolean) : [],
    catatanOperator: Array.isArray(d.catatanOperator) ? d.catatanOperator.map((g) => String(g)).filter(Boolean) : [],
  };
}

/** Elemen yang dapat difokus di dalam pop up - untuk jebakan Tab. */
function dapatDifokus(akar: HTMLElement): HTMLElement[] {
  return Array.from(
    akar.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute("aria-hidden"));
}

type TombolUnduhProps = {
  alamat: string | null;
  format: FormatEvidenSkp;
  sibuk: boolean;
  label: string;
  onUnduh: (alamat: string) => void;
};

/** Satu tombol format. Tanpa alamat = nonaktif (dokumen tidak tersedia). */
function TombolUnduh({ alamat, format, sibuk, label, onUnduh }: TombolUnduhProps) {
  const teks = SEBUTAN_FORMAT_EVIDEN_SKP[format];
  const kelas =
    "inline-flex h-9 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";
  if (!alamat) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${teks} - ${label} (tidak tersedia)`}
        className={cn(kelas, "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground opacity-60")}
      >
        {teks}
      </button>
    );
  }
  return (
    <a
      href={alamat}
      download
      aria-label={`Unduh ${label} sebagai ${teks}`}
      aria-busy={sibuk || undefined}
      data-format={format}
      onClick={(e) => {
        e.preventDefault();
        if (!sibuk) onUnduh(alamat);
      }}
      className={cn(
        kelas,
        "border-border bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-accent/70 hover:text-accent-foreground",
        sibuk && "pointer-events-none opacity-70"
      )}
    >
      {sibuk ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
      {teks}
    </a>
  );
}

export function EvidenSkpMenu({
  peran,
  id,
  nama,
  onTutup,
}: {
  peran: PeranEvidenSkp;
  id: number;
  /** Nama dari rekap, bila sudah terbaca - hanya untuk judul pop up. */
  nama?: string;
  onTutup: () => void;
}) {
  const hariIni = waktuPengadilan().tanggal;
  const tahunIni = Number(hariIni.slice(0, 4));
  // Bawaan: triwulan terakhir yang SUDAH selesai (Januari-Maret: Triwulan IV
  // tahun lalu) - eviden eKinerja untuk periode yang sudah lewat. Triwulan
  // berjalan dan Tahunan tetap dapat dipilih.
  const [bawaan] = useState(() => triwulanSelesaiTerakhir(hariIni));
  const [tahun, setTahun] = useState(bawaan.tahun);
  const [periode, setPeriode] = useState<KunciPeriodeSkp>(bawaan.periode);
  const [tanggal, setTanggal] = useState(hariIni);
  const [daftar, setDaftar] = useState<DaftarEviden | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState<Record<string, boolean>>({});
  const [kabar, setKabar] = useState<{ jenis: "ok" | "galat"; teks: string } | null>(null);
  const [ulang, setUlang] = useState(0);
  const nomorMinta = useRef(0);
  const kotak = useRef<HTMLDivElement>(null);
  const tombolTutup = useRef<HTMLButtonElement>(null);
  const idJudul = useId();
  const idKeterangan = useId();

  const tanggalSah = bacaTanggalIso(tanggal);

  // Fokus masuk ke pop up saat dibuka; pengembaliannya ke tombol pemicu
  // diurus pemanggil, yang memegang tombolnya.
  useEffect(() => {
    tombolTutup.current?.focus();
  }, []);

  useEffect(() => {
    const nomor = ++nomorMinta.current;
    const timer = window.setTimeout(async () => {
      setMemuat(true);
      setGalat("");
      try {
        const balasan = await fetch(apiPath(alamatDaftarEvidenSkp({ peran, id, tahun, periode })), { cache: "no-store" });
        const isi = (await balasan.json().catch(() => null)) as {
          ok?: boolean;
          data?: unknown;
          error?: { message?: string };
        } | null;
        if (nomor !== nomorMinta.current) return;
        if (!balasan.ok || !isi || isi.ok === false) {
          setDaftar(null);
          setGalat(isi?.error?.message || `Daftar dokumen tidak dapat dibuka (HTTP ${balasan.status}).`);
          return;
        }
        setDaftar(bacaDaftar(isi.data));
      } catch (e) {
        if (nomor !== nomorMinta.current) return;
        setDaftar(null);
        setGalat(e instanceof Error && e.message ? `Daftar dokumen tidak dapat dibuka: ${e.message}` : "Daftar dokumen tidak dapat dibuka.");
      } finally {
        if (nomor === nomorMinta.current) setMemuat(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [peran, id, tahun, periode, ulang]);

  const unduh = useCallback(async (alamat: string) => {
    setSibuk((s) => ({ ...s, [alamat]: true }));
    setKabar(null);
    try {
      const balasan = await fetch(alamat, { cache: "no-store" });
      if (!balasan.ok) {
        const isi = (await balasan.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(isi?.error?.message || `Unduhan gagal (HTTP ${balasan.status}).`);
      }
      const berkas = await balasan.blob();
      const namaBerkas = namaDariDisposition(balasan.headers.get("content-disposition")) || "Eviden SKP";
      const url = URL.createObjectURL(berkas);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaBerkas;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setKabar({ jenis: "ok", teks: `${namaBerkas} diunduh.` });
    } catch (e) {
      setKabar({ jenis: "galat", teks: e instanceof Error && e.message ? e.message : "Unduhan gagal." });
    } finally {
      setSibuk((s) => {
        const sisa = { ...s };
        delete sisa[alamat];
        return sisa;
      });
    }
  }, []);

  /** Escape menutup; Tab berputar di dalam pop up. */
  const tekanTombol = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onTutup();
      return;
    }
    if (e.key !== "Tab" || !kotak.current) return;
    const semua = dapatDifokus(kotak.current);
    if (semua.length === 0) return;
    const pertama = semua[0];
    const terakhir = semua[semua.length - 1];
    if (e.shiftKey && document.activeElement === pertama) {
      e.preventDefault();
      terakhir.focus();
    } else if (!e.shiftKey && document.activeElement === terakhir) {
      e.preventDefault();
      pertama.focus();
    }
  };

  const alamatUnduh = (dokumen: string, format: FormatEvidenSkp) =>
    tanggalSah ? apiPath(alamatUnduhEvidenSkp({ peran, id, tahun, periode, dokumen, format, tanggal: tanggalSah })) : null;

  const tersedia = daftar?.dokumen.filter((d) => d.tersedia) ?? [];
  const pilihanTahun = Array.from({ length: 6 }, (_, i) => tahunIni - i);
  if (!pilihanTahun.includes(tahun)) pilihanTahun.push(tahun);
  const namaTampil = daftar?.namaOrang || nama || "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onTutup();
      }}
    >
      <div
        ref={kotak}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        aria-describedby={idKeterangan}
        onKeyDown={tekanTombol}
        className="my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
      >
        {/* ---- Kepala --------------------------------------------------- */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id={idJudul} className="text-base font-semibold leading-tight">
              Unduh eviden SKP
            </h2>
            <p id={idKeterangan} className="mt-0.5 text-xs text-muted-foreground">
              Bukti dukung SKP{namaTampil ? ` ${namaTampil}` : ""} dari data SIPP, dalam PDF, Excel, atau Word - berkop,
              dengan tempat tanda tangan hakim (kiri) dan Ketua (kanan).
            </p>
          </div>
          <Button ref={tombolTutup} type="button" size="sm" variant="ghost" onClick={onTutup} aria-label="Tutup pop up unduh eviden SKP">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
          {/* ---- Pilihan ------------------------------------------------ */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Periode</legend>
            <div className="flex flex-wrap gap-1.5">
              {PILIHAN_PERIODE_EVIDEN_SKP.map((p) => {
                // Periode yang belum dimulai ditolak rutenya - tidak dapat dipilih.
                const belumMulai = mulaiPeriodeEvidenSkp(p.kunci, tahun) > hariIni;
                return (
                  <label
                    key={p.kunci}
                    title={belumMulai ? "Periode ini belum dimulai" : undefined}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition focus-within:ring-2 focus-within:ring-ring",
                      belumMulai
                        ? "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground opacity-60"
                        : periode === p.kunci
                          ? "cursor-pointer border-primary bg-primary/10 font-semibold text-foreground"
                          : "cursor-pointer border-border bg-card text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <input
                      type="radio"
                      name="periode-eviden-skp"
                      value={p.kunci}
                      checked={periode === p.kunci}
                      disabled={belumMulai}
                      onChange={() => setPeriode(p.kunci)}
                      className="sr-only"
                    />
                    {p.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Tahun
              <NativeSelect
                aria-label="Tahun SKP"
                value={String(tahun)}
                onChange={(e) => {
                  const baru = Number(e.target.value);
                  setTahun(baru);
                  // Triwulan yang dipilih bisa belum dimulai di tahun baru - kembali ke triwulan terakhir
                  // yang selesai bila ada di tahun itu, selainnya ke triwulan berjalan.
                  if (mulaiPeriodeEvidenSkp(periode, baru) > hariIni) {
                    setPeriode(bawaan.tahun === baru ? bawaan.periode : triwulanDariTanggal(hariIni));
                  }
                }}
                className="h-10"
              >
                {pilihanTahun.map((t) => (
                  <option key={t} value={String(t)}>
                    {t}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Tanggal tanda tangan
              <Input
                type="date"
                aria-label="Tanggal tanda tangan"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-10"
                aria-invalid={!tanggalSah || undefined}
              />
              <span className={cn("font-normal", tanggalSah ? "text-muted-foreground" : "text-destructive")}>
                {tanggalSah ? `Tercetak "${tanggalPanjang(tanggalSah)}" di atas tanda tangan Ketua.` : "Tanggal belum sah - tombol unduh dinonaktifkan."}
              </span>
            </label>
          </div>

          {/* ---- Keadaan ------------------------------------------------ */}
          <div aria-live="polite" className="sr-only">
            {memuat ? "Memuat daftar dokumen." : daftar ? `${daftar.dokumen.length} dokumen.` : ""}
          </div>

          {galat ? (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{galat}</span>
              </p>
              <div>
                <Button type="button" size="sm" variant="outline" onClick={() => setUlang((n) => n + 1)}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Coba lagi
                </Button>
              </div>
            </div>
          ) : null}

          {memuat && !daftar ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              Menyusun daftar dokumen dari SIPP… hitungan pertama dapat memakan beberapa detik.
            </p>
          ) : null}

          {daftar ? (
            <div className={cn("flex flex-col gap-3", memuat && "opacity-60")} aria-busy={memuat || undefined}>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                {daftar.labelPeriode ? <p>Periode: {daftar.labelPeriode}</p> : null}
                <p className="flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {/* Tanpa titik penutup: nama bergelar sudah berakhir titik ("M.H."). */}
                  {daftar.namaKetua
                    ? `Mengetahui: ${daftar.namaKetua}`
                    : "Nama Ketua tidak terbaca dari SIPP - tempat tanda tangan Ketua dicetak titik-titik untuk diisi tangan."}
                </p>
              </div>

              {daftar.galat.length > 0 ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs" role="status">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Sebagian data tidak terbaca dari SIPP - dokumennya menyebutkannya di catatan:
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {daftar.galat.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Keterangan untuk petugas - konfigurasi SIPP yang perlu dibetulkan,
                  sumber data. Sengaja TIDAK ikut tercetak di dokumen. */}
              {daftar.catatanOperator.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                  <p className="font-medium text-foreground">Catatan untuk petugas - tidak tercetak di dokumen:</p>
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {daftar.catatanOperator.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {daftar.dokumen.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada dokumen eviden untuk periode ini.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border" aria-label="Dokumen eviden SKP">
                  {daftar.dokumen.map((d) => (
                    <li key={d.kunci} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between" data-kunci={d.kunci}>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", !d.tersedia && "text-muted-foreground")}>{d.judulLengkap}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.tersedia
                            ? d.jumlahBaris === null
                              ? "tersedia"
                              : `${angka(d.jumlahBaris)} baris`
                            : `Tidak tersedia${d.sebabTidakTersedia ? ` - ${d.sebabTidakTersedia}` : ""}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        {FORMAT_EVIDEN_SKP.map((f) => {
                          const alamat = d.tersedia ? alamatUnduh(d.kunci, f) : null;
                          return (
                            <TombolUnduh
                              key={f}
                              alamat={alamat}
                              format={f}
                              sibuk={Boolean(alamat && sibuk[alamat])}
                              label={d.judulLengkap}
                              onUnduh={(a) => void unduh(a)}
                            />
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* ---- Semua dalam ZIP ------------------------------------ */}
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Archive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Unduh semua (ZIP)
                  <span className="text-xs font-normal text-muted-foreground">
                    {tersedia.length > 0 ? `${angka(tersedia.length)} dokumen tersedia` : "tidak ada dokumen tersedia"}
                  </span>
                </p>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {FORMAT_EVIDEN_SKP.map((f) => {
                    const alamat = tersedia.length > 0 ? alamatUnduh(SEMUA_DOKUMEN_EVIDEN_SKP, f) : null;
                    return (
                      <TombolUnduh
                        key={f}
                        alamat={alamat}
                        format={f}
                        sibuk={Boolean(alamat && sibuk[alamat])}
                        label="semua dokumen (ZIP)"
                        onUnduh={(a) => void unduh(a)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {kabar ? (
            <p
              role={kabar.jenis === "galat" ? "alert" : "status"}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                kabar.jenis === "galat"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              )}
            >
              {kabar.teks}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-border px-4 py-2.5">
          <Button type="button" size="sm" variant="outline" onClick={onTutup}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
