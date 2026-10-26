"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { labelAturan, labelHasil, type FiturOtomatis, type RingkasAturan, type RingkasSebab } from "@/lib/otomatis-jejak";
import { KALIMAT_LEWATI, type SebabLewati } from "@/lib/tunda-otomatis";

type Rincian = { tanggal: string; fitur: FiturOtomatis; nomorPerkara: string; keputusan: string; aturan: string; hasil: string; kering: boolean; pesan: string };

type Laporan =
  | { tersedia: false; pesan: string }
  | { tersedia: true; hari: number; dari: string; sampai: string; jumlahBaris: number; aturan: RingkasAturan[]; dilewati: RingkasSebab[]; rincian: Rincian[]; jejakAktif?: boolean };

function pesanGalat(isi: unknown, cadangan: string): string {
  const x = isi as { error?: { message?: string }; message?: string } | null;
  return x?.error?.message || x?.message || cadangan;
}

/**
 * Ketepatan tunda dan putus otomatis per aturan (U19). Yang diukur: berapa kali usulan sebuah
 * aturan diterima atau ditolak saat bot membaca ulang SIPP sebelum menulis. Ini bahan koreksi
 * aturan, bukan penilaian benar-salahnya putusan.
 */
export function OtomatisKetepatan() {
  const [hari, setHari] = useState("90");
  const [fitur, setFitur] = useState("");
  const [laporan, setLaporan] = useState<Laporan | null>(null);
  const [galat, setGalat] = useState("");
  const [ditolak, setDitolak] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const kueri = new URLSearchParams({ hari, ...(fitur ? { fitur } : {}) });
        const jawaban = await fetch(apiPath(`/api/aleta-ecourt/otomatis-jejak?${kueri.toString()}`), { cache: "no-store" });
        if (batal) return;
        if (jawaban.status === 403) {
          setDitolak(true);
          return;
        }
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalat(isi, "Gagal membaca laporan."));
        if (!batal) {
          setLaporan((isi?.data ?? isi) as Laporan);
          setGalat("");
        }
      } catch (e) {
        if (!batal) setGalat(e instanceof Error ? e.message : "Gagal membaca laporan.");
      }
    })();
    return () => {
      batal = true;
    };
  }, [hari, fitur]);

  const susunUlang = useCallback(async () => {
    setSibuk(true);
    setPesan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/otomatis-jejak"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "isi-ulang" }),
      });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalat(isi, "Gagal menyusun ulang."));
      const d = (isi?.data ?? isi) as { hariTunda: number; hariPutus: number; baris: number };
      setPesan(`Disusun dari riwayat harian: ${d.hariTunda} hari tunda, ${d.hariPutus} hari putus, ${d.baris} baris diperbarui. Muat ulang halaman untuk melihat angkanya.`);
    } catch (e) {
      setPesan(e instanceof Error ? e.message : "Gagal menyusun ulang.");
    } finally {
      setSibuk(false);
    }
  }, []);

  if (ditolak) return null;

  return (
    <Card id="ketepatan-otomatis" className="mt-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Ketepatan Tunda dan Putus Otomatis
          <Badge variant="outline">Admin dan Super Admin</Badge>
        </CardTitle>
        <CardDescription>
          Berapa kali usulan tiap aturan diterima atau ditolak saat bot membaca ulang SIPP sebelum menulis. Aturan yang sering ditolak
          perlu dikoreksi; angka ini bukan penilaian benar atau salahnya putusan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Rentang</span>
            <NativeSelect value={hari} onChange={(e) => setHari(e.target.value)} aria-label="Rentang hari">
              <option value="7">7 hari terakhir</option>
              <option value="30">30 hari terakhir</option>
              <option value="90">90 hari terakhir</option>
              <option value="365">1 tahun terakhir</option>
            </NativeSelect>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Jenis</span>
            <NativeSelect value={fitur} onChange={(e) => setFitur(e.target.value)} aria-label="Jenis otomatis">
              <option value="">Tunda dan putus</option>
              <option value="tunda">Tunda saja</option>
              <option value="putus">Putus saja</option>
            </NativeSelect>
          </label>
          <Button variant="outline" onClick={() => void susunUlang()} disabled={sibuk}>
            Susun ulang dari riwayat harian
          </Button>
        </div>
        {pesan ? <p className="text-sm text-muted-foreground">{pesan}</p> : null}
        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}
        {!laporan && !galat ? <p className="text-sm text-muted-foreground">Memuat laporan...</p> : null}
        {laporan && laporan.tersedia === false ? <p className="text-sm text-muted-foreground">{laporan.pesan}</p> : null}
        {laporan && laporan.tersedia ? (
          <>
            <p className="text-xs text-muted-foreground">
              {laporan.dari} sampai {laporan.sampai}: {laporan.jumlahBaris} sidang tercatat.
            </p>
            {laporan.jejakAktif === false ? (
              <p className="text-sm text-muted-foreground">
                Pencatatan jejak sedang mati, jadi sidang baru tidak dicatat di sini. Super Admin dapat menyalakannya di Fitur Satker (Jejak tunda dan putus otomatis).
              </p>
            ) : null}
            {laporan.aturan.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada tunda atau putus otomatis yang tercatat pada rentang ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Aturan</th>
                      <th className="px-2 font-medium">Dicoba</th>
                      <th className="px-2 font-medium">Lolos</th>
                      <th className="px-2 font-medium">Ditolak saat dibaca ulang</th>
                      <th className="px-2 font-medium">Gagal</th>
                      <th className="px-2 font-medium">Dibatalkan</th>
                      <th className="px-2 font-medium">Mode kering</th>
                      <th className="px-2 font-medium">Usulan saja</th>
                      <th className="px-2 font-medium">Lolos (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laporan.aturan.map((a) => (
                      <tr key={`${a.fitur}|${a.aturan}`} className="border-b border-border/60">
                        <td className="py-2 pr-3 text-foreground">{labelAturan(a.fitur, a.aturan, a.nomorAturan)}</td>
                        <td className="px-2">{a.dicoba}</td>
                        <td className="px-2">{a.lolos}</td>
                        <td className="px-2">{a.ditolakPenjaga}</td>
                        <td className="px-2">{a.gagal}</td>
                        <td className="px-2">{a.dibatalkan}</td>
                        <td className="px-2">{a.kering}</td>
                        <td className="px-2">{a.usulan}</td>
                        <td className="px-2 font-medium">{a.persenLolos === null ? "-" : `${a.persenLolos}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {laporan.dilewati.length > 0 ? (
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Sidang yang dilewati dan sebabnya</summary>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {laporan.dilewati.map((s) => (
                    <li key={`${s.fitur}|${s.sebab}`}>
                      <span className="font-medium text-foreground">{s.jumlah}</span> {s.fitur === "putus" ? "(putus)" : "(tunda)"}{" "}
                      {KALIMAT_LEWATI[s.sebab as SebabLewati] ?? s.sebab}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {laporan.rincian.length > 0 ? (
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Kejadian terakhir ({laporan.rincian.length})</summary>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {laporan.rincian.map((r, i) => (
                    <li key={`${r.tanggal}|${r.nomorPerkara}|${i}`}>
                      {r.tanggal} - {r.nomorPerkara}: {labelAturan(r.fitur, r.aturan, 0)} - {labelHasil(r.hasil)}
                      {r.kering ? " (mode kering)" : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
