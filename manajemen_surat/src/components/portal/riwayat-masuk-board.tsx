"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, LoaderCircle, LogOut, RefreshCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { LABEL_JALUR, LABEL_PERISTIWA, labelJalur, labelPeristiwa, peristiwaGagal, teksMac, waktuWita } from "@/lib/jejak-masuk-tampilan";
import { bolehAksiLayar } from "@/lib/matriks-peran";
import { getRoleLabel } from "@/lib/permissions";
import type { RoleId } from "@/lib/types";

/**
 * Riwayat Masuk & Perangkat (23 Okt 2026) - Admin dan Super Admin. Rute
 * /api/admin/jejak-masuk dan /api/admin/batas-perangkat menegakkan haknya;
 * tombol yang disembunyikan di sini hanya kenyamanan.
 */

type Baris = Record<string, string>;
type Peringatan = { jenis: string; tingkat: string; judul: string; rincian: string; waktu: string };
type SesiAktif = { userId: string; username: string; namaAkun: string; peran: string; perangkatId: string; nama: string; terakhirAktif: string; ip: string; jumlahSesi: number; jalur: string };
type Kebijakan = { cakupan: "peran" | "akun"; sasaran: string; maks: number; perilaku: string; berlaku_sampai: string; alasan: string; diubah_nama: string; diubah_pada: string };
type Setelan = { retensiHari: number; jamKerjaMulai: string; jamKerjaSelesai: string; hariKerja: number[]; catatAkunWindows: boolean };

async function ambil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data belum dapat dimuat.");
  return j.data as T;
}

const LABEL_PERILAKU: Record<string, string> = { tolak: "Tolak masuk baru", "keluarkan-terlama": "Keluarkan perangkat terlama" };

export function RiwayatMasukBoard() {
  const { currentUser, users, roles } = usePortal();
  const superAdmin = bolehAksiLayar(currentUser, "perangkat.batas-peran");
  const [galat, setGalat] = useState("");
  const [peringatan, setPeringatan] = useState<Peringatan[]>([]);

  useEffect(() => {
    void ambil<{ peringatan: Peringatan[] }>("/api/admin/jejak-masuk?tab=peringatan")
      .then((d) => setPeringatan(d.peringatan))
      .catch(() => setPeringatan([]));
  }, []);

  return (
    <div className="space-y-6">
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      {peringatan.length > 0 && (
        <Card className="border-amber-500/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Perlu diperhatikan (7 hari terakhir)
            </CardTitle>
            <CardDescription>
              Banyak gagal dari satu alamat/ke satu akun (5 dalam satu jam), masuk dari luar jaringan kantor, satu akun dari dua jaringan dalam 15 menit,
              perangkat baru untuk pimpinan/admin, dan masuk di luar jam kerja.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {peringatan.slice(0, 12).map((p, i) => (
              <div key={`${p.jenis}-${i}`} className="flex flex-wrap items-baseline gap-2 text-sm">
                <Badge variant={p.tingkat === "tinggi" ? "danger" : "outline"}>{p.tingkat === "tinggi" ? "Penting" : "Catatan"}</Badge>
                <span className="font-medium text-foreground">{p.judul}</span>
                <span className="text-muted-foreground">{p.rincian}</span>
                <span className="text-xs text-muted-foreground">{waktuWita(p.waktu)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="riwayat">
        <TabsList>
          <TabsTrigger value="riwayat">Riwayat masuk</TabsTrigger>
          <TabsTrigger value="sesi">Sesi aktif</TabsTrigger>
          <TabsTrigger value="perangkat">Perangkat</TabsTrigger>
          <TabsTrigger value="batas">Batas perangkat</TabsTrigger>
        </TabsList>
        <TabsContent value="riwayat">
          <TabRiwayat users={users} roles={roles} />
        </TabsContent>
        <TabsContent value="sesi">
          <TabSesi onGalat={setGalat} />
        </TabsContent>
        <TabsContent value="perangkat">
          <TabPerangkat users={users} />
        </TabsContent>
        <TabsContent value="batas">
          <TabBatas superAdmin={superAdmin} users={users} roles={roles} onGalat={setGalat} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Akun = { id: string; name: string; username: string };
type PeranOpsi = { id: string; name: string };

function TabRiwayat({ users, roles }: { users: Akun[]; roles: PeranOpsi[] }) {
  const [saring, setSaring] = useState({ dari: "", sampai: "", userId: "", peran: "", peristiwa: "", jalur: "", ip: "", hanyaGagal: false });
  const [halaman, setHalaman] = useState(1);
  const [data, setData] = useState<{ total: number; perHalaman: number; baris: Baris[] } | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState("");

  const kueri = useMemo(() => {
    const q = new URLSearchParams();
    if (saring.dari) q.set("dari", `${saring.dari}T00:00:00+08:00`);
    if (saring.sampai) q.set("sampai", `${saring.sampai}T23:59:59+08:00`);
    for (const k of ["userId", "peran", "peristiwa", "jalur", "ip"] as const) if (saring[k]) q.set(k, saring[k]);
    if (saring.hanyaGagal) q.set("hanyaGagal", "1");
    return q;
  }, [saring]);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const q = new URLSearchParams(kueri);
      q.set("halaman", String(halaman));
      q.set("perHalaman", "50");
      setData(await ambil(`/api/admin/jejak-masuk?${q}`));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Riwayat belum dapat dimuat.");
    } finally {
      setMemuat(false);
    }
  }, [kueri, halaman]);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const ubah = (k: keyof typeof saring, v: string | boolean) => {
    setHalaman(1);
    setSaring((s) => ({ ...s, [k]: v }));
  };
  const jumlahHalaman = data ? Math.max(1, Math.ceil(data.total / data.perHalaman)) : 1;
  const csv = new URLSearchParams(kueri);
  csv.set("format", "csv");

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-base">Riwayat masuk</CardTitle>
        <CardDescription>Semua waktu dalam WITA. Alamat IP diambil dari alamat yang benar-benar menyambung ke server.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">Dari tanggal<Input type="date" value={saring.dari} onChange={(e) => ubah("dari", e.target.value)} /></label>
          <label className="text-sm">Sampai tanggal<Input type="date" value={saring.sampai} onChange={(e) => ubah("sampai", e.target.value)} /></label>
          <label className="text-sm">
            Akun
            <NativeSelect value={saring.userId} onChange={(e) => ubah("userId", e.target.value)}>
              <option value="">Semua akun</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Peran
            <NativeSelect value={saring.peran} onChange={(e) => ubah("peran", e.target.value)}>
              <option value="">Semua peran</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Peristiwa
            <NativeSelect value={saring.peristiwa} onChange={(e) => ubah("peristiwa", e.target.value)}>
              <option value="">Semua peristiwa</option>
              {Object.entries(LABEL_PERISTIWA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Jalur
            <NativeSelect value={saring.jalur} onChange={(e) => ubah("jalur", e.target.value)}>
              <option value="">Semua jalur</option>
              {Object.entries(LABEL_JALUR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </label>
          <label className="text-sm">Alamat IP / jaringan<Input placeholder="192.168.9 atau 192.168.9.12" value={saring.ip} onChange={(e) => ubah("ip", e.target.value)} /></label>
          <label className="flex items-end gap-2 pb-3 text-sm">
            <input type="checkbox" checked={saring.hanyaGagal} onChange={(e) => ubah("hanyaGagal", e.target.checked)} /> Hanya yang gagal / ditolak
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void muat()} disabled={memuat}>
            {memuat ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Muat ulang
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={apiPath(`/api/admin/jejak-masuk?${csv}`)}>
              <Download className="h-4 w-4" /> Unduh CSV
            </a>
          </Button>
          <span className="text-sm text-muted-foreground">{data ? `${data.total} catatan` : ""}</span>
        </div>
        {galat && <p className="text-sm text-destructive">{galat}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="p-2">Waktu</th><th className="p-2">Akun</th><th className="p-2">Peristiwa</th><th className="p-2">Jalur</th><th className="p-2">IP</th><th className="p-2">Perangkat</th></tr>
            </thead>
            <tbody>
              {(data?.baris ?? []).map((b) => (
                <BarisRiwayat key={b.id} b={b} terbuka={buka === b.id} onKlik={() => setBuka(buka === b.id ? "" : b.id)} />
              ))}
              {data && data.baris.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Tidak ada catatan.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={halaman <= 1} onClick={() => setHalaman((h) => h - 1)}>Sebelumnya</Button>
          <span>Halaman {halaman} dari {jumlahHalaman}</span>
          <Button variant="outline" size="sm" disabled={halaman >= jumlahHalaman} onClick={() => setHalaman((h) => h + 1)}>Berikutnya</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BarisRiwayat({ b, terbuka, onKlik }: { b: Baris; terbuka: boolean; onKlik: () => void }) {
  const gagal = peristiwaGagal(b.peristiwa);
  return (
    <>
      <tr className="cursor-pointer border-t border-border/60 hover:bg-muted/40" onClick={onKlik} data-baris-riwayat={b.id}>
        <td className="p-2 whitespace-nowrap">{waktuWita(b.waktu)}</td>
        <td className="p-2">{b.nama || b.username || b.identitas_samar || "-"}</td>
        <td className="p-2">
          <Badge variant={gagal ? "danger" : "outline"}>{labelPeristiwa(b.peristiwa)}</Badge>
          {b.alasan && <span className="ml-2 text-xs text-muted-foreground">{b.alasan}</span>}
        </td>
        <td className="p-2">{labelJalur(b.jalur)}</td>
        <td className="p-2 font-mono text-xs">{b.ip || "-"}</td>
        <td className="p-2">{[b.peramban, b.os, b.model].filter(Boolean).join(" · ") || "-"}</td>
      </tr>
      {terbuka && (
        <tr className="bg-muted/30">
          <td colSpan={6} className="p-3">
            <dl className="grid gap-x-6 gap-y-1 text-xs md:grid-cols-2">
              <Rinci k="Peran" v={b.peran ? getRoleLabel(b.peran as RoleId) : "-"} />
              <Rinci k="Jenis perangkat" v={b.jenis_perangkat || "-"} />
              <Rinci k="Nama komputer" v={b.nama_komputer || "tidak terbaca"} />
              <Rinci k="MAC" v={teksMac(b.mac, b.mac_sumber, b.jenis_perangkat === "hp" ? "tidak terbaca (HP)" : "")} />
              <Rinci k="Rantai alamat" v={b.rantai_xff || "-"} />
              <Rinci k="Simpan login" v={b.ingat === "ya" ? "Ya" : b.ingat === "tidak" ? "Tidak" : "-"} />
              <Rinci k="Kode perangkat" v={b.perangkat_id || "-"} />
              <Rinci k="Rujukan sesi" v={b.sesi_ref || "-"} />
              {b.pelaku_nama && <Rinci k="Oleh" v={b.pelaku_nama} />}
              <Rinci k="Peramban (lengkap)" v={b.agen || "-"} />
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

function Rinci({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-32 text-muted-foreground">{k}</dt>
      <dd className="break-all text-foreground">{v}</dd>
    </div>
  );
}

function TabSesi({ onGalat }: { onGalat: (g: string) => void }) {
  const [sesi, setSesi] = useState<SesiAktif[] | null>(null);
  const muat = useCallback(async () => {
    try {
      setSesi((await ambil<{ sesi: SesiAktif[] }>("/api/admin/jejak-masuk?tab=sesi")).sesi);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Sesi belum dapat dimuat.");
    }
  }, [onGalat]);
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const cabut = async (userId: string, perangkatId?: string) => {
    if (!window.confirm(perangkatId ? "Keluarkan perangkat ini?" : "Keluarkan SEMUA perangkat akun ini?")) return;
    try {
      await ambil("/api/admin/jejak-masuk/cabut", { method: "POST", body: JSON.stringify(perangkatId ? { userId, perangkatId } : { userId, semua: true }) });
      await muat();
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Gagal mengeluarkan.");
    }
  };

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-base">Sesi aktif</CardTitle>
        <CardDescription>Perangkat yang sedang masuk, per akun. Yang dikeluarkan harus masuk lagi di perangkat itu.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-2">Akun</th><th className="p-2">Perangkat</th><th className="p-2">Terakhir aktif</th><th className="p-2">IP</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {(sesi ?? []).map((s) => (
              <tr key={`${s.userId}-${s.perangkatId}`} className="border-t border-border/60">
                <td className="p-2">{s.namaAkun} <span className="text-xs text-muted-foreground">({s.peran ? getRoleLabel(s.peran as RoleId) : "-"})</span></td>
                <td className="p-2">{s.nama}</td>
                <td className="p-2 whitespace-nowrap">{waktuWita(s.terakhirAktif)}</td>
                <td className="p-2 font-mono text-xs">{s.ip || "-"}</td>
                <td className="p-2 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => void cabut(s.userId, s.perangkatId)}><LogOut className="h-4 w-4" /> Keluarkan</Button>
                  <Button size="sm" variant="ghost" onClick={() => void cabut(s.userId)}>Semua</Button>
                </td>
              </tr>
            ))}
            {sesi && sesi.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Tidak ada sesi aktif.</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function TabPerangkat({ users }: { users: Akun[] }) {
  const [userId, setUserId] = useState("");
  const [daftar, setDaftar] = useState<Baris[]>([]);
  useEffect(() => {
    void ambil<{ perangkat: Baris[] }>(`/api/admin/jejak-masuk?tab=perangkat${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`)
      .then((d) => setDaftar(d.perangkat))
      .catch(() => setDaftar([]));
  }, [userId]);
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-base">Perangkat</CardTitle>
        <CardDescription>
          Satu peramban dihitung satu perangkat. Bila data peramban dihapus atau memakai jendela penyamaran, perangkat itu terhitung baru.
          MAC hanya terbaca dari ekstensi di PC kantor atau dari komputer yang satu jaringan dengan server; HP tidak pernah memberikannya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <NativeSelect value={userId} onChange={(e) => setUserId(e.target.value)} className="max-w-sm">
          <option value="">Semua akun</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </NativeSelect>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="p-2">Akun</th><th className="p-2">Perangkat</th><th className="p-2">Nama komputer</th><th className="p-2">MAC</th><th className="p-2">Pertama</th><th className="p-2">Terakhir</th><th className="p-2">IP terakhir</th></tr>
            </thead>
            <tbody>
              {daftar.map((p) => (
                <tr key={`${p.perangkat_id}-${p.user_id}`} className="border-t border-border/60">
                  <td className="p-2">{p.nama || p.username}</td>
                  <td className="p-2">{p.label || p.nama_terbaca}{p.os_rinci ? <span className="block text-xs text-muted-foreground">{p.os_rinci}</span> : null}</td>
                  <td className="p-2">{p.nama_komputer || "-"}</td>
                  <td className="p-2 text-xs">{teksMac(p.mac, p.mac_sumber, p.mac_catatan)}</td>
                  <td className="p-2 whitespace-nowrap">{waktuWita(p.pertama_dilihat)}</td>
                  <td className="p-2 whitespace-nowrap">{waktuWita(p.terakhir_dilihat)}</td>
                  <td className="p-2 font-mono text-xs">{p.ip_terakhir || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TabBatas({ superAdmin, users, roles, onGalat }: { superAdmin: boolean; users: Akun[]; roles: PeranOpsi[]; onGalat: (g: string) => void }) {
  const [kebijakan, setKebijakan] = useState<Kebijakan[]>([]);
  const [setelan, setSetelan] = useState<Setelan | null>(null);
  const [baru, setBaru] = useState({ sasaran: "", maks: "2", perilaku: "keluarkan-terlama", berlakuSampai: "", alasan: "" });
  const muat = useCallback(async () => {
    try {
      setKebijakan((await ambil<{ kebijakan: Kebijakan[] }>("/api/admin/batas-perangkat")).kebijakan);
      setSetelan((await ambil<{ setelan: Setelan }>("/api/admin/jejak-masuk/setelan")).setelan);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Batas perangkat belum dapat dimuat.");
    }
  }, [onGalat]);
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const simpan = async (badan: Record<string, unknown>) => {
    try {
      onGalat("");
      setKebijakan((await ambil<{ kebijakan: Kebijakan[] }>("/api/admin/batas-perangkat", { method: "POST", body: JSON.stringify(badan) })).kebijakan);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Batas tidak tersimpan.");
    }
  };
  const hapus = async (cakupan: string, sasaran: string) => {
    try {
      setKebijakan((await ambil<{ kebijakan: Kebijakan[] }>(`/api/admin/batas-perangkat?cakupan=${cakupan}&sasaran=${encodeURIComponent(sasaran)}`, { method: "DELETE" })).kebijakan);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  };
  const simpanSetelan = async (ubah: Partial<Setelan>) => {
    try {
      setSetelan((await ambil<{ setelan: Setelan }>("/api/admin/jejak-masuk/setelan", { method: "POST", body: JSON.stringify(ubah) })).setelan);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Setelan tidak tersimpan.");
    }
  };
  const milikPeran = (id: string) => kebijakan.find((k) => k.cakupan === "peran" && k.sasaran === id);
  const pengecualian = kebijakan.filter((k) => k.cakupan === "akun");
  const namaAkun = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Batas per peran</CardTitle>
          <CardDescription>
            Kosong atau 0 = tanpa batas (bawaan). Yang dihitung perangkat yang sedang masuk, bukan jumlah sesi; masuk ulang dari perangkat yang sama tidak menambah hitungan.
            Akun dengan beberapa peran memakai batas terbesar. Super Admin tidak pernah ditolak: perangkat terlamanya yang dikeluarkan.
            {!superAdmin && " Hanya Super Admin yang dapat mengubah batas per peran."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="p-2">Peran</th><th className="p-2">Maks. perangkat</th><th className="p-2">Saat penuh</th><th className="p-2" /></tr></thead>
            <tbody>
              {roles.map((r) => (
                <BarisPeran key={r.id} peran={r} k={milikPeran(r.id)} bolehUbah={superAdmin} onSimpan={simpan} onHapus={() => void hapus("peran", r.id)} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Pengecualian per akun</CardTitle>
          <CardDescription>Pengecualian menang atas batas peran (misalnya pegawai yang memakai dua komputer). Boleh diberi tanggal berakhir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-6">
            <NativeSelect value={baru.sasaran} onChange={(e) => setBaru({ ...baru, sasaran: e.target.value })} className="md:col-span-2">
              <option value="">Pilih akun</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
            </NativeSelect>
            <Input type="number" min={0} max={50} value={baru.maks} onChange={(e) => setBaru({ ...baru, maks: e.target.value })} aria-label="Maks. perangkat" />
            <NativeSelect value={baru.perilaku} onChange={(e) => setBaru({ ...baru, perilaku: e.target.value })}>
              {Object.entries(LABEL_PERILAKU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
            <Input type="date" value={baru.berlakuSampai} onChange={(e) => setBaru({ ...baru, berlakuSampai: e.target.value })} aria-label="Berlaku sampai" />
            <Input placeholder="Alasan" value={baru.alasan} onChange={(e) => setBaru({ ...baru, alasan: e.target.value })} />
          </div>
          <Button
            size="sm"
            disabled={!baru.sasaran}
            onClick={() =>
              void simpan({
                cakupan: "akun",
                sasaran: baru.sasaran,
                maks: Number(baru.maks),
                perilaku: baru.perilaku,
                berlakuSampai: baru.berlakuSampai ? `${baru.berlakuSampai}T23:59:59+08:00` : "",
                alasan: baru.alasan,
              })
            }
          >
            Simpan pengecualian
          </Button>
          <table className="w-full text-sm">
            <tbody>
              {pengecualian.map((k) => (
                <tr key={k.sasaran} className="border-t border-border/60">
                  <td className="p-2">{namaAkun(k.sasaran)}</td>
                  <td className="p-2">{k.maks > 0 ? `${k.maks} perangkat` : "Tanpa batas"} · {LABEL_PERILAKU[k.perilaku] ?? k.perilaku}</td>
                  <td className="p-2 text-xs text-muted-foreground">{k.berlaku_sampai ? `sampai ${waktuWita(k.berlaku_sampai)}` : "tanpa batas waktu"} {k.alasan && `· ${k.alasan}`}</td>
                  <td className="p-2 text-xs text-muted-foreground">{k.diubah_nama} {waktuWita(k.diubah_pada)}</td>
                  <td className="p-2"><Button size="sm" variant="ghost" onClick={() => void hapus("akun", k.sasaran)} aria-label="Hapus pengecualian"><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {setelan && (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-base">Setelan riwayat masuk</CardTitle>
            <CardDescription>{superAdmin ? "Berlaku untuk seluruh satker." : "Hanya Super Admin yang dapat mengubah."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <label className="text-sm">Simpan riwayat (hari)
              <Input type="number" min={30} max={3650} defaultValue={setelan.retensiHari} disabled={!superAdmin} onBlur={(e) => void simpanSetelan({ retensiHari: Number(e.target.value) })} />
            </label>
            <label className="text-sm">Jam kerja mulai
              <Input type="time" defaultValue={setelan.jamKerjaMulai} disabled={!superAdmin} onBlur={(e) => void simpanSetelan({ jamKerjaMulai: e.target.value })} />
            </label>
            <label className="text-sm">Jam kerja selesai
              <Input type="time" defaultValue={setelan.jamKerjaSelesai} disabled={!superAdmin} onBlur={(e) => void simpanSetelan({ jamKerjaSelesai: e.target.value })} />
            </label>
            <label className="flex items-end gap-2 pb-3 text-sm">
              <input type="checkbox" checked={setelan.catatAkunWindows} disabled={!superAdmin} onChange={(e) => void simpanSetelan({ catatAkunWindows: e.target.checked })} />
              Catat nama akun Windows (dari ekstensi)
            </label>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BarisPeran({ peran, k, bolehUbah, onSimpan, onHapus }: { peran: PeranOpsi; k?: Kebijakan; bolehUbah: boolean; onSimpan: (b: Record<string, unknown>) => Promise<void>; onHapus: () => void }) {
  const [maks, setMaks] = useState(String(k?.maks ?? 0));
  const superAdmin = peran.id === "super-admin";
  const [perilaku, setPerilaku] = useState(superAdmin ? "keluarkan-terlama" : k?.perilaku ?? "keluarkan-terlama");
  return (
    <tr className="border-t border-border/60">
      <td className="p-2">{peran.name}</td>
      <td className="p-2"><Input type="number" min={0} max={50} value={maks} disabled={!bolehUbah} onChange={(e) => setMaks(e.target.value)} className="h-9 w-24" aria-label={`Maks. perangkat ${peran.name}`} /></td>
      <td className="p-2">
        <NativeSelect value={perilaku} disabled={!bolehUbah || superAdmin} onChange={(e) => setPerilaku(e.target.value)} className="h-9">
          {Object.entries(LABEL_PERILAKU).map(([kk, v]) => <option key={kk} value={kk}>{v}</option>)}
        </NativeSelect>
      </td>
      <td className="p-2 whitespace-nowrap">
        {bolehUbah && <Button size="sm" variant="outline" onClick={() => void onSimpan({ cakupan: "peran", sasaran: peran.id, maks: Number(maks), perilaku })}>Simpan</Button>}
        {bolehUbah && k && <Button size="sm" variant="ghost" onClick={onHapus}>Hapus</Button>}
      </td>
    </tr>
  );
}
