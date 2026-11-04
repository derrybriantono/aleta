"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { sebabRekeningTeks, statusPutaranTeks, sumberPutaranTeks } from "@/lib/rekening-sinkron";
import type { GatewayRekeningStatus } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * Sinkron rekening dan bank pembayar dari e-Court (4 Nov 2026) - kartu admin Integrasi e-Court.
 *
 * Rekening dibaca otomatis di ujung tiap putaran penarikan e-Court; kartu ini menunjukkan keadaannya
 * (terakhir sinkron, terbaca, belum dicek, gagal beserta sebab) dan menyediakan satu tombol untuk menjalankannya
 * sekarang. Hanya Super Admin dan Admin; nomor rekening tidak pernah tampil di sini. Rutenya
 * /api/aleta-ecourt/rekening-sinkron.
 */

type Keadaan = { status: GatewayRekeningStatus["status"]; penjadwal: GatewayRekeningStatus["penjadwal"] };

const ALAMAT = "/api/aleta-ecourt/rekening-sinkron";

function waktuTeks(iso: string): string {
  if (!iso) return "belum pernah";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "belum pernah";
  try {
    return t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });
  } catch {
    return t.toLocaleString("id-ID");
  }
}

function Angka({ label, nilai, catatan }: { label: string; nilai: string | number; catatan?: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{nilai}</p>
      {catatan ? <p className="text-xs text-muted-foreground">{catatan}</p> : null}
    </div>
  );
}

export function AletaEcourtRekening() {
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [memulai, setMemulai] = useState(false);
  const [dilarang, setDilarang] = useState(false);
  const pewaktu = useRef<number | null>(null);

  const muat = useCallback(async (diam = false) => {
    if (!diam) setMemuat(true);
    try {
      const r = await fetch(apiPath(ALAMAT), { cache: "no-store" });
      if (r.status === 403) {
        setDilarang(true);
        return;
      }
      const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: { available?: boolean; message?: string } & Partial<Keadaan> } | null;
      if (!r.ok || !isi) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
      const data = isi.data;
      if (!data?.available || !data.status || !data.penjadwal) {
        setKeadaan(null);
        setPesan(data?.message || "ALETA Bot belum dapat dihubungi.");
      } else {
        setKeadaan({ status: data.status, penjadwal: data.penjadwal });
        if (!diam) setPesan("");
      }
    } catch (galat) {
      setPesan(galat instanceof Error ? galat.message : "Keadaan sinkron rekening belum terbaca.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  // Selama sinkron berjalan, keadaan diperbarui tiap 6 detik; selain itu tidak ada pembacaan berulang.
  const berjalan = Boolean(keadaan?.penjadwal.sedangSinkronRekening);
  useEffect(() => {
    if (!berjalan) return undefined;
    pewaktu.current = window.setInterval(() => void muat(true), 6000);
    return () => {
      if (pewaktu.current !== null) window.clearInterval(pewaktu.current);
    };
  }, [berjalan, muat]);

  async function mulai() {
    setMemulai(true);
    setPesan("");
    try {
      const r = await fetch(apiPath(ALAMAT), { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: "{}" });
      const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: { ok?: boolean; message?: string } } | null;
      if (!r.ok || !isi) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
      setPesan(isi.data?.message || "");
      await muat(true);
    } catch (galat) {
      setPesan(galat instanceof Error ? galat.message : "Sinkron rekening belum dapat dimulai.");
    } finally {
      setMemulai(false);
    }
  }

  if (dilarang) return null;

  const s = keadaan?.status;
  const p = keadaan?.penjadwal;
  const terakhir = s?.putaranTerakhir?.[0];
  const gagal = s?.jumlah.gagal ?? 0;
  const sesiHabis = p?.terakhirKode === 2 || terakhir?.status === "sesi_habis";

  return (
    <Card id="rekening-ecourt">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Rekening dan bank pembayar
            {s ? <Badge variant={s.otomatis ? "default" : "secondary"}>{s.otomatis ? "Otomatis menyala" : "Otomatis mati"}</Badge> : null}
            {berjalan ? <Badge variant="outline">Sedang berjalan</Badge> : null}
          </CardTitle>
          <CardDescription>
            Nomor rekening dan bank pembayar dibaca dari e-Court bersama penarikan berkala dan tampil otomatis di Kasir dan Status Perkara. Yang sudah
            terbaca hanya diperiksa lagi bila perlu; tidak ada yang ditulis ke e-Court.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void muat()} disabled={memuat}>
            Segarkan
          </Button>
          <Button type="button" size="sm" onClick={() => void mulai()} disabled={memulai || berjalan || !keadaan}>
            {berjalan ? "Sedang berjalan..." : "Sinkron rekening"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pesan ? (
          <p className="text-sm text-muted-foreground" role="status">
            {pesan}
          </p>
        ) : null}
        {memuat && !keadaan ? <p className="text-sm text-muted-foreground">Memuat keadaan...</p> : null}

        {sesiHabis ? (
          <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
            Sesi e-Court habis, jadi rekening belum dapat dibaca. Masuk ulang di bagian login e-Court pada halaman ini, lalu tekan Sinkron rekening.
          </p>
        ) : null}
        {p && !p.aktif ? (
          <p className="text-sm text-muted-foreground">Penjadwal penarikan e-Court sedang mati, jadi sinkron otomatis tidak berjalan. Tombol di atas tetap dapat dipakai.</p>
        ) : null}

        {s ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Angka label="Terakhir sinkron" nilai={waktuTeks(s.terakhirCek)} />
              <Angka
                label="Rekening terbaca"
                nilai={s.cakupan ? `${s.cakupan.denganRekening} dari ${s.cakupan.total}` : s.tersimpan.denganRekening}
                catatan={s.cakupan ? "perkara e-Court setahun terakhir" : "perkara tersimpan"}
              />
              <Angka label="Belum dicek" nilai={s.cakupan ? s.cakupan.belumDicek : "-"} catatan="dicek bertahap tiap putaran" />
              <Angka label="Gagal dibaca" nilai={gagal} catatan={gagal ? "dicoba lagi otomatis" : undefined} />
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Angka label="e-Court tanpa nomor rekening" nilai={s.jumlah.tanpa_rekening ?? 0} />
              <Angka label="e-Court belum mencatat pembayaran" nilai={s.jumlah.tidak_ada ?? 0} />
              <Angka label="Tidak ditemukan di e-Court" nilai={s.jumlah.tidak_ketemu ?? 0} />
            </div>

            {s.sebabGagal.length ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">Sebab gagal</p>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {s.sebabGagal.map((x) => (
                    <li key={x.sebab}>
                      {sebabRekeningTeks(x.sebab)}: <span className="tabular-nums">{x.jumlah}</span> perkara
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-1">
              <p className="text-sm font-medium">Putaran terakhir</p>
              {s.putaranTerakhir.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Selesai</th>
                        <th className="py-1 pr-3 font-medium">Asal</th>
                        <th className="py-1 pr-3 font-medium">Hasil</th>
                        <th className="py-1 pr-3 font-medium">Perkara</th>
                        <th className="py-1 pr-3 font-medium">Terbaca</th>
                        <th className="py-1 pr-3 font-medium">Berubah</th>
                        <th className="py-1 pr-3 font-medium">Gagal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.putaranTerakhir.map((r, i) => (
                        <tr key={`${r.selesai}-${i}`} className="border-t border-border/60">
                          <td className="py-1 pr-3 whitespace-nowrap">{waktuTeks(r.selesai)}</td>
                          <td className="py-1 pr-3">{sumberPutaranTeks(r.sumber)}</td>
                          <td className="py-1 pr-3">
                            {statusPutaranTeks(r.status)}
                            {r.sebab && r.status !== "selesai" ? <span className="block text-xs text-muted-foreground">{sebabRekeningTeks(r.sebab)}</span> : null}
                          </td>
                          <td className="py-1 pr-3 tabular-nums">{r.sasaran}</td>
                          <td className="py-1 pr-3 tabular-nums">{r.terbaca}</td>
                          <td className="py-1 pr-3 tabular-nums">{r.berubah}</td>
                          <td className="py-1 pr-3 tabular-nums">{r.gagal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada putaran. Sinkron otomatis dimulai pada putaran penarikan e-Court berikutnya.</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Otomatis: paling banyak {s.perPutaran} perkara di ujung tiap putaran penarikan berkala; tombol: paling banyak {s.maksManual} perkara sekali tekan.
              Nomor rekening disimpan tersandi dan hanya tampil bagi Super Admin, Admin, Ketua/Wakil, Hakim, Panitera, Kasir, dan PTSP.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
