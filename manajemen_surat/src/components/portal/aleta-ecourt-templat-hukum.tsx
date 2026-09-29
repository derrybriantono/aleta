"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Templat pertimbangan & dasar hukum - kartu admin.
 *
 * ============================================================================
 * DRAF SAMPAI DISAHKAN, DAN KEMBALI DRAF BEGITU DISUNTING
 * ============================================================================
 *
 * Seluruh benih tertulis "DRAF - belum disahkan pimpinan". Ekstensi hanya
 * menyisipkan butir yang disahkan; yang DRAF tampil di sana dengan tombol
 * sisip mati. Menyimpan suntingan selalu mencabut pengesahan - tombol Sahkan
 * baru muncul untuk kalimat yang sudah tersimpan, supaya yang disahkan adalah
 * yang sungguh terbaca di layar ini.
 *
 * Semua pegawai dapat membaca; hanya Super Admin yang mengubah (server
 * menjawab bolehMenyunting). Bukan Pustaka pertimbangan: pustaka menyerap
 * alinea putusan yang sudah ada, templat ini kerangka pendek per status
 * putusan dan per huruf alasan perceraian.
 */

type Butir = {
  id: string;
  jenis: "pertimbangan" | "pasal";
  kunci: string;
  judul: string;
  isi: string;
  disahkan: boolean;
  disahkanOleh: { id: string; nama: string } | null;
  disahkanPada: string | null;
  diubahPada: string;
  benih?: boolean;
};

type Jawaban = { butir: Butir[]; bolehMenyunting: boolean; tandaDraf: string };

const ALAMAT = "/api/aleta-ecourt/templat-hukum";

function waktuSingkat(iso: string | null) {
  if (!iso) return "";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function BarisButir({
  butir,
  boleh,
  tandaDraf,
  sibuk,
  onUbah,
}: {
  butir: Butir;
  boleh: boolean;
  tandaDraf: string;
  sibuk: boolean;
  onUbah: (cara: "PUT" | "DELETE", badan: Record<string, unknown>) => Promise<boolean>;
}) {
  const [menyunting, setMenyunting] = useState(false);
  const [judul, setJudul] = useState(butir.judul);
  const [isi, setIsi] = useState(butir.isi);

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{butir.jenis === "pasal" ? `huruf ${butir.kunci}` : butir.kunci}</Badge>
        <span className="text-sm font-medium">{butir.judul}</span>
        {butir.disahkan ? (
          <Badge variant="success">
            Disahkan {butir.disahkanOleh ? butir.disahkanOleh.nama : ""} · {waktuSingkat(butir.disahkanPada)}
          </Badge>
        ) : (
          <Badge variant="warning">{tandaDraf}</Badge>
        )}
      </div>

      {menyunting ? (
        <div className="mt-2 space-y-2">
          <Input value={judul} onChange={(e) => setJudul(e.target.value)} aria-label="Judul" />
          <Textarea className="min-h-[160px] font-mono text-xs" value={isi} onChange={(e) => setIsi(e.target.value)} aria-label="Isi" />
          <p className="text-xs text-muted-foreground">Menyimpan suntingan mengembalikan templat ini ke DRAF.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={sibuk}
              onClick={async () => {
                if (await onUbah("PUT", { id: butir.id, judul, isi })) setMenyunting(false);
              }}
            >
              Simpan (kembali DRAF)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={sibuk}
              onClick={() => {
                setJudul(butir.judul);
                setIsi(butir.isi);
                setMenyunting(false);
              }}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">{butir.isi}</pre>
      )}

      {boleh && !menyunting ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {butir.disahkan ? (
            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void onUbah("PUT", { id: butir.id, sahkan: false })}>
              Cabut pengesahan
            </Button>
          ) : (
            <Button size="sm" disabled={sibuk} onClick={() => void onUbah("PUT", { id: butir.id, sahkan: true })}>
              Sahkan atas nama pimpinan
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setMenyunting(true)}>
            Sunting
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={sibuk}
            onClick={() => {
              if (window.confirm(`Hapus templat "${butir.judul}"? Benih yang dihapus tidak ditanam lagi.`)) {
                void onUbah("DELETE", { id: butir.id });
              }
            }}
          >
            Hapus
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function AletaEcourtTemplatHukum() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [baru, setBaru] = useState({ jenis: "pertimbangan", kunci: "", judul: "", isi: "" });

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath(ALAMAT), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca templat hukum."));
      setData(isi?.data ?? null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal membaca templat hukum.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const kirim = useCallback(
    async (cara: "POST" | "PUT" | "DELETE", badan: Record<string, unknown>) => {
      setSibuk(true);
      setGalat("");
      setKabar("");
      try {
        const jawaban = await fetch(apiPath(ALAMAT), {
          method: cara,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(badan),
        });
        const isi = await jawaban.json().catch(() => null);
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Templat gagal disimpan."));
        setData((lama) => (lama ? { ...lama, butir: isi.data.butir as Butir[] } : lama));
        setKabar(cara === "DELETE" ? "Templat dihapus." : "Tersimpan.");
        return true;
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Templat gagal disimpan.");
        return false;
      } finally {
        setSibuk(false);
      }
    },
    []
  );

  const pertimbangan = data?.butir.filter((b) => b.jenis === "pertimbangan") ?? [];
  const pasal = data?.butir.filter((b) => b.jenis === "pasal") ?? [];
  const boleh = Boolean(data?.bolehMenyunting);
  const tanda = data?.tandaDraf ?? "DRAF - belum disahkan pimpinan";
  const jumlahDraf = data?.butir.filter((b) => !b.disahkan).length ?? 0;

  return (
    <Card id="templat-hukum">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Templat pertimbangan & dasar hukum
          {data ? <Badge variant={jumlahDraf > 0 ? "warning" : "success"}>{jumlahDraf} DRAF</Badge> : null}
        </CardTitle>
        <CardDescription>
          Kerangka pertimbangan untuk putusan gugur, dicabut, verstek, dan tidak diterima, serta bunyi pasal per huruf
          alasan perceraian. Ekstensi hanya menyisipkan yang sudah disahkan; yang {tanda.toLowerCase()} tampil dengan
          tombol sisip mati. {boleh ? "" : "Hanya Super Admin yang dapat menyunting dan mengesahkan."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {memuat ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {galat ? <p className="text-sm text-rose-600 dark:text-rose-400">{galat}</p> : null}
        {kabar ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{kabar}</p> : null}

        {data ? (
          <>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Pertimbangan per status putusan</h3>
              {pertimbangan.map((b) => (
                <BarisButir key={b.id + b.diubahPada} butir={b} boleh={boleh} tandaDraf={tanda} sibuk={sibuk} onUbah={kirim} />
              ))}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Pasal per huruf alasan perceraian (PP 9/1975 Pasal 19, KHI Pasal 116)</h3>
              <p className="text-xs text-muted-foreground">
                KHI Pasal 116 hanya sampai huruf h; huruf i sampai k tidak dibenihkan dan dapat ditambahkan bila satker
                memakainya.
              </p>
              {pasal.map((b) => (
                <BarisButir key={b.id + b.diubahPada} butir={b} boleh={boleh} tandaDraf={tanda} sibuk={sibuk} onUbah={kirim} />
              ))}
            </div>

            {boleh ? (
              <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                <h3 className="text-sm font-semibold">Tambah templat (tersimpan sebagai DRAF)</h3>
                <div className="grid gap-2 sm:grid-cols-[10rem_10rem_minmax(0,1fr)]">
                  <NativeSelect value={baru.jenis} onChange={(e) => setBaru({ ...baru, jenis: e.target.value })} aria-label="Jenis">
                    <option value="pertimbangan">pertimbangan</option>
                    <option value="pasal">pasal</option>
                  </NativeSelect>
                  <Input
                    value={baru.kunci}
                    onChange={(e) => setBaru({ ...baru, kunci: e.target.value })}
                    placeholder={baru.jenis === "pasal" ? "huruf, mis. i" : "kunci, mis. ditolak"}
                    aria-label="Kunci"
                  />
                  <Input value={baru.judul} onChange={(e) => setBaru({ ...baru, judul: e.target.value })} placeholder="Judul" aria-label="Judul baru" />
                </div>
                <Textarea
                  className="min-h-[120px] font-mono text-xs"
                  value={baru.isi}
                  onChange={(e) => setBaru({ ...baru, isi: e.target.value })}
                  placeholder="Isi - pakai penanda {nama}, {tanggal} untuk bagian yang diisi petugas"
                  aria-label="Isi baru"
                />
                <Button
                  size="sm"
                  disabled={sibuk || !baru.kunci.trim() || !baru.judul.trim() || !baru.isi.trim()}
                  onClick={async () => {
                    if (await kirim("POST", baru)) setBaru({ jenis: baru.jenis, kunci: "", judul: "", isi: "" });
                  }}
                >
                  Tambah sebagai DRAF
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
