"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CircleAlert, Loader2, Receipt } from "lucide-react";

import { ambil } from "@/lib/aleta-ai/klien";
import { formatRupiah, type MutasiSaldo, type StatusPromoAi } from "@/lib/aleta-ai/kontrak";
import { apiPath } from "@/lib/base-path";

import { PitaPromoAi } from "./promo-ai";

/** Rincian biaya satu giliran (GET /api/aleta-ai/dompet). Tanpa isi pesan. */
type GiliranDompet = {
  pesanId: string;
  waktu: string;
  mode: string;
  status: string;
  token?: { masuk: number; keluar: number; cacheTulis: number; cacheBaca: number };
  kurs?: number;
  kursTanggal?: string;
  perkiraanRp?: number;
  biayaRp: number;
  gratis?: boolean;
  /** Gratis karena program promosi. */
  promo?: boolean;
};

type DataSaldo = {
  saldoRp: number;
  mutasi: MutasiSaldo[];
  giliran: GiliranDompet[];
  saldoMenipis?: boolean;
  pemberitahuan?: string;
  gratis?: boolean;
  promo?: StatusPromoAi | null;
  caraIsi?: string;
  hariIni?: { terpakaiRp: number; batasRp: number; token: number; batasToken: number };
  kuota?: { diberikanRp: number; sisaRp: number; hangus: string; teks: string } | null;
};

/** Mutasi di luar giliran yang punya struk sendiri (struk giliran ada di tabel rincian). */
const JENIS_BERSTRUK = new Set(["isi", "kuota", "kuota-hangus", "koreksi"]);

const LABEL_STATUS: Record<string, string> = { selesai: "Selesai", terpotong: "Terpotong", ditolak: "Ditolak", gagal: "Gagal (tidak dipotong)" };

function jumlahToken(g: GiliranDompet) {
  const t = g.token;
  return t ? t.masuk + t.keluar + t.cacheTulis + t.cacheBaca : 0;
}

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
      const r = await ambil<DataSaldo>("/api/aleta-ai/dompet");
      if (batal) return;
      if (r.ok) setData({ ...r.data, saldoRp: r.data.saldoRp ?? 0, mutasi: r.data.mutasi ?? [], giliran: Array.isArray(r.data.giliran) ? r.data.giliran : [] });
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
          <PitaPromoAi awal={data.promo} />
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saldo Anda</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums text-foreground" data-testid="saldo-besar">
              {formatRupiah(data.saldoRp)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.gratis ? "Akun Anda tidak dikenai biaya (dalam batas wajar)." : "Saldo dipakai per jawaban. "}
              {data.caraIsi ?? "Untuk mengisi saldo, hubungi admin."}
            </p>
            {data.kuota ? (
              <p className="mt-1 text-sm text-muted-foreground" data-testid="kuota-bulan-ini">
                {data.kuota.teks} Kuota dipakai lebih dulu; saldo yang diisi tidak ikut hangus.
              </p>
            ) : null}
            {data.hariIni ? (
              <p className="mt-1 text-sm text-muted-foreground" data-testid="pemakaian-hari-ini">
                Hari ini: {formatRupiah(data.hariIni.terpakaiRp)} dari batas {formatRupiah(data.hariIni.batasRp)}; {data.hariIni.token.toLocaleString("id-ID")} dari{" "}
                {data.hariIni.batasToken.toLocaleString("id-ID")} token.
              </p>
            ) : null}
          </div>

          {data.saldoMenipis ? (
            <p role="status" data-testid="saldo-menipis" className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {data.pemberitahuan ?? "Saldo ALETA Ai Anda menipis. Hubungi Super Admin untuk mengisi saldo."}
            </p>
          ) : null}

          <section aria-label="Rincian biaya per giliran">
            <h2 className="mb-2 text-lg font-semibold">Rincian biaya per giliran</h2>
            {data.giliran.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">Belum ada giliran.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm" data-testid="tabel-giliran">
                  <thead className="bg-muted/60">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Waktu</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Mode</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Token</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Kurs</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Perkiraan</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Biaya</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Struk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.giliran.map((g) => (
                      <tr key={g.pesanId} className="border-t border-border/50">
                        <td className="whitespace-nowrap px-3 py-2">{waktuTampil(g.waktu)}</td>
                        <td className="px-3 py-2">
                          {g.mode || "-"}
                          {g.status !== "selesai" ? <span className="block text-xs text-muted-foreground">{LABEL_STATUS[g.status] ?? g.status}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{jumlahToken(g).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 text-right tabular-nums" title={g.kursTanggal ? `Kurs ${g.kursTanggal}` : undefined}>
                          {g.kurs ? formatRupiah(g.kurs) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{g.perkiraanRp != null ? formatRupiah(g.perkiraanRp) : "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{g.promo ? "Gratis (promosi)" : g.gratis ? "Gratis" : formatRupiah(g.biayaRp)}</td>
                        <td className="px-3 py-2">
                          <a
                            href={apiPath(`/api/aleta-ai/struk/${encodeURIComponent(g.pesanId)}`)}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Receipt className="size-3.5" aria-hidden="true" /> Struk
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
                      <th scope="col" className="px-3 py-2 font-semibold">Struk</th>
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
                        <td className="px-3 py-2">
                          {m.id && m.jenis && JENIS_BERSTRUK.has(m.jenis) ? (
                            <a href={apiPath(`/api/aleta-ai/struk/${encodeURIComponent(m.id)}`)} target="_blank" rel="noopener" className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              Struk
                            </a>
                          ) : null}
                        </td>
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
