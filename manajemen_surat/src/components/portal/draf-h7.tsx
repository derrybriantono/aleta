"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

import { apiPath } from "@/lib/base-path";
import {
  daftarVarianH7,
  teksLencanaH7,
  type StatusVarianH7,
  type DrafH7,
  type DrafH7Checklist,
  type RingkasDrafH7,
} from "@/lib/agen-h7-putusan";
import { TAHAP_H7, hariTanggal, susunTahapanH7, type KodeTahapH7, type StatusTahapH7 } from "@/lib/draf-h7-tahapan";
import { tautanBlangkoDerry, type DataTautanBlangko } from "@/lib/tautan-blangko-derry";
import { waktuSingkat } from "@/lib/konseptor-langkah";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * DRAF PUTUSAN DARI AGEN ALETA DI JADWAL SIDANG DAN CHECKLIST KONSEPTOR
 * ============================================================================
 *
 *   LencanaDrafH7     lencana warna di samping penanda kuning "Hari Putusan".
 *   PanelDrafH7       SATU tombol kecil di baris ("Draf putusan · 3 dari 11
 *                     siap"); kliknya membuka POP-UP besar berisi lima tahap
 *                     yang dapat diklik (ringkasan, isian otomatis, perlu
 *                     diisi hakim, bahan perkara, buka blangko). Tidak ada
 *                     lagi panel panjang di dalam baris (keluhan hakim 19 Okt).
 *   BagianDrafH7      ringkasan di dalam checklist konseptor.
 *
 * Tidak ada tombol yang menulis ke ABT/SIPP di sini - draf dibuka lewat
 * Blangko ABT by Derry Briantono (tautan #bd=, pembentuk yang sama dengan
 * tombol Blangko di Jadwal Sidang).
 */

const WARNA_TINGKAT: Record<RingkasDrafH7["tingkat"], string> = {
  siap: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  hampir: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  belum: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
};

const WARNA_YAKIN = {
  pasti: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  cukup: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  ragu: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
} as const;

export function LencanaDrafH7({ ringkas }: { ringkas?: RingkasDrafH7 | null }) {
  if (!ringkas) return null;
  return (
    <span
      data-draf-h7={ringkas.tingkat}
      className={cn("rounded px-1.5 py-0.5 text-xs font-medium", WARNA_TINGKAT[ringkas.tingkat])}
      title={
        ringkas.perlu.length
          ? `Disiapkan agen ALETA ${waktuSingkat(ringkas.dibuatPada)}. Perlu perhatian: ${ringkas.perlu.join(", ")}.`
          : `Disiapkan agen ALETA ${waktuSingkat(ringkas.dibuatPada)}.`
      }
    >
      {teksLencanaH7(ringkas)}
    </span>
  );
}

type DrafLengkap = DrafH7 & { laporan?: string[] };

/** Bahan membentuk tautan "Isi di Blangko": dari baris Jadwal Sidang. */
export type BahanTautanDrafH7 = {
  sidangKe?: number | null;
  jumlahSaksiP?: number | null;
  jumlahSaksiT?: number | null;
  setelanAps?: string | null;
  /** Hak peran: jenis "putusan" ada di jenisBlangkoBoleh(pengguna). Tanpa hak, tombol blangko disembunyikan. */
  boleh?: boolean;
};

function IkonTahap({ status, nomor }: { status: StatusTahapH7; nomor: number }) {
  return (
    <span
      data-status-tahap={status}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
        status === "lengkap" && "border-emerald-600 bg-emerald-600 text-white",
        status === "perlu" && "border-orange-500 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
        status === "netral" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {status === "lengkap" ? <Check className="h-4 w-4" aria-hidden="true" /> : nomor}
    </span>
  );
}

const KELAS_TOMBOL_UTAMA =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground transition hover:opacity-90";
const KELAS_TOMBOL_KECIL =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-md border border-sky-400 px-3 py-1 text-sm font-medium text-sky-900 transition hover:bg-sky-50 dark:text-sky-200 dark:hover:bg-sky-500/15";

function Lipat({ judul, jumlah, children, terbuka }: { judul: string; jumlah?: number; children: React.ReactNode; terbuka?: boolean }) {
  return (
    <details open={terbuka} className="group rounded-lg border border-border bg-card" data-kartu-bahan="">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-base font-medium">
        <span className="min-w-0 break-words">
          {judul}
          {typeof jumlah === "number" ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-sm font-normal text-muted-foreground">{jumlah}</span> : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-2 border-t border-border px-3 py-2 text-[15px] leading-relaxed">{children}</div>
    </details>
  );
}

export function PanelDrafH7({
  perkaraId,
  ringkas,
  tautan,
  bukaAwal,
}: {
  perkaraId: string;
  ringkas?: RingkasDrafH7 | null;
  tautan?: BahanTautanDrafH7;
  /** Uji/tangkapan: pop-up langsung terbuka. */
  bukaAwal?: boolean;
}) {
  const [terbuka, setTerbuka] = useState(Boolean(bukaAwal));
  const [draf, setDraf] = useState<DrafLengkap | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [tahap, setTahap] = useState<KodeTahapH7>("ringkasan");
  const [pilihVarian, setPilihVarian] = useState<StatusVarianH7>("dikabulkan");

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const balasan = await fetch(apiPath(`/api/aleta-ecourt/agen-h7?perkaraId=${encodeURIComponent(perkaraId)}`), { cache: "no-store" });
      const isi = (await balasan.json()) as { data?: { peta?: Record<string, DrafLengkap> } };
      setDraf(isi?.data?.peta?.[perkaraId] ?? null);
      if (balasan.status === 403) setGalat("Isi draf putusan hanya dapat dibuka pemegang perkara (majelis, panitera, panitera pengganti).");
      else if (!balasan.ok) setGalat("Draf putusan tidak terbaca.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Draf putusan tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, [perkaraId]);

  const buka = useCallback(() => {
    setTahap("ringkasan");
    setTerbuka(true);
    void muat();
  }, [muat]);

  // Tombol widget ALETA membuka halaman dengan ?drafH7=<perkaraId>: pop-up langsung terbuka (juga bukaAwal untuk
  // uji/tangkapan). Dibuka lewat microtask supaya tidak mengatur state di badan efek.
  useEffect(() => {
    let sasaran = Boolean(bukaAwal);
    try {
      if (new URLSearchParams(window.location.search).get("drafH7") === perkaraId) sasaran = true;
    } catch {
      /* tanpa alamat: tombol biasa */
    }
    if (!sasaran) return;
    let batal = false;
    void Promise.resolve().then(() => {
      if (!batal) buka();
    });
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perkaraId]);

  useEffect(() => {
    if (!terbuka) return;
    const tutupEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTerbuka(false);
    };
    document.addEventListener("keydown", tutupEsc);
    const lama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tutupEsc);
      document.body.style.overflow = lama;
    };
  }, [terbuka]);

  const semuaVarian = useMemo(() => (draf ? daftarVarianH7(draf) : []), [draf]);
  const varianAktif = semuaVarian.find((v) => v.status === pilihVarian)?.status ?? "dikabulkan";
  const t = useMemo(() => (draf ? susunTahapanH7(draf, varianAktif) : null), [draf, varianAktif]);

  if (!ringkas) return null;

  const tautanIsian = (isian?: string): string | null => {
    if (!draf || !tautan?.boleh) return null;
    const data: DataTautanBlangko = {
      nomor: draf.nomorPerkara,
      perkaraId: draf.perkaraId,
      sidangKe: tautan.sidangKe ?? null,
      tanggalSidang: draf.tanggalSidang,
      agenda: draf.agenda,
      tunda: "",
      keterangan: "",
      amar: varianAktif === "ditolak" ? "Ditolak" : "",
      verstek: draf.blangko.perkiraanVerstek ? true : null,
      jumlahSaksiP: tautan.jumlahSaksiP ?? 0,
      jumlahSaksiT: tautan.jumlahSaksiT ?? 0,
      draf: "h7",
      varian: varianAktif,
      isian: isian ?? null,
    };
    return tautanBlangkoDerry(data, "putusan", tautan.setelanAps);
  };

  const indeks = TAHAP_H7.findIndex((x) => x.kode === tahap);
  const pindah = (arah: number) => setTahap(TAHAP_H7[Math.max(0, Math.min(TAHAP_H7.length - 1, indeks + arah))].kode);

  const linkUtama = tautanIsian();

  const isiTahap = () => {
    if (!draf || !t) return null;
    switch (tahap) {
      case "ringkasan":
        return (
          <div className="space-y-4" data-isi-tahap="ringkasan">
            <p className="text-lg leading-relaxed" data-kalimat-ringkasan="">
              {t.kalimat}
            </p>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">Blangko yang disiapkan</p>
              <p className="text-base font-medium" data-nama-blangko="">
                {t.adaBlangko ? t.blangko : "Belum ada blangko putusan untuk perkara ini."}
              </p>
              {t.alasanBlangko ? <p className="mt-1 text-sm text-muted-foreground">{t.alasanBlangko}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-semibold tabular-nums" data-angka-siap="">
                {t.siap} dari {t.jumlah}
              </span>
              <span className="text-base text-muted-foreground">isian sudah siap</span>
            </div>
            {t.jumlah > 0 ? (
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full bg-emerald-600" style={{ width: `${Math.round((t.siap / t.jumlah) * 100)}%` }} />
              </div>
            ) : null}
            {draf.kendala.length ? <p className="text-sm text-orange-700 dark:text-orange-300">Belum terbaca: {draf.kendala.join("; ")}.</p> : null}
          </div>
        );
      case "otomatis":
        return (
          <div className="space-y-2" data-isi-tahap="otomatis">
            <p className="text-sm text-muted-foreground">Isian yang sudah diisi atau diusulkan agen. Yang bertanda &quot;periksa&quot; perlu dibaca dulu.</p>
            {t.otomatis.length ? (
              <ul className="space-y-2">
                {t.otomatis.map((o) => (
                  <li key={o.kode} data-isian-otomatis="" className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-medium">{o.nama}</span>
                      <span data-yakin={o.keyakinan} className={cn("rounded-full px-2 py-0.5 text-sm font-medium", WARNA_YAKIN[o.keyakinan])}>
                        {o.teksYakin}
                      </span>
                    </div>
                    {o.nilai ? <p className="mt-1 whitespace-pre-line break-words text-[15px]">{o.nilai.length > 200 ? `${o.nilai.slice(0, 199)}…` : o.nilai}</p> : null}
                    <p className="mt-1 text-sm text-muted-foreground" data-asal={o.asal}>
                      {o.teksAsal}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-muted-foreground">Belum ada isian yang bisa diisi otomatis.</p>
            )}
          </div>
        );
      case "perlu":
        return (
          <div className="space-y-2" data-isi-tahap="perlu">
            {t.perlu.length ? (
              <ul className="space-y-2">
                {t.perlu.slice(0, 10).map((p) => {
                  const href = tautanIsian(p.nama);
                  return (
                    <li key={p.kode} data-perlu-isi="" className="flex flex-col gap-2 rounded-lg border border-orange-300 bg-orange-50/60 p-3 dark:border-orange-800 dark:bg-orange-950/30 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-medium">{p.nama}</p>
                        <p className="text-sm text-muted-foreground">{p.alasan}</p>
                        {p.usulan ? <p className="mt-1 break-words text-sm">Usulan agen: {p.usulan}</p> : null}
                      </div>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" data-isi-di-blangko="" className={KELAS_TOMBOL_KECIL}>
                          Isi di Blangko
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-base text-emerald-700 dark:text-emerald-300">Tidak ada isian yang harus diisi hakim.</p>
            )}
            {t.perlu.length > 10 ? (
              <details>
                <summary className="min-h-9 cursor-pointer text-base text-muted-foreground">Lihat {t.perlu.length - 10} isian lainnya</summary>
                <ul className="mt-2 space-y-1 text-[15px]">
                  {t.perlu.slice(10).map((p) => (
                    <li key={p.kode}>
                      {p.nama} <span className="text-muted-foreground">- {p.alasan}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {t.dataSippKosong.length ? (
              <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                Data di SIPP yang dipakai naskah masih kosong: {t.dataSippKosong.join(", ")}. Lengkapi di SIPP.
              </p>
            ) : null}
            {!tautan?.boleh && t.perlu.length ? <p className="text-sm text-muted-foreground">Akun ini hanya dapat melihat; blangko dibuka oleh hakim atau petugas yang berhak.</p> : null}
          </div>
        );
      case "bahan":
        return (
          <div className="space-y-2" data-isi-tahap="bahan">
            {t.bahan.map((b) => (
              <Lipat key={b.kode} judul={b.judul} jumlah={b.jumlah}>
                {!b.ada ? <p className="text-muted-foreground">Belum ada bahan.</p> : null}
                {b.kode === "duduk" && b.ada ? (
                  <div className="space-y-1">
                    {b.butir.map((x, i) => (
                      <details key={i} className="rounded-md border border-border">
                        <summary className="min-h-9 cursor-pointer px-2 py-1.5 text-[15px]">
                          {i + 1}. {x.length > 70 ? `${x.slice(0, 69)}…` : x}
                        </summary>
                        <p className="border-t border-border px-2 py-1.5 text-[15px] leading-relaxed">{x}</p>
                      </details>
                    ))}
                  </div>
                ) : (
                  <ul className="ml-4 list-disc space-y-1">
                    {b.butir.map((x, i) => (
                      <li key={i} className="break-words">
                        {x}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-muted-foreground">Asal bahan: {b.sumber}.</p>
              </Lipat>
            ))}
          </div>
        );
      default:
        return (
          <div className="space-y-4" data-isi-tahap="selesai">
            {linkUtama && t.adaBlangko ? (
              <a href={linkUtama} target="_blank" rel="noopener noreferrer" data-buka-draf="" className={cn(KELAS_TOMBOL_UTAMA, "w-full sm:w-auto")}>
                Buka draf di Blangko ABT
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : !t.adaBlangko ? (
              <p className="text-base text-muted-foreground">Belum ada blangko putusan Derry untuk perkara ini, jadi draf belum bisa dibuka.</p>
            ) : (
              <p className="text-base text-muted-foreground">Blangko dibuka oleh hakim atau petugas yang berhak. Akun ini hanya dapat melihat draf.</p>
            )}
            <p className="text-[15px] leading-relaxed text-muted-foreground" data-ket-belum-simpan="">
              Draf belum disimpan ke ABT maupun SIPP sampai petugas menyimpannya sendiri di Blangko ABT.
            </p>
            <p className="text-sm text-muted-foreground">Jalur lain: Alat saya &gt; Checklist konseptor putusan &gt; Buka blangko draf.</p>
          </div>
        );
    }
  };

  return (
    <div className="mb-1" data-panel-draf-h7={perkaraId}>
      <button
        type="button"
        onClick={buka}
        aria-haspopup="dialog"
        title="Draf putusan yang disiapkan agen ALETA sebelum Hari Putusan. Belum disimpan ke ABT maupun SIPP."
        data-tombol-draf-h7={ringkas.tingkat}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-0.5 text-left text-xs font-medium leading-snug transition hover:opacity-80",
          WARNA_TINGKAT[ringkas.tingkat],
          "border-transparent"
        )}
      >
        <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{teksLencanaH7(ringkas)}</span>
        <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
      </button>

      {terbuka && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setTerbuka(false)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Draf putusan"
                data-dialog-draf-h7={perkaraId}
                onClick={(e) => e.stopPropagation()}
                className="flex h-full w-full flex-col bg-card text-[15px] text-card-foreground shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-xl sm:border"
              >
                <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Bot className="h-5 w-5 shrink-0" aria-hidden="true" /> Draf putusan
                    </h3>
                    <p className="break-words text-sm text-muted-foreground">
                      {draf ? draf.nomorPerkara : ringkas.tanggalSidang ? hariTanggal(ringkas.tanggalSidang) : ""}
                      {draf ? ` · disiapkan agen ALETA ${waktuSingkat(draf.dibuatPada)}` : ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => setTerbuka(false)} aria-label="Tutup" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-muted">
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                {memuat && !draf ? <div className="min-h-[3rem] p-4" aria-busy="true" /> : null}
                {galat ? <p className="m-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-base text-red-700 dark:bg-red-950/40 dark:text-red-300">{galat}</p> : null}
                {!draf && !memuat && !galat ? <p className="m-4 text-base text-muted-foreground">Draf belum ada.</p> : null}

                {draf && t ? (
                  <>
                    {semuaVarian.length > 1 ? (
                      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2" role="group" aria-label="Varian draf putusan">
                        <span className="text-sm text-muted-foreground">Bila majelis:</span>
                        {semuaVarian.map((v) => (
                          <button
                            key={v.status}
                            type="button"
                            data-varian-h7={v.status}
                            aria-pressed={varianAktif === v.status}
                            onClick={() => setPilihVarian(v.status)}
                            title={v.blangko.alasan}
                            className={cn(
                              "min-h-9 rounded-md border px-3 py-1 text-sm",
                              varianAktif === v.status ? "border-sky-500 bg-sky-50 font-medium text-sky-900 dark:bg-sky-500/15 dark:text-sky-200" : "border-border"
                            )}
                          >
                            {v.status === "dikabulkan" ? "Mengabulkan" : "Menolak"} ({v.kesiapan.persen}%)
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <nav className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2" role="tablist" aria-label="Tahapan draf putusan">
                      {t.tahap.map((x, i) => (
                        <button
                          key={x.kode}
                          type="button"
                          role="tab"
                          aria-selected={tahap === x.kode}
                          data-tahap={x.kode}
                          onClick={() => setTahap(x.kode)}
                          className={cn(
                            "flex min-h-14 min-w-[4.25rem] flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-center transition",
                            tahap === x.kode ? "bg-muted ring-2 ring-sky-500" : "hover:bg-muted/60"
                          )}
                        >
                          <IkonTahap status={x.status} nomor={i + 1} />
                          <span className="text-sm font-medium leading-tight">{x.pendek}</span>
                          <span className="text-xs leading-tight text-muted-foreground">{x.ket}</span>
                        </button>
                      ))}
                    </nav>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" role="tabpanel">
                      <h4 className="mb-3 text-base font-semibold text-muted-foreground">
                        Tahap {indeks + 1} dari {TAHAP_H7.length}: {TAHAP_H7[indeks].judul}
                      </h4>
                      {isiTahap()}
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                      <button
                        type="button"
                        onClick={() => pindah(-1)}
                        disabled={indeks === 0}
                        data-tahap-sebelumnya=""
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-4 py-2 text-base disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Sebelumnya
                      </button>
                      {indeks < TAHAP_H7.length - 1 ? (
                        <button type="button" onClick={() => pindah(1)} data-tahap-berikutnya="" className={KELAS_TOMBOL_UTAMA}>
                          Berikutnya <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : (
                        <button type="button" onClick={() => setTerbuka(false)} className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-base">
                          Tutup
                        </button>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

/** Di dalam checklist konseptor (F1.6): kesiapan draf putusan dan isian yang perlu diisi hakim. */
export function BagianDrafH7({ h7 }: { h7?: DrafH7Checklist | null }) {
  if (!h7) return null;
  return (
    <div className="mt-1.5 border-t border-border pt-1.5" data-bagian-draf-h7>
      <p className="font-medium">
        <LencanaDrafH7 ringkas={h7.ringkas} />{" "}
        <span className="font-normal text-muted-foreground">disiapkan agen ALETA {waktuSingkat(h7.ringkas.dibuatPada)}</span>
      </p>
      <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
        {h7.laporan.slice(1, 5).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
