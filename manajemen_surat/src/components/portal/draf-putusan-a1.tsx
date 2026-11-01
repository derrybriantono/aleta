"use client";

import { useState } from "react";
import { ExternalLink, Scale } from "lucide-react";

import type { DrafPutusanA1, StatusPembuktianA1 } from "@/lib/draf-putusan-a1";

/**
 * ============================================================================
 * A1 (1 Nov 2026) - KARTU "DRAF PERTIMBANGAN DAN AMAR" DI POP-UP DRAF PUTUSAN
 * ============================================================================
 *
 * Tampil di tahap "Perlu diisi hakim" pop-up draf putusan (draf-h7.tsx) bila draf varian yang dipilih memuat draf A1 -
 * rute agen-h7 hanya mengirimkannya untuk hakim, ketua, wakil ketua, dan Super Admin. Terlipat bawaan; isinya baru
 * dirender saat dibuka (pop-up tetap ringan). Tanpa tombol yang menulis ke ABT/SIPP: usulan isian dibuka lewat tautan
 * Blangko yang sama dengan isian lain. Tanpa istilah teknis.
 */

const TEKS_BUKTI: Record<StatusPembuktianA1, string> = {
  terbukti: "terbukti",
  "belum-terbukti": "belum terbukti",
  bertentangan: "bertentangan",
  "tidak-perlu-dibuktikan": "tidak perlu dibuktikan",
  "": "belum dinilai",
  "belum-dinilai": "belum dinilai",
};

const WARNA_BUKTI: Record<string, string> = {
  terbukti: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "tidak-perlu-dibuktikan": "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "belum-terbukti": "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  bertentangan: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  "belum-dinilai": "bg-muted text-muted-foreground",
};

export function KartuDrafPutusanA1({ putusan, tautanIsian }: { putusan: DrafPutusanA1; tautanIsian?: (nama: string) => string | null }) {
  const [buka, setBuka] = useState(false);
  const dasarOk = new Set(putusan.dasar.filter((d) => d.terverifikasi).map((d) => d.teks)).size;
  const dasarBelum = new Set(putusan.dasar.filter((d) => !d.terverifikasi).map((d) => d.teks)).size;
  const belumDinilai = putusan.pembuktian.dalil - putusan.pembuktian.dinilai;
  return (
    <details
      className="group rounded-lg border border-sky-300 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20"
      data-kartu-draf-a1={putusan.arah}
      onToggle={(e) => setBuka((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-base font-medium">
        <Scale className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Draf pertimbangan dan amar</span>
        <span className="ml-auto text-sm font-normal text-muted-foreground">
          {putusan.amar.butir.length} butir amar{putusan.tanda.length ? ` · ${putusan.tanda.length} perlu diperiksa` : ""}
        </span>
      </summary>
      {buka ? (
        <div className="space-y-3 border-t border-sky-200 px-3 py-3 text-[15px] dark:border-sky-900" data-isi-draf-a1="">
          <p className="text-sm text-muted-foreground">
            Disusun otomatis dari dalil, keterangan saksi, bukti, dan petitum untuk dibaca majelis. Belum disimpan ke ABT maupun SIPP. Dasar hukum yang ditulis hanya yang sudah
            terverifikasi ({dasarOk}); {dasarBelum} rujukan lain diberi tanda merah untuk diperiksa.
            {belumDinilai > 0 ? ` ${belumDinilai} dalil belum dinilai pembuktiannya.` : ""}
          </p>

          {putusan.isian.length ? (
            <div className="space-y-2" data-usulan-a1="">
              {putusan.isian.map((i) => {
                const href = tautanIsian?.(i.nama) ?? null;
                return (
                  <div key={i.kode} className="rounded-md border border-border bg-card p-2">
                    <p className="font-medium">Usulan: {i.nama}</p>
                    <p className="whitespace-pre-line break-words">{i.nilai}</p>
                    <p className="text-sm text-muted-foreground">{i.alasan}</p>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-md border px-2 text-sm">
                        Isi di Blangko <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {putusan.bagian
            .filter((b) => b.kunci !== "dalil")
            .map((b) => (
              <section key={b.kunci} data-bagian-a1={b.kunci}>
                <h5 className="text-sm font-semibold text-muted-foreground">{b.judul}</h5>
                {b.paragraf.map((p, i) => (
                  <div key={i} className="mt-1">
                    <p className="leading-relaxed">{p.teks}</p>
                    {p.tanda.map((t, j) => (
                      <p key={j} className="text-sm text-red-700 dark:text-red-300" data-tanda-a1="">
                        {t}
                      </p>
                    ))}
                  </div>
                ))}
              </section>
            ))}

          {putusan.dalil.length ? (
            <section data-bagian-a1="dalil">
              <h5 className="text-sm font-semibold text-muted-foreground">Dalil dan pembuktiannya</h5>
              <ul className="mt-1 space-y-1">
                {putusan.dalil.map((d) => (
                  <li key={d.id} className="rounded-md border border-border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Dalil angka {d.nomor || "?"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${WARNA_BUKTI[d.pembuktian] ?? WARNA_BUKTI["belum-dinilai"]}`}>{TEKS_BUKTI[d.pembuktian]}</span>
                      {d.tanggapan ? <span className="text-sm text-muted-foreground">{d.tanggapan}</span> : null}
                      {d.saksi.length ? <span className="text-sm text-muted-foreground">disinggung {d.saksi.length} saksi</span> : null}
                    </div>
                    <p className="mt-1 whitespace-pre-line break-words text-sm">{d.teks}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section data-bagian-a1="amar">
            <h5 className="text-sm font-semibold text-muted-foreground">Amar</h5>
            {putusan.amar.butir.length ? (
              <ol className="ml-5 mt-1 list-decimal space-y-1">
                {putusan.amar.butir.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground">Amar belum dapat disusun dari petitum.</p>
            )}
          </section>
          {putusan.tanda.length ? <p className="text-sm text-muted-foreground">Tanda merah ikut tercetak bila disalin ke naskah, supaya tidak terlewat sebelum diunggah.</p> : null}
        </div>
      ) : null}
    </details>
  );
}
