"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { LABEL_BAGIAN_KATALOG, LABEL_STATUS_FITUR, type BagianKatalog, type SaluranSatker, type StatusFitur } from "@/lib/fitur-satker";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Fitur satker (banyak satker, Tahap 0) - hanya Super Admin. Rute
 * /api/satker/fitur memeriksa ulang perannya dari akun yang masuk.
 */

type ButirFitur = {
  kode: string;
  nama: string;
  bagian: BagianKatalog;
  keterangan: string;
  bawaan: StatusFitur;
  status: StatusFitur;
  pilihan: StatusFitur;
  menyala: boolean;
  sebab: string;
};

type Akses = { id: string; nama: string; username: string; alamatIp: string; cara: string; waktu: string };

type Layar = {
  saluran: SaluranSatker;
  saluranDipaksaPusat: SaluranSatker | null;
  tersimpan: boolean;
  diubahOleh: string;
  diubahPada: string;
  terhubungPusat: boolean;
  fitur: ButirFitur[];
  satker: { kode: string; nama: string; sumber: string };
  kanal: { saluran: SaluranSatker; alamatPusat: string; diubahOleh: string; diubahPada: string };
  pusatTerakhir: { diperiksaPada: string; pesan: string; pembaruan: Array<{ komponen: string; terpasang: string; tersedia: string; adaPembaruan: boolean }> } | null;
  aksesGlobal: { penandaTerpasang: boolean; terbaru: Akses[] };
  bot?: { terkirim: boolean; pesan: string };
  hasil?: { status: string; pesan: string };
};

async function panggil(init?: RequestInit): Promise<Layar> {
  const r = await fetch(apiPath("/api/satker/fitur"), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: Layar } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as Layar;
}

const kirim = (badan: Record<string, unknown>) =>
  panggil({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

const waktuIndonesia = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

export function FiturSatkerAdmin() {
  const [layar, setLayar] = useState<Layar | null>(null);
  const [pilih, setPilih] = useState<Record<string, StatusFitur>>({});
  const [saluran, setSaluran] = useState<SaluranSatker>("stabil");
  const [alamat, setAlamat] = useState("");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "galat" | "berhasil"; teks: string } | null>(null);

  const terima = useCallback((d: Layar) => {
    setLayar(d);
    setPilih(Object.fromEntries(d.fitur.map((f) => [f.kode, f.pilihan])));
    setSaluran(d.kanal.saluran);
    setAlamat(d.kanal.alamatPusat);
  }, []);

  useEffect(() => {
    let batal = false;
    panggil()
      .then((d) => {
        if (!batal) terima(d);
      })
      .catch((e: Error) => {
        if (!batal) setPesan({ jenis: "galat", teks: e.message });
      });
    return () => {
      batal = true;
    };
  }, [terima]);

  const jalankan = async (badan: Record<string, unknown>, berhasil: (d: Layar) => string) => {
    setSibuk(true);
    setPesan(null);
    try {
      const d = await kirim(badan);
      terima(d);
      setPesan({ jenis: "berhasil", teks: berhasil(d) });
    } catch (e) {
      setPesan({ jenis: "galat", teks: (e as Error).message });
    } finally {
      setSibuk(false);
    }
  };

  const fiturBerubah = useMemo(() => (layar?.fitur ?? []).some((f) => pilih[f.kode] !== f.pilihan), [layar, pilih]);
  const kanalBerubah = Boolean(layar) && (saluran !== layar!.kanal.saluran || alamat.trim() !== layar!.kanal.alamatPusat);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (layar?.fitur ?? []).filter((f) => !q || f.nama.toLowerCase().includes(q) || f.keterangan.toLowerCase().includes(q));
  }, [layar, cari]);

  const kotakPesan = pesan ? (
    <div
      className={`rounded-xl border px-3 py-2 text-sm ${
        pesan.jenis === "galat"
          ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
      }`}
    >
      {pesan.teks}
    </div>
  ) : null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sistem</p>
        <h1 className="text-2xl font-semibold">Fitur Satker</h1>
        <p className="text-sm text-muted-foreground">
          {layar?.satker.nama || "Satker ini"}
          {layar?.satker.kode ? ` (${layar.satker.kode})` : ""}. Halaman ini hanya untuk Super Admin. Semua fitur yang sudah ada menyala, kecuali dimatikan di sini.
        </p>
      </div>
      {kotakPesan}
      {!layar && !pesan ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}

      {layar ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Saluran pembaruan</CardTitle>
              <CardDescription>
                Fitur uji coba hanya menyala bila satker berada di saluran uji coba.
                {layar.saluranDipaksaPusat ? ` ALETA Pusat menetapkan saluran ${LABEL_STATUS_FITUR[layar.saluranDipaksaPusat].toLowerCase()} untuk satker ini.` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Saluran</span>
                  <NativeSelect value={saluran} disabled={sibuk} onChange={(e) => setSaluran(e.target.value as SaluranSatker)}>
                    <option value="stabil">Stabil</option>
                    <option value="uji-coba">Uji coba</option>
                  </NativeSelect>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Alamat ALETA Pusat</span>
                  <Input value={alamat} disabled={sibuk} placeholder="Kosong bila belum ada" onChange={(e) => setAlamat(e.target.value)} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={!kanalBerubah || sibuk} onClick={() => void jalankan({ tindakan: "simpan-kanal", saluran, alamatPusat: alamat.trim() }, () => "Saluran dan alamat Pusat tersimpan.")}>
                  Simpan saluran
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sibuk || kanalBerubah}
                  onClick={() => void jalankan({ tindakan: "cek-pusat" }, (d) => d.hasil?.pesan || "Pengecekan selesai.")}
                >
                  Cek pembaruan ke Pusat
                </Button>
                {layar.kanal.diubahOleh ? <span className="text-xs text-muted-foreground">Terakhir diubah {layar.kanal.diubahOleh}.</span> : null}
              </div>
              {layar.pusatTerakhir ? (
                <div className="rounded-xl border px-3 py-2 text-sm">
                  <p className="font-medium">Pengecekan terakhir: {waktuIndonesia(layar.pusatTerakhir.diperiksaPada)}</p>
                  {layar.pusatTerakhir.pembaruan.map((p) => (
                    <p key={p.komponen} className="text-muted-foreground">
                      {p.komponen}: terpasang {p.terpasang}
                      {p.adaPembaruan ? `, tersedia ${p.tersedia}` : ", sudah terbaru"}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status fitur</CardTitle>
              <CardDescription>
                Stabil dan uji coba menyala; mati berarti tidak tersedia di satker ini.
                {layar.tersimpan ? ` Terakhir diubah ${layar.diubahOleh}.` : " Belum pernah diubah - semua menyala."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input aria-label="Cari fitur" placeholder="Cari fitur..." value={cari} onChange={(e) => setCari(e.target.value)} />
              <div className="divide-y rounded-xl border">
                {tampil.map((f) => (
                  <div key={f.kode} className="flex flex-col gap-2 px-3 py-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {f.nama} <span className="text-xs font-normal text-muted-foreground">({LABEL_BAGIAN_KATALOG[f.bagian]})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{f.keterangan}</p>
                      {f.sebab && f.status !== f.pilihan ? <p className="text-xs text-amber-700 dark:text-amber-300">{f.sebab}</p> : null}
                    </div>
                    <NativeSelect
                      aria-label={`Status ${f.nama}`}
                      className="md:w-40"
                      value={pilih[f.kode] ?? f.pilihan}
                      disabled={sibuk}
                      onChange={(e) => setPilih((lama) => ({ ...lama, [f.kode]: e.target.value as StatusFitur }))}
                    >
                      <option value="stabil">Stabil</option>
                      <option value="uji-coba">Uji coba</option>
                      <option value="mati">Mati</option>
                    </NativeSelect>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={!fiturBerubah || sibuk} onClick={() => void jalankan({ tindakan: "simpan-fitur", fitur: pilih }, (d) => `Tersimpan. ${d.bot ? d.bot.pesan : ""}`.trim())}>
                  {sibuk ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void jalankan({ tindakan: "sinkron-bot" }, () => "Status fitur dikirim ke bot.")}>
                  Kirim ulang ke bot
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Akses super admin global</CardTitle>
              <CardDescription>
                Setiap kali super admin global masuk ke satker ini, akses itu dicatat di Jejak Audit dan diberitahukan ke admin satker.
                {layar.aksesGlobal.penandaTerpasang ? "" : " Belum ada akun yang ditandai sebagai super admin global di server ini."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {layar.aksesGlobal.terbaru.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada akses tercatat.</p> : null}
              <div className="divide-y rounded-xl border">
                {layar.aksesGlobal.terbaru.map((a) => (
                  <div key={a.id} className="px-3 py-2 text-sm">
                    <p className="font-medium">{a.nama || a.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {waktuIndonesia(a.waktu)}
                      {a.alamatIp ? ` dari ${a.alamatIp}` : ""}
                      {a.cara === "tiket-pusat" ? " melalui ALETA Pusat" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
