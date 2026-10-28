"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Lock, LoaderCircle, RotateCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import type { ElemenBerlaku, HalamanSipp, JenisElemen } from "@/lib/tampilan-sipp";

/**
 * Pengaturan tampilan ALETA di halaman SIPP milik pengguna sendiri (28 Okt 2026).
 * Tiap elemen: pratinjau tulisan yang tampil di SIPP, penjelasan, dan saklar. Elemen yang dikunci admin
 * tampil dengan keterangan "diatur admin". Tersimpan otomatis ke akun (PUT /api/aleta-ecourt/ekstensi/tampilan-sipp)
 * sehingga sama di PC mana pun dan sesudah keluar-masuk lagi.
 */

type ElemenKatalog = { kunci: string; halaman: HalamanSipp; nama: string; jelas: string; contoh: string; jenis: JenisElemen };
type Data = {
  halaman: Record<HalamanSipp, string>;
  katalog: ElemenKatalog[];
  berlaku: ElemenBerlaku[];
  golongan: Array<{ id: string; label: string }>;
  pilihanDiubahPada: string | null;
  ditolak?: string[];
};

async function ambil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data belum dapat dimuat.");
  return j.data as T;
}

const ALAMAT = "/api/aleta-ecourt/ekstensi/tampilan-sipp";

function keteranganSumber(b: ElemenBerlaku): string {
  const siapa = b.oleh === "super" ? "dikunci Super Admin" : "diatur admin";
  if (b.mode === "selalu") return `Selalu tampil - ${siapa}`;
  if (b.mode === "tidak") return `Tidak tersedia untuk akun Anda - ${siapa}`;
  if (b.sumber === "pilihan") return b.tampil ? "Anda menyalakannya" : "Anda mematikannya";
  const penyetel = b.oleh === "super" ? "Super Admin" : "admin";
  if (b.sumber === "pengguna") return `Bawaan dari ${penyetel} untuk akun Anda: ${b.bawaan ? "tampil" : "tersembunyi"}`;
  if (b.sumber === "peran") return `Bawaan dari ${penyetel} untuk peran Anda: ${b.bawaan ? "tampil" : "tersembunyi"}`;
  return `Usulan untuk peran Anda: ${b.bawaan ? "tampil" : "tersembunyi - boleh Anda nyalakan"}`;
}

export function TampilanSippSaya() {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState<string>("");
  const antre = useRef<Promise<unknown>>(Promise.resolve());

  const muat = useCallback(async () => {
    try {
      setData(await ambil<Data>(ALAMAT));
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data belum dapat dimuat.");
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const peta = useMemo(() => new Map((data?.berlaku ?? []).map((b) => [b.kunci, b])), [data]);

  // Tersimpan otomatis: tiap saklar langsung dikirim, berurutan supaya jawaban lama tidak menimpa yang baru.
  const ubah = useCallback((kunci: string, tampil: boolean) => {
    setSibuk(kunci);
    setData((d) => (d ? { ...d, berlaku: d.berlaku.map((b) => (b.kunci === kunci ? { ...b, tampil } : b)) } : d));
    antre.current = antre.current.then(async () => {
      try {
        const hasil = await ambil<Data>(ALAMAT, { method: "PUT", body: JSON.stringify({ pilihan: { [kunci]: tampil } }) });
        setData(hasil);
        setKabar(hasil.ditolak && hasil.ditolak.length ? "Sebagian tidak tersimpan karena diatur admin." : "Tersimpan di akun Anda - berlaku di PC mana pun sesudah halaman SIPP dimuat ulang.");
        setGalat("");
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Belum tersimpan.");
        void muat();
      } finally {
        setSibuk("");
      }
    });
  }, [muat]);

  const kembalikan = useCallback(async () => {
    setSibuk("semua");
    try {
      setData(await ambil<Data>(ALAMAT, { method: "DELETE" }));
      setKabar("Kembali ke bawaan peran Anda.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum dapat dikembalikan.");
    } finally {
      setSibuk("");
    }
  }, []);

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          {galat ? galat : (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat pengaturan tampilan...
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const kata = cari.trim().toLowerCase();
  const kelompok = (Object.keys(data.halaman) as HalamanSipp[])
    .map((h) => ({
      h,
      judul: data.halaman[h],
      butir: data.katalog.filter((el) => el.halaman === h && (!kata || `${el.nama} ${el.jelas} ${el.contoh}`.toLowerCase().includes(kata))),
    }))
    .filter((k) => k.butir.length);
  const jumlahTampil = data.berlaku.filter((b) => b.tampil).length;

  return (
    <div className="space-y-6" data-tampilan-sipp-saya>
      <Card>
        <CardHeader>
          <CardTitle>Yang tampil di halaman SIPP</CardTitle>
          <CardDescription>
            Pilih bagian ALETA yang ingin Anda lihat di halaman SIPP. Pilihan tersimpan otomatis di akun Anda, jadi tetap sama sesudah keluar dan masuk lagi, di komputer mana pun.
            Menyembunyikan hanya tidak menggambar: pekerjaan ALETA di latar tetap berjalan, dan menampilkan tidak menambah hak Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="info">{jumlahTampil} dari {data.berlaku.length} tampil</Badge>
            {data.golongan.map((g) => (
              <Badge key={g.id} variant="outline">{g.label}</Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Seluruh tampilan ALETA di SIPP bawaannya tersembunyi sampai Anda menampilkannya lewat popup ekstensi (Tampilkan ALETA di SIPP) atau tombol Alt+Shift+A di halaman SIPP. Pengaturan di bawah ini menentukan bagian mana yang ikut tampil.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari bagian, misalnya lencana atau jadwalkan" className="pl-9" aria-label="Cari bagian" />
            </div>
            <Button variant="outline" onClick={() => void kembalikan()} disabled={sibuk !== ""}>
              <RotateCcw className="mr-2 h-4 w-4" /> Kembali ke bawaan peran
            </Button>
          </div>
          {kabar ? <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">{kabar}</p> : null}
          {galat ? <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{galat}</p> : null}
        </CardContent>
      </Card>

      {kelompok.map((k) => (
        <Card key={k.h} data-halaman-sipp={k.h}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{k.judul}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {k.butir.map((el) => {
                const b = peta.get(el.kunci);
                if (!b) return null;
                const id = `tampilan-sipp-${el.kunci.replace(/\./g, "-")}`;
                return (
                  <li key={el.kunci} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-start" data-elemen={el.kunci} data-tampil={b.tampil ? "ya" : "tidak"} data-terkunci={b.terkunci ? "ya" : "tidak"}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={id} className="text-sm font-medium text-foreground">{el.nama}</label>
                        <Badge variant={el.jenis === "aksi" ? "netral" : "muted"}>{el.jenis === "aksi" ? "Ada tombol" : "Keterangan"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{el.jelas}</p>
                      <div className="rounded-lg border border-dashed border-border bg-muted/40 px-2 py-1 text-xs text-foreground" aria-label="Contoh tampilan di SIPP">
                        <span className="mr-1 text-muted-foreground">Contoh:</span>
                        <span className={b.tampil ? "" : "line-through opacity-60"}>{el.contoh}</span>
                      </div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {b.terkunci ? <Lock className="h-3 w-3" /> : null}
                        {keteranganSumber(b)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {b.tampil ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <Switch
                        id={id}
                        checked={b.tampil}
                        disabled={b.terkunci || sibuk === "semua"}
                        onCheckedChange={(v) => ubah(el.kunci, v)}
                        aria-label={`${b.tampil ? "Sembunyikan" : "Tampilkan"} ${el.nama}`}
                      />
                      {sibuk === el.kunci ? <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
