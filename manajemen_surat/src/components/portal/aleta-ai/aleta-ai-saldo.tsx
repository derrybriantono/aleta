"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CircleAlert, Loader2 } from "lucide-react";

import { ambil } from "@/lib/aleta-ai/klien";
import { formatRupiah, type MutasiSaldo } from "@/lib/aleta-ai/kontrak";

type DataSaldo = { saldoRp: number; mutasi: MutasiSaldo[] };

function waktuTampil(iso: string) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AletaAiSaldo() {
  const [data, setData] = useState<DataSaldo | null>(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    let batal = false;
    void (async () => {
      const r = await ambil<DataSaldo>("/api/aleta-ai/saldo");
      if (batal) return;
      if (r.ok) setData({ saldoRp: r.data.saldoRp ?? 0, mutasi: r.data.mutasi ?? [] });
      else setGalat(r.galat);
    })();
    return () => {
      batal = true;
    };
  }, []);

  return (
    <div className="space-y-5" data-testid="aleta-ai-saldo">
      <Link href="/aleta-ai" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke ALETA Ai
      </Link>

      {galat ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {galat}
        </p>
      ) : null}
      {!data && !galat ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat saldo...
        </p>
      ) : null}

      {data ? (
        <>
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saldo Anda</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums text-foreground" data-testid="saldo-besar">
              {formatRupiah(data.saldoRp)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Saldo dipakai per jawaban. Untuk mengisi saldo, hubungi admin.</p>
          </div>

          <section aria-label="Mutasi saldo">
            <h2 className="mb-2 text-lg font-semibold">Mutasi</h2>
            {data.mutasi.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">Belum ada mutasi.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
                <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Waktu</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Keterangan</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Jumlah</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mutasi.map((m, i) => (
                      <tr key={m.id ?? `${m.waktu}-${i}`} className="border-t border-border/50">
                        <td className="whitespace-nowrap px-3 py-2">{waktuTampil(m.waktu)}</td>
                        <td className="px-3 py-2">{m.keterangan || m.jenis || "-"}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${m.jumlahRp < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                          {m.jumlahRp < 0 ? "-" : "+"}
                          {formatRupiah(Math.abs(m.jumlahRp))}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.saldoSesudahRp != null ? formatRupiah(m.saldoSesudahRp) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
