"use client";

import { Copy, FileText, Info, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import type { StatistikBlangko } from "@/lib/statistik-blangko";

/**
 * Pusat Kendali > Statistik pemakaian blangko (30 Okt 2026, G6 butir 6.4).
 * Hanya informasi: tidak ada tombol hapus/pindah. Data: cetakan dari panel
 * Blangko ABT by Derry (dicatat ALETA, bukan ABT) + daftar blangko di server.
 */

type Hasil = StatistikBlangko & { galatKatalog?: string };

const tgl = (iso: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

function Keterangan({ teks }: { teks: string }) {
  return (
    <span className="inline-flex cursor-help align-middle text-muted-foreground" title={teks} aria-label={teks}>
      <Info className="h-4 w-4" />
    </span>
  );
}

export function StatistikBlangkoPanel() {
  const [data, setData] = useState<Hasil | null>(null);
  const [galat, setGalat] = useState("");
  const [muat, setMuat] = useState(false);
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<Record<string, boolean>>({});

  const ambil = useCallback(async (segarkan = false) => {
    setMuat(true);
    setGalat("");
    try {
      const r = await fetch(apiPath(`/api/aleta-ecourt/statistik-blangko${segarkan ? "?segarkan=1" : ""}`), { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: Hasil; error?: { message?: string } } | null;
      if (!r.ok || !j?.ok || !j.data) throw new Error(j?.error?.message || "Statistik tidak dapat dibaca.");
      setData(j.data);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setMuat(false);
    }
  }, []);

  useEffect(() => {
    void ambil(false);
  }, [ambil]);

  const q = cari.trim().toLowerCase();
  const kelompok = useMemo(
    () => (data?.perKelompok ?? []).filter((k) => !q || k.kelompok.toLowerCase().includes(q) || k.terbanyak.some((b) => b.berkas.toLowerCase().includes(q)) || k.tidakPernah.some((n) => n.toLowerCase().includes(q))),
    [data, q]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-sky-600" /> Ringkasan
              <Keterangan teks="Dihitung dari blangko yang dicetak lewat panel Blangko ABT by Derry. Cetakan langsung dari ABT tanpa panel tidak tercatat, karena ABT tidak mencatat blangko yang dicetak." />
            </CardTitle>
            <CardDescription>
              {data
                ? data.jumlahCetak
                  ? `${data.jumlahCetak.toLocaleString("id-ID")} cetakan tercatat, ${tgl(data.sejak)} sampai ${tgl(data.sampai)}.`
                  : "Belum ada cetakan tercatat. Angka mulai terkumpul sejak pembaruan ini terpasang."
                : "Memuat..."}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void ambil(true)} disabled={muat}>
            {muat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Muat ulang
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {galat && <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-red-700 dark:text-red-300">{galat}</p>}
          {data?.galatKatalog && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
              Daftar blangko di server tidak terbaca ({data.galatKatalog}). Blangko yang tidak pernah dicetak dan pasangan yang mirip belum dapat ditampilkan.
            </p>
          )}
          {data && data.tanpaFolder > 0 && (
            <p className="text-muted-foreground">
              {data.tanpaFolder} cetakan lama tidak menyimpan foldernya dan namanya ada di lebih dari satu folder; dihitung di baris tanpa folder.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Per folder blangko
            <Keterangan teks="Folder Blangko ABT by Derry (satu folder = satu jenis perkara atau satu kelompok BAS). Yang tidak pernah dicetak hanya informasi; tidak ada blangko yang dipindah atau dihapus." />
          </CardTitle>
          <div className="pt-2">
            <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari folder atau nama blangko" className="max-w-md" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {kelompok.map((k) => {
            const id = k.kelompok || "(tanpa folder - cetakan lama)";
            const terbuka = Boolean(buka[id]);
            return (
              <div key={id} className="rounded-lg border p-3">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setBuka((b) => ({ ...b, [id]: !terbuka }))}>
                  <span className="font-medium">{id}</span>
                  <span className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="muted">{k.jumlahCetak} cetak</Badge>
                    <Badge variant="outline">
                      {k.dipakai}/{k.jumlahBlangko} blangko pernah dicetak
                    </Badge>
                  </span>
                </button>
                {terbuka && (
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Paling sering</p>
                      {k.terbanyak.length ? (
                        <ol className="space-y-1 text-sm">
                          {k.terbanyak.map((b) => (
                            <li key={b.berkas} className="flex justify-between gap-2">
                              <span className="break-words">{b.berkas}</span>
                              <span className="shrink-0 text-muted-foreground">
                                {b.jumlah}x · {tgl(b.terakhir)}
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-muted-foreground">Belum ada cetakan.</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Tidak pernah dicetak ({k.tidakPernah.length})</p>
                      <ul className="max-h-64 space-y-1 overflow-auto text-sm text-muted-foreground">
                        {k.tidakPernah.map((n) => (
                          <li key={n} className="break-words">
                            {n}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {data && !kelompok.length && <p className="text-sm text-muted-foreground">Tidak ada yang cocok.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Per jenis perkara</CardTitle>
          <CardDescription>Blangko yang paling sering dicetak untuk tiap jenis perkara SIPP.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {(data?.perJenis ?? []).map((j) => (
            <div key={j.jenisPerkara} className="rounded-lg border p-3">
              <p className="mb-2 flex justify-between gap-2 font-medium">
                <span>{j.jenisPerkara}</span>
                <span className="text-sm text-muted-foreground">{j.jumlahCetak} cetak</span>
              </p>
              <ol className="space-y-1 text-sm">
                {j.terbanyak.map((b) => (
                  <li key={`${b.kelompok}/${b.berkas}`} className="flex justify-between gap-2">
                    <span className="break-words">
                      {b.berkas}
                      {b.kelompok && <span className="text-muted-foreground"> · {b.kelompok}</span>}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{b.jumlah}x</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {data && !data.perJenis.length && <p className="text-sm text-muted-foreground">Belum ada cetakan tercatat.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Copy className="h-5 w-5 text-violet-600" /> Varian yang hampir sama
            <Keterangan teks="Pasangan blangko dalam satu folder yang naskahnya hampir sama (kemiripan rangkaian kata 90% ke atas). Kandidat untuk ditinjau: mungkin varian yang memang sengaja berbeda sedikit, mungkin salinan yang dapat diarsipkan. Tidak ada tindakan otomatis." />
          </CardTitle>
          <CardDescription>{data?.dipindai ? `Daftar blangko dibaca ${tgl(data.dipindai)}.` : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.ganda.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="p-2">Folder</th>
                    <th className="p-2">Blangko A</th>
                    <th className="p-2">Blangko B</th>
                    <th className="p-2 text-right">Mirip</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ganda.map((g) => (
                    <tr key={`${g.a}|${g.b}`} className="border-t align-top">
                      <td className="max-w-[12rem] p-2 break-words">{g.folder}</td>
                      <td className="max-w-[18rem] p-2 break-words">
                        {g.a.split("/").pop()?.replace(/\.rtf$/i, "")} <span className="text-muted-foreground">({g.cetakA}x)</span>
                      </td>
                      <td className="max-w-[18rem] p-2 break-words">
                        {g.b.split("/").pop()?.replace(/\.rtf$/i, "")} <span className="text-muted-foreground">({g.cetakB}x)</span>
                      </td>
                      <td className="p-2 text-right">{Math.round(g.mirip * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{data?.katalogTersedia ? "Tidak ada pasangan yang hampir sama." : "-"}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
