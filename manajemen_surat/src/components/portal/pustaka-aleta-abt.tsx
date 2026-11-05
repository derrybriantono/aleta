"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import { JadwalSinkronAbt } from "@/components/portal/sinkron-abt-kartu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HitunganRencana, RingkasanPustaka, RiwayatSinkron } from "@/lib/aleta-abt-pustaka";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Pengaturan SIPP & ABT > Pustaka blangko (3 Nov 2026, Tahap 1 ALETA ABT) - Super Admin saja.
 * Melihat salinan Blangko ABT by Derry Briantono di database ALETA dan menyalin ulang dari ABT. ABT hanya dibaca;
 * blangko yang sudah diubah di ALETA tidak pernah ditimpa (dicatat sebagai beda), yang hilang di ABT hanya ditandai.
 * Rute /api/pengaturan-sipp-abt?bagian=pustaka dan tindakan "sinkron-pustaka" menjaga peran.
 */

async function panggil<T>(init?: RequestInit, cari = ""): Promise<T> {
  const r = await fetch(apiPath(`/api/pengaturan-sipp-abt${cari}`), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}

const angka = (n: number) => n.toLocaleString("id-ID");
const jam = (iso: string) => {
  const d = new Date(iso);
  return !iso || Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};
const mb = (b: number) => `${(b / 1048576).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
const JENIS: Record<"berkas" | "variabel" | "menu", string> = { berkas: "Blangko", variabel: "Isian", menu: "Hak folder" };

function Kotak({ judul, nilai, rinci }: { judul: string; nilai: string; rinci: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{judul}</div>
      <div className="text-2xl font-semibold text-foreground">{nilai}</div>
      <div className="mt-1 text-xs text-muted-foreground">{rinci}</div>
    </div>
  );
}

function ringkasHitung(h?: HitunganRencana) {
  if (!h) return "-";
  const bagian = [`${angka(h.baru)} baru`, `${angka(h.berubah + h.kembali)} diperbarui`, `${angka(h.sama)} sama`];
  if (h.bentrok) bagian.push(`${angka(h.bentrok)} beda dengan ubahan ALETA`);
  if (h.hilang) bagian.push(`${angka(h.hilang)} tidak ada lagi di ABT`);
  return bagian.join(", ");
}

function BarisRiwayat({ r }: { r: RiwayatSinkron }) {
  const warna = r.status === "berhasil" ? "success" : r.status === "gagal" ? "danger" : "info";
  return (
    <li className="rounded-lg border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={warna}>{r.status === "berhasil" ? "Selesai" : r.status === "gagal" ? "Tidak selesai" : "Berjalan"}</Badge>
        <span className="text-foreground">{jam(r.mulaiAt)}</span>
        {r.server ? <span className="text-muted-foreground">dari {r.server}</span> : null}
        {r.oleh ? <span className="text-muted-foreground">oleh {r.oleh}</span> : null}
      </div>
      {r.status === "berhasil" ? (
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <div>Blangko: {ringkasHitung(r.ringkasan.berkas)}{r.ringkasan.berkas?.gagal ? `, ${angka(r.ringkasan.berkas.gagal)} belum terbaca` : ""}</div>
          <div>Isian: {ringkasHitung(r.ringkasan.variabel)}</div>
          <div>Hak folder: {ringkasHitung(r.ringkasan.menu)}</div>
        </div>
      ) : null}
      {r.status === "gagal" && r.galat ? <div className="mt-1 text-xs text-rose-700 dark:text-rose-300">{r.galat}</div> : null}
    </li>
  );
}

export function BagianPustakaAletaAbt() {
  const [data, setData] = useState<RingkasanPustaka | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "error" | "info"; teks: string } | null>(null);
  const pemantau = useRef<number | null>(null);

  const muat = useCallback(async () => {
    try {
      const d = await panggil<RingkasanPustaka>(undefined, "?bagian=pustaka");
      setData(d);
      return d;
    } catch (e) {
      setPesan({ jenis: "error", teks: (e as Error).message });
      return null;
    }
  }, []);

  // Selama sinkron berjalan, keadaan dibaca ulang tiap 5 detik (berhenti sendiri sesudah selesai).
  useEffect(() => {
    if (!data?.sedangJalan) return;
    pemantau.current = window.setTimeout(() => void muat(), 5000);
    return () => {
      if (pemantau.current) window.clearTimeout(pemantau.current);
    };
  }, [data, muat]);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const sinkron = async () => {
    setSibuk(true);
    setPesan(null);
    try {
      await panggil(
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tindakan: "sinkron-pustaka" }) },
        ""
      );
      setPesan({ jenis: "info", teks: "Penyalinan dari ABT dimulai. Halaman ini memperbarui angkanya sendiri sampai selesai." });
      await muat();
    } catch (e) {
      setPesan({ jenis: "error", teks: (e as Error).message });
    } finally {
      setSibuk(false);
    }
  };

  const kosong = data && !data.berkas.aktif && !data.berkas.hilang && !data.riwayat.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pustaka blangko</CardTitle>
        <CardDescription>
          Salinan Blangko ABT by Derry Briantono (blangko, isian, dan hak folder) yang tersimpan di ALETA sendiri, dengan kode isian ALETA yang tidak
          bergantung pada nomor isian ABT setempat. ABT hanya dibaca. Blangko yang sudah diubah di ALETA tidak pernah ditimpa; yang tidak ada lagi di
          ABT hanya ditandai, tidak dihapus. Blangko Derry di ABT tetap dipakai seperti biasa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void sinkron()} disabled={sibuk || Boolean(data?.sedangJalan)}>
            {data?.sedangJalan ? "Sedang menyalin dari ABT..." : "Sinkron dari ABT"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void muat()} disabled={sibuk}>
            Muat ulang
          </Button>
          {data?.terakhir ? <span className="text-xs text-muted-foreground">Terakhir: {jam(data.terakhir.selesaiAt || data.terakhir.mulaiAt)}</span> : null}
        </div>
        {pesan ? (
          <div
            className={
              pesan.jenis === "error"
                ? "rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                : "rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
            }
          >
            {pesan.teks}
          </div>
        ) : null}
        <JadwalSinkronAbt />
        {kosong ? <p className="text-sm text-muted-foreground">Belum pernah disalin. Tekan Sinkron dari ABT untuk salinan pertama.</p> : null}
        {data && !kosong ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Kotak
              judul="Blangko"
              nilai={angka(data.berkas.aktif)}
              rinci={`${angka(data.berkas.arsip)} arsip, ${mb(data.berkas.ukuranByte)}${data.berkas.hilang ? `, ${angka(data.berkas.hilang)} tidak ada lagi di ABT` : ""}`}
            />
            <Kotak
              judul="Isian blangko"
              nilai={angka(data.variabel.aktif)}
              rinci={`${angka(data.variabel.blangko)} dipakai blangko, ${angka(data.variabel.turunan)} dipakai isian lain${data.variabel.hilang ? `, ${angka(data.variabel.hilang)} tidak dipakai lagi` : ""}`}
            />
            <Kotak judul="Hak folder" nilai={angka(data.menu.aktif)} rinci={data.menu.hilang ? `${angka(data.menu.hilang)} tidak ada lagi di ABT` : "folder Blangko Derry"} />
          </div>
        ) : null}
        {data && data.bentrok.length ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">
              Beda dengan ubahan ALETA ({angka(data.berkas.bentrok + data.variabel.bentrok + data.menu.bentrok)}) - ubahan ALETA dibiarkan, isi ABT tidak disalin
            </div>
            {data.berkas.bentrok ? (
              <p className="text-xs text-muted-foreground">
                {angka(data.berkas.bentrok)} blangko menunggu Anda tinjau.{" "}
                <Link href="/aleta-abt/beda" className="underline">
                  Buka Beda dengan ABT
                </Link>{" "}
                untuk melihat bedanya dan memilih isi yang dipakai.
              </p>
            ) : null}
            <ul className="space-y-1">
              {data.bentrok.map((b) => (
                <li key={`${b.jenis}:${b.kunci}`} className="flex flex-wrap gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <Badge variant="outline">{JENIS[b.jenis]}</Badge>
                  <span className="break-all">{b.nama || b.kunci}</span>
                  <span className="text-amber-700 dark:text-amber-300">{jam(b.pada)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data && data.riwayat.length ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Riwayat penyalinan</div>
            <ul className="space-y-2">
              {data.riwayat.map((r) => (
                <BarisRiwayat key={r.id} r={r} />
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
