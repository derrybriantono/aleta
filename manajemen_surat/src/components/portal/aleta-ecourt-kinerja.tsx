"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import type { SaklarKinerja } from "@/lib/kinerja-ekstensi";

/**
 * Saklar kinerja untuk PC tua (rantai B, 25 Okt 2026). Hanya tampil bagi
 * Super Admin. Semua mati bawaan: mati = ekstensi dan portal seperti sebelumnya.
 */

type Halaman = {
  saklar: SaklarKinerja;
  keterangan: Record<string, { judul: string; isi: string }>;
  bolehMengubah: boolean;
};

export function AletaEcourtKinerja() {
  const [halaman, setHalaman] = useState<Halaman | null>(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const jawab = await fetch(apiPath("/api/aleta-ecourt/ekstensi/kinerja"), { cache: "no-store" });
        const luar = (await jawab.json()) as { data?: Halaman } | null;
        if (!batal && luar?.data?.saklar) setHalaman(luar.data);
      } catch {
        /* kartu pelengkap: tanpa data ia tidak tampil */
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  if (!halaman || !halaman.bolehMengubah) return null;

  const ubah = async (kunci: string, nilai: boolean) => {
    setSibuk(true);
    setPesan("");
    try {
      const jawab = await fetch(apiPath("/api/aleta-ecourt/ekstensi/kinerja"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [kunci]: nilai }),
      });
      const luar = (await jawab.json()) as { data?: { saklar: SaklarKinerja }; message?: string; error?: string } | null;
      if (!jawab.ok || !luar?.data) {
        setPesan(luar?.message || luar?.error || "Saklar tidak dapat disimpan.");
      } else {
        const saklar = luar.data.saklar;
        setHalaman((h) => (h ? { ...h, saklar } : h));
        setPesan("Tersimpan. Tab yang sudah terbuka mengikuti dalam beberapa menit.");
      }
    } catch {
      setPesan("Server tidak dapat dihubungi.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Card id="kinerja-ekstensi">
      <CardHeader>
        <CardTitle>Kinerja untuk PC tua</CardTitle>
        <CardDescription>
          Pengaturan yang hanya meringankan komputer, tanpa mengubah isi pekerjaan. Semuanya mati sampai Anda menyalakannya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(halaman.saklar) as Array<keyof SaklarKinerja>).map((kunci) => {
          const k = halaman.keterangan[kunci];
          return (
            <div key={kunci} className="flex items-start justify-between gap-3 rounded-md border bg-card p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{k?.judul ?? kunci}</p>
                <p className="text-sm text-muted-foreground">{k?.isi}</p>
              </div>
              <Switch
                checked={halaman.saklar[kunci] === true}
                disabled={sibuk}
                aria-label={k?.judul ?? kunci}
                onCheckedChange={(nilai) => void ubah(kunci, nilai)}
              />
            </div>
          );
        })}
        {pesan ? <p className="text-sm text-muted-foreground" role="status">{pesan}</p> : null}
      </CardContent>
    </Card>
  );
}
