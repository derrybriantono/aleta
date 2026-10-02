"use client";

/**
 * ============================================================================
 * CAP PENGADILAN - TEMPAT MENGUNGGAH CAP UNTUK EDOC PENETAPAN (butir 17, K6)
 * ============================================================================
 *
 * Tampil di bawah daftar tanda tangan pada menu "Berkas tanda tangan" ALETA
 * e-Court. Cap DIPERLAKUKAN BEDA dari tanda tangan: tanda tangan milik satu
 * orang dan wajib disahkan; cap milik JABATAN dan dapat dipakai pejabat mana
 * saja sesuai nama/peruntukannya (Ketua untuk PMH, Panitera untuk PPP/PJS,
 * Ketua Majelis untuk PHS, Umum sebagai cadangan). Cap ditempel otomatis DI
 * ATAS tanda tangan pada edoc penetapan.
 *
 * Cap tidak dihapus - dimatikan/dinyalakan, sehingga cap yang pernah dipakai
 * tetap terlihat.
 */

import { useCallback, useEffect, useState } from "react";

import { Power, RefreshCw, Stamp, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

type BarisCap = {
  id: string;
  nama: string;
  peruntukan: string;
  keterangan: string;
  jenisBerkas: string;
  ukuran: number;
  aktif: boolean;
  diunggahOlehNama: string;
  diubahPada: string;
};

type Peruntukan = { kode: string; sebutan: string };

const PERUNTUKAN_BAWAAN: Peruntukan[] = [
  { kode: "ketua", sebutan: "Ketua (PMH)" },
  { kode: "panitera", sebutan: "Panitera (PPP, PJS)" },
  { kode: "hakim", sebutan: "Ketua Majelis (PHS)" },
  { kode: "umum", sebutan: "Umum (semua jenis)" },
];

type HasilBaca =
  | { ok: true; baris: BarisCap[]; peruntukan: Peruntukan[] }
  | { ok: false; pesan: string };

/** Membaca daftar cap - TANPA menyentuh state komponen. */
async function bacaDaftarCap(): Promise<HasilBaca> {
  try {
    const r = await fetch(apiPath("/api/aleta-ecourt/penetapan-edoc/cap"), {
      credentials: "include",
      cache: "no-store",
    });
    if (r.status === 404) return { ok: false, pesan: "Tempat cap belum tersedia di server." };
    if (!r.ok) {
      return {
        ok: false,
        pesan: r.status === 403 ? "Hanya admin yang dapat mengelola cap." : `ALETA menjawab ${r.status}.`,
      };
    }
    const bungkus = (await r.json()) as { data?: { baris?: BarisCap[]; peruntukan?: Peruntukan[] } };
    return {
      ok: true,
      baris: Array.isArray(bungkus.data?.baris) ? bungkus.data.baris : [],
      peruntukan: Array.isArray(bungkus.data?.peruntukan) ? bungkus.data.peruntukan : [],
    };
  } catch {
    return { ok: false, pesan: "Daftar cap tidak dapat dibaca." };
  }
}

export function AletaEcourtCap() {
  const [baris, setBaris] = useState<BarisCap[]>([]);
  const [peruntukan, setPeruntukan] = useState<Peruntukan[]>(PERUNTUKAN_BAWAAN);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [bukaTambah, setBukaTambah] = useState(false);
  const [nama, setNama] = useState("");
  const [untuk, setUntuk] = useState("panitera");
  const [keterangan, setKeterangan] = useState("");
  const [berkas, setBerkas] = useState<{
    nama: string;
    base64: string;
    ukuran: number;
  } | null>(null);

  // Hasil bacaan diterapkan di dalam callback janji - tidak ada setState
  // serentak di badan efek (react-hooks/set-state-in-effect).
  const terapkan = useCallback((h: HasilBaca) => {
    if (h.ok) {
      setBaris(h.baris);
      if (h.peruntukan.length) setPeruntukan(h.peruntukan);
    } else {
      setPesan(h.pesan);
      setBaris([]);
    }
    setMemuat(false);
  }, []);

  useEffect(() => {
    let batal = false;
    void bacaDaftarCap().then((h) => {
      if (!batal) terapkan(h);
    });
    return () => {
      batal = true;
    };
  }, [terapkan]);

  const muat = useCallback(async () => {
    setMemuat(true);
    setPesan("");
    terapkan(await bacaDaftarCap());
  }, [terapkan]);

  const kirim = useCallback(
    async (muatan: Record<string, unknown>) => {
      setSibuk(true);
      setPesan("");
      try {
        const r = await fetch(apiPath("/api/aleta-ecourt/penetapan-edoc/cap"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(muatan),
        });
        const bungkus = (await r.json().catch(() => ({}))) as {
          data?: { ok?: boolean; pesan?: string };
        };
        if (!r.ok || bungkus.data?.ok === false) {
          setPesan(bungkus.data?.pesan || `ALETA menjawab ${r.status}.`);
          return false;
        }
        await muat();
        return true;
      } catch {
        setPesan("Permintaan tidak terkirim.");
        return false;
      } finally {
        setSibuk(false);
      }
    },
    [muat],
  );

  const pilihBerkas = useCallback((f: File | null) => {
    if (!f) return setBerkas(null);
    const baca = new FileReader();
    baca.onload = () => {
      const teks = String(baca.result || "");
      setBerkas({
        nama: f.name,
        base64: teks.slice(teks.indexOf(",") + 1),
        ukuran: f.size,
      });
    };
    baca.readAsDataURL(f);
  }, []);

  const simpan = useCallback(async () => {
    if (!berkas) return;
    const berhasil = await kirim({
      tindakan: "tambah",
      nama,
      peruntukan: untuk,
      keterangan,
      isiBase64: berkas.base64,
    });
    if (berhasil) {
      setNama("");
      setKeterangan("");
      setBerkas(null);
      setBukaTambah(false);
    }
  }, [berkas, keterangan, kirim, nama, untuk]);

  const sebutan = (kode: string) =>
    peruntukan.find((p) => p.kode === kode)?.sebutan ?? kode;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Stamp className="h-4 w-4" aria-hidden />
          Cap pengadilan
          <Badge variant="outline">
            {baris.filter((b) => b.aktif).length} aktif
          </Badge>
        </CardTitle>
        <CardDescription>
          Cap ditempel otomatis di atas tanda tangan pada edoc penetapan (PMH,
          PPP, PJS, PHS). Berbeda dari tanda tangan, cap milik jabatan: dapat
          dipakai pejabat mana saja sesuai peruntukannya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void muat()}
            disabled={memuat || sibuk}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
          <Button
            type="button"
            size="sm"
            variant={bukaTambah ? "secondary" : "default"}
            onClick={() => setBukaTambah((x) => !x)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Unggah cap
          </Button>
        </div>

        {bukaTambah ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Unggah gambar cap sendiri (PNG berlatar transparan paling baik,
              paling besar 3 MB). Cap yang aktif dan terbaru untuk peruntukan
              itu yang dipakai.
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                Nama cap
                <Input
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Cap Panitera PA Donggala"
                />
              </label>
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                Peruntukan
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  value={untuk}
                  onChange={(e) => setUntuk(e.target.value)}
                >
                  {peruntukan.map((p) => (
                    <option key={p.kode} value={p.kode}>
                      {p.sebutan}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Keterangan (opsional)
              <Input
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Berkas gambar cap
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="text-sm text-foreground"
                onChange={(e) => pilihBerkas(e.target.files?.[0] ?? null)}
              />
              {berkas ? (
                <span className="text-[0.7rem]">
                  {berkas.nama} · {Math.round(berkas.ukuran / 1024)} KB
                </span>
              ) : null}
            </label>
            <Button
              type="button"
              size="sm"
              disabled={sibuk || !berkas || !nama.trim()}
              onClick={() => void simpan()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Simpan cap
            </Button>
          </div>
        ) : null}

        {pesan ? <p className="text-sm text-destructive">{pesan}</p> : null}

        {memuat ? (
          <div className="min-h-[6rem] animate-pulse rounded-lg border border-border bg-muted/30" />
        ) : baris.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada cap. Edoc penetapan tidak dapat diunggah sampai cap untuk
            peruntukannya (atau cap Umum) diunggah.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {baris.map((c) => (
              <div
                key={c.id}
                className="space-y-2 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex h-28 items-center justify-center rounded border border-border bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={apiPath(
                      `/api/aleta-ecourt/penetapan-edoc/cap/${encodeURIComponent(c.id)}/gambar`,
                    )}
                    alt={`Cap ${c.nama}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="text-sm font-medium text-foreground">{c.nama}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{sebutan(c.peruntukan)}</Badge>
                  <Badge variant={c.aktif ? "default" : "muted"}>
                    {c.aktif ? "Aktif" : "Mati"}
                  </Badge>
                </div>
                {c.keterangan ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    {c.keterangan}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {c.jenisBerkas.toUpperCase()} ·{" "}
                    {Math.round(c.ukuran / 1024)} KB
                    {c.diunggahOlehNama ? ` · ${c.diunggahOlehNama}` : ""}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={sibuk}
                    onClick={() =>
                      void kirim({
                        tindakan: "aktif",
                        id: c.id,
                        aktif: !c.aktif,
                      })
                    }
                    title={
                      c.aktif
                        ? "Matikan cap ini (tidak dihapus)"
                        : "Nyalakan cap ini"
                    }
                  >
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
