"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardCopy, LoaderCircle, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type { HasilKesehatan, Komponen, UjiBebanRingkas, Warna } from "@/server/modules/kesehatan/pemeriksa";
import type { KelompokGalat, KejadianGalat } from "@/server/modules/kesehatan/galat";
import type { PengaturanKesehatan } from "@/server/modules/kesehatan/layanan";

/**
 * Pusat kesehatan sistem (E2, 25 Okt 2026) - Admin dan Super Admin. Rute
 * /api/admin/kesehatan, /catatan-galat, dan /uji-beban menegakkan haknya;
 * tombol yang disembunyikan di sini hanya kenyamanan.
 */

const DETAK_MS = 30_000;

const TITIK: Record<Warna, string> = {
  hijau: "bg-emerald-500",
  kuning: "bg-amber-500",
  merah: "bg-rose-500",
  kelabu: "bg-slate-300 dark:bg-slate-600",
};
const LABEL: Record<Warna, string> = { hijau: "Baik", kuning: "Perhatian", merah: "Bermasalah", kelabu: "Tidak terukur" };
const VARIAN: Record<Warna, "success" | "warning" | "danger" | "muted"> = { hijau: "success", kuning: "warning", merah: "danger", kelabu: "muted" };

async function ambil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data belum dapat dimuat.");
  return j.data as T;
}

function waktu(iso: string | null | undefined) {
  if (!iso) return "-";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "-" : t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });
}

type DataKesehatan = { hasil: HasilKesehatan; pengaturan: PengaturanKesehatan; bolehAtur: boolean };

export function PusatKesehatanPanel() {
  const [data, setData] = useState<DataKesehatan | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);
  const jalan = useRef(false);

  const muat = useCallback(async (opsi: { periksaSambung?: boolean; segarkan?: boolean } = {}) => {
    if (jalan.current) return;
    jalan.current = true;
    setMemuat(true);
    try {
      const kueri = new URLSearchParams();
      if (opsi.periksaSambung) kueri.set("ping", "1");
      if (opsi.segarkan) kueri.set("segarkan", "1");
      setData(await ambil<DataKesehatan>(`/api/admin/kesehatan?${kueri.toString()}`));
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pusat kesehatan belum dapat dimuat.");
    } finally {
      jalan.current = false;
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // Pemuatan pertama lewat janji (setState di dalam .then, bukan serentak di badan efek).
    let batal = false;
    void ambil<DataKesehatan>("/api/admin/kesehatan?ping=1")
      .then((d) => {
        if (!batal) setData(d);
      })
      .catch((e) => {
        if (!batal) setGalat(e instanceof Error ? e.message : "Pusat kesehatan belum dapat dimuat.");
      });
    const jam = setInterval(() => {
      if (document.visibilityState === "visible") void muat();
    }, DETAK_MS);
    return () => {
      batal = true;
      clearInterval(jam);
    };
  }, [muat]);

  const hasil = data?.hasil ?? null;

  return (
    <div className="space-y-6" data-pusat-kesehatan>
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}

      <Card className="bg-card">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-3 text-base">
              <span className={cn("inline-block h-3 w-3 rounded-full", TITIK[hasil?.warna ?? "kelabu"])} aria-hidden />
              {hasil ? `Keadaan sistem: ${LABEL[hasil.warna]}` : "Memeriksa sistem ..."}
            </CardTitle>
            <CardDescription>
              {hasil ? `Diperiksa ${waktu(hasil.diukurPada)} WITA. Layar menyegarkan sendiri tiap 30 detik.` : "Mohon tunggu."}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void muat({ periksaSambung: true, segarkan: true })} disabled={memuat}>
            {memuat ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Periksa sekarang
          </Button>
        </CardHeader>
      </Card>

      <Tabs defaultValue="keadaan">
        <TabsList>
          <TabsTrigger value="keadaan">Keadaan</TabsTrigger>
          <TabsTrigger value="galat">Catatan error</TabsTrigger>
          <TabsTrigger value="uji-beban">Uji beban</TabsTrigger>
          {data?.bolehAtur && <TabsTrigger value="pengaturan">Pengaturan</TabsTrigger>}
        </TabsList>
        <TabsContent value="keadaan">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hasil?.komponen.map((k) => <KartuKomponen key={k.kunci} k={k} />)}
          </div>
        </TabsContent>
        <TabsContent value="galat">
          <TabGalat />
        </TabsContent>
        <TabsContent value="uji-beban">
          <TabUjiBeban bolehAtur={Boolean(data?.bolehAtur)} />
        </TabsContent>
        {data?.bolehAtur && (
          <TabsContent value="pengaturan">
            <TabPengaturan awal={data.pengaturan} onGalat={setGalat} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function KartuKomponen({ k }: { k: Komponen }) {
  return (
    <Card className="bg-card" data-komponen={k.kunci} data-warna={k.warna}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <span className={cn("inline-block h-2.5 w-2.5 rounded-full", TITIK[k.warna])} aria-hidden />
            {k.nama}
          </span>
          <Badge variant={VARIAN[k.warna]}>{LABEL[k.warna]}</Badge>
        </CardTitle>
        <CardDescription className="text-sm">{k.ringkas}</CardDescription>
      </CardHeader>
      {k.rincian.length > 0 && (
        <CardContent>
          <dl className="space-y-1 text-xs">
            {k.rincian.map((r, i) => (
              <div key={`${r.label}-${i}`} className="flex flex-wrap justify-between gap-x-3">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="text-foreground">{r.nilai}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Catatan galat
// ---------------------------------------------------------------------------

type RincianGalat = { kelompok: KelompokGalat; kejadian: KejadianGalat[]; teks: string };

function TabGalat() {
  const [sumber, setSumber] = useState("");
  const [status, setStatus] = useState("baru");
  const [daftar, setDaftar] = useState<KelompokGalat[]>([]);
  const [pilih, setPilih] = useState<RincianGalat | null>(null);
  const [galat, setGalat] = useState("");
  const [tersalin, setTersalin] = useState(false);

  const muat = useCallback(async () => {
    try {
      const kueri = new URLSearchParams();
      if (sumber) kueri.set("sumber", sumber);
      if (status) kueri.set("status", status);
      setDaftar((await ambil<{ galat: KelompokGalat[] }>(`/api/admin/catatan-galat?${kueri.toString()}`)).galat);
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Catatan error belum dapat dimuat.");
    }
  }, [sumber, status]);

  useEffect(() => {
    let batal = false;
    const kueri = new URLSearchParams();
    if (sumber) kueri.set("sumber", sumber);
    if (status) kueri.set("status", status);
    void ambil<{ galat: KelompokGalat[] }>(`/api/admin/catatan-galat?${kueri.toString()}`)
      .then((d) => {
        if (batal) return;
        setDaftar(d.galat);
        setGalat("");
      })
      .catch((e) => {
        if (!batal) setGalat(e instanceof Error ? e.message : "Catatan error belum dapat dimuat.");
      });
    return () => {
      batal = true;
    };
  }, [sumber, status]);

  const buka = async (id: string) => {
    try {
      setPilih(await ambil<RincianGalat>(`/api/admin/catatan-galat?id=${encodeURIComponent(id)}`));
      setTersalin(false);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Rincian belum dapat dimuat.");
    }
  };

  const tandai = async (id: string, ditangani: boolean) => {
    try {
      await ambil("/api/admin/catatan-galat", { method: "POST", body: JSON.stringify({ id, ditangani }) });
      setPilih(null);
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum dapat disimpan.");
    }
  };

  const salin = async (teks: string) => {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
    } catch {
      setGalat("Penyalinan diblokir peramban; pilih teksnya lalu salin dengan Ctrl+C.");
    }
  };

  return (
    <div className="space-y-4">
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      <div className="flex flex-wrap gap-3">
        <NativeSelect className="w-48" value={sumber} onChange={(e) => setSumber(e.target.value)} aria-label="Sumber error">
          <option value="">Semua sumber</option>
          <option value="server">Server</option>
          <option value="peramban">Peramban</option>
          <option value="ekstensi">Ekstensi</option>
        </NativeSelect>
        <NativeSelect className="w-48" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status error">
          <option value="baru">Belum ditangani</option>
          <option value="ditangani">Sudah ditangani</option>
          <option value="">Semua</option>
        </NativeSelect>
      </div>
      <Card className="bg-card">
        <CardContent className="space-y-2 pt-6">
          {daftar.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada error yang cocok.</p>}
          {daftar.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => void buka(g.id)}
              className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-card p-3 text-left text-sm hover:border-primary/40"
            >
              <Badge variant={g.sumber === "server" ? "danger" : g.sumber === "ekstensi" ? "info" : "warning"}>{g.sumber}</Badge>
              <span className="font-medium text-foreground">{g.pesan.slice(0, 140)}</span>
              <span className="text-xs text-muted-foreground">
                {g.jumlah}x · terakhir {waktu(g.terakhirAt)} · {g.lokasi || "tanpa lokasi"}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
      {pilih && (
        <Card className="border-primary/30 bg-card" data-rincian-galat>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> {pilih.kelompok.jenis || "Galat"} ({pilih.kelompok.jumlah}x)
            </CardTitle>
            <CardDescription>
              Pertama {waktu(pilih.kelompok.pertamaAt)}, terakhir {waktu(pilih.kelompok.terakhirAt)}.
              {pilih.kelompok.status === "ditangani" && ` Ditandai ditangani oleh ${pilih.kelompok.tanganiOleh}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-xs">{pilih.teks}</pre>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void salin(pilih.teks)}>
                <ClipboardCopy className="mr-2 h-4 w-4" /> {tersalin ? "Tersalin" : "Salin untuk pengembang"}
              </Button>
              {pilih.kelompok.status === "baru" ? (
                <Button onClick={() => void tandai(pilih.kelompok.id, true)}>Tandai sudah ditangani</Button>
              ) : (
                <Button variant="outline" onClick={() => void tandai(pilih.kelompok.id, false)}>
                  Buka kembali
                </Button>
              )}
              <Button variant="ghost" onClick={() => setPilih(null)}>
                Tutup
              </Button>
            </div>
            <div className="space-y-1 text-xs">
              <p className="font-medium text-foreground">Kejadian terakhir</p>
              {pilih.kejadian.slice(0, 10).map((e) => (
                <p key={e.id} className="text-muted-foreground">
                  {waktu(e.waktu)} · {e.halaman || "-"} · {e.akunNama || e.akunId || "tanpa akun"} · {e.versi || "-"}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Uji beban
// ---------------------------------------------------------------------------

type BarisUji = UjiBebanRingkas & { diimporOleh: string; diimporAt: string };

function TabUjiBeban({ bolehAtur }: { bolehAtur: boolean }) {
  const [hasil, setHasil] = useState<BarisUji[]>([]);
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    try {
      setHasil((await ambil<{ hasil: BarisUji[] }>("/api/admin/uji-beban")).hasil);
    } catch (e) {
      setPesan(e instanceof Error ? e.message : "Hasil belum dapat dimuat.");
    }
  }, []);

  useEffect(() => {
    let batal = false;
    void ambil<{ hasil: BarisUji[] }>("/api/admin/uji-beban")
      .then((d) => {
        if (!batal) setHasil(d.hasil);
      })
      .catch((e) => {
        if (!batal) setPesan(e instanceof Error ? e.message : "Hasil belum dapat dimuat.");
      });
    return () => {
      batal = true;
    };
  }, []);

  const impor = async (berkas: File | undefined) => {
    if (!berkas) return;
    try {
      const isi = JSON.parse(await berkas.text()) as unknown;
      await ambil("/api/admin/uji-beban", { method: "POST", body: JSON.stringify(isi) });
      setPesan("Hasil uji beban diimpor.");
      await muat();
    } catch (e) {
      setPesan(e instanceof Error ? e.message : "Berkas tidak dapat diimpor.");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Uji beban (hanya di kembaran laptop)</CardTitle>
          <CardDescription>
            Dijalankan dari laptop dengan skrip uji beban terhadap kembaran, tidak pernah terhadap server kantor. Berkas hasilnya (.json) diimpor di sini
            supaya angkanya tersimpan bersama catatan sistem.
          </CardDescription>
        </CardHeader>
        {bolehAtur && (
          <CardContent>
            <label className="text-sm font-medium text-foreground" htmlFor="impor-uji-beban">
              Impor berkas hasil
            </label>
            <input id="impor-uji-beban" type="file" accept="application/json,.json" className="mt-1 block text-sm" onChange={(e) => void impor(e.target.files?.[0])} />
            {pesan && <p className="mt-2 text-sm text-muted-foreground">{pesan}</p>}
          </CardContent>
        )}
      </Card>
      <Card className="bg-card">
        <CardContent className="overflow-x-auto pt-6">
          {hasil.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada hasil uji beban yang diimpor.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3">Dijalankan</th>
                  <th className="pb-2 pr-3">Perangkat</th>
                  <th className="pb-2 pr-3">p95 (ms)</th>
                  <th className="pb-2 pr-3">Error</th>
                  <th className="pb-2 pr-3">Kueri SIPP/menit</th>
                  <th className="pb-2 pr-3">Sambungan SIPP</th>
                  <th className="pb-2">CPU / RAM laptop</th>
                </tr>
              </thead>
              <tbody>
                {hasil.map((h) => (
                  <tr key={h.id} className="border-t border-border/60">
                    <td className="py-2 pr-3">{waktu(h.dibuatAt)}</td>
                    <td className="py-2 pr-3">
                      {h.perangkat} ({h.profil})
                    </td>
                    <td className="py-2 pr-3">{Math.round(h.p95Ms)}</td>
                    <td className="py-2 pr-3">{h.galatPersen}%</td>
                    <td className="py-2 pr-3">{h.kueriSippPerMenit ?? "-"}</td>
                    <td className="py-2 pr-3">{h.sambunganSippMaks ?? "-"}</td>
                    <td className="py-2">
                      {h.cpuMesinMaks ?? "-"}% / {h.ramMesinMaksPersen ?? "-"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pengaturan (Super Admin)
// ---------------------------------------------------------------------------

function TabPengaturan({ awal, onGalat }: { awal: PengaturanKesehatan; onGalat: (pesan: string) => void }) {
  const [p, setP] = useState<PengaturanKesehatan>(awal);
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState("");

  const simpan = async (baru: PengaturanKesehatan) => {
    setMenyimpan(true);
    try {
      const d = await ambil<{ pengaturan: PengaturanKesehatan }>("/api/admin/kesehatan", { method: "POST", body: JSON.stringify(baru) });
      setP(d.pengaturan);
      setPesan("Pengaturan disimpan.");
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Pengaturan belum dapat disimpan.");
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-base">Pemeriksaan berkala dan peringatan WhatsApp</CardTitle>
        <CardDescription>
          Keduanya mati bawaan. Tanpa pemeriksaan berkala, halaman ini tetap memeriksa saat dibuka. Peringatan hanya untuk komponen yang bermasalah dua
          pemeriksaan berturut-turut (dua menit); abu-abu dan kuning tidak pernah mengirim pesan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={p.berkala} disabled={menyimpan} onChange={(e) => void simpan({ ...p, berkala: e.target.checked })} className="mt-1 h-4 w-4" />
          <span>
            <span className="font-medium text-foreground">Periksa tiap menit di latar</span>
            <span className="block text-muted-foreground">Menanyai bot, menyimpan riwayat 14 hari, dan memunculkan lonceng portal untuk Admin.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={p.wa} disabled={menyimpan || !p.berkala} onChange={(e) => void simpan({ ...p, wa: e.target.checked })} className="mt-1 h-4 w-4" />
          <span>
            <span className="font-medium text-foreground">Kirim peringatan WhatsApp ke admin</span>
            <span className="block text-muted-foreground">
              Perlu pemeriksaan berkala. Pesan tidak dapat terkirim bila bot/WhatsApp itu sendiri yang mati; tanda merah dan lonceng tetap muncul.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-foreground">Penerima</span>
          <NativeSelect className="w-60" value={p.penerima} disabled={menyimpan} onChange={(e) => void simpan({ ...p, penerima: e.target.value as PengaturanKesehatan["penerima"] })}>
            <option value="admin">Admin dan Super Admin</option>
            <option value="super-admin">Super Admin saja</option>
          </NativeSelect>
          <span className="text-foreground">Ulangi paling cepat tiap</span>
          <NativeSelect className="w-28" value={String(p.ulangJam)} disabled={menyimpan} onChange={(e) => void simpan({ ...p, ulangJam: Number(e.target.value) })}>
            {[1, 3, 6, 12, 24].map((j) => (
              <option key={j} value={j}>
                {j} jam
              </option>
            ))}
          </NativeSelect>
        </div>
        {pesan && <p className="text-sm text-muted-foreground">{pesan}</p>}
      </CardContent>
    </Card>
  );
}
