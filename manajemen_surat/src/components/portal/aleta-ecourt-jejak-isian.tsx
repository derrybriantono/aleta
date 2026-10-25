"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import type { KelompokButir, KelompokIsian } from "@/lib/jejak-isian";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Jejak isian dan butir saksi - kartu Admin (rantai C, C1, 25 Okt 2026).
 *
 * Menampilkan angka lapangan dari aleta_saksi_butir dan aleta_isian_jejak:
 * "% butir diterima tanpa diubah" per katalog, varian, jenis perkara, dan
 * seberapa sering usulan isian diterima atau diubah petugas. Hanya membaca;
 * saklarnya (Fitur satker "jejak-isian", bawaan mati) dinyalakan Super Admin
 * di halaman Fitur satker. Hanya Super Admin dan Admin.
 */

type Laporan = {
  jumlah: number;
  persenDiterima: number | null;
  perKatalog: KelompokButir[];
  perVarian: KelompokButir[];
  perJenisPerkara: KelompokButir[];
  perJalur: KelompokButir[];
};
type Ringkasan = { jumlah: number; perKode: KelompokIsian[]; perHasil: Record<string, number>; terverifikasiBeda: number };

const persen = (x: number | null) => (x === null ? "-" : `${x}%`);

function TabelButir({ judul, baris }: { judul: string; baris: KelompokButir[] }) {
  if (!baris.length) return null;
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{judul}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3">Kunci</th>
              <th className="pr-3">Butir</th>
              <th className="pr-3">Diterima</th>
              <th className="pr-3">Disunting</th>
              <th className="pr-3">Diketik</th>
              <th className="pr-3">Dibuang</th>
              <th>% diterima tanpa diubah</th>
            </tr>
          </thead>
          <tbody>
            {baris.slice(0, 30).map((b) => (
              <tr key={b.kunci} className="border-t border-border">
                <td className="py-1 pr-3 break-all">{b.kunci}</td>
                <td className="pr-3">{b.jumlah}</td>
                <td className="pr-3">{b.diterima}</td>
                <td className="pr-3">{b.disunting}</td>
                <td className="pr-3">{b.diketik}</td>
                <td className="pr-3">{b.dibuang}</td>
                <td>{persen(b.persenDiterima)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AletaEcourtJejakIsian() {
  const [aktif, setAktif] = useState<boolean | null>(null);
  const [laporan, setLaporan] = useState<Laporan | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const [a, b] = await Promise.all([
        fetch(apiPath("/api/aleta-ecourt/saksi-butir?bagian=laporan"), { credentials: "include", cache: "no-store" }),
        fetch(apiPath("/api/aleta-ecourt/jejak-isian?bagian=ringkasan"), { credentials: "include", cache: "no-store" }),
      ]);
      const ja = await a.json();
      const jb = await b.json();
      if (!a.ok) throw new Error(ja?.error?.message || "Laporan butir saksi tidak dapat dibaca.");
      if (!b.ok) throw new Error(jb?.error?.message || "Ringkasan isian tidak dapat dibaca.");
      setAktif(Boolean(ja.data.aktif));
      setLaporan(ja.data.laporan as Laporan);
      setRingkasan(jb.data.ringkasan as Ringkasan);
    } catch (e) {
      setGalat(pesanGalatPortal(e, "Jejak isian tidak dapat dimuat."));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  return (
    <Card id="jejak-isian">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Jejak isian dan butir saksi
          {aktif === null ? null : <Badge variant={aktif ? "success" : "muted"}>{aktif ? "Mencatat" : "Mati"}</Badge>}
        </CardTitle>
        <CardDescription>
          Angka lapangan dari susun saksi dan Blangko Derry: berapa banyak usulan diterima tanpa diubah. Saklar &quot;Jejak isian dan butir saksi&quot; ada di
          Fitur satker (bawaan mati). Disimpan 2 tahun di server kantor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" variant="outline" size="sm" onClick={() => void muat()} disabled={memuat}>
          {memuat ? "Memuat..." : "Segarkan"}
        </Button>
        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}
        {laporan ? (
          <div className="space-y-4">
            <p className="text-sm">
              Butir saksi tercatat: <b>{laporan.jumlah}</b>. Diterima tanpa diubah: <b>{persen(laporan.persenDiterima)}</b> (hanya butir yang ada usulan mesinnya).
            </p>
            <TabelButir judul="Per katalog" baris={laporan.perKatalog} />
            <TabelButir judul="Per varian kalimat" baris={laporan.perVarian} />
            <TabelButir judul="Per jenis perkara" baris={laporan.perJenisPerkara} />
            <TabelButir judul="Per jalur" baris={laporan.perJalur} />
          </div>
        ) : null}
        {ringkasan ? (
          <div className="space-y-1">
            <p className="text-sm">
              Penyimpanan isian tercatat: <b>{ringkasan.jumlah}</b>; bacaan ulang dari ABT berbeda: <b>{ringkasan.terverifikasiBeda}</b>.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Kode</th>
                    <th className="pr-3">Pengisi</th>
                    <th className="pr-3">Usulan</th>
                    <th className="pr-3">Bertahan</th>
                    <th className="pr-3">Presisi</th>
                    <th>Diketik</th>
                  </tr>
                </thead>
                <tbody>
                  {ringkasan.perKode.slice(0, 40).map((k) => (
                    <tr key={k.kunci} className="border-t border-border">
                      <td className="py-1 pr-3">{k.kode}</td>
                      <td className="pr-3">{k.asalUsulan || "-"}</td>
                      <td className="pr-3">{k.usulan}</td>
                      <td className="pr-3">{k.bertahan}</td>
                      <td className="pr-3">{k.presisi === null ? "-" : `${Math.round(k.presisi * 1000) / 10}%`}</td>
                      <td>{k.diketik}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
