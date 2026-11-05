"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KELAS_BEDA_NAMA, KELAS_DIJELASKAN, bacaLaporanBanding, type KelasBeda, type LaporanBanding } from "@/lib/aleta-abt-naskah";

/**
 * Laporan pembanding ALETA ABT lawan ABT (5 Nov 2026, Tahap 5). Membaca berkas hasil skrip pengukur (scripts/ukur-banding-abt/naskah.mts)
 * LANGSUNG DI PERAMBAN: berkas tidak dikirim ke server dan tidak disimpan. Laporan hanya memuat penanda perkara sampel, jenis, kelas beda,
 * nomor alinea, dan nama isian; tidak memuat nama pihak atau nilai isian.
 */

const detik = (ms: number) => (ms / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

function Persen({ nilai }: { nilai: number }) {
  const penuh = nilai >= 99.995;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${penuh ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"}`}>
      {nilai.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%
    </span>
  );
}

export function LaporanPembanding() {
  const [laporan, setLaporan] = useState<LaporanBanding | null>(null);
  const [galat, setGalat] = useState("");
  const [jenis, setJenis] = useState("");

  const baca = async (f: File | undefined) => {
    if (!f) return;
    setGalat("");
    try {
      if (f.size > 8 * 1024 * 1024) throw new Error("Berkas laporan terlalu besar.");
      const l = bacaLaporanBanding(JSON.parse(await f.text()));
      if (!l) throw new Error("Berkas ini bukan laporan pembanding.");
      setLaporan(l);
      setJenis("");
    } catch (e) {
      setLaporan(null);
      setGalat(e instanceof SyntaxError ? "Berkas ini bukan laporan pembanding." : (e as Error).message);
    }
  };

  const beda = laporan ? laporan.beda.filter((b) => !jenis || b.jenis === jenis) : [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Buka laporan hasil pengukuran</CardTitle>
          <CardDescription>Pilih berkas laporan pembanding. Berkas dibaca di peramban ini saja, tidak dikirim ke server.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-sm hover:bg-muted sm:w-auto">
            Pilih berkas laporan
            <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void baca(e.target.files?.[0])} />
          </label>
          {galat ? (
            <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
              {galat}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {laporan ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Teks per alinea, per jenis perkara</CardTitle>
              <CardDescription>{laporan.keterangan || "Naskah utuh ALETA ABT dibandingkan dengan cetakan ABT, alinea demi alinea."}</CardDescription>
            </CardHeader>
            <CardContent>
              {laporan.ringkas.map((r) => (
                <div key={r.jenis} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border py-2 last:border-b-0">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{r.jenis}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.naskah} naskah, {r.identik} dari {r.alinea} alinea identik; {r.naskahIdentik} naskah identik seluruhnya
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Beda dijelaskan: {r.dijelaskan}. Beda belum dijelaskan: {r.belumDijelaskan}. Identik ditambah dijelaskan:{" "}
                      {r.alinea ? (((r.identik + r.dijelaskan) / r.alinea) * 100).toLocaleString("id-ID", { maximumFractionDigits: 3 }) : "100"}%
                    </p>
                  </div>
                  <Persen nilai={r.persen} />
                </div>
              ))}
              <p className="mt-3 text-xs text-muted-foreground">
                Waktu menyusun {laporan.waktu.jumlah} naskah: rata-rata {detik(laporan.waktu.rata)} detik, tengah {detik(laporan.waktu.tengah)}, terlama {detik(laporan.waktu.terlama)}.
                {laporan.waktu.tempat ? ` Diukur di ${laporan.waktu.tempat}; ini bukan angka server.` : ""}
              </p>
            </CardContent>
          </Card>

          {laporan.belumTerukur.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Belum terukur</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {laporan.belumTerukur.map((t, i) => (
                    <li key={i} className="break-words">
                      {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Beda yang ditemukan</CardTitle>
              <CardDescription>
                {(Object.keys(laporan.perKelas) as KelasBeda[])
                  .filter((k) => laporan.perKelas[k] > 0)
                  .map((k) => `${KELAS_BEDA_NAMA[k]}: ${laporan.perKelas[k]}`)
                  .join("; ") || "Tidak ada beda."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {laporan.ringkas.length > 1 ? (
                <select value={jenis} onChange={(e) => setJenis(e.target.value)} aria-label="Jenis perkara" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm sm:w-auto">
                  <option value="">Semua jenis perkara</option>
                  {laporan.ringkas.map((r) => (
                    <option key={r.jenis} value={r.jenis}>
                      {r.jenis}
                    </option>
                  ))}
                </select>
              ) : null}
              {beda.slice(0, 100).map((b, i) => (
                <div key={i} className="rounded-xl border border-border p-2 text-sm">
                  <p className="break-words font-medium">{b.blangko}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.jenis}, perkara sampel {b.perkara}: {KELAS_BEDA_NAMA[b.kelas]} ({KELAS_DIJELASKAN[b.kelas] ? "sudah dijelaskan" : "belum dijelaskan"})
                    {b.nomorAbt ? `, alinea ABT ${b.nomorAbt}` : ""}
                    {b.nomorAleta ? `, alinea ALETA ${b.nomorAleta}` : ""}
                  </p>
                  {b.isian.length ? <p className="mt-1 break-words text-xs">Isian pada alinea itu: {b.isian.join(", ")}</p> : null}
                </div>
              ))}
              {beda.length > 100 ? <p className="text-xs text-muted-foreground">Menampilkan 100 beda pertama dari {beda.length}.</p> : null}
              {!beda.length ? <p className="text-sm text-muted-foreground">Tidak ada beda untuk pilihan ini.</p> : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
