"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import type { PenjelasanMenu } from "@/lib/lihat-sebagai";
import type { HasilLihat } from "@/server/modules/lihat-sebagai/layanan";

/**
 * Lihat sebagai akun/peran (E4) - hanya Super Admin; rute /api/admin/lihat-sebagai
 * menegakkannya. Pratinjau baca-saja: menu apa yang tampil dan KENAPA.
 */
type Pilihan = { akun: Array<{ id: string; nama: string; roleId: string }>; peran: Array<{ id: string; nama: string }>; berjalan: HasilLihat | null };

async function ambil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data belum dapat dimuat.");
  return j.data as T;
}

function BarisMenu({ m }: { m: PenjelasanMenu }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-start sm:gap-3" data-menu={m.appId} data-tampil={m.tampil ? "ya" : "tidak"}>
      <div className="flex shrink-0 items-center gap-2 sm:w-56">
        <Badge variant={m.tampil ? "success" : "muted"}>{m.tampil ? "Tampil" : "Tersembunyi"}</Badge>
        <span className="text-sm font-medium text-foreground">{m.nama}</span>
      </div>
      <p className="text-sm text-muted-foreground">{m.penjelasan}</p>
    </li>
  );
}

export function LihatSebagaiPanel() {
  const [pilihan, setPilihan] = useState<Pilihan | null>(null);
  const [hasil, setHasil] = useState<HasilLihat | null>(null);
  const [jenis, setJenis] = useState<"akun" | "peran">("akun");
  const [target, setTarget] = useState("");
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [hanyaTersembunyi, setHanyaTersembunyi] = useState(false);

  const muat = useCallback(async () => {
    try {
      const d = await ambil<Pilihan>("/api/admin/lihat-sebagai");
      setPilihan(d);
      setHasil(d.berjalan);
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pilihan belum dapat dimuat.");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const mulai = async () => {
    setSibuk(true);
    setGalat("");
    try {
      const d = await ambil<{ berjalan: HasilLihat }>("/api/admin/lihat-sebagai", {
        method: "POST",
        body: JSON.stringify(jenis === "akun" ? { userId: target, alasan } : { roleId: target, alasan }),
      });
      setHasil(d.berjalan);
      setAlasan("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum dapat dimulai.");
    } finally {
      setSibuk(false);
    }
  };

  const akhiri = async () => {
    setSibuk(true);
    try {
      await ambil("/api/admin/lihat-sebagai", { method: "DELETE" });
      setHasil(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum dapat diakhiri.");
    } finally {
      setSibuk(false);
    }
  };

  const daftar = hasil ? hasil.menu.filter((m) => !hanyaTersembunyi || !m.tampil) : [];
  const tampil = hasil?.menu.filter((m) => m.tampil).length ?? 0;

  return (
    <div className="space-y-6" data-lihat-sebagai-panel>
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}

      {hasil && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/70 bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/80 dark:text-amber-200"
          role="status"
          data-pita-lihat-sebagai
        >
          <Eye className="h-4 w-4" aria-hidden />
          <span className="flex-1">
            Melihat sebagai {hasil.sesi.jenis === "akun" ? "akun" : "peran"} <strong>{hasil.sesi.nama}</strong> (baca-saja), sisa {hasil.sisaMenit} menit. Alasan: {hasil.sesi.alasan}
          </span>
          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void akhiri()}>
            Akhiri
          </Button>
        </div>
      )}

      {!hasil && (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              <Eye className="h-5 w-5 text-primary" aria-hidden />
              Lihat sebagai
            </CardTitle>
            <CardDescription>
              Periksa menu apa yang tampil bagi sebuah akun atau peran, dan kenapa menu lain tersembunyi. Pratinjau baca-saja: tidak membuka sesi orang lain. Alasan wajib, berlaku 30
              menit, tercatat di audit, dan pemilik akun dapat melihat catatannya di halaman Akun.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="jenis-lihat" className="text-sm font-medium text-foreground">
                  Lihat sebagai
                </label>
                <NativeSelect
                  id="jenis-lihat"
                  value={jenis}
                  onChange={(e) => {
                    setJenis(e.target.value as "akun" | "peran");
                    setTarget("");
                  }}
                >
                  <option value="akun">Akun tertentu</option>
                  <option value="peran">Peran (tanpa jabatan khusus)</option>
                </NativeSelect>
              </div>
              <div>
                <label htmlFor="target-lihat" className="text-sm font-medium text-foreground">
                  {jenis === "akun" ? "Akun" : "Peran"}
                </label>
                <NativeSelect id="target-lihat" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Pilih...</option>
                  {jenis === "akun"
                    ? pilihan?.akun.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nama} ({a.roleId})
                        </option>
                      ))
                    : pilihan?.peran.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama}
                        </option>
                      ))}
                </NativeSelect>
              </div>
            </div>
            <div>
              <label htmlFor="alasan-lihat" className="text-sm font-medium text-foreground">
                Alasan (wajib, paling sedikit 10 huruf)
              </label>
              <textarea
                id="alasan-lihat"
                value={alasan}
                maxLength={300}
                rows={2}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Contoh: hakim melaporkan menu Jadwal Sidang tidak muncul."
                className="mt-1 w-full rounded-xl border border-input/90 bg-card/70 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              />
            </div>
            <Button disabled={sibuk || !target || alasan.trim().length < 10} onClick={() => void mulai()}>
              {sibuk && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Mulai melihat
            </Button>
          </CardContent>
        </Card>
      )}

      {hasil && (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-base">Menu yang dilihat {hasil.sesi.nama}</CardTitle>
            <CardDescription>
              Golongan: {hasil.golongan.join(", ") || "tidak ada"}. {tampil} dari {hasil.menu.length} aplikasi tampil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hanyaTersembunyi} onChange={(e) => setHanyaTersembunyi(e.target.checked)} className="h-4 w-4" />
              Tampilkan hanya yang tersembunyi
            </label>
            <ul className="space-y-2">
              {daftar.map((m) => (
                <BarisMenu key={m.appId} m={m} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
