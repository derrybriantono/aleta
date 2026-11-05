"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { JAM_KERJA_MULAI, JAM_KERJA_SELESAI, type RingkasBeda, type SetelanSinkronAbt } from "@/lib/aleta-abt-sinkron";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Dua potongan layar kecil Tahap 9 (Super Admin saja; rutenya /api/aleta-abt/sinkron menjaga peran di server):
 *   - KartuBedaAbt: kartu di halaman ALETA ABT dengan jumlah blangko yang menunggu ditinjau, supaya tidak menumpuk tanpa terbaca;
 *   - JadwalSinkronAbt: saklar sinkron terjadwal di Pustaka blangko (bawaan mati; jam malam; jam kerja sidang hanya dengan izin).
 */

async function panggil<T>(cari: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(`/api/aleta-abt/sinkron${cari}`), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}

export function KartuBedaAbt() {
  const [data, setData] = useState<RingkasBeda | null>(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    let batal = false;
    panggil<RingkasBeda>("")
      .then((d) => {
        if (!batal) setData(d);
      })
      .catch((e: Error) => {
        if (!batal) setGalat(e.message);
      });
    return () => {
      batal = true;
    };
  }, []);

  const menunggu = data?.menunggu ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Beda dengan ABT</CardTitle>
        <CardDescription>
          Blangko yang berubah di ABT sedangkan ALETA ABT sudah mengubahnya. Pilih isi mana yang dipakai, dan kirim ubahan kembali ke ABT sebagai paket yang
          ditinjau lebih dulu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {galat ? <p className="text-sm text-rose-700 dark:text-rose-300">{galat}</p> : null}
        {data ? (
          <p className={`text-sm ${menunggu ? "font-medium text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}>
            {menunggu
              ? `${menunggu.toLocaleString("id-ID")} blangko menunggu Anda tinjau${data.tertuaHari >= 7 ? `, yang terlama sudah ${data.tertuaHari} hari` : ""}.`
              : "Tidak ada blangko yang menunggu ditinjau."}
          </p>
        ) : null}
        <Button asChild className="w-full sm:w-auto">
          <Link href="/aleta-abt/beda">Buka Beda dengan ABT</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function JadwalSinkronAbt() {
  const [s, setS] = useState<SetelanSinkronAbt | null>(null);
  const [jam, setJam] = useState("23:00");
  const [pesan, setPesan] = useState<{ jenis: "error" | "info"; teks: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    try {
      const d = await panggil<SetelanSinkronAbt>("?bagian=setelan");
      setS(d);
      setJam(d.jam);
    } catch (e) {
      setPesan({ jenis: "error", teks: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const simpan = async (ubah: Partial<Pick<SetelanSinkronAbt, "jadwal" | "jam" | "izinJamKerja">>) => {
    setSibuk(true);
    setPesan(null);
    try {
      const d = await panggil<SetelanSinkronAbt>("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tindakan: "setelan", ...ubah }) });
      setS(d);
      setJam(d.jam);
      setPesan({ jenis: "info", teks: d.jadwal ? `Sinkron otomatis menyala: sekali sehari sesudah ${d.jam} WITA.` : "Sinkron otomatis dimatikan." });
    } catch (e) {
      setPesan({ jenis: "error", teks: (e as Error).message });
    } finally {
      setSibuk(false);
    }
  };

  if (!s) return pesan ? <p className="text-sm text-rose-700 dark:text-rose-300">{pesan.teks}</p> : null;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Sinkron otomatis dari ABT</p>
          <p className="text-xs text-muted-foreground">
            {s.jadwal ? `Menyala: sekali sehari sesudah ${s.jam} WITA.` : "Mati. Sinkron hanya berjalan bila tombol di atas ditekan."} ABT hanya dibaca; ubahan di ALETA ABT tidak pernah ditimpa.
          </p>
        </div>
        <Button size="sm" variant={s.jadwal ? "outline" : "default"} onClick={() => void simpan({ jadwal: !s.jadwal })} disabled={sibuk}>
          {s.jadwal ? "Matikan" : "Nyalakan"}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Jam mulai (WITA)
          <Input type="time" value={jam} onChange={(e) => setJam(e.target.value)} className="h-9 w-32" />
        </label>
        <Button size="sm" variant="outline" onClick={() => void simpan({ jam })} disabled={sibuk || jam === s.jam}>
          Simpan jam
        </Button>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="mt-0.5" checked={s.izinJamKerja} onChange={(e) => void simpan({ izinJamKerja: e.target.checked })} disabled={sibuk} />
        <span>
          Boleh berjalan pada jam kerja sidang ({JAM_KERJA_MULAI.replace(":", ".")}-{JAM_KERJA_SELESAI.replace(":", ".")} WITA). Bawaan tidak, supaya sidang tidak terganggu.
        </span>
      </label>
      {pesan ? (
        <p className={`text-xs ${pesan.jenis === "error" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>{pesan.teks}</p>
      ) : null}
    </div>
  );
}
