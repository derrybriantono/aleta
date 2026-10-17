"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { NAMA_BAWAAN_ADVANCE } from "@/lib/putusan-advance-akun";

/**
 * Pengaturan SIPP & ABT > Putusan Advance (17 Okt 2026): akun yang boleh
 * memakai Putusan Advance. Bawaan hanya Derry Briantono; akun lain tetap
 * memakai ABT. Rute /api/pengaturan-sipp-abt menjaga peran (Super Admin/Admin).
 */

type Calon = { id: string; nama: string; peran: string; menyala: boolean };
type Layar = { tersimpan: boolean; pengaturan: { akun: string[]; diubahOleh: string; diubahPada: string } | null; calon: Calon[] };

const NAMA_PERAN: Record<string, string> = {
  hakim: "Hakim",
  ketua: "Ketua",
  "wakil-ketua": "Wakil Ketua",
  "panitera-pengganti": "Panitera Pengganti",
  panitera: "Panitera",
  "panitera-muda": "Panitera Muda",
  "super-admin": "Super Admin",
  admin: "Admin",
};

async function panggil<T>(init?: RequestInit, cari = ""): Promise<T> {
  const r = await fetch(apiPath(`/api/pengaturan-sipp-abt${cari}`), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}

export function BagianPutusanAdvance() {
  const [layar, setLayar] = useState<Layar | null>(null);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "galat" | "berhasil"; teks: string } | null>(null);

  const terima = useCallback((d: Layar) => {
    setLayar(d);
    setPilih(new Set(d.calon.filter((c) => c.menyala).map((c) => c.id)));
  }, []);

  useEffect(() => {
    let batal = false;
    panggil<Layar>(undefined, "?bagian=putusan-advance")
      .then((d) => {
        if (!batal) terima(d);
      })
      .catch((e: Error) => {
        if (!batal) setPesan({ jenis: "galat", teks: e.message });
      });
    return () => {
      batal = true;
    };
  }, [terima]);

  const asal = useMemo(() => new Set((layar?.calon ?? []).filter((c) => c.menyala).map((c) => c.id)), [layar]);
  const berubah = useMemo(() => asal.size !== pilih.size || [...pilih].some((id) => !asal.has(id)), [asal, pilih]);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (layar?.calon ?? []).filter((c) => !q || c.nama.toLowerCase().includes(q));
  }, [layar, cari]);

  const simpan = async () => {
    setSibuk(true);
    setPesan(null);
    try {
      const d = await panggil<Layar>({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tindakan: "simpan-putusan-advance", akun: [...pilih] }),
      });
      terima(d);
      setPesan({ jenis: "berhasil", teks: "Tersimpan. Berlaku segera untuk rute dan alat ekstensi (sesudah halaman ABT dimuat ulang)." });
    } catch (e) {
      setPesan({ jenis: "galat", teks: (e as Error).message });
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Siapa yang boleh memakai Putusan Advance</CardTitle>
        <CardDescription>
          Akun yang dimatikan tetap memakai ABT seperti biasa dan tidak melihat alat Putusan Advance. Hak lama tetap berlaku: hanya hakim dan konseptor
          perkara itu yang dapat memeriksa drafnya.
          {layar && !layar.tersimpan ? ` Belum pernah diatur - bawaannya hanya ${NAMA_BAWAAN_ADVANCE}.` : ""}
          {layar?.pengaturan?.diubahOleh ? ` Terakhir diubah ${layar.pengaturan.diubahOleh}.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pesan ? (
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              pesan.jenis === "galat"
                ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
            }`}
          >
            {pesan.teks}
          </div>
        ) : null}
        <Input aria-label="Cari akun" placeholder="Cari nama akun..." value={cari} onChange={(e) => setCari(e.target.value)} />
        {!layar ? <p className="text-sm text-muted-foreground">Memuat daftar akun...</p> : null}
        {layar && !tampil.length ? <p className="text-sm text-muted-foreground">Tidak ada akun yang cocok.</p> : null}
        <div className="divide-y rounded-xl border">
          {tampil.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{c.nama}</p>
                <p className="text-xs text-muted-foreground">{NAMA_PERAN[c.peran] ?? c.peran}</p>
              </div>
              <Switch
                aria-label={`Putusan Advance untuk ${c.nama}`}
                checked={pilih.has(c.id)}
                disabled={sibuk}
                onCheckedChange={(v) =>
                  setPilih((lama) => {
                    const baru = new Set(lama);
                    if (v) baru.add(c.id);
                    else baru.delete(c.id);
                    return baru;
                  })
                }
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!berubah || sibuk || !layar} onClick={() => void simpan()}>
            {sibuk ? "Menyimpan..." : "Simpan"}
          </Button>
          <span className="text-xs text-muted-foreground">{pilih.size} akun menyala</span>
        </div>
      </CardContent>
    </Card>
  );
}
