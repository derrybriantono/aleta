"use client";

/**
 * ============================================================================
 * TANDA TANGAN PEJABAT - MENAMAI DAN MENGESAHKAN
 * ============================================================================
 *
 * Gambar tanda tangan diimpor dari berkas .doc satuan kerja, dan pengukirannya
 * kasar: ia menyapu bita mencari tanda berkas PNG dan JPEG, tanpa tahu gambar
 * mana milik siapa. Nama pejabat memang ada di berkas yang sama, tetapi urutan
 * gambar di dalam wadah .doc tidak harus sama dengan urutan namanya.
 *
 * Karena itu layar ini ada, dan karena itu pula ia menampilkan GAMBARNYA
 * sebesar mungkin: yang menamai harus melihat tanda tangannya, bukan menebak
 * dari urutan. Tanda tangan yang terpasang pada nama yang keliru adalah tanda
 * tangan palsu pada penetapan pengadilan, dan tidak ada satu galat pun yang
 * akan berbunyi.
 *
 * ============================================================================
 * DUA LANGKAH, DAN ITU DISENGAJA
 * ============================================================================
 *
 * Menamai dan mengesahkan dipisah. Yang pertama menuliskan dugaan; yang kedua
 * menyatakan dugaan itu benar, dan namanya tercatat sebagai yang menyatakan.
 * Mengubah nama yang sudah disahkan MEMBATALKAN pengesahannya - tanda tangan A
 * yang namanya diganti menjadi B adalah tanda tangan A pada penetapan B.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { CheckCircle2, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

type TandaTangan = {
  id: number;
  sidik: string;
  namaPejabat: string;
  jabatan: string;
  jenisBerkas: string;
  ukuran: number;
  disahkan: boolean;
  disahkanOleh: string;
  disahkanPada: string;
  asal: string;
};

export function AletaEcourtTandaTangan() {
  const [baris, setBaris] = useState<TandaTangan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(0);
  const [suntingan, setSuntingan] = useState<Record<number, { nama: string; jabatan: string }>>({});

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const respons = await fetch(apiPath("/api/aleta-ecourt/tanda-tangan"), {
        credentials: "include",
        cache: "no-store",
      });
      if (!respons.ok) {
        throw new Error(
          respons.status === 403
            ? "Hanya admin yang dapat menamai dan mengesahkan tanda tangan."
            : `ALETA menjawab ${respons.status}.`
        );
      }
      const isi = (await respons.json()) as { baris?: TandaTangan[] };
      setBaris(Array.isArray(isi.baris) ? isi.baris : []);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Daftar tidak dapat dibaca.");
      setBaris([]);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const kirim = useCallback(
    async (muatan: Record<string, unknown>) => {
      setSibuk((n) => n + 1);
      setGalat("");
      try {
        const respons = await fetch(apiPath("/api/aleta-ecourt/tanda-tangan"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(muatan),
        });
        const isi = (await respons.json()) as { ok?: boolean; alasan?: string };
        if (!respons.ok || isi.ok === false) {
          throw new Error(isi.alasan || `ALETA menjawab ${respons.status}.`);
        }
        await muat();
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Tidak dapat disimpan.");
      } finally {
        setSibuk((n) => n - 1);
      }
    },
    [muat]
  );

  const belumSah = useMemo(() => baris.filter((x) => !x.disahkan).length, [baris]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Tanda tangan pejabat
          <Badge variant="muted">{baris.length} gambar</Badge>
          {belumSah > 0 ? <Badge variant="warning">{belumSah} belum disahkan</Badge> : null}
        </CardTitle>
        <CardDescription>
          Dipakai membubuhkan tanda tangan pada penetapan yang diterbitkan ALETA. Gambarnya diukir
          dari berkas .doc satuan kerja, dan pengukirannya tidak tahu gambar mana milik siapa —
          karena itu tiap gambar harus dinamai dan disahkan lebih dahulu. Yang belum disahkan tidak
          pernah dipakai membubuhkan apa pun.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void muat()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
          <p className="text-xs text-muted-foreground">
            Impor gambar baru dijalankan dari peladen:{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              node scripts/impor-tanda-tangan.js &quot;TTD ALL.doc&quot;
            </code>
          </p>
        </div>

        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}

        {memuat ? (
          <div className="min-h-[14rem] animate-pulse rounded-lg border border-border bg-muted/30" />
        ) : baris.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada tanda tangan. Jalankan impor dari berkas .doc satuan kerja lebih dahulu.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {baris.map((x) => {
              const sunting = suntingan[x.id] ?? { nama: x.namaPejabat, jabatan: x.jabatan };
              const berubah = sunting.nama !== x.namaPejabat || sunting.jabatan !== x.jabatan;

              return (
                <div
                  key={x.id}
                  className={
                    "flex flex-col gap-2 rounded-lg border p-3 " +
                    (x.disahkan ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-border")
                  }
                >
                  {/* Gambarnya di atas segalanya, dan di atas latar putih:
                      tanda tangan bertinta hitam di atas latar gelap praktis
                      tidak terlihat, dan yang tidak terlihat tidak dapat
                      diperiksa. */}
                  <div className="flex h-28 items-center justify-center rounded border border-border bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={apiPath(`/api/aleta-ecourt/tanda-tangan/${x.id}/gambar`)}
                      alt={x.namaPejabat || `Tanda tangan ${x.id}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <Input
                    value={sunting.nama}
                    placeholder="Nama pejabat beserta gelarnya"
                    onChange={(peristiwa) =>
                      setSuntingan((s) => ({
                        ...s,
                        [x.id]: { ...sunting, nama: peristiwa.target.value },
                      }))
                    }
                    className="h-8 text-sm"
                  />
                  <Input
                    value={sunting.jabatan}
                    placeholder="Jabatan (Ketua, Panitera, Hakim…)"
                    onChange={(peristiwa) =>
                      setSuntingan((s) => ({
                        ...s,
                        [x.id]: { ...sunting, jabatan: peristiwa.target.value },
                      }))
                    }
                    className="h-8 text-sm"
                  />

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={sibuk > 0 || !berubah || !sunting.nama.trim()}
                      onClick={() =>
                        void kirim({
                          id: x.id,
                          tindakan: "nama",
                          namaPejabat: sunting.nama,
                          jabatan: sunting.jabatan,
                        })
                      }
                    >
                      Simpan nama
                    </Button>

                    {x.disahkan ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        disahkan
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={sibuk > 0 || berubah || !x.namaPejabat}
                        onClick={() => void kirim({ id: x.id, tindakan: "sahkan" })}
                        title={
                          berubah
                            ? "Simpan namanya lebih dahulu."
                            : !x.namaPejabat
                              ? "Beri nama lebih dahulu."
                              : "Menyatakan gambar ini benar tanda tangan orang tersebut."
                        }
                      >
                        Sahkan
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={sibuk > 0}
                      onClick={() => void kirim({ id: x.id, tindakan: "hapus" })}
                      title="Buang gambar ini"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    {x.jenisBerkas.toUpperCase()} · {Math.round(x.ukuran / 1024)} KB
                    {x.disahkan && x.disahkanOleh ? ` · disahkan ${x.disahkanOleh}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
