"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * SK Ketua: susunan majelis hakim dan panitera sidangnya.
 *
 * ============================================================================
 * KENAPA PENGIKATAN INI TIDAK DAPAT DIKERJAKAN MESIN
 * ============================================================================
 *
 * Kode hakim pada SK - A, B, C1, C2, C3 - cocok persis dengan hakim_pn di
 * SIPP, jadi susunan hakimnya cukup disimpan sebagai kode.
 *
 * Kode panitera TIDAK. Diperiksa pada panitera_pn PA Donggala:
 *
 *   Sri Susilowati "D"   Munifa "D"   Qadariyah "D"   Andini "D"
 *   Sitti Nurhidayah "D8"   Unun Fidiyasari ""   Fikrianto ""
 *
 * sementara SK menyebut D, D1, D2, D3, D4, D5, D6. Empat orang berbagi satu
 * kode, dan lima kode SK tidak ada sama sekali. Namanya pun berbeda ejaan -
 * SK menulis "Munifah", SIPP menulis "Munifa".
 *
 * Karena itu tiap kode SK diikat ke ORANG di layar ini, sekali, oleh manusia.
 * Kodenya tetap tersimpan dan tetap terbaca di sebelah namanya pada panel
 * penetapan - ia label, bukan penunjuk orang.
 */

type Majelis = {
  majelisKode: string;
  hari: number;
  namaHari: string;
  paniteraKode: string[];
  panitera: { kode: string; id: number }[];
  hakimKode: string[];
  skNomor: string;
  skTanggal: string;
  keterangan: string;
  bawaan: boolean;
};

type Pegawai = { id: number; kode: string; nama: string };

export function AletaEcourtSkMajelis() {
  const [majelis, setMajelis] = useState<Majelis[]>([]);
  const [hakim, setHakim] = useState<Pegawai[]>([]);
  const [panitera, setPanitera] = useState<Pegawai[]>([]);
  const [namaHari, setNamaHari] = useState<string[]>([]);
  const [skBerlaku, setSkBerlaku] = useState<{ nomor: string; tanggal: string } | null>(null);
  const [pegawaiAlasan, setPegawaiAlasan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState("");
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/sk-majelis"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca SK susunan majelis."));
      const data = isi?.data ?? isi;
      setMajelis((data.majelis ?? []) as Majelis[]);
      setHakim((data.hakim ?? []) as Pegawai[]);
      setPanitera((data.panitera ?? []) as Pegawai[]);
      setNamaHari((data.namaHari ?? []) as string[]);
      setSkBerlaku((data.skBerlaku ?? null) as { nomor: string; tanggal: string } | null);
      setPegawaiAlasan(String(data.pegawaiAlasan ?? ""));
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca SK.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const namaHakim = useMemo(
    () => new Map(hakim.map((x) => [x.kode.toUpperCase(), x.nama])),
    [hakim]
  );
  const namaPanitera = useMemo(() => new Map(panitera.map((x) => [x.id, x.nama])), [panitera]);

  /** Empat panitera berbagi kode "D" - itu yang membuat layar ini perlu. */
  const kodeTabrakan = useMemo(() => {
    const hitung = new Map<string, number>();
    for (const p of panitera) {
      if (!p.kode) continue;
      hitung.set(p.kode, (hitung.get(p.kode) ?? 0) + 1);
    }
    return [...hitung.entries()].filter(([, n]) => n > 1);
  }, [panitera]);

  const simpan = useCallback(
    async (satu: Majelis, ubahan: Partial<Majelis>) => {
      setSibuk(satu.majelisKode);
      setGalat("");
      setPesan("");
      const gabung = { ...satu, ...ubahan };
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/sk-majelis"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            majelisKode: gabung.majelisKode,
            hari: gabung.hari,
            paniteraKode: gabung.paniteraKode.join(","),
            hakimKode: gabung.hakimKode.join(","),
            // Pasangan kode=id - bentuk yang sama yang tersimpan.
            paniteraId: gabung.panitera.map((p) => `${p.kode}=${p.id}`).join(","),
            skNomor: gabung.skNomor,
            skTanggal: gabung.skTanggal,
            keterangan: gabung.keterangan,
          }),
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));
        const data = isi?.data ?? isi;
        setMajelis((data.majelis ?? []) as Majelis[]);
        setPesan(`Majelis ${gabung.majelisKode} tersimpan.`);
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.");
      } finally {
        setSibuk("");
      }
    },
    []
  );

  if (memuat) {
    return <p className="text-sm text-muted-foreground">Membaca SK susunan majelis…</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>SK susunan majelis hakim dan panitera sidang</CardTitle>
          <CardDescription>
            {skBerlaku?.nomor
              ? `Nilai awalnya dari SK Nomor ${skBerlaku.nomor} tanggal ${skBerlaku.tanggal}. `
              : ""}
            Yang tersimpan di sini menang atas susunan yang disimpulkan dari pemakaian di SIPP:
            majelis yang ada di SK muncul lebih dahulu pada panel penetapan, beserta kodenya.
            Susunan di luar SK tetap dapat dipilih, di bawahnya, tanpa kode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {pegawaiAlasan ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              Daftar pegawai SIPP tidak terbaca: {pegawaiAlasan}. Hari sidang dan kode masih dapat
              disunting, tetapi panitera sidang belum dapat diikat ke orangnya.
            </p>
          ) : null}

          {kodeTabrakan.length > 0 ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
              Kode panitera di SIPP tidak dapat dipakai menunjuk orang —{" "}
              {kodeTabrakan.map(([kode, n]) => `${n} orang berkode "${kode}"`).join(", ")}. Karena
              itu tiap kode SK diikat ke orangnya di bawah ini; kodenya tetap tampil di sebelah
              namanya pada panel penetapan.
            </p>
          ) : null}

          {galat ? <p className="text-destructive">{galat}</p> : null}
          {pesan ? <p className="text-emerald-600">{pesan}</p> : null}
        </CardContent>
      </Card>

      {majelis.map((satu) => (
        <Card key={satu.majelisKode}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span>Majelis {satu.majelisKode}</span>
              {satu.bawaan ? <Badge variant="outline">belum disunting</Badge> : null}
              <Badge variant="muted">{namaHari[satu.hari] ?? satu.namaHari}</Badge>
            </CardTitle>
            <CardDescription>
              {satu.hakimKode.length > 0
                ? satu.hakimKode
                    .map((kode) => `${kode} — ${namaHakim.get(kode) ?? "tidak ada di SIPP"}`)
                    .join("  ·  ")
                : "Susunan hakimnya belum diisi — panel masih menyimpulkannya dari pemakaian di SIPP."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <label className="flex flex-wrap items-center gap-2">
              <span className="w-32 text-muted-foreground">Hari sidang</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2"
                value={satu.hari}
                onChange={(e) => void simpan(satu, { hari: Number(e.target.value) })}
                disabled={sibuk === satu.majelisKode}
              >
                {namaHari.map((nama, i) => (
                  <option key={nama} value={i}>
                    {nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-wrap items-center gap-2">
              <span className="w-32 text-muted-foreground">Kode hakim</span>
              <Input
                className="max-w-xs"
                defaultValue={satu.hakimKode.join(",")}
                placeholder="A,C1,C3"
                onBlur={(e) => {
                  const baru = e.target.value.trim().toUpperCase();
                  if (baru === satu.hakimKode.join(",")) return;
                  void simpan(satu, {
                    hakimKode: baru.split(",").map((x) => x.trim()).filter(Boolean),
                  });
                }}
              />
              <span className="text-xs text-muted-foreground">
                Ketua di depan. Kode hakim_pn SIPP: {hakim.map((x) => x.kode).filter(Boolean).join(", ") || "—"}
              </span>
            </label>

            <div className="space-y-2">
              <p className="text-muted-foreground">Panitera sidang menurut SK</p>
              {satu.paniteraKode.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada kode panitera pada SK majelis ini.
                </p>
              ) : null}
              {satu.paniteraKode.map((kode) => {
                const terikat = satu.panitera.find((p) => p.kode === kode);
                return (
                  <label key={kode} className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="w-14 justify-center">
                      {kode}
                    </Badge>
                    <select
                      className="h-9 min-w-64 rounded-md border border-input bg-background px-2"
                      value={terikat?.id ?? 0}
                      disabled={sibuk === satu.majelisKode || panitera.length === 0}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        const lain = satu.panitera.filter((p) => p.kode !== kode);
                        void simpan(satu, { panitera: [...lain, { kode, id }] });
                      }}
                    >
                      <option value={0}>— belum diikat —</option>
                      {panitera.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama}
                          {p.kode ? ` (kode SIPP ${p.kode})` : " (tanpa kode SIPP)"}
                        </option>
                      ))}
                    </select>
                    {terikat?.id ? (
                      <span className="text-xs text-muted-foreground">
                        {namaPanitera.get(terikat.id) ?? "orangnya sudah tidak aktif"}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">
                        belum diikat — panel memakai giliran beban
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <label className="flex flex-wrap items-center gap-2">
              <span className="w-32 text-muted-foreground">Kode panitera SK</span>
              <Input
                className="max-w-xs"
                defaultValue={satu.paniteraKode.join(",")}
                placeholder="D,D4"
                onBlur={(e) => {
                  const baru = e.target.value.trim().toUpperCase();
                  if (baru === satu.paniteraKode.join(",")) return;
                  void simpan(satu, {
                    paniteraKode: baru.split(",").map((x) => x.trim()).filter(Boolean),
                  });
                }}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <span className="w-32 text-muted-foreground">SK</span>
              <Input
                className="max-w-sm"
                defaultValue={satu.skNomor}
                placeholder="Nomor SK"
                onBlur={(e) => {
                  if (e.target.value === satu.skNomor) return;
                  void simpan(satu, { skNomor: e.target.value });
                }}
              />
              <Input
                className="max-w-40"
                type="date"
                defaultValue={satu.skTanggal}
                onBlur={(e) => {
                  if (e.target.value === satu.skTanggal) return;
                  void simpan(satu, { skTanggal: e.target.value });
                }}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={() => void muat()} disabled={memuat}>
        Muat ulang
      </Button>
    </div>
  );
}
