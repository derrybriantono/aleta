"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Pemantauan antrian sidang online.
 *
 * Antrian dicatat di basis data di luar ALETA (sipp_turunan_antrian). Bila
 * koneksi ke sana putus, perintah "daftar antrian" dari pihak gagal tanpa ada
 * yang menyadari - dan baru ketahuan saat sidang. Panel ini menjawab satu
 * pertanyaan: antriannya jalan atau tidak.
 */

type AntrianItem = {
  nomorPerkara: string;
  majelisHakimKode: string;
  online: boolean;
  pihak1DaftarPada: string | null;
  pihak2DaftarPada: string | null;
  nomorAntrian: number | null;
};

type AntrianLog = {
  id: number | string;
  createdAt: string;
  severity: string;
  message: string;
  status: string;
  nomorPerkara: string;
  partySlot: string;
  nomorAntrian: number | null;
  resolvedBy: string;
};

type AntrianMonitor = {
  connectionKey: string;
  commands: string[];
  reachable: boolean;
  error: string;
  checkedAt: string;
  totals: { sidangHariIni: number; sudahAmbilAntrian: number; pihak1: number; pihak2: number };
  items: AntrianItem[];
};

const LABEL_STATUS: Record<string, string> = {
  registered: "Terdaftar",
  not_found: "Perkara Tidak Bersidang",
  needs_more_info: "Nomor Perkara Belum Diisi",
};

const LABEL_SLOT: Record<string, string> = {
  pihak_1: "Penggugat/Pemohon",
  pihak_2: "Tergugat/Termohon",
};

const LABEL_SUMBER: Record<string, string> = {
  sender_phone: "Dikenali dari nomor WhatsApp",
  message_fallback: "Dari nomor perkara yang diketik",
};

function Ringkasan({ judul, nilai, keterangan }: { judul: string; nilai: string; keterangan: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{judul}</p>
        <p className="text-2xl font-semibold">{nilai}</p>
        <p className="text-xs text-muted-foreground">{keterangan}</p>
      </CardContent>
    </Card>
  );
}

export function AletaBotAntrianOnlinePanel() {
  const [monitor, setMonitor] = useState<AntrianMonitor | null>(null);
  const [logs, setLogs] = useState<AntrianLog[]>([]);
  const [tersedia, setTersedia] = useState(true);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const respons = await fetch(apiPath("/api/aleta-bot/antrian-online?limit=200&logLimit=100"), {
        credentials: "include",
        cache: "no-store",
      });
      const isi = (await respons.json().catch(() => null)) as {
        ok?: boolean;
        data?: { available?: boolean; message?: string; monitor?: AntrianMonitor | null; logs?: AntrianLog[] };
        error?: { message?: string };
      } | null;

      if (!respons.ok || !isi?.ok) {
        setTersedia(false);
        setPesan(isi?.error?.message ?? "Pemantauan antrian belum bisa dibaca.");
        return;
      }

      setTersedia(isi.data?.available !== false);
      setPesan(isi.data?.message ?? "");
      setMonitor(isi.data?.monitor ?? null);
      setLogs(isi.data?.logs ?? []);
    } catch (galat) {
      setTersedia(false);
      setPesan(galat instanceof Error ? galat.message : "Pemantauan antrian belum bisa dibaca.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // Ditunda satu tick agar pembaruan state tidak terjadi langsung di dalam
    // effect, mengikuti pola panel ALETA Bot lain.
    const timer = globalThis.setTimeout(() => {
      void muat();
    }, 0);
    return () => globalThis.clearTimeout(timer);
  }, [muat]);

  const sehat = tersedia && monitor?.reachable === true;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              Antrian Sidang Online
              <Badge variant={sehat ? "success" : "danger"}>{sehat ? "Berjalan" : "Bermasalah"}</Badge>
            </CardTitle>
            <CardDescription>
              Pihak mendaftar lewat WhatsApp dengan perintah{" "}
              {(monitor?.commands ?? ["daftar antrian", "antrian online", "ambil antrian"]).map((perintah, urutan) => (
                <span key={perintah}>
                  {urutan > 0 ? ", " : ""}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{perintah}</code>
                </span>
              ))}
              .
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void muat()} disabled={memuat}>
            {memuat ? "Memuat..." : "Muat Ulang"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!tersedia ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="font-medium">ALETA Bot belum dapat dihubungi.</p>
              <p className="text-muted-foreground">{pesan}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ini belum tentu antriannya bermasalah — yang pasti, statusnya tidak bisa dibaca dari sini.
              </p>
            </div>
          ) : monitor && !monitor.reachable ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="font-medium">Basis data antrian tidak terjangkau.</p>
              <p className="text-muted-foreground">{monitor.error}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Selama ini terjadi, perintah pendaftaran antrian dari pihak akan gagal. Periksa koneksi{" "}
                <code className="rounded bg-muted px-1 py-0.5">{monitor.connectionKey}</code> di tab Koneksi Data.
              </p>
            </div>
          ) : null}

          {monitor?.reachable ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Ringkasan
                judul="Perkara Bersidang Hari Ini"
                nilai={String(monitor.totals.sidangHariIni)}
                keterangan="Mengikuti tanggal server; berganti sendiri saat hari berganti."
              />
              <Ringkasan
                judul="Sudah Ambil Antrian"
                nilai={String(monitor.totals.sudahAmbilAntrian)}
                keterangan="Minimal satu pihak sudah mendaftar."
              />
              <Ringkasan
                judul="Penggugat/Pemohon"
                nilai={String(monitor.totals.pihak1)}
                keterangan="Pihak 1 yang sudah mendaftar."
              />
              <Ringkasan
                judul="Tergugat/Termohon"
                nilai={String(monitor.totals.pihak2)}
                keterangan="Pihak 2 yang sudah mendaftar."
              />
            </div>
          ) : null}

          {monitor?.checkedAt ? (
            <p className="text-xs text-muted-foreground">Diperiksa: {formatDateTime(monitor.checkedAt)}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Antrian</CardTitle>
          <CardDescription>Urutan mengikuti waktu pendaftaran, sama seperti nomor yang dibalas ke pihak.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">No. Antrian</th>
                  <th className="px-4 py-2">Nomor Perkara</th>
                  <th className="px-4 py-2">Majelis</th>
                  <th className="px-4 py-2">Penggugat/Pemohon</th>
                  <th className="px-4 py-2">Tergugat/Termohon</th>
                </tr>
              </thead>
              <tbody>
                {(monitor?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      {monitor?.reachable
                        ? "Belum ada perkara pada antrian."
                        : "Data antrian belum bisa dibaca."}
                    </td>
                  </tr>
                ) : (
                  (monitor?.items ?? []).map((item) => (
                    <tr key={`${item.nomorPerkara}-${item.majelisHakimKode}`} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        {item.nomorAntrian ? (
                          <Badge variant="default">{item.nomorAntrian}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">belum daftar</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-medium">{item.nomorPerkara}</td>
                      <td className="px-4 py-2 text-muted-foreground">{item.majelisHakimKode || "-"}</td>
                      {/* Jam pendaftaran sudah berupa teks jam dinding WITA dari
                          bot — ditampilkan apa adanya, JANGAN dilewatkan
                          formatDateTime yang akan menggeser zona lagi. */}
                      <td className={cn("px-4 py-2", !item.pihak1DaftarPada && "text-muted-foreground")}>
                        {item.pihak1DaftarPada ?? "belum"}
                      </td>
                      <td className={cn("px-4 py-2", !item.pihak2DaftarPada && "text-muted-foreground")}>
                        {item.pihak2DaftarPada ?? "belum"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log Pendaftaran</CardTitle>
          <CardDescription>
            Setiap perintah antrian yang masuk, berhasil maupun tidak. Berguna untuk menelusuri keluhan pihak yang
            mengaku sudah mendaftar.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Waktu</th>
                  <th className="px-4 py-2">Hasil</th>
                  <th className="px-4 py-2">Nomor Perkara</th>
                  <th className="px-4 py-2">Sebagai</th>
                  <th className="px-4 py-2">No. Antrian</th>
                  <th className="px-4 py-2">Cara Dikenali</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Belum ada pendaftaran antrian yang tercatat.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={String(log.id)} className="border-b last:border-0">
                      <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-2">
                        <Badge variant={log.status === "registered" ? "success" : "warning"}>
                          {LABEL_STATUS[log.status] || log.status || "-"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">{log.nomorPerkara || "-"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{LABEL_SLOT[log.partySlot] || log.partySlot || "-"}</td>
                      <td className="px-4 py-2">{log.nomorAntrian ?? "-"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {LABEL_SUMBER[log.resolvedBy] || log.resolvedBy || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
