"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import type { LaporanBeban } from "@/server/modules/aleta-ecourt/isian-sekali";

/**
 * Isian sekali per perkara - kartu Admin (rantai D, D2, 25 Okt 2026).
 *
 * Daftar kerja menutup isian manual: isian Blangko Derry yang belum punya pengisi otomatis, urut dari yang paling
 * sering diketik petugas. Menampilkan berapa perkara yang isiannya sudah diingat ALETA (cukup diketik sekali).
 * Hanya membaca. Saklar &quot;Isian sekali per perkara&quot; ada di Fitur satker (bawaan mati). Hanya Super Admin dan Admin.
 */

const AMBIL = { credentials: "include" as const, cache: "no-store" as const };

export function AletaEcourtIsianSekali() {
  const [laporan, setLaporan] = useState<LaporanBeban | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [semua, setSemua] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawab = await fetch(apiPath("/api/aleta-ecourt/isian-sekali?bagian=beban"), AMBIL);
      const j = await jawab.json();
      if (!jawab.ok) throw new Error(j?.error?.message || "Urutan isian manual tidak dapat dibaca.");
      setLaporan(j.data as LaporanBeban);
    } catch (e) {
      setGalat(pesanGalatPortal(e, "Urutan isian manual tidak dapat dimuat."));
    } finally {
      setMemuat(false);
    }
  }, []);

  const baris = laporan ? (semua ? laporan.baris : laporan.baris.slice(0, 25)) : [];

  return (
    <Card id="isian-sekali">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Isian manual yang diingat per perkara
          {laporan === null ? null : <Badge variant={laporan.aktif ? "success" : "muted"}>{laporan.aktif ? "Menyala" : "Mati"}</Badge>}
        </CardTitle>
        <CardDescription>
          Isian Blangko Derry yang belum punya sumber otomatis (mis. nomor penetapan prodeo) cukup diketik sekali per perkara; blangko lain perkara itu
          menampilkannya sebagai saran. Daftar ini urut dari yang paling sering diketik. Saklar &quot;Isian sekali per perkara&quot; ada di Fitur satker (bawaan mati).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" variant="outline" size="sm" onClick={() => void muat()} disabled={memuat}>
          {memuat ? "Memuat..." : laporan ? "Segarkan" : "Muat daftar"}
        </Button>
        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}
        {laporan && !laporan.aktif ? <p className="text-sm">Saklar mati. Tidak ada isian yang diingat per perkara.</p> : null}
        {laporan?.aktif ? (
          <div className="space-y-2">
            <p className="text-sm">
              Isian yang dapat diingat: <b>{laporan.jumlahKode}</b> (tanpa sumber di SIPP: <b>{laporan.jumlahTanpaSumber}</b>). Sudah diingat: <b>{laporan.diingatTotal}</b> isian.
              {laporan.jejakMenyala ? "" : " Hitungan ketikan hidup butuh saklar Jejak isian menyala; sementara dipakai hitungan sejak 2023."}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Isian</th>
                    <th className="pr-3">Nama</th>
                    <th className="pr-3">Diketik (ALETA)</th>
                    <th className="pr-3">Diketik sejak 2023</th>
                    <th className="pr-3">Blangko</th>
                    <th className="pr-3">Diingat</th>
                    <th>Sumber yang mungkin</th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b) => (
                    <tr key={b.kode} className="border-t border-border">
                      <td className="py-1 pr-3">{b.kode}</td>
                      <td className="pr-3">{b.nama}</td>
                      <td className="pr-3">{b.diketikHidup}</td>
                      <td className="pr-3">{b.bebanDaftar}</td>
                      <td className="pr-3">{b.blangko}</td>
                      <td className="pr-3">{b.diingat}</td>
                      <td>{b.sumber || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {laporan.baris.length > 25 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setSemua((x) => !x)}>
                {semua ? "Tampilkan 25 teratas" : `Tampilkan semua (${laporan.baris.length})`}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
