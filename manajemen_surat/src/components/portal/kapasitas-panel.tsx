"use client";

import { AlertTriangle, CheckCircle2, HardDrive, Loader2, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import {
  BATAS_SETELAN,
  PERINTAH_PASANG_CRON,
  formatUkuran,
  type BarisKapasitas,
  type HasilKapasitas,
  type RiwayatPembersihan,
  type SetelanKapasitas,
  type Warna,
} from "@/server/modules/kapasitas/hitung";

/**
 * Admin > Kapasitas penyimpanan (30 Oktober 2026).
 *
 * Super Admin mengatur dan meminta pemeriksaan; Admin hanya membaca (server
 * menegakkannya: POST ditolak 403 untuk Admin). Angka dari pemantau di server;
 * portal tidak menyentuh Docker. Berdetak tiap 30 detik selama tab terlihat.
 */

type Data = {
  setelan: SetelanKapasitas;
  kapasitas: HasilKapasitas;
  riwayat: RiwayatPembersihan[];
  akanDibersihkan: boolean;
  perintahPembersihan: string;
  bolehAtur: boolean;
  cerminanTertulis?: boolean;
};

const DETAK_MS = 30_000;

const WARNA_BILAH: Record<Warna, string> = {
  hijau: "bg-emerald-500",
  kuning: "bg-amber-500",
  merah: "bg-rose-500",
  kelabu: "bg-slate-300 dark:bg-slate-600",
};
const WARNA_TEKS: Record<Warna, string> = {
  hijau: "text-emerald-700 dark:text-emerald-400",
  kuning: "text-amber-700 dark:text-amber-400",
  merah: "text-rose-700 dark:text-rose-400",
  kelabu: "text-muted-foreground",
};
const WARNA_KARTU: Record<Warna, string> = {
  hijau: "border-emerald-500/40 bg-emerald-500/5",
  kuning: "border-amber-500/50 bg-amber-500/10",
  merah: "border-rose-500/50 bg-rose-500/10",
  kelabu: "border-border bg-muted/40",
};
const NAMA_WARNA: Record<Warna, string> = { hijau: "Wajar", kuning: "Perlu diperhatikan", merah: "Hampir penuh", kelabu: "Belum terukur" };

async function ambil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data kapasitas belum dapat dimuat.");
  return j.data as T;
}

function waktu(iso: string | null | undefined) {
  if (!iso) return "-";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "-" : t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function persenTeks(p: number | null) {
  return p === null ? "-" : `${p.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function BarisPemakaian({ b, s }: { b: BarisKapasitas; s: SetelanKapasitas }) {
  const lebar = b.persen === null ? 0 : Math.max(1.5, Math.min(100, b.persen));
  const partisi = b.jenis === "partisi";
  return (
    <div className="space-y-1.5" data-baris={b.kunci} data-warna={b.warna}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
        <span className={cn("font-medium text-foreground", !partisi && "pl-3 font-normal")}>{b.nama}</span>
        <span className={cn("font-semibold tabular-nums", partisi ? WARNA_TEKS[b.warna] : "text-foreground")}>
          {partisi
            ? b.persen === null
              ? "belum terukur"
              : `${persenTeks(b.persen)} · bebas ${formatUkuran(b.sisaByte)}`
            : b.terpakaiByte === null
              ? "belum terukur"
              : `${formatUkuran(b.terpakaiByte)}${b.persen !== null ? ` · ${persenTeks(b.persen)} dari partisi` : ""}`}
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
        <div className={cn("h-full rounded-full transition-all", partisi ? WARNA_BILAH[b.warna] : "bg-sky-500")} style={{ width: `${lebar}%` }} />
        {partisi && (
          <>
            <span className="absolute inset-y-0 w-px bg-amber-600/70" style={{ left: `${s.ambangKuning}%` }} aria-hidden />
            <span className="absolute inset-y-0 w-px bg-rose-600/80" style={{ left: `${s.ambangMerah}%` }} aria-hidden />
          </>
        )}
      </div>
      <p className={cn("text-xs leading-5 text-muted-foreground", !partisi && "pl-3")}>
        {partisi && b.terpakaiByte !== null ? `${formatUkuran(b.terpakaiByte)} dari ${formatUkuran(b.totalByte)}. ` : ""}
        {b.keterangan}
      </p>
    </div>
  );
}

export function KapasitasPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [memeriksa, setMemeriksa] = useState(false);
  const [kuning, setKuning] = useState("80");
  const [merah, setMerah] = useState("90");
  const [umur, setUmur] = useState("72");
  const [otomatis, setOtomatis] = useState(false);
  const sudahIsi = useRef(false);

  const isiForm = useCallback((d: Data) => {
    setKuning(String(d.setelan.ambangKuning));
    setMerah(String(d.setelan.ambangMerah));
    setUmur(String(d.setelan.umurCacheJam));
    setOtomatis(d.setelan.pembersihanOtomatis);
  }, []);

  const muat = useCallback(
    async (isiUlangForm: boolean) => {
      try {
        const d = await ambil<Data>("/api/admin/kapasitas");
        setData(d);
        setGalat("");
        if (isiUlangForm || !sudahIsi.current) {
          isiForm(d);
          sudahIsi.current = true;
        }
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Data kapasitas belum dapat dimuat.");
      } finally {
        setMemuat(false);
      }
    },
    [isiForm]
  );

  useEffect(() => {
    const awal = window.setTimeout(() => void muat(true), 0);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void muat(false);
    }, DETAK_MS);
    return () => {
      window.clearTimeout(awal);
      window.clearInterval(id);
    };
  }, [muat]);

  const bolehAtur = data?.bolehAtur ?? false;

  const simpan = async () => {
    setMenyimpan(true);
    setGalat("");
    setInfo("");
    try {
      const d = await ambil<Data>("/api/admin/kapasitas", {
        method: "POST",
        body: JSON.stringify({
          aksi: "simpan",
          setelan: { ambangKuning: Number(kuning), ambangMerah: Number(merah), umurCacheJam: Number(umur), pembersihanOtomatis: otomatis },
        }),
      });
      setData(d);
      isiForm(d);
      setInfo(d.cerminanTertulis === false ? "Tersimpan, tetapi pemantau di server belum dapat diberi tahu (folder bersama tidak dapat ditulis)." : "Pengaturan tersimpan dan diteruskan ke pemantau di server.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum dapat disimpan.");
    } finally {
      setMenyimpan(false);
    }
  };

  const periksa = async () => {
    setMemeriksa(true);
    setGalat("");
    setInfo("");
    try {
      await ambil<{ diminta: true }>("/api/admin/kapasitas", { method: "POST", body: JSON.stringify({ aksi: "periksa" }) });
      setInfo("Permintaan diterima. Pemantau di server mengukur ulang dalam sekitar satu menit; layar ini terbarui sendiri.");
      window.setTimeout(() => void muat(false), 15_000);
      window.setTimeout(() => void muat(false), 70_000);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Permintaan pemeriksaan belum dapat dikirim.");
    } finally {
      setMemeriksa(false);
    }
  };

  if (memuat && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-kapasitas-panel>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat kapasitas penyimpanan...
      </div>
    );
  }

  const k = data?.kapasitas;
  const setelan = data?.setelan;
  const ringkasan = k?.ringkasan;
  const warna: Warna = ringkasan?.warna ?? "kelabu";
  const IkonRingkasan = warna === "merah" ? ShieldAlert : warna === "kuning" ? AlertTriangle : warna === "hijau" ? CheckCircle2 : HardDrive;
  const perluPemantau = k && (k.sumber !== "host" || k.basi);

  return (
    <div className="space-y-6" data-kapasitas-panel>
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      {info && <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">{info}</p>}

      <Card className={cn("border", WARNA_KARTU[warna])} data-ringkasan-warna={warna}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <IkonRingkasan className={cn("mt-0.5 h-6 w-6 shrink-0", WARNA_TEKS[warna])} aria-hidden />
              <div>
                <CardTitle className="text-base">Ruang penyimpanan server: {NAMA_WARNA[warna]}</CardTitle>
                <CardDescription className="mt-1">{ringkasan?.pesan}</CardDescription>
                <p className="mt-1 text-xs text-muted-foreground">
                  {k?.diukurPada ? `Diukur ${waktu(k.diukurPada)}${k.umurMenit !== null ? ` (${k.umurMenit} menit lalu)` : ""}` : "Belum ada pengukuran dari pemantau di server."}
                  {k?.sumber === "bot" ? " · sementara dibaca dari ALETA Bot" : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void muat(false)} disabled={memuat}>
                <RefreshCw className={cn("mr-2 h-4 w-4", memuat && "animate-spin")} aria-hidden /> Muat ulang
              </Button>
              {bolehAtur && (
                <Button type="button" size="sm" onClick={periksa} disabled={memeriksa} data-aksi="periksa-sekarang">
                  {memeriksa ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <HardDrive className="mr-2 h-4 w-4" aria-hidden />}
                  Periksa sekarang
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {perluPemantau && (
        <Card className="border-amber-500/40 bg-amber-500/5" data-pemantau-belum>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{k?.sumber === "host" ? "Pemantau di server berhenti" : "Pemantau di server belum terpasang"}</CardTitle>
            <CardDescription>
              Tanpa pemantau, layar ini hanya tahu pemakaian tiap partisi dari ALETA Bot. Rincian data aplikasi, database, dan sisa pembuatan pembaruan memerlukan pemantau yang dipasang
              sekali oleh pengelola server:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-5 text-foreground">{`chmod +x /var/www/html/aleta/scripts/kapasitas/aleta-kapasitas-cron.sh\n${PERINTAH_PASANG_CRON}`}</pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4 text-sky-600" aria-hidden /> Pemakaian ruang
          </CardTitle>
          <CardDescription>
            Garis kuning dan merah pada batang partisi menandai batas peringatan ({setelan?.ambangKuning}% dan {setelan?.ambangMerah}%). Batang biru adalah bagian dari partisinya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {k && k.baris.length > 0 ? (
            k.baris.map((b) => <BarisPemakaian key={b.kunci} b={b} s={setelan as SetelanKapasitas} />)
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada angka ruang yang dapat ditampilkan.</p>
          )}
          {k && k.satuPartisiDenganDocker.length > 0 && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">
              {k.satuPartisiDenganDocker.join(" dan ")} berada di partisi yang sama dengan data aplikasi (Docker). Bila partisi itu penuh, database ikut terancam - itu sebabnya data
              sebaiknya dipindah ke partisi yang besar.
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-pengaturan-kapasitas>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pengaturan peringatan</CardTitle>
          <CardDescription>
            {bolehAtur ? "Hanya Super Admin yang dapat mengubah." : "Anda melihat saja; hanya Super Admin yang dapat mengubah."} Peringatan juga tampil di Pusat kesehatan sistem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Mulai kuning (%)</span>
              <Input type="number" inputMode="numeric" min={BATAS_SETELAN.ambangKuning.min} max={BATAS_SETELAN.ambangKuning.maks} value={kuning} onChange={(e) => setKuning(e.target.value)} disabled={!bolehAtur} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Mulai merah (%)</span>
              <Input type="number" inputMode="numeric" min={BATAS_SETELAN.ambangMerah.min} max={BATAS_SETELAN.ambangMerah.maks} value={merah} onChange={(e) => setMerah(e.target.value)} disabled={!bolehAtur} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Sisa pembuatan yang dibersihkan (jam)</span>
              <Input type="number" inputMode="numeric" min={BATAS_SETELAN.umurCacheJam.min} max={BATAS_SETELAN.umurCacheJam.maks} value={umur} onChange={(e) => setUmur(e.target.value)} disabled={!bolehAtur} />
            </label>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border p-3">
            <Switch checked={otomatis} onCheckedChange={setOtomatis} disabled={!bolehAtur} aria-label="Bersihkan sisa pembuatan lama otomatis" id="bersih-otomatis" />
            <label htmlFor="bersih-otomatis" className="space-y-1 text-sm">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <Trash2 className="h-4 w-4 text-rose-600" aria-hidden /> Bersihkan sisa pembuatan lama otomatis
                <Badge variant={otomatis ? "warning" : "muted"}>{otomatis ? "Menyala" : "Mati"}</Badge>
              </span>
              <span className="block text-xs leading-5 text-muted-foreground">
                Mati bawaan, karena tiap pembersihan memerlukan izin pemilik server. Bila dinyalakan, Anda memberi izin tetap: server membuang sisa pembuatan pembaruan yang lebih tua dari{" "}
                {umur || "72"} jam <strong>hanya bila partisi data aplikasi sudah di atas batas merah</strong> ({merah}%), paling sering sekali tiap 6 jam. Versi aplikasi yang sedang jalan,
                database, dan berkas ALETA tidak tersentuh. Setiap pembersihan tercatat di jejak audit.
              </span>
              {data?.akanDibersihkan && (
                <span className="block text-xs font-medium text-rose-700 dark:text-rose-400">Partisi sudah di atas batas merah: pembersihan berjalan pada pemeriksaan berikutnya.</span>
              )}
            </label>
          </div>

          {bolehAtur && (
            <div className="flex items-center gap-3">
              <Button type="button" onClick={simpan} disabled={menyimpan} data-aksi="simpan-kapasitas">
                {menyimpan && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />} Simpan pengaturan
              </Button>
              <span className="text-xs text-muted-foreground">Perintah yang dijalankan server: <code className="rounded bg-muted px-1 py-0.5">{data?.perintahPembersihan}</code></span>
            </div>
          )}
        </CardContent>
      </Card>

      {k && (
        <Card data-petunjuk-pindah>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Menambah ruang: pindah ke partisi yang besar</CardTitle>
            <CardDescription>Jalan keluar permanen bila partisi data aplikasi terus penuh. Dikerjakan pengelola server saat ALETA dimatikan sebentar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc space-y-1.5 pl-5 text-foreground">
              {k.petunjuk.pesan.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {k.petunjuk.cukup1Tb === false && (
              <p className="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                Catatan: 1 TB (1.024 GB) hanya tercapai bila total disk server mencukupi. Jika tidak, ALETA tetap diberi partisi terbesar yang ada; kekurangannya harus ditutup dengan disk tambahan.
              </p>
            )}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Urutan (jalankan di server, sebagai root):</p>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-5 text-foreground">{k.petunjuk.perintah.join("\n")}</pre>
              <p className="text-xs leading-5 text-muted-foreground">
                Perintah pertama hanya melaporkan (tidak mengubah apa pun). Perintah kedua mencadangkan database, memindahkan, memverifikasi, dan menyimpan data lama dengan nama baru - tidak
                ada yang dihapus. Panduan lengkap: docs/kapasitas-penyimpanan.md.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && data.riwayat.length > 0 && (
        <Card data-riwayat-kapasitas>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Riwayat pembersihan otomatis</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {data.riwayat.slice(0, 8).map((r) => (
                <li key={r.pada} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-foreground">{waktu(r.pada)}</span>
                  <span className="text-muted-foreground">
                    partisi {r.sebabPersen === null ? "-" : `${r.sebabPersen.toLocaleString("id-ID")}%`} · dibebaskan {formatUkuran(r.dibebaskanByte)}
                    {r.kode !== null && r.kode !== 0 ? " · gagal" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
