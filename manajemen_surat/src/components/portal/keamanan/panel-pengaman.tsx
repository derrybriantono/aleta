"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ambilKeamanan } from "@/lib/keamanan-klien";

/**
 * Pengaman aksi admin (Bagian 6c) - saklar MATI bawaan. Bila menyala, aksi
 * berdampak besar meminta sandi ulang dan kata konfirmasi (kotak konfirmasinya
 * muncul sendiri di layar mana pun; lihat pengaman-aksi-global.tsx).
 */

type Aksi = { kode: string; label: string; kataKonfirmasi: string; keterangan: string; tersambung: boolean };
type Pengaman = { aktif: boolean; aksi: Record<string, boolean>; batasHapus: number; langkahKedua: boolean };
type Muatan = { pengaman: Pengaman; katalog: Aksi[]; langkahKeduaTersedia: boolean };

export function PanelPengaman({ bolehUbah }: { bolehUbah: boolean }) {
  const [data, setData] = useState<Muatan | null>(null);
  const [isi, setIsi] = useState<Pengaman | null>(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    try {
      const d = await ambilKeamanan<Muatan>("/api/admin/keamanan/pengaman");
      setData(d);
      setIsi(d.pengaman);
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pengaman aksi belum dapat dimuat.");
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const simpan = async () => {
    if (!isi) return;
    setSibuk(true);
    setInfo("");
    try {
      const d = await ambilKeamanan<Muatan>("/api/admin/keamanan/pengaman", {
        method: "POST",
        body: JSON.stringify({ aktif: isi.aktif, aksi: isi.aksi, batasHapus: Number(isi.batasHapus), langkahKedua: isi.langkahKedua }),
      });
      setData(d);
      setIsi(d.pengaman);
      setGalat("");
      setInfo("Tersimpan.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pengaman aksi tidak tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  if (!data || !isi) {
    return galat ? (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat pengaman aksi...
      </p>
    );
  }

  return (
    <div className="space-y-6" data-panel="pengaman-aksi">
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" /> Pengaman aksi admin
            <Badge variant={isi.aktif ? "success" : "outline"}>{isi.aktif ? "Menyala" : "Mati"}</Badge>
          </CardTitle>
          <CardDescription>
            Bila menyala, aksi berdampak besar di bawah meminta sandi Anda sekali lagi dan kata konfirmasi yang diketik. Setiap permintaan, kegagalan, dan keberhasilan tercatat
            di Audit Trail (tanpa sandi). Selama mati, semua aksi berjalan seperti biasa.
            {!bolehUbah && " Hanya Super Admin yang dapat mengubahnya."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
            <span>
              <span className="block text-sm font-medium text-foreground">Nyalakan pengaman aksi admin</span>
              <span className="block text-xs text-muted-foreground">Bawaan mati. Mematikannya kembali pun meminta konfirmasi bila pengaman sedang menyala.</span>
            </span>
            <Switch checked={isi.aktif} onCheckedChange={(v) => setIsi({ ...isi, aktif: v })} disabled={!bolehUbah} aria-label="Nyalakan pengaman aksi admin" />
          </label>

          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-2">Aksi</th>
                <th className="p-2">Kata konfirmasi</th>
                <th className="p-2">Dijaga</th>
              </tr>
            </thead>
            <tbody>
              {data.katalog.map((a) => (
                <tr key={a.kode} className="border-t border-border/60 align-top">
                  <td className="p-2">
                    <span className="block font-medium text-foreground">{a.label}</span>
                    <span className="block text-xs text-muted-foreground">{a.keterangan}</span>
                    {!a.tersambung && <Badge variant="muted">Menunggu fitur terkait</Badge>}
                  </td>
                  <td className="p-2 font-mono text-xs">{a.kataKonfirmasi}</td>
                  <td className="p-2">
                    <Switch
                      checked={isi.aksi[a.kode] !== false}
                      onCheckedChange={(v) => setIsi({ ...isi, aksi: { ...isi.aksi, [a.kode]: v } })}
                      disabled={!bolehUbah}
                      aria-label={`Jaga aksi: ${a.label}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Hapus massal: lebih dari berapa</span>
              <Input type="number" min={1} max={100000} value={isi.batasHapus} onChange={(e) => setIsi({ ...isi, batasHapus: Number(e.target.value) })} disabled={!bolehUbah} />
              <span className="block text-xs text-muted-foreground">Bawaan 20 baris.</span>
            </label>
            <label className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
              <span>
                <span className="block text-sm font-medium text-foreground">Minta juga kode langkah kedua</span>
                <span className="block text-xs text-muted-foreground">
                  {data.langkahKeduaTersedia
                    ? "Kode WhatsApp atau aplikasi authenticator bagi yang sudah memakainya."
                    : "Tersedia begitu verifikasi dua langkah (OTP) terpasang."}
                </span>
              </span>
              <Switch
                checked={isi.langkahKedua}
                onCheckedChange={(v) => setIsi({ ...isi, langkahKedua: v })}
                disabled={!bolehUbah || !data.langkahKeduaTersedia}
                aria-label="Minta juga kode langkah kedua"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void simpan()} disabled={!bolehUbah || sibuk}>
              {sibuk ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan pengaman aksi
            </Button>
            {info && <span className="text-sm text-muted-foreground">{info}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
