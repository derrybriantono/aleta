"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Pengaturan akses ekstensi ALETA E-Court per peran.
 *
 * ============================================================================
 * SATU PENGALIHAN, SATU PENYIMPANAN
 * ============================================================================
 *
 * Tiap pengalihan langsung disimpan, tanpa tombol Simpan di bawah. Matriks ini
 * berisi lebih dari lima puluh pengalihan; satu tombol simpan di ujung halaman
 * berarti administrator harus mengingat apa saja yang sudah disentuh, dan satu
 * kali menutup tab membuang seluruhnya tanpa peringatan.
 *
 * Ongkosnya: satu permintaan per pengalihan. Untuk pengaturan yang disentuh
 * beberapa kali setahun, itu jauh lebih murah daripada perubahan yang hilang.
 *
 * ============================================================================
 * SUPER ADMIN DAN ADMIN TIDAK PUNYA PENGALIHAN
 * ============================================================================
 *
 * Keduanya selalu berkemampuan penuh, dan pengalihannya sengaja TIDAK digambar.
 * Menggambar pengalihan yang selalu ditolak server adalah kebohongan kecil pada
 * antarmuka: administrator menggesernya, tampak berubah, lalu tidak terjadi
 * apa-apa.
 */

type Kapabilitas = "panel" | "berkas" | "permintaan";

type PeranAkses = {
  roleId: string;
  label: string;
  selaluPenuh: boolean;
  kapabilitas: Record<Kapabilitas, boolean>;
};

type Keterangan = Record<Kapabilitas, { label: string; penjelasan: string }>;

type Jawaban = {
  available: boolean;
  bolehMengatur: boolean;
  saya: Record<Kapabilitas, boolean>;
  peran: PeranAkses[];
  keterangan: Keterangan;
};

const URUTAN: Kapabilitas[] = ["panel", "berkas", "permintaan"];

export function AletaEcourtAksesPeran() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  // Kunci "peran:kapabilitas" yang sedang disimpan - dipakai untuk mematikan
  // pengalihannya sementara, supaya klik beruntun tidak saling mendahului.
  const [sedangSimpan, setSedangSimpan] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/akses"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca akses ekstensi."));
      setData(isi?.data ?? isi);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca akses ekstensi.");
    } finally {
      setMemuat(false);
    }
  }, []);

  // Pemuatan ditunda satu putaran, mengikuti pola panel e-Court lain:
  // memanggil setState langsung di dalam efek memicu render beruntun.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const ubah = useCallback(
    async (roleId: string, kapabilitas: Kapabilitas, aktif: boolean) => {
      const kunci = roleId + ":" + kapabilitas;
      setSedangSimpan(kunci);
      setGalat("");
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/akses"), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roleId, kapabilitas, aktif }),
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));

        // Memakai matriks yang dikirim balik server, bukan menebak keadaan baru
        // di sisi peramban. Bila server menolak sebagian - peran tidak dikenali,
        // misalnya - layar tetap menunjukkan apa yang benar-benar tersimpan.
        const baru = isi?.data ?? isi;
        setData((lama) => (lama ? { ...lama, peran: baru?.peran ?? lama.peran } : lama));
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.");
        void muat();
      } finally {
        setSedangSimpan(null);
      }
    },
    [muat]
  );

  if (!memuat && data && !data.bolehMengatur) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Akses ekstensi ALETA E-Court</CardTitle>
        <CardDescription>
          Menentukan apa yang boleh dilakukan tiap peran lewat ekstensi peramban di halaman SIPP.
          Super Admin dan Admin selalu berkemampuan penuh.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
        ) : null}

        {memuat ? (
          <p className="text-sm text-muted-foreground">Memuat akses peran...</p>
        ) : !data ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Akses peran belum dapat dibaca.</p>
            <Button size="sm" variant="outline" onClick={() => void muat()}>
              Coba lagi
            </Button>
          </div>
        ) : (
          <>
            <dl className="grid gap-2 sm:grid-cols-3">
              {URUTAN.map((kunci) => (
                <div key={kunci} className="rounded-md border bg-muted/40 px-3 py-2">
                  <dt className="text-xs font-semibold">{data.keterangan[kunci].label}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    {data.keterangan[kunci].penjelasan}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium">Peran</th>
                    {URUTAN.map((kunci) => (
                      <th key={kunci} className="px-3 py-2 font-medium">
                        {data.keterangan[kunci].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.peran.map((peran) => (
                    <tr key={peran.roleId} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <span className="font-medium">{peran.label}</span>
                        {peran.selaluPenuh ? (
                          <Badge variant="muted" className="ml-2 align-middle">
                            selalu penuh
                          </Badge>
                        ) : null}
                      </td>

                      {URUTAN.map((kunci) => (
                        <td key={kunci} className="px-3 py-2">
                          {peran.selaluPenuh ? (
                            <span className="text-xs text-muted-foreground">selalu aktif</span>
                          ) : (
                            <Switch
                              checked={peran.kapabilitas[kunci]}
                              disabled={sedangSimpan === peran.roleId + ":" + kunci}
                              aria-label={peran.label + " - " + data.keterangan[kunci].label}
                              onCheckedChange={(nilai) => void ubah(peran.roleId, kunci, nilai)}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Perubahan tersimpan seketika. Pengguna yang sedang membuka halaman SIPP perlu memuat
              ulang halamannya agar panel ALETA mengikuti pengaturan baru.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
