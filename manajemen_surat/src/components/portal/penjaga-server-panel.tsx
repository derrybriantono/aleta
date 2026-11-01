"use client";

import { BellRing, Loader2, Moon, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { jamWita, lamaTeks, type PengaturanPenjaga } from "@/lib/penjaga-server";
import { cn } from "@/lib/utils";

/**
 * Admin > Kapasitas penyimpanan > Penjaga server (1 November 2026).
 *
 * Super Admin mengatur; Admin hanya membaca (server menegakkannya). Dimuat SEKALI saat dibuka dan lewat tombol
 * "Muat ulang" - tanpa pemuatan berkala, supaya layar ringan. Nomor WhatsApp tidak pernah dikirim ke layar.
 */

type Kejadian = {
  id: string;
  kunci: string;
  tingkat: "peringatan" | "merah";
  judul: string;
  uraian: string;
  mulaiAt: string;
  pulihAt: string;
  kabarAt: string;
  jumlahKabar: number;
  catatan: string;
};

type Data = {
  pengaturan: PengaturanPenjaga;
  sedangJamTenang: boolean;
  berlangsung: Kejadian[];
  riwayat: Kejadian[];
  calonPenerima: Array<{ id: string; nama: string; adaNomor: boolean }>;
  pemantauServer: { dibuat: string; intervalMenit: number } | null;
  bolehAtur: boolean;
  periksa?: { temuan: number; dikirim: number; tanpaPenerima: boolean } | null;
};

type KunciAngka =
  | "ulangMerahJam"
  | "ulangPeringatanJam"
  | "inodeKuning"
  | "inodeMerah"
  | "cadanganPeringatanJam"
  | "cadanganMerahJam"
  | "cadanganUkuranMinPersen"
  | "sertifikatPeringatanHari"
  | "sertifikatMerahHari";

async function ambil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data penjaga server belum dapat dimuat.");
  return j.data as T;
}

function tanggal(iso: string) {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "-" : t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function BarisKejadian({ k }: { k: Kejadian }) {
  const merah = k.tingkat === "merah";
  return (
    <li className={cn("rounded-lg border p-3 text-sm", merah ? "border-rose-500/50 bg-rose-500/10" : "border-amber-500/50 bg-amber-500/10")} data-kunci={k.kunci}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{k.judul}</span>
        <Badge variant="outline">{merah ? "Perlu ditangani" : "Pemberitahuan"}</Badge>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{k.uraian}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Sejak {tanggal(k.mulaiAt)}
        {k.pulihAt ? `, pulih ${tanggal(k.pulihAt)} (berlangsung ${lamaTeks(k.mulaiAt, k.pulihAt)})` : ""}
        {k.kabarAt ? ` · dikabari ${jamWita(k.kabarAt)}${k.jumlahKabar > 1 ? ` (${k.jumlahKabar} kali)` : ""}` : " · belum dikabari"}
        {k.catatan ? ` · ${k.catatan}` : ""}
      </p>
    </li>
  );
}

export function PenjagaServerPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [form, setForm] = useState<PengaturanPenjaga | null>(null);

  const muat = useCallback(async () => {
    try {
      const d = await ambil<Data>("/api/admin/penjaga-server");
      setData(d);
      setForm(d.pengaturan);
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data penjaga server belum dapat dimuat.");
    }
  }, []);

  useEffect(() => {
    const awal = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(awal);
  }, [muat]);

  const ubah = <K extends keyof PengaturanPenjaga>(k: K, v: PengaturanPenjaga[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const angka = (k: KunciAngka) => (e: React.ChangeEvent<HTMLInputElement>) => ubah(k, Number(e.target.value));

  const kerjakan = async (badan: Record<string, unknown>, pesan: (d: Data) => string) => {
    setSibuk(true);
    setGalat("");
    setInfo("");
    try {
      const d = await ambil<Data>("/api/admin/penjaga-server", { method: "POST", body: JSON.stringify(badan) });
      setData(d);
      setForm(d.pengaturan);
      setInfo(pesan(d));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum dapat dikerjakan.");
    } finally {
      setSibuk(false);
    }
  };

  const bolehAtur = data?.bolehAtur ?? false;
  const tombolMati = !bolehAtur || sibuk;

  return (
    <Card data-penjaga-server>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4" aria-hidden /> Penjaga server
        </CardTitle>
        <CardDescription>
          Mengabari Super Admin lewat WhatsApp bila ruang penyimpanan menipis, cadangan harian tidak terbentuk, atau ada layanan yang mati. Penjaga hanya mengabari; ia tidak membersihkan atau mengubah apa pun di server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {galat && <p className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{galat}</p>}
        {info && <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{info}</p>}
        {!data || !form ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat...
          </p>
        ) : (
          <>
            <section className="space-y-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">Kabari bila perlu ditangani (merah)</span>
                  <span className="block text-xs text-muted-foreground">Dikirim kapan saja, termasuk malam hari. Diingatkan lagi tiap {form.ulangMerahJam} jam selama belum pulih.</span>
                </span>
                <Switch checked={form.merahAktif} disabled={tombolMati} onCheckedChange={(v) => ubah("merahAktif", v)} aria-label="Kabari kejadian merah" />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">Kabari pemberitahuan biasa (kuning)</span>
                  <span className="block text-xs text-muted-foreground">Contohnya ruang mulai menipis. Boleh dimatikan; diingatkan lagi tiap {form.ulangPeringatanJam} jam.</span>
                </span>
                <Switch checked={form.peringatanAktif} disabled={tombolMati} onCheckedChange={(v) => ubah("peringatanAktif", v)} aria-label="Kabari pemberitahuan biasa" />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="flex items-center gap-1 font-medium">
                    <Moon className="h-3.5 w-3.5" aria-hidden /> Jam tenang
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Pada jam ini pemberitahuan biasa menunggu pagi; yang merah tetap dikirim. Waktu WITA.{data.sedangJamTenang ? " Sekarang sedang jam tenang." : ""}
                  </span>
                </span>
                <Switch checked={form.jamTenangAktif} disabled={tombolMati} onCheckedChange={(v) => ubah("jamTenangAktif", v)} aria-label="Jam tenang" />
              </label>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  Mulai
                  <Input type="time" className="w-28" value={form.tenangMulai} disabled={tombolMati || !form.jamTenangAktif} onChange={(e) => ubah("tenangMulai", e.target.value)} />
                </label>
                <label className="flex items-center gap-2">
                  Selesai
                  <Input type="time" className="w-28" value={form.tenangSelesai} disabled={tombolMati || !form.jamTenangAktif} onChange={(e) => ubah("tenangSelesai", e.target.value)} />
                </label>
                <label className="flex items-center gap-2">
                  Ingatkan merah tiap (jam)
                  <Input type="number" className="w-20" min={1} max={48} value={form.ulangMerahJam} disabled={tombolMati} onChange={angka("ulangMerahJam")} />
                </label>
                <label className="flex items-center gap-2">
                  biasa tiap (jam)
                  <Input type="number" className="w-20" min={6} max={168} value={form.ulangPeringatanJam} disabled={tombolMati} onChange={angka("ulangPeringatanJam")} />
                </label>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Penerima</h3>
              <p className="text-xs text-muted-foreground">Hanya Super Admin. Tanpa pilihan = semua Super Admin yang punya nomor WhatsApp. Nomor tidak ditampilkan di sini.</p>
              <ul className="space-y-1">
                {data.calonPenerima.map((u) => (
                  <li key={u.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.penerimaIds.includes(u.id)}
                        disabled={tombolMati}
                        onChange={(e) => ubah("penerimaIds", e.target.checked ? [...form.penerimaIds, u.id] : form.penerimaIds.filter((i) => i !== u.id))}
                      />
                      {u.nama}
                      {!u.adaNomor && <span className="text-xs text-amber-700 dark:text-amber-400">(belum punya nomor WhatsApp)</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <details className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Batas lainnya</summary>
              <p className="mt-2 text-xs text-muted-foreground">Batas ruang disk memakai pengaturan Kapasitas penyimpanan di atas.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-2">
                  Cadangan terlambat: pemberitahuan (jam)
                  <Input type="number" className="w-24" value={form.cadanganPeringatanJam} disabled={tombolMati} onChange={angka("cadanganPeringatanJam")} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Cadangan terlambat: merah (jam)
                  <Input type="number" className="w-24" value={form.cadanganMerahJam} disabled={tombolMati} onChange={angka("cadanganMerahJam")} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Cadangan dianggap kecil bila di bawah (% dari biasanya)
                  <Input type="number" className="w-24" value={form.cadanganUkuranMinPersen} disabled={tombolMati} onChange={angka("cadanganUkuranMinPersen")} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Jumlah berkas penuh: pemberitahuan (%)
                  <Input type="number" className="w-24" value={form.inodeKuning} disabled={tombolMati} onChange={angka("inodeKuning")} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Jumlah berkas penuh: merah (%)
                  <Input type="number" className="w-24" value={form.inodeMerah} disabled={tombolMati} onChange={angka("inodeMerah")} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Sertifikat: pemberitahuan (hari sebelum habis)
                  <Input type="number" className="w-24" value={form.sertifikatPeringatanHari} disabled={tombolMati} onChange={angka("sertifikatPeringatanHari")} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  Sertifikat: merah (hari sebelum habis)
                  <Input type="number" className="w-24" value={form.sertifikatMerahHari} disabled={tombolMati} onChange={angka("sertifikatMerahHari")} />
                </label>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" disabled={tombolMati} onClick={() => void kerjakan({ aksi: "simpan", pengaturan: form }, () => "Pengaturan penjaga tersimpan.")}>
                {sibuk ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}Simpan
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={tombolMati}
                onClick={() =>
                  void kerjakan({ aksi: "periksa" }, (d) =>
                    d.periksa
                      ? d.periksa.tanpaPenerima
                        ? "Diperiksa. Ada hal yang perlu dikabari, tetapi belum ada Super Admin dengan nomor WhatsApp."
                        : `Diperiksa sekarang: ${d.periksa.temuan} hal terlihat, ${d.periksa.dikirim} pesan dikirim.`
                      : "Penjaga sedang dimatikan (kedua kabar mati)."
                  )
                }
              >
                Periksa sekarang
              </Button>
              <Button type="button" variant="ghost" disabled={sibuk} onClick={() => void muat()}>
                <RefreshCw className="mr-1 h-4 w-4" aria-hidden /> Muat ulang
              </Button>
              {!bolehAtur && <span className="text-xs text-muted-foreground">Hanya Super Admin yang dapat mengubah.</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.pemantauServer
                ? `Pemantau di server terakhir melapor ${tanggal(data.pemantauServer.dibuat)}.`
                : "Pemantau di server belum terpasang: ruang disk, jumlah berkas, sertifikat, dan layanan di server induk belum ikut dipantau."}
            </p>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Sedang berlangsung</h3>
              {data.berlangsung.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada. Semua terpantau wajar.</p>
              ) : (
                <ul className="space-y-2">
                  {data.berlangsung.map((k) => (
                    <BarisKejadian key={k.id} k={k} />
                  ))}
                </ul>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Riwayat kejadian</h3>
              {data.riwayat.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada kejadian tercatat.</p>
              ) : (
                <ul className="space-y-2">
                  {data.riwayat.map((k) => (
                    <BarisKejadian key={k.id} k={k} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
