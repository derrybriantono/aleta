"use client";

/**
 * ============================================================================
 * SEBARAN RELAAS PER JURUSITA
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026. Peta perkara sudah punya lapisan
 * "Jurusita yang melayani", dan ia menjawab pertanyaan yang BERLAWANAN ARAH -
 * "siapa yang paling sering ke desa ini". Yang dibutuhkan di sini "orang ini
 * mengerjakan apa saja", dan ia dibaca orang yang berbeda: ketua atau panitera
 * yang hendak membagi beban.
 *
 * ============================================================================
 * RETUR DITAMPILKAN BERDAMPINGAN DENGAN JUMLAHNYA - DAN ITU MENENTUKAN
 * ============================================================================
 *
 * Jumlah relaas sendirian tidak menerangkan apa pun tentang mutu pekerjaan.
 * Diukur pada 2026 di satker ini: tiga jurusita membagi 2.337 relaas hampir
 * rata - 793, 788, 756 - tetapi returnya 5,7%, 0,3%, dan 5,3%. Beban mereka
 * sama; hasilnya tidak, dan hanya kolom kedua yang memperlihatkannya.
 *
 * Retur dibaca dari status_pos = 2, yaitu surat yang KEMBALI. Panggilan yang
 * gagal karena jurusita tidak bertemu pihaknya tidak ikut - itu persoalan
 * yang berbeda, dan mencampurnya membuat keduanya tidak dapat ditindaklanjuti.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";

type Jurusita = {
  nama: string;
  relaas: number;
  retur: number;
  persenRetur: number;
  jumlahDesa: number;
  desa: Array<{ kode: string; relaas: number; retur: number }>;
};

type Hasil = {
  dari: string;
  sampai: string;
  total: number;
  tanpaNama: number;
  jurusita: Jurusita[];
};

/**
 * Ambang retur.
 *
 * Bukan angka bulat yang dipilih karena bulat: 5% kira-kira dua kali lipat
 * retur terbaik yang terukur di satker ini (0,3%) dan sedikit di bawah dua
 * yang lain (5,3% dan 5,7%). Ia karena itu memisahkan yang tampak wajar dari
 * yang patut ditanyakan - bukan menyatakan siapa yang bersalah.
 */
const AMBANG_RETUR_PERSEN = 5;

export function AletaSebaranJurusita({ periode = "tahun" }: { periode?: string }) {
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [kabar, setKabar] = useState("");
  const [dibuka, setDibuka] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    setKabar("");
    try {
      const r = await fetch(
        apiPath(`/api/aleta-ecourt/sebaran-jurusita?periode=${encodeURIComponent(periode)}`),
        { cache: "no-store" }
      );
      const j = (await r.json()) as { data?: Hasil };
      if (!r.ok) {
        setKabar(pesanGalatPortal(j, `HTTP ${r.status}`).replace(/_/g, " "));
        return;
      }
      setHasil(j.data ?? null);
    } catch (galat) {
      setKabar(galat instanceof Error ? galat.message : "Sebaran tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, [periode]);

  // Ditunda satu putaran, bukan dipanggil langsung: setState serentak di
  // dalam efek memicu penggambaran berantai, dan aturan lint repositori ini
  // menolaknya. Pola yang sama dipakai panel arsip berkas.
  useEffect(() => {
    const jam = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(jam);
  }, [muat]);

  const terbanyak = hasil?.jurusita?.[0]?.relaas ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sebaran relaas per juru sita</CardTitle>
        <CardDescription>
          Siapa mengerjakan berapa, di berapa desa, dan berapa yang kembali.
          {hasil ? ` ${hasil.dari} sampai ${hasil.sampai}.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {memuat ? (
          <p className="text-sm text-muted-foreground">Membaca…</p>
        ) : kabar ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{kabar}</p>
            <Button size="sm" variant="outline" onClick={() => void muat()}>
              Coba lagi
            </Button>
          </div>
        ) : !hasil || hasil.jurusita.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada relaas yang tercatat pada rentang ini.
          </p>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{hasil.total}</span> relaas oleh{" "}
              <span className="font-semibold tabular-nums">{hasil.jurusita.length}</span> juru sita.
              {/* Disebutkan apa adanya. Daftar yang menyembunyikan bagian tak
                  bernamanya akan dibaca sebagai lengkap. */}
              {hasil.tanpaNama > 0 ? (
                <span className="text-muted-foreground">
                  {" "}
                  {hasil.tanpaNama} relaas belum bernama juru sita dan tidak masuk hitungan di bawah.
                </span>
              ) : null}
            </p>

            <ul className="space-y-2">
              {hasil.jurusita.map((j) => {
                const lebar = terbanyak > 0 ? Math.round((j.relaas / terbanyak) * 100) : 0;
                const returTinggi = j.persenRetur >= AMBANG_RETUR_PERSEN;
                return (
                  <li key={j.nama} className="rounded border border-border p-2">
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center gap-2 text-left"
                      onClick={() => setDibuka(dibuka === j.nama ? "" : j.nama)}
                      aria-expanded={dibuka === j.nama}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{j.nama}</span>
                      <span className="tabular-nums">{j.relaas} relaas</span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {j.jumlahDesa} desa
                      </span>
                      <Badge variant={returTinggi ? "warning" : "outline"}>
                        retur {j.retur} ({j.persenRetur}%)
                      </Badge>
                    </button>
                    {/* Batang perbandingan, bukan angka saja: tiga angka yang
                        hampir sama sulit dibedakan sebagai angka, mudah
                        sebagai panjang. */}
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
                      <div
                        className={cn("h-full", returTinggi ? "bg-amber-500" : "bg-primary")}
                        style={{ width: `${lebar}%` }}
                      />
                    </div>

                    {dibuka === j.nama ? (
                      <div className="mt-2">
                        <p className="mb-1 text-xs font-semibold">
                          Desa terbanyak {j.desa.length < j.jumlahDesa ? `(25 dari ${j.jumlahDesa})` : ""}
                        </p>
                        <ul className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                          {j.desa.map((d) => (
                            <li key={d.kode} className="flex justify-between gap-2">
                              <span className="truncate">{d.kode}</span>
                              <span className="tabular-nums text-muted-foreground">
                                {d.relaas}
                                {d.retur > 0 ? ` · retur ${d.retur}` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <p className="text-xs text-muted-foreground">
              Retur dihitung dari surat yang KEMBALI (status pos), bukan dari panggilan yang gagal
              karena juru sita tidak bertemu pihaknya - keduanya menuntut tindakan yang berbeda.
              Nama juru sita dibaca dari akun penggunanya di SIPP; sampai 2.33.0 ia dicari di
              tabel yang keliru dan 61,6% baris bernama menyebut orang lain.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
