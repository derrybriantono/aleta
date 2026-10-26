"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import type { KeadaanPemeliharaan, PengaturanPemeliharaan } from "@/server/modules/pemeliharaan/layanan";

/**
 * Pengaturan Mode pemeliharaan (E3) - hanya Super Admin; rute /api/admin/pemeliharaan
 * menegakkannya. Mati bawaan: tidak ada yang berubah bagi siapa pun sampai
 * tombol "Nyalakan sekarang" ditekan atau jadwal ditetapkan.
 */
type Data = { pengaturan: PengaturanPemeliharaan; keadaan: KeadaanPemeliharaan };

async function ambil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data belum dapat dimuat.");
  return j.data as T;
}

/** ISO UTC -> nilai input datetime-local (waktu setempat peramban). */
function keLokal(iso: string) {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())}T${dua(t.getHours())}:${dua(t.getMinutes())}`;
}

function keIso(lokal: string) {
  if (!lokal) return "";
  const t = new Date(lokal);
  return Number.isNaN(t.getTime()) ? "" : t.toISOString();
}

export function PemeliharaanPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [pesan, setPesan] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [adminBoleh, setAdminBoleh] = useState(false);
  const [kabarWa, setKabarWa] = useState(false);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const isi = (d: Data) => {
    setData(d);
    setPesan(d.pengaturan.pesan);
    setMulai(keLokal(d.pengaturan.mulai));
    setSelesai(keLokal(d.pengaturan.selesai));
    setAdminBoleh(d.pengaturan.adminBoleh);
    setKabarWa(d.pengaturan.kabarWa);
  };

  useEffect(() => {
    let batal = false;
    void ambil<Data>("/api/admin/pemeliharaan")
      .then((d) => {
        if (!batal) isi(d);
      })
      .catch((e) => {
        if (!batal) setGalat(e instanceof Error ? e.message : "Pengaturan belum dapat dimuat.");
      });
    return () => {
      batal = true;
    };
  }, []);

  const simpan = async (aktif: boolean | undefined, ringkasan: string) => {
    setMenyimpan(true);
    setGalat("");
    setInfo("");
    try {
      const d = await ambil<Data>("/api/admin/pemeliharaan", {
        method: "POST",
        body: JSON.stringify({ aktif: aktif ?? data?.pengaturan.aktif ?? false, pesan, mulai: keIso(mulai), selesai: keIso(selesai), adminBoleh, kabarWa }),
      });
      isi(d);
      setInfo(ringkasan);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum dapat disimpan.");
    } finally {
      setMenyimpan(false);
    }
  };

  const aktif = data?.keadaan.aktif ?? false;

  return (
    <div className="space-y-6" data-pemeliharaan-panel>
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            <Wrench className="h-5 w-5 text-amber-600" aria-hidden />
            {aktif ? "Mode pemeliharaan AKTIF" : "Mode pemeliharaan mati"}
            <Badge variant={aktif ? "warning" : "muted"}>{aktif ? (data?.keadaan.sebab === "jadwal" ? "Menurut jadwal" : "Dinyalakan tangan") : "Mati"}</Badge>
          </CardTitle>
          <CardDescription>
            Saat aktif, pengguna biasa melihat layar pemeliharaan dan tidak dapat menyimpan perubahan. Anda (Super Admin) tetap bekerja seperti biasa. Layar antrean dan jadwal
            publik tidak terpengaruh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="pesan-pemeliharaan" className="text-sm font-medium text-foreground">
              Pesan untuk pengguna
            </label>
            <textarea
              id="pesan-pemeliharaan"
              value={pesan}
              maxLength={400}
              rows={3}
              onChange={(e) => setPesan(e.target.value)}
              placeholder="ALETA sedang dalam pemeliharaan. Mohon simpan pekerjaan Anda dan coba lagi sebentar lagi."
              className="mt-1 w-full rounded-xl border border-input/90 bg-card/70 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mulai-pemeliharaan" className="text-sm font-medium text-foreground">
                Jadwal mulai (opsional)
              </label>
              <Input id="mulai-pemeliharaan" type="datetime-local" value={mulai} onChange={(e) => setMulai(e.target.value)} />
            </div>
            <div>
              <label htmlFor="selesai-pemeliharaan" className="text-sm font-medium text-foreground">
                Jadwal selesai (opsional)
              </label>
              <Input id="selesai-pemeliharaan" type="datetime-local" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Jadwal berjalan sendiri: aktif dari waktu mulai sampai waktu selesai (paling lama 72 jam). Pengguna melihat pita pemberitahuan sejak 60 menit sebelum mulai.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={adminBoleh} onChange={(e) => setAdminBoleh(e.target.checked)} className="mt-1 h-4 w-4" />
            <span>
              <span className="font-medium text-foreground">Admin tetap boleh masuk dan menyimpan</span>
              <span className="block text-muted-foreground">Bila tidak dicentang, hanya Super Admin yang dikecualikan.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={kabarWa} onChange={(e) => setKabarWa(e.target.checked)} className="mt-1 h-4 w-4" />
            <span>
              <span className="font-medium text-foreground">Kabari admin lewat WhatsApp 15 menit sebelum mulai</span>
              <span className="block text-muted-foreground">Satu pesan per jadwal. Tidak terkirim bila bot/WhatsApp sedang mati.</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button disabled={menyimpan} onClick={() => void simpan(undefined, "Jadwal dan pesan disimpan.")}>
              {menyimpan && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Simpan jadwal dan pesan
            </Button>
            {aktif && data?.pengaturan.aktif !== false ? (
              <Button variant="outline" disabled={menyimpan} onClick={() => void simpan(false, "Mode pemeliharaan dimatikan. Layar pengguna terbuka sendiri.")}>
                Matikan sekarang
              </Button>
            ) : (
              <Button variant="outline" disabled={menyimpan} onClick={() => void simpan(true, "Mode pemeliharaan menyala sekarang.")}>
                Nyalakan sekarang
              </Button>
            )}
          </div>
          {info && <p className="text-sm text-muted-foreground">{info}</p>}
          {data && (
            <p className="text-xs text-muted-foreground">
              Terakhir diubah: {data.pengaturan.diubahOleh || "belum pernah"}
              {data.pengaturan.diubahPada ? `, ${new Date(data.pengaturan.diubahPada).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" })} WITA` : ""}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
