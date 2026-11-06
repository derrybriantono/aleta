"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import {
  bandingBaris,
  berkasUntukBukti,
  buktiDariAlinea,
  kalimatBaris,
  katalogDari,
  kolomBukti,
  PIL_COCOK,
  PIL_METERAI,
  tanggalIndo,
  type BarisBukti,
  type DataSipp,
} from "@/lib/bukti-tertulis";

type Dokumen = { judul: string; documentKey: string };
type Bahan = DataSipp & { dokumen: Dokumen[] };
type Butir = { sisi: "P" | "T"; nomor: number; baris: BarisBukti; diperiksa: boolean };

/**
 * Pemeriksaan alat bukti tertulis di layar cetak ALETA ABT (6 Nov 2026). Bahannya kalimat bukti yang tertulis di pratinjau naskah; pembandingnya
 * data SIPP (rute bukti-sipp). Layar ini TIDAK menulis ke SIPP atau ABT: perubahan hanya tampil di sini dan kalimatnya dapat disalin. Penyimpanan
 * ke ABT tetap lewat kotak alat bukti di Blangko ABT by Derry Briantono.
 */
export function BuktiAletaAbt({ alinea, perkaraId, nomor }: { alinea: ReadonlyArray<{ teks: string }>; perkaraId: string; nomor: string }) {
  const dariNaskah = (l: ReadonlyArray<{ teks: string }>) => buktiDariAlinea(l).map((x) => ({ ...x, diperiksa: false }));
  const [sumber, setSumber] = useState(alinea);
  const [daftar, setDaftar] = useState<Butir[]>(() => dariNaskah(alinea));
  const [aktif, setAktif] = useState(0);
  const [bahan, setBahan] = useState<Bahan | null>(null);
  const [tersalin, setTersalin] = useState(false);

  // Pratinjau baru: daftar dibaca ulang dari naskah.
  if (sumber !== alinea) {
    setSumber(alinea);
    setDaftar(dariNaskah(alinea));
    setAktif(0);
  }

  useEffect(() => {
    let batal = false;
    const q = new URLSearchParams({ perkaraId, nomor });
    fetch(apiPath(`/api/aleta-ecourt/blangko-derry/bukti-sipp?${q.toString()}`), { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Bahan }) => {
        if (!batal && j && j.ok && j.data) setBahan(j.data);
      })
      .catch(() => undefined);
    return () => {
      batal = true;
    };
  }, [perkaraId, nomor]);

  if (!daftar.length) return null;
  const b = daftar[Math.min(aktif, daftar.length - 1)];
  const r = b.baris;
  const urutanKtp = (i: number) => daftar.slice(0, i).filter((x) => x.sisi === daftar[i].sisi && katalogDari(x.baris.nm)?.kunci === "ktp").length;
  const banding = (i: number) => bandingBaris(daftar[i].baris, daftar[i].sisi, urutanKtp(i), bahan);
  const iAktif = daftar.indexOf(b);
  const hasil = banding(iAktif);
  const kol = kolomBukti(r.nm);
  const jenis = katalogDari(r.nm);
  const berkas = bahan ? berkasUntukBukti(r.nm, bahan.dokumen) : null;
  const jumlahBeda = daftar.reduce((n, _, i) => n + Object.values(banding(i)).filter((h) => h.keadaan === "beda").length, 0);
  const selesai = daftar.filter((x) => x.diperiksa).length;
  const kalimat = kalimatBaris(r, b.sisi, b.nomor - 1);
  const ubah = (kolom: keyof BarisBukti, nilai: string | number) =>
    setDaftar((l) => l.map((x, i) => (i === iAktif ? { ...x, baris: { ...x.baris, [kolom]: nilai } } : x)));

  const medan = (kolom: "nm" | "an" | "no" | "tgl" | "oleh", label: string, jenisInput = "text", contoh = "") => {
    const h = hasil[kolom];
    return (
      <div key={kolom} className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor={`bukti-${kolom}`}>
          {label}
        </label>
        <Input id={`bukti-${kolom}`} type={jenisInput} value={String(r[kolom] ?? "")} placeholder={contoh} onChange={(e) => ubah(kolom, e.target.value)} />
        {h?.keadaan === "sama" ? <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Sama dengan SIPP</p> : null}
        {h?.keadaan === "beda" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-100 px-2 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <span className="min-w-0 flex-1">Di SIPP tertulis {kolom === "tgl" ? tanggalIndo(h.sipp) : h.sipp}</span>
            {h.pakai !== null ? (
              <Button type="button" size="sm" variant="outline" onClick={() => ubah(kolom, h.pakai as string)}>
                Pakai data SIPP
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };
  const pilihan = (kolom: "meterai" | "cocok", label: string, opsi: readonly string[]) => (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        className="min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
        value={String(r[kolom] ?? 0)}
        onChange={(e) => ubah(kolom, Number(e.target.value))}
      >
        {opsi.map((t, v) => (
          <option key={t} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alat bukti tertulis</CardTitle>
        <CardDescription>
          Dibaca dari naskah di atas dan diadu dengan SIPP. Perubahan di sini tidak tersimpan ke ABT: salin kalimatnya, atau simpan lewat kotak alat bukti di Blangko ABT by Derry Briantono.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="success">
            {selesai} dari {daftar.length} sudah diperiksa
          </Badge>
          {jumlahBeda ? <Badge variant="warning">{jumlahBeda} isian berbeda dari SIPP</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 lg:max-w-xs">
          {daftar.map((x, i) => {
            const beda = Object.values(banding(i)).filter((h) => h.keadaan === "beda").length;
            return (
              <button
                key={`${x.sisi}.${x.nomor}`}
                type="button"
                aria-current={i === iAktif}
                onClick={() => setAktif(i)}
                className={`flex min-h-11 gap-2.5 rounded-lg border p-2.5 text-left ${i === iAktif ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <span className="w-8 flex-none text-sm font-bold text-primary">
                  {x.sisi}.{x.nomor}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{x.baris.nm || "Tanpa nama"}</span>
                  <span className="block text-xs text-muted-foreground">{x.diperiksa ? "Sudah diperiksa" : beda ? `${beda} isian berbeda dari SIPP` : "Belum diperiksa"}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-bold">
              <span className="text-primary">
                {b.sisi}.{b.nomor}
              </span>{" "}
              {r.nm}
            </p>
            {jenis ? <Badge variant="outline">{jenis.kuat}</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex min-h-48 min-w-0 flex-[1_1_240px] items-center justify-center rounded-lg border border-dashed border-border p-2 text-center text-sm text-muted-foreground">
              {berkas ? (
                <div className="w-full">
                  <iframe title={`Pindaian ${berkas.judul}`} className="h-80 w-full rounded" src={apiPath(`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(berkas.documentKey)}&format=pdf&tampil=1`)} />
                  <a className="text-xs underline" target="_blank" rel="noreferrer" href={apiPath(`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(berkas.documentKey)}&format=pdf&tampil=1`)}>
                    Buka {berkas.judul} di tab baru
                  </a>
                </div>
              ) : (
                "Pindaian bukti ini belum ada di arsip e-Court."
              )}
            </div>
            {typeof r.manual === "string" ? (
              <p className="min-w-0 flex-[2_1_320px] text-sm text-muted-foreground">Bukti ini tertulis sebagai kalimat bebas di naskah.</p>
            ) : (
              <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-3">
                {medan("an", kol.an)}
                {medan("no", kol.no, "text", kol.contohNo)}
                {medan("tgl", kol.tgl, "date")}
                {medan("oleh", "Dikeluarkan oleh")}
              </div>
            )}
          </div>
          {typeof r.manual === "string" ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pilihan("meterai", "Meterai", PIL_METERAI)}
              {pilihan("cocok", "Dicocokkan dengan aslinya", PIL_COCOK)}
            </div>
          )}
          <div className="rounded-lg bg-muted/50 px-4 py-3 font-serif text-base leading-relaxed">{kalimat}</div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(kalimat)
                  .then(() => setTersalin(true))
                  .catch(() => setTersalin(false));
              }}
            >
              {tersalin ? "Tersalin" : "Salin kalimat"}
            </Button>
            <Button type="button" onClick={() => setDaftar((l) => l.map((x, i) => (i === iAktif ? { ...x, diperiksa: !x.diperiksa } : x)))}>
              {b.diperiksa ? "Batalkan tanda selesai" : "Tandai sudah diperiksa"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
