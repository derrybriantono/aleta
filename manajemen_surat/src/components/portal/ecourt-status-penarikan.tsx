"use client";

/**
 * Kartu STATUS PENARIKAN DATA e-COURT di dasbor ALETA e-Court (13 Okt 2026,
 * butir 12): tarikan terakhir berkala & per perkara (berhasil/gagal + sebab),
 * jumlah perkara diperiksa dan dokumen baru, akun yang dipakai, jadwal
 * berikutnya, dan sesi e-Court aktif atau tidak. Hanya membaca.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LencanaStatusEcourt, useStatusEcourt } from "@/components/portal/ecourt-status-lencana";
import type { StatusAkunEcourt } from "@/lib/ecourt-status-akun";
import { apiPath } from "@/lib/base-path";
import {
  LABEL_HASIL,
  NADA_HASIL,
  angkaPenarikan,
  kalimatBerikutnya,
  kalimatPagi,
  kalimatPenarikan,
  keadaanSesi,
  peringatanPenarikan,
  waktuPendek,
  type RingkasPenarikan,
  type StatusPenarikan,
} from "@/lib/status-penarikan-ecourt";

function BarisTerakhir({ judul, r, zona }: { judul: string; r: RingkasPenarikan | null; zona?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{judul}</span>
        {r ? <Badge variant={NADA_HASIL[r.hasil]}>{LABEL_HASIL[r.hasil]}</Badge> : <Badge variant="muted">belum ada</Badge>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{kalimatPenarikan(r, zona)}</p>
    </div>
  );
}

export function EcourtStatusPenarikan() {
  const [status, setStatus] = useState<StatusPenarikan | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/penarikan?bagian=status"), { cache: "no-store" });
      const isi = await jawaban.json();
      const data = isi?.data ?? isi;
      if (!jawaban.ok || !data?.available || !data?.status) {
        setPesan(String(data?.message || "Status penarikan belum dapat dibaca."));
        setStatus(null);
      } else {
        setPesan("");
        setStatus(data.status as StatusPenarikan);
      }
    } catch (galat) {
      setPesan(galat instanceof Error ? galat.message : "Status penarikan belum dapat dibaca.");
      setStatus(null);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const { data: statusEcourt } = useStatusEcourt();
  const statusUtama = statusEcourt?.ringkas ?? null;
  const zona = status?.penjadwal.zonaWaktu || undefined;
  const sesi = status ? keadaanSesi(status.sesi, zona) : null;
  // Peringatan sesi mengikuti simpanan status bersama (berubah serentak
  // sesudah masuk), bukan salinan saat kartu ini dimuat.
  const peringatan = status
    ? peringatanPenarikan(
        statusUtama
          ? { ...status, statusUtama: { ...(status.statusUtama ?? {}), keadaan: statusUtama.keadaan, adaSandi: statusUtama.adaSandi } as StatusAkunEcourt }
          : status
      )
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Status penarikan data e-Court
            {status ? (
              <Badge variant={status.penjadwal.aktif ? "success" : "danger"}>
                {status.penjadwal.selaluAktif
                  ? "otomatis - selalu aktif"
                  : status.penjadwal.aktif
                    ? "otomatis menyala"
                    : "otomatis mati"}
              </Badge>
            ) : null}
            {status?.penjadwal.sedangJalan ? <Badge variant="warning">sedang menarik</Badge> : null}
            {/* Keadaan sesi dari status akun satu sumber - sama dengan semua kartu. */}
            {statusUtama ? <LencanaStatusEcourt t={statusUtama} awalan="e-Court" /> : sesi ? <Badge variant={sesi.nada}>{status?.sesi.berlaku === true ? "sesi aktif" : status?.sesi.berlaku === false ? "sesi habis" : "sesi belum diperiksa"}</Badge> : null}
          </CardTitle>
          <CardDescription>Dibaca dari log penarikan dan keadaan ALETA Bot - tidak menyentuh e-Court.</CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled={memuat} onClick={() => void muat()}>
          Muat Ulang
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {memuat && !status ? <p className="text-sm text-muted-foreground">Memuat…</p> : null}
        {pesan ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            {pesan}
          </p>
        ) : null}
        {status ? (
          <>
            {peringatan.length ? (
              <ul className="space-y-1 rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100">
                {peringatan.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
            <div className="grid gap-3 md:grid-cols-3">
              <BarisTerakhir judul="Tarikan pagi terakhir" r={status.terakhirPagi ?? null} zona={zona} />
              <BarisTerakhir judul="Tarikan berkala terakhir" r={status.terakhirBerkala} zona={zona} />
              <BarisTerakhir judul="Tarikan per perkara terakhir" r={status.terakhirPerkara} zona={zona} />
            </div>
            <div className="grid gap-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Akun utama:</span>{" "}
                {status.akunUtama.slot ? `${status.akunUtama.label || status.akunUtama.slot}` : "belum dipilih"}
                {status.penjadwal.sedangJalan && status.penjadwal.akunBerjalan
                  ? ` · sedang dipakai: ${status.penjadwal.akunBerjalan}`
                  : ""}
              </p>
              {kalimatPagi(status) ? (
                <p>
                  <span className="font-medium text-foreground">Pagi:</span> {kalimatPagi(status)}
                </p>
              ) : null}
              <p>
                <span className="font-medium text-foreground">Jadwal:</span> {kalimatBerikutnya(status)}
                {status.penjadwal.jamMulai !== null && status.penjadwal.jamSelesai !== null
                  ? ` Jam kerja ${status.penjadwal.jamMulai}.00-${status.penjadwal.jamSelesai}.00, Senin-Jumat.`
                  : ""}
              </p>
              {statusUtama ? (
                <p>
                  <span className="font-medium text-foreground">Sesi e-Court:</span> {statusUtama.judul} - {statusUtama.teks}
                </p>
              ) : sesi ? (
                <p>
                  <span className="font-medium text-foreground">Sesi:</span> {sesi.teks}
                </p>
              ) : null}
            </div>
            {status.riwayat.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Riwayat {status.riwayat.length} penarikan terakhir</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-xs">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-2 py-1 font-medium">Mulai</th>
                        <th className="px-2 py-1 font-medium">Sumber</th>
                        <th className="px-2 py-1 font-medium">Hasil</th>
                        <th className="px-2 py-1 font-medium">Angka</th>
                        <th className="px-2 py-1 font-medium">Sebab</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.riwayat.map((r) => (
                        <tr key={r.nama} className="border-t border-border">
                          <td className="px-2 py-1 whitespace-nowrap">{waktuPendek(r.mulai, zona)}</td>
                          <td className="px-2 py-1">
                            {r.labelSumber}
                            {r.perkara ? ` · ${r.perkara}` : ""}
                            {r.labelAkun || r.akun ? ` · ${r.labelAkun || r.akun}` : ""}
                          </td>
                          <td className="px-2 py-1">
                            <Badge variant={NADA_HASIL[r.hasil]}>{LABEL_HASIL[r.hasil]}</Badge>
                          </td>
                          <td className="px-2 py-1">{angkaPenarikan(r) || "-"}</td>
                          <td className="px-2 py-1">{r.sebab || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
