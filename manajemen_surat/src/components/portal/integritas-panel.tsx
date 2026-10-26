"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import type { Temuan, RingkasIntegritas } from "@/server/modules/integritas/layanan";
import type { FolderIntegritas, PengaturanIntegritas } from "@/server/modules/integritas/pengaturan";

/**
 * Penjaga integritas berkas (E6). Admin melihat temuan; Super Admin juga
 * mengatur folder, memindai, dan menandai. ALETA hanya MEMBACA folder itu.
 */
type Data = { ringkas: RingkasIntegritas; temuan: Temuan[]; memindai: boolean; pengaturan: PengaturanIntegritas; boleh: boolean };

async function panggil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data belum dapat dimuat.");
  return j.data as T;
}

const waktu = (iso: string) => (iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }) : "-");
const UNGGAHAN_BAWAAN = "uploads, upload, files, images, media, cache, tmp, wp-content/uploads";

type BarisFolder = { id: string; nama: string; jalur: string; jenis: string; unggahan: string };
const keBaris = (f: FolderIntegritas): BarisFolder => ({ id: f.id, nama: f.nama, jalur: f.jalur, jenis: f.jenis, unggahan: f.unggahan.join(", ") });

export function IntegritasPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [aktif, setAktif] = useState(false);
  const [folder, setFolder] = useState<BarisFolder[]>([]);
  const [halaman, setHalaman] = useState("");
  const [selang, setSelang] = useState("360");
  const [wa, setWa] = useState(true);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [alasan, setAlasan] = useState<Record<string, string>>({});
  const [semua, setSemua] = useState(false);

  const isi = useCallback((d: Data) => {
    setData(d);
    setAktif(d.pengaturan.aktif);
    setFolder(d.pengaturan.folder.map(keBaris));
    setHalaman(d.pengaturan.halamanPublik.join("\n"));
    setSelang(String(d.pengaturan.selangMenit));
    setWa(d.pengaturan.peringatanWa);
  }, []);

  const muat = useCallback(async () => {
    try {
      isi(await panggil<Data>("/api/admin/integritas"));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data belum dapat dimuat.");
    }
  }, [isi]);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const jalankan = async (fn: () => Promise<void>, pesan = "") => {
    setSibuk(true);
    setGalat("");
    setInfo("");
    try {
      await fn();
      if (pesan) setInfo(pesan);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Permintaan belum berhasil.");
    } finally {
      setSibuk(false);
    }
  };

  const simpan = () =>
    jalankan(async () => {
      isi(
        await panggil<Data>("/api/admin/integritas", {
          method: "POST",
          body: JSON.stringify({
            aktif,
            folder: folder.map((f) => ({ id: f.id, nama: f.nama, jalur: f.jalur, jenis: f.jenis, unggahan: f.unggahan.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean) })),
            halamanPublik: halaman.split(/\n+/).map((x) => x.trim()).filter(Boolean),
            selangMenit: Number(selang),
            peringatanWa: wa,
          }),
        })
      );
    }, aktif ? "Disimpan. Penjaga MENYALA: pemindaian awal berjalan pada detak berikutnya (tanpa peringatan untuk isi lama)." : "Disimpan. Penjaga mati: tidak ada folder yang dibaca.");

  const pindai = (jenis: "otomatis" | "penuh") =>
    jalankan(async () => {
      await panggil("/api/admin/integritas/pindai", { method: "POST", body: JSON.stringify({ jenis }) });
      window.setTimeout(() => void muat(), 4000);
    }, "Pemindaian dimulai di latar. Muat ulang daftar beberapa saat lagi.");

  const tandai = (id: string, aksi: "ditangani" | "aman") =>
    jalankan(async () => {
      await panggil("/api/admin/integritas/temuan", { method: "POST", body: JSON.stringify({ id, aksi, alasan: alasan[id] ?? "" }) });
      await muat();
    });

  const boleh = data?.boleh ?? false;
  const daftar = (data?.temuan ?? []).filter((t) => semua || t.status === "baru");

  return (
    <div className="space-y-6" data-integritas-panel>
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      {info && <p className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">{info}</p>}

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3 text-base">
            <ShieldAlert className="h-5 w-5 text-primary" aria-hidden />
            Penjaga integritas berkas
            <Badge variant={data?.ringkas.aktif ? "success" : "muted"}>{data?.ringkas.aktif ? "Menyala" : "Mati"}</Badge>
            <Badge variant={data && data.ringkas.temuanBaru > 0 ? "danger" : "muted"}>{data?.ringkas.temuanBaru ?? 0} temuan baru</Badge>
          </CardTitle>
          <CardDescription>
            ALETA hanya MEMBACA folder yang didaftarkan: tidak menulis, memindah, atau menghapus apa pun, dan isi berkas mencurigakan tidak disalin. Pindai terakhir: {waktu(data?.ringkas.pindaiTerakhir ?? "")}
            {data?.memindai ? " (sedang memindai)" : ""}.
          </CardDescription>
        </CardHeader>
        {boleh && (
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>
                <span className="font-medium text-foreground">Nyalakan penjaga integritas</span>
                <span className="block text-muted-foreground">Mati bawaan. Pemindaian pertama hanya mencatat sidik semua berkas (baseline) tanpa memperingatkan isi lama.</span>
              </span>
            </label>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Folder yang dijaga (jalur seperti terlihat dari server ALETA, mount baca-saja)</p>
              {folder.map((f, i) => (
                <div key={f.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                  <Input aria-label="Nama folder" placeholder="Nama (mis. Website PA)" value={f.nama} onChange={(e) => setFolder((l) => l.map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)))} />
                  <NativeSelect aria-label="Jenis folder" value={f.jenis} onChange={(e) => setFolder((l) => l.map((x, j) => (j === i ? { ...x, jenis: e.target.value } : x)))}>
                    <option value="website">Website satker</option>
                    <option value="sipp">SIPP</option>
                    <option value="abt">ABT</option>
                    <option value="lain">Lainnya</option>
                  </NativeSelect>
                  <Input aria-label="Jalur folder" className="sm:col-span-2" placeholder="/mnt/website-pa" value={f.jalur} onChange={(e) => setFolder((l) => l.map((x, j) => (j === i ? { ...x, jalur: e.target.value } : x)))} />
                  <Input aria-label="Folder unggahan" className="sm:col-span-2" placeholder={UNGGAHAN_BAWAAN} value={f.unggahan} onChange={(e) => setFolder((l) => l.map((x, j) => (j === i ? { ...x, unggahan: e.target.value } : x)))} />
                  <Button variant="outline" size="sm" className="sm:col-span-2 justify-self-start" onClick={() => setFolder((l) => l.filter((_, j) => j !== i))}>
                    Hapus dari daftar (berkasnya tidak disentuh)
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setFolder((l) => [...l, { id: "", nama: "", jalur: "", jenis: "website", unggahan: UNGGAHAN_BAWAAN }])}>
                Tambah folder
              </Button>
            </div>

            <div>
              <label htmlFor="halaman-integritas" className="text-sm font-medium text-foreground">
                Halaman publik website yang diperiksa kata judi online (satu alamat per baris)
              </label>
              <textarea
                id="halaman-integritas"
                rows={3}
                value={halaman}
                onChange={(e) => setHalaman(e.target.value)}
                placeholder="https://pa-contoh.go.id/"
                className="mt-1 w-full rounded-xl border border-input/90 bg-card/70 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="max-w-48">
                <label htmlFor="selang-integritas" className="text-sm font-medium text-foreground">
                  Selang pindai (menit)
                </label>
                <Input id="selang-integritas" inputMode="numeric" value={selang} onChange={(e) => setSelang(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={wa} onChange={(e) => setWa(e.target.checked)} className="h-4 w-4" />
                Kabari admin lewat WhatsApp bila ada temuan baru
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={sibuk} onClick={() => void simpan()}>
                {sibuk && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
              <Button variant="outline" disabled={sibuk || !data?.ringkas.aktif} onClick={() => void pindai("otomatis")}>
                Pindai sekarang
              </Button>
              <Button variant="outline" disabled={sibuk || !data?.ringkas.aktif} onClick={() => void pindai("penuh")}>
                Pindai penuh (hitung ulang semua sidik)
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Temuan</CardTitle>
          <CardDescription>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} className="h-4 w-4" />
              Tampilkan juga yang sudah ditangani
            </label>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {daftar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada temuan{semua ? "" : " baru"}.</p>
          ) : (
            <ul className="space-y-3">
              {daftar.map((t) => (
                <li key={t.id} className="space-y-2 rounded-xl border border-border p-3 text-sm" data-temuan={t.jenis}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={t.status === "baru" ? "danger" : "muted"}>{t.status === "baru" ? "Baru" : "Ditangani"}</Badge>
                    <span className="font-medium text-foreground">{t.label}</span>
                    <span className="text-muted-foreground">{t.folderNama}</span>
                  </div>
                  <p className="break-all font-mono text-xs text-foreground">
                    {t.jalur}
                    {t.baris ? ` (baris ${t.baris})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pertama {waktu(t.pertamaAt)}, terakhir {waktu(t.terakhirAt)}
                    {t.sha256 ? `, sha256 ${t.sha256.slice(0, 12)}...` : ""}
                    {t.status !== "baru" && t.tanganiOleh ? `. Ditangani oleh ${t.tanganiOleh}` : ""}
                  </p>
                  {boleh && t.status === "baru" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tandai(t.id, "ditangani")}>
                        Sudah ditangani
                      </Button>
                      {t.sha256 && (
                        <>
                          <Input
                            aria-label="Alasan diketahui aman"
                            className="max-w-64"
                            placeholder="Alasan (mis. pembaruan resmi CMS)"
                            value={alasan[t.id] ?? ""}
                            onChange={(e) => setAlasan((a) => ({ ...a, [t.id]: e.target.value }))}
                          />
                          <Button size="sm" variant="outline" disabled={sibuk || (alasan[t.id] ?? "").trim().length < 5} onClick={() => void tandai(t.id, "aman")}>
                            Diketahui aman
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
