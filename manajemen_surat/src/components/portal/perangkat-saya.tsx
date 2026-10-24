"use client";

import { useCallback, useEffect, useState } from "react";
import { LaptopMinimal, LoaderCircle, LogOut, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { labelJalur, labelPeristiwa, peristiwaGagal, teksMac, waktuWita } from "@/lib/jejak-masuk-tampilan";

/**
 * "Perangkat yang sedang masuk" di halaman Akun (23 Okt 2026): perangkat MILIK
 * SENDIRI dan 50 peristiwa masuk terakhir. Rute /api/portal/perangkat hanya
 * pernah memulangkan data akun pemanggil.
 */

type SesiAktif = { perangkatId: string; nama: string; terakhirAktif: string; ip: string; jumlahSesi: number; jalur: string; ini: boolean };
type Perangkat = { perangkat_id: string; nama_terbaca: string; label: string; nama_komputer: string; mac: string; mac_sumber: string; mac_catatan: string; pertama_dilihat: string; terakhir_dilihat: string; ini: boolean };
type Riwayat = { id: string; waktu: string; peristiwa: string; alasan: string; jalur: string; ip: string; peramban: string; os: string };
type Data = { sesiAktif: SesiAktif[]; perangkat: Perangkat[]; riwayat: Riwayat[] };

export function PerangkatSaya() {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    try {
      const r = await fetch(apiPath("/api/portal/perangkat"), { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: Data; error?: { message?: string } } | null;
      if (!r.ok || !j?.ok || !j.data) throw new Error(j?.error?.message ?? "Daftar perangkat belum dapat dimuat.");
      setData(j.data);
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Daftar perangkat belum dapat dimuat.");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const kirim = async (url: string, method: string, badan: unknown) => {
    setSibuk(true);
    try {
      const r = await fetch(apiPath(url), { method, credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Permintaan gagal.");
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Permintaan gagal.");
    } finally {
      setSibuk(false);
    }
  };

  const lain = (data?.sesiAktif ?? []).filter((s) => !s.ini);

  return (
    <Card className="bg-card" data-perangkat-saya>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LaptopMinimal className="h-5 w-5 text-primary" /> Perangkat yang sedang masuk
        </CardTitle>
        <CardDescription>
          Satu peramban dihitung satu perangkat. Keluarkan perangkat yang tidak Anda kenali, lalu ganti password Anda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {galat && <p className="text-sm text-destructive">{galat}</p>}
        {!data && !galat && <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />}
        {(data?.sesiAktif ?? []).map((s) => (
          <div key={s.perangkatId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 p-3" data-sesi-perangkat={s.perangkatId}>
            <div className="text-sm">
              <div className="font-medium text-foreground">
                {s.nama} {s.ini && <Badge className="ml-1">Perangkat ini</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                Terakhir aktif {waktuWita(s.terakhirAktif)} · {s.ip || "alamat tidak terbaca"} · {labelJalur(s.jalur)}
              </div>
            </div>
            {!s.ini && (
              <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim("/api/portal/perangkat/cabut", "POST", { perangkatId: s.perangkatId })}>
                <LogOut className="h-4 w-4" /> Keluarkan
              </Button>
            )}
          </div>
        ))}
        {lain.length > 0 && (
          <Button
            variant="outline"
            disabled={sibuk}
            onClick={() => {
              if (window.confirm("Keluarkan semua perangkat lain? Perangkat ini tetap masuk.")) void kirim("/api/portal/perangkat/cabut", "POST", { semuaKecualiIni: true });
            }}
          >
            Keluarkan semua kecuali perangkat ini
          </Button>
        )}

        {data && data.perangkat.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-foreground">Semua perangkat yang pernah dipakai ({data.perangkat.length})</summary>
            <ul className="mt-2 space-y-2">
              {data.perangkat.map((p) => (
                <li key={p.perangkat_id} className="rounded-lg border border-border/60 p-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.label || p.nama_terbaca}</span>
                    {p.ini && <Badge variant="outline">ini</Badge>}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Beri nama perangkat"
                      onClick={() => {
                        const label = window.prompt("Nama perangkat (mis. Laptop rumah)", p.label || "");
                        if (label !== null) void kirim("/api/portal/perangkat", "PATCH", { perangkatId: p.perangkat_id, label });
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.nama_komputer ? `${p.nama_komputer} · ` : ""}MAC {teksMac(p.mac, p.mac_sumber, p.mac_catatan)} · pertama {waktuWita(p.pertama_dilihat)} · terakhir {waktuWita(p.terakhir_dilihat)}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}

        {data && data.riwayat.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-foreground">Riwayat masuk akun ini</summary>
            <ul className="mt-2 space-y-1">
              {data.riwayat.map((b) => (
                <li key={b.id} className="flex flex-wrap gap-2 text-xs">
                  <span className="text-muted-foreground">{waktuWita(b.waktu)}</span>
                  <Badge variant={peristiwaGagal(b.peristiwa) ? "danger" : "outline"}>{labelPeristiwa(b.peristiwa)}</Badge>
                  {b.alasan && <span>{b.alasan}</span>}
                  <span className="text-muted-foreground">{[b.ip, b.peramban, b.os].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
