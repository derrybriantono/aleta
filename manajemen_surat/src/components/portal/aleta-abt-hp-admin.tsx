"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PilihanPengguna, SumberHakAbtHp } from "@/lib/aleta-abt-hp";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Pengaturan SIPP & ABT > ALETA ABT di HP (5 Nov 2026) - Super Admin saja.
 * Siapa kelak boleh membuka ALETA ABT dari HP: per peran dan per pengguna. Layar ALETA ABT untuk HP belum ada,
 * jadi pengaturan ini baru menentukan hak. Rute /api/aleta-abt/hak menjaga peran dan mencatat tiap ubahan.
 */

type BarisPeran = { id: string; nama: string; menyala: boolean; sumber: SumberHakAbtHp };
type BarisPengguna = { id: string; nama: string; peran: string; pilihan: PilihanPengguna; terbuka: boolean };
type Layar = { peran: BarisPeran[]; pengguna: BarisPengguna[]; diubahOleh: string; diubahPada: string };

async function panggil<T>(init?: RequestInit, cari = ""): Promise<T> {
  const r = await fetch(apiPath(`/api/aleta-abt/hak${cari}`), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}

const kirim = (badan: Record<string, unknown>) =>
  panggil<Layar>({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

const PILIHAN: Array<[PilihanPengguna, string]> = [
  ["ikuti", "Ikuti peran"],
  ["aktif", "Aktif"],
  ["mati", "Mati"],
];

const sumberTeks = (s: SumberHakAbtHp) => (s === "bawaan" ? "Bawaan" : "Diatur");

export function BagianAletaAbtHp() {
  const [layar, setLayar] = useState<Layar | null>(null);
  const [cari, setCari] = useState("");
  const [hasil, setHasil] = useState<BarisPengguna[] | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "galat" | "berhasil"; teks: string } | null>(null);
  const nomorCari = useRef(0);

  const muatPencarian = useCallback(async (kata: string) => {
    const nomor = ++nomorCari.current;
    try {
      const d = await panggil<Layar>(undefined, `?bagian=pengaturan&cari=${encodeURIComponent(kata)}`);
      if (nomor !== nomorCari.current) return;
      setHasil(d.pengguna);
      setLayar(d);
    } catch (e) {
      if (nomor === nomorCari.current) setPesan({ jenis: "galat", teks: (e as Error).message });
    }
  }, []);

  // Pencarian menunggu pengguna berhenti mengetik; satu huruf tidak mencari (daftar pilihan sendiri tetap tampil).
  useEffect(() => {
    const kata = cari.trim();
    const t = window.setTimeout(() => void muatPencarian(kata.length === 1 ? "" : kata), kata ? 350 : 0);
    return () => window.clearTimeout(t);
  }, [cari, muatPencarian]);

  const ubah = async (badan: Record<string, unknown>, teks: string) => {
    setSibuk(true);
    setPesan(null);
    try {
      await kirim(badan);
      const kata = cari.trim();
      await muatPencarian(kata.length === 1 ? "" : kata);
      setPesan({ jenis: "berhasil", teks });
    } catch (e) {
      setPesan({ jenis: "galat", teks: (e as Error).message });
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ALETA ABT di HP</CardTitle>
        <CardDescription>
          Menentukan siapa yang kelak boleh membuka ALETA ABT dari HP. Layar ALETA ABT untuk HP masih dibangun, jadi saklar ini baru mengatur hak dan
          belum membuat fiturnya dapat dipakai di HP. Bawaannya hanya Super Admin yang menyala. Pilihan per pengguna menang atas pilihan peran.
          {layar?.diubahOleh ? ` Terakhir diubah ${layar.diubahOleh}.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {pesan ? (
          <div
            role={pesan.jenis === "galat" ? "alert" : "status"}
            className={`rounded-xl border px-3 py-2 text-sm ${
              pesan.jenis === "galat"
                ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
            }`}
          >
            {pesan.teks}
          </div>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Per peran</h3>
          {!layar ? <p className="text-sm text-muted-foreground">Memuat daftar peran...</p> : null}
          <div className="divide-y rounded-xl border empty:hidden">
            {(layar?.peran ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{p.nama}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.menyala ? "Menyala" : "Mati"} - {sumberTeks(p.sumber)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.sumber === "peran" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={sibuk}
                      onClick={() => void ubah({ tindakan: "ubah-peran", id: p.id, nilai: "bawaan" }, `${p.nama} kembali ke bawaan.`)}
                    >
                      Bawaan
                    </Button>
                  ) : null}
                  <Switch
                    aria-label={`ALETA ABT di HP untuk peran ${p.nama}`}
                    checked={p.menyala}
                    disabled={sibuk}
                    onCheckedChange={(v) =>
                      void ubah({ tindakan: "ubah-peran", id: p.id, nilai: v }, `${p.nama}: ALETA ABT di HP ${v ? "dinyalakan" : "dimatikan"}.`)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Per pengguna</h3>
          <Input aria-label="Cari pengguna" placeholder="Cari nama atau akun (minimal dua huruf)..." value={cari} onChange={(e) => setCari(e.target.value)} />
          {hasil && !hasil.length ? (
            <p className="text-sm text-muted-foreground">
              {cari.trim().length >= 2 ? "Tidak ada pengguna yang cocok." : "Belum ada pengguna dengan pilihan sendiri. Cari nama untuk mengaturnya."}
            </p>
          ) : null}
          <div className="divide-y rounded-xl border empty:hidden">
            {(hasil ?? []).map((u) => (
              <div key={u.id} className="space-y-2 px-3 py-2">
                <div>
                  <p className="break-words text-sm font-medium">{u.nama}</p>
                  <p className="text-xs text-muted-foreground">
                    {layar?.peran.find((p) => p.id === u.peran)?.nama ?? u.peran} - saat ini {u.terbuka ? "menyala" : "mati"}
                  </p>
                </div>
                <div role="group" aria-label={`Pilihan untuk ${u.nama}`} className="flex flex-wrap gap-2">
                  {PILIHAN.map(([nilai, label]) => (
                    <Button
                      key={nilai}
                      size="sm"
                      variant={u.pilihan === nilai ? "default" : "outline"}
                      aria-pressed={u.pilihan === nilai}
                      disabled={sibuk || u.pilihan === nilai}
                      onClick={() => void ubah({ tindakan: "ubah-pengguna", id: u.id, nilai }, `${u.nama}: pilihan menjadi ${label.toLowerCase()}.`)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
