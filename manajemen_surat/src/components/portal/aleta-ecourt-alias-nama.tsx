"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

/**
 * Kamus alias nama pihak dan penguji pemeriksa ejaan (U18, rantai B, 25 Okt 2026).
 * Hanya tampil bagi Admin dan Super Admin (server menolak yang lain dengan 403 dan kartu ini tidak tampil).
 * Pemeriksa hanya memberi USULAN; tidak ada yang ditulis ke SIPP, ABT, atau e-Court.
 */

type Kamus = { baku: string; varian: Array<{ id: string; varian: string; sumber: string; dibuatPada: string }> };
type Halaman = { aktif: boolean; jumlah: number; kamus: Kamus[] };
type Usulan = { jenis: string; tingkat: string; pesan: string; usulanBaku: string };

async function panggil<T>(jalur: string, badan?: unknown): Promise<{ ok: boolean; data?: T; pesan?: string }> {
  try {
    const jawab = await fetch(apiPath(jalur), {
      method: badan === undefined ? "GET" : "POST",
      headers: badan === undefined ? undefined : { "Content-Type": "application/json" },
      body: badan === undefined ? undefined : JSON.stringify(badan),
      cache: "no-store",
    });
    const luar = (await jawab.json().catch(() => null)) as { data?: T; message?: string; error?: string | { message?: string } } | null;
    if (!jawab.ok) {
      const e = luar?.error;
      return { ok: false, pesan: luar?.message || (typeof e === "string" ? e : e?.message) || "Permintaan ditolak." };
    }
    return { ok: true, data: luar?.data };
  } catch {
    return { ok: false, pesan: "Server tidak dapat dihubungi." };
  }
}

export function AletaEcourtAliasNama() {
  const [halaman, setHalaman] = useState<Halaman | null>(null);
  const [baku, setBaku] = useState("");
  const [varian, setVarian] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [ujiA, setUjiA] = useState("");
  const [ujiB, setUjiB] = useState("");
  const [hasilUji, setHasilUji] = useState<Usulan[] | null>(null);

  const muat = useCallback(async () => {
    const r = await panggil<Halaman>("/api/aleta-ecourt/alias-nama");
    if (r.ok && r.data) setHalaman(r.data);
  }, []);

  useEffect(() => {
    let batal = false;
    void (async () => {
      const r = await panggil<Halaman>("/api/aleta-ecourt/alias-nama");
      if (!batal && r.ok && r.data) setHalaman(r.data);
    })();
    return () => {
      batal = true;
    };
  }, []);

  if (!halaman) return null;

  const tambah = async () => {
    setSibuk(true);
    setPesan("");
    const r = await panggil<{ ditambah: string[]; sudahAda: string[] }>("/api/aleta-ecourt/alias-nama", { aksi: "tambah", baku, varian });
    if (r.ok && r.data) {
      setPesan(`${r.data.ditambah.length} varian ditambahkan${r.data.sudahAda.length ? `, ${r.data.sudahAda.length} sudah ada` : ""}.`);
      setBaku("");
      setVarian("");
      await muat();
    } else setPesan(r.pesan || "Tidak dapat menyimpan.");
    setSibuk(false);
  };

  const hapus = async (arg: { id?: string; baku?: string }) => {
    setSibuk(true);
    const r = await panggil("/api/aleta-ecourt/alias-nama", { aksi: "hapus", ...arg });
    setPesan(r.ok ? "Dihapus." : r.pesan || "Tidak dapat menghapus.");
    await muat();
    setSibuk(false);
  };

  const uji = async () => {
    setSibuk(true);
    const nama = [
      { asal: "Penulisan 1", nama: ujiA },
      { asal: "Penulisan 2", nama: ujiB },
    ].filter((n) => n.nama.trim());
    const r = await panggil<{ tersedia: boolean; usulan?: Usulan[] }>("/api/aleta-ecourt/alias-nama/periksa", { nama });
    if (!r.ok) setPesan(r.pesan || "Pemeriksa tidak dapat dijalankan.");
    else if (!r.data?.tersedia) setPesan("Pemeriksa belum dinyalakan (saklar di kartu Kinerja untuk PC tua).");
    else setHasilUji(r.data.usulan ?? []);
    setSibuk(false);
  };

  return (
    <Card id="alias-nama">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Kamus alias nama pihak <Badge variant="outline">{halaman.aktif ? "pemeriksa menyala" : "pemeriksa mati"}</Badge>
        </CardTitle>
        <CardDescription>
          Nama baku beserta varian ejaannya. Dipakai pemeriksa ejaan di SIPP, blangko, dan BAS, serta membantu ALETA Ai mengenali satu orang yang namanya
          ditulis berbeda. Hanya usulan: tidak ada yang ditulis ke SIPP, ABT, atau e-Court. Isinya nama orang, jadi hanya terlihat oleh Admin dan Super Admin.
          Saklar pemeriksa ada di kartu kinerja.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Nama baku</span>
            <Input value={baku} maxLength={120} onChange={(e) => setBaku(e.target.value)} placeholder="Muhammad Alwi" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Varian ejaan (satu per baris)</span>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              rows={3}
              value={varian}
              onChange={(e) => setVarian(e.target.value)}
              placeholder={"Muhamad Alwi\nMoh. Alwi"}
            />
          </label>
        </div>
        <Button type="button" disabled={sibuk || !baku.trim() || !varian.trim()} onClick={() => void tambah()}>
          Tambahkan ke kamus
        </Button>

        <div className="space-y-2">
          <p className="text-sm font-medium">{halaman.jumlah} varian tercatat</p>
          {halaman.kamus.length === 0 ? <p className="text-sm text-muted-foreground">Kamus masih kosong.</p> : null}
          {halaman.kamus.map((k) => (
            <div key={k.baku} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{k.baku}</p>
                <Button type="button" variant="outline" size="sm" disabled={sibuk} onClick={() => void hapus({ baku: k.baku })}>
                  Hapus semua
                </Button>
              </div>
              <ul className="mt-2 space-y-1">
                {k.varian.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{v.varian}</span>
                    <Button type="button" variant="ghost" size="sm" disabled={sibuk} onClick={() => void hapus({ id: v.id })}>
                      Hapus
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-md border bg-card p-3">
          <p className="text-sm font-medium">Uji pemeriksa</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={ujiA} onChange={(e) => setUjiA(e.target.value)} placeholder="Penulisan di SIPP" aria-label="Penulisan di SIPP" />
            <Input value={ujiB} onChange={(e) => setUjiB(e.target.value)} placeholder="Penulisan di BAS" aria-label="Penulisan di BAS" />
          </div>
          <Button type="button" variant="outline" disabled={sibuk || (!ujiA.trim() && !ujiB.trim())} onClick={() => void uji()}>
            Periksa
          </Button>
          {hasilUji ? (
            hasilUji.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada perbedaan ejaan yang perlu diperiksa.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {hasilUji.map((u, i) => (
                  <li key={i}>
                    {u.pesan}
                    {u.usulanBaku ? ` Usulan ejaan: "${u.usulanBaku}".` : ""}
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
        {pesan ? (
          <p className="text-sm text-muted-foreground" role="status">
            {pesan}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
