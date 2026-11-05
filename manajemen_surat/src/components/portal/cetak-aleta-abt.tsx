"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KELAS_BEDA_NAMA, type BedaAlinea, type BandingPdf, type HasilBandingAlinea, type KertasNaskah, type RingkasPdf } from "@/lib/aleta-abt-naskah";
import type { FolderDaftar } from "@/lib/aleta-abt-penyunting-tipe";
import { kepalaTanda } from "@/lib/aleta-abt-tanda-klien";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Layar cetak ALETA ABT (5 Nov 2026, Tahap 5) - Super Admin saja; rute /api/aleta-abt/cetak menjaga ulang di server
 * (akun Super Admin DAN tanda ekstensi di PC atau hak ALETA ABT di HP). Naskah disusun jalur ALETA dari blangko pustaka tanpa ABT.
 * Layar ini tidak menulis apa pun ke SIPP/ABT. Panel Blangko ABT by Derry Briantono tidak memakai layar ini.
 */

type Perkara = { nomorPerkara: string; perkaraId: string; jenisPerkara: string; sudahPutus?: boolean; tanggalPutusan?: string };
type ParagrafTampil = { i: number; teks: string; rata: string; li: number; fi: number; tabel: boolean; awalan: string };
type Waktu = { botMs: number; totalMs: number; pdfMs?: number };
type Pratinjau = {
  nama: string;
  kertas: KertasNaskah;
  paragraf: ParagrafTampil[];
  jumlahParagraf: number;
  terpotong: boolean;
  jumlahTerisi: number;
  kosong: Array<{ nama: string; sebab: string; status: string }>;
  lolosCetak: boolean;
  mesinGalat: string;
  ringkasanKeyakinan: Record<string, number>;
  waktu: Waktu;
};
type HasilBandingRtf = { alinea: HasilBandingAlinea; kertas: { abt: KertasNaskah; aleta: KertasNaskah }; waktu: Waktu; tercatat?: { hasil: string; jenisPerkara: string } };
type HasilBandingPdf = { abt: RingkasPdf; aleta: RingkasPdf; banding: BandingPdf };
type Hak = { boleh: boolean; lewat: string; sebab: string };

async function panggil<T>(cari: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(`/api/aleta-abt/cetak${cari}`), { cache: "no-store", ...init, headers: { ...(await kepalaTanda()), ...((init?.headers as Record<string, string> | undefined) ?? {}) } });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; kosong?: Array<{ nama: string }> } | null;
  if (!r.ok || !isi || isi.ok === false) {
    const galat = new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`)) as Error & { kosong?: Array<{ nama: string }> };
    if (isi && Array.isArray(isi.kosong)) galat.kosong = isi.kosong;
    throw galat;
  }
  return isi.data as T;
}

const kirim = <T,>(badan: Record<string, unknown>) =>
  panggil<T>("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

const detik = (ms: number) => `${(ms / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} detik`;

function dasarBase64(b: ArrayBuffer): string {
  const bita = new Uint8Array(b);
  let s = "";
  for (let i = 0; i < bita.length; i += 8192) s += String.fromCharCode(...bita.subarray(i, i + 8192));
  return btoa(s);
}

function unduh(base64: string, nama: string, jenis: string) {
  const bita = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bita], { type: jenis }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Nama berkas unduhan tanpa kata ALETA: berkas ini dapat diunggah ke SIPP/e-Court oleh petugas. */
const namaBerkas = (nama: string, akhiran: string, tambahan = "") => `${nama.replace(/\.rtf$/i, "").replace(/[\\/:*?"<>|]+/g, " ").trim()}${tambahan}.${akhiran}`;

function Galat({ pesan }: { pesan: string }) {
  if (!pesan) return null;
  return (
    <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
      {pesan}
    </div>
  );
}

function Ukuran({ k }: { k: KertasNaskah }) {
  return <span>{k.nama === "Tak terbaca" ? "ukuran kertas tidak terbaca" : `${k.nama} (${k.lebarMm} x ${k.tinggiMm} mm)`}</span>;
}

type Status = "hijau" | "kuning" | "merah" | "abu";
const WARNA_STATUS: Record<Status, string> = {
  hijau: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  kuning: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  merah: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  abu: "border-border bg-muted text-muted-foreground",
};

function Tanda({ status, children }: { status: Status; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${WARNA_STATUS[status]}`}>{children}</span>;
}

function BarisUkur({ nama, children }: { nama: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border py-2 last:border-b-0">
      <span className="text-sm">{nama}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

export function CetakAletaAbt() {
  const [hak, setHak] = useState<Hak | null>(null);
  const [daftar, setDaftar] = useState<FolderDaftar[] | null>(null);
  const [galat, setGalat] = useState("");
  const [nomor, setNomor] = useState("");
  const [hasilCari, setHasilCari] = useState<Perkara[] | null>(null);
  const [perkara, setPerkara] = useState<Perkara | null>(null);
  const [saring, setSaring] = useState("");
  const [berkas, setBerkas] = useState<{ id: string; nama: string } | null>(null);
  const [sidangKe, setSidangKe] = useState("");
  const [pratinjau, setPratinjau] = useState<Pratinjau | null>(null);
  const [kosongTahan, setKosongTahan] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState("");
  const [infoBerkas, setInfoBerkas] = useState("");
  const [bandingRtf, setBandingRtf] = useState<HasilBandingRtf | null>(null);
  const [bandingPdf, setBandingPdf] = useState<HasilBandingPdf | null>(null);
  const [berdampingan, setBerdampingan] = useState(false);
  const [catatBanding, setCatatBanding] = useState(false);
  const pdfAleta = useRef<string>("");
  const [adaPdfAleta, setAdaPdfAleta] = useState(false);

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const h = await panggil<Hak>("?bagian=hak");
        if (batal) return;
        setHak(h);
        if (!h.boleh) return;
        const d = await panggil<{ folder: FolderDaftar[] }>("?bagian=daftar");
        if (!batal) setDaftar(d.folder);
      } catch (e) {
        if (!batal) setGalat((e as Error).message);
      }
    })();
    return () => {
      batal = true;
    };
  }, []);


  const cari = useCallback(async () => {
    setGalat("");
    setSibuk("cari");
    try {
      const h = await panggil<{ perkara: Perkara[] }>(`?bagian=perkara&nomor=${encodeURIComponent(nomor.trim())}`);
      setHasilCari(h.perkara);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
    }
  }, [nomor]);

  const badan = (tindakan: string, tambahan: Record<string, unknown> = {}) => ({
    tindakan,
    berkasId: berkas?.id,
    perkaraId: perkara?.perkaraId,
    sidangKe: Number(sidangKe) || 0,
    ...tambahan,
  });

  const siap = Boolean(perkara && berkas);

  const susun = async () => {
    if (!siap) return;
    setGalat("");
    setKosongTahan([]);
    setBandingRtf(null);
    setBandingPdf(null);
    pdfAleta.current = "";
    setAdaPdfAleta(false);
    setSibuk("pratinjau");
    try {
      setPratinjau(await kirim<Pratinjau>(badan("pratinjau")));
    } catch (e) {
      setPratinjau(null);
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
    }
  };

  const cetak = async (jenis: "rtf" | "pdf" | "salinan") => {
    if (!siap || !berkas) return;
    setGalat("");
    setKosongTahan([]);
    setSibuk(jenis);
    try {
      if (jenis === "rtf") {
        const h = await kirim<{ nama: string; rtfBase64: string }>(badan("rtf"));
        unduh(h.rtfBase64, namaBerkas(h.nama, "rtf"), "application/rtf");
      } else {
        const h = await kirim<{ nama: string; pdfBase64: string; waktu: Waktu }>(badan(jenis));
        pdfAleta.current = h.pdfBase64;
        setAdaPdfAleta(true);
        setPratinjau((p) => (p ? { ...p, waktu: { ...p.waktu, pdfMs: h.waktu.pdfMs } } : p));
        unduh(h.pdfBase64, namaBerkas(h.nama, "pdf", jenis === "salinan" ? " (SALINAN)" : ""), "application/pdf");
      }
    } catch (e) {
      const g = e as Error & { kosong?: Array<{ nama: string }> };
      setGalat(g.message);
      if (g.kosong) setKosongTahan(g.kosong.map((k) => k.nama));
    } finally {
      setSibuk("");
    }
  };

  const salinanDariBerkas = async (f: File | undefined) => {
    if (!f) return;
    setGalat("");
    setKosongTahan([]);
    setInfoBerkas("");
    setSibuk("salinan-berkas");
    try {
      if (f.size > 20 * 1024 * 1024) throw new Error("Berkas terlalu besar (paling banyak 20 MB).");
      const h = await kirim<{ pdfBase64: string }>({ tindakan: "salinan-berkas", namaBerkas: f.name, berkasBase64: dasarBase64(await f.arrayBuffer()) });
      const dasar = f.name.replace(/\.[^./\\]+$/, "");
      unduh(h.pdfBase64, namaBerkas(dasar, "pdf", " (SALINAN)"), "application/pdf");
      setInfoBerkas(`PDF SALINAN dari ${f.name} sudah diunduh.`);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
    }
  };

  const pilihRtfAbt = async (f: File | undefined) => {
    if (!f || !siap) return;
    setGalat("");
    setSibuk("banding");
    try {
      setBandingRtf(await kirim<HasilBandingRtf>(badan("banding", { rtfAbtBase64: dasarBase64(await f.arrayBuffer()), ...(catatBanding ? { catat: true, jenisPerkara: perkara?.jenisPerkara ?? "" } : {}) })));
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
    }
  };

  const pilihPdfAbt = async (f: File | undefined) => {
    if (!f || !pdfAleta.current) return;
    setGalat("");
    setSibuk("banding-pdf");
    try {
      setBandingPdf(await kirim<HasilBandingPdf>({ tindakan: "banding-pdf", pdfAbtBase64: dasarBase64(await f.arrayBuffer()), pdfAletaBase64: pdfAleta.current }));
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
    }
  };

  const blangkoTersaring = useMemo(() => {
    if (!daftar) return [];
    const kata = saring.trim().toLowerCase();
    const hasil: Array<{ id: string; nama: string; folder: string }> = [];
    for (const f of daftar) {
      for (const b of f.blangko) {
        if (!b.rtf || b.hilang || b.arsip) continue;
        if (kata && !`${f.label} ${b.nama}`.toLowerCase().includes(kata)) continue;
        hasil.push({ id: b.id, nama: b.nama, folder: f.label });
        if (hasil.length >= 40) return hasil;
      }
    }
    return hasil;
  }, [daftar, saring]);

  if (hak && !hak.boleh) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cetak belum dibuka</CardTitle>
          <CardDescription>{hak.sebab}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tahanKosong = pratinjau && !pratinjau.lolosCetak;

  return (
    <div className="space-y-5">
      <Galat pesan={galat} />
      {kosongTahan.length ? (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Isian yang masih kosong: {kosongTahan.slice(0, 20).join(", ")}
          {kosongTahan.length > 20 ? `, dan ${kosongTahan.length - 20} lainnya` : ""}.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>1. Pilih perkara</CardTitle>
          <CardDescription>Ketik sebagian nomor perkara, lalu pilih.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (nomor.trim().length >= 3) void cari();
            }}
          >
            <Input value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="Contoh: 123/Pdt.G/2026" aria-label="Nomor perkara" className="min-w-0 flex-1" />
            <Button type="submit" disabled={nomor.trim().length < 3 || sibuk === "cari"} className="w-full sm:w-auto">
              {sibuk === "cari" ? "Mencari..." : "Cari perkara"}
            </Button>
          </form>
          {perkara ? (
            <p className="text-sm">
              Dipilih: <b className="break-words">{perkara.nomorPerkara}</b> <span className="text-muted-foreground">{perkara.jenisPerkara}</span>
            </p>
          ) : null}
          {hasilCari ? (
            hasilCari.length ? (
              <ul className="space-y-1.5">
                {hasilCari.map((p) => (
                  <li key={p.perkaraId}>
                    <button
                      type="button"
                      onClick={() => {
                        setPerkara(p);
                        setPratinjau(null);
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${perkara?.perkaraId === p.perkaraId ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                    >
                      <span className="block break-words font-medium">{p.nomorPerkara}</span>
                      <span className="block text-xs text-muted-foreground">
                        {p.jenisPerkara}
                        {p.sudahPutus && p.tanggalPutusan ? ` - putus ${p.tanggalPutusan}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak ada perkara dengan nomor itu.</p>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Pilih blangko</CardTitle>
          <CardDescription>Dari pustaka ALETA ABT. Yang dipakai adalah versi yang sudah diterbitkan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!daftar ? <p className="text-sm text-muted-foreground">Memuat pustaka...</p> : null}
          {daftar ? (
            <>
              <Input value={saring} onChange={(e) => setSaring(e.target.value)} placeholder="Cari nama blangko atau jenisnya" aria-label="Cari blangko" />
              {berkas ? (
                <p className="text-sm">
                  Dipilih: <b className="break-words">{berkas.nama}</b>
                </p>
              ) : null}
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {blangkoTersaring.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setBerkas({ id: b.id, nama: b.nama });
                        setPratinjau(null);
                      }}
                      className={`w-full rounded-lg border px-3 py-1.5 text-left text-sm ${berkas?.id === b.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                    >
                      <span className="block break-words">{b.nama}</span>
                      <span className="block text-xs text-muted-foreground">{b.folder}</span>
                    </button>
                  </li>
                ))}
                {!blangkoTersaring.length ? <li className="text-sm text-muted-foreground">Tidak ada blangko yang cocok.</li> : null}
              </ul>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span>Sidang ke (untuk berita acara sidang, boleh kosong)</span>
                <Input value={sidangKe} onChange={(e) => setSidangKe(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className="w-20" aria-label="Sidang ke" />
              </label>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PDF SALINAN dari berkas</CardTitle>
          <CardDescription>
            Pilih berkas putusan atau penetapan (RTF, DOCX, DOC, atau PDF yang masih kosong). PDF SALINAN langsung diunduh. Berita acara sidang dalam bentuk PDF ditolak karena salinannya memakai tanda tangan asli.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-sm hover:bg-muted sm:w-auto">
            {sibuk === "salinan-berkas" ? "Membuat PDF salinan..." : "Pilih berkas lalu unduh PDF SALINAN"}
            <input type="file" accept=".rtf,.docx,.doc,.pdf" className="sr-only" disabled={sibuk !== ""} onChange={(e) => { void salinanDariBerkas(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {infoBerkas ? (
            <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              {infoBerkas}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={susun} disabled={!siap || sibuk !== ""} className="w-full sm:w-auto">
          {sibuk === "pratinjau" ? "Menyusun naskah..." : "Pratinjau naskah"}
        </Button>
      </div>

      {pratinjau ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Pratinjau
              <Badge variant={tahanKosong ? "warning" : "success"}>{tahanKosong ? `${pratinjau.kosong.length} isian kosong` : "semua isian terisi"}</Badge>
            </CardTitle>
            <CardDescription>
              Kertas <Ukuran k={pratinjau.kertas} />. Disusun {detik(pratinjau.waktu.totalMs)} (mesin {detik(pratinjau.waktu.botMs)}); itu waktu pada server yang sedang dipakai, bukan jaminan kecepatan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pratinjau.mesinGalat ? <Galat pesan={`Mesin ragu: ${pratinjau.mesinGalat}`} /> : null}
            {pratinjau.kosong.length ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                <p className="font-medium">Cetak final ditahan sampai isian ini terisi di SIPP atau ABT:</p>
                <ul className="mt-1 list-disc pl-5">
                  {pratinjau.kosong.slice(0, 30).map((k, i) => (
                    <li key={`${k.nama}-${i}`} className="break-words">
                      {k.nama}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button variant="outline" onClick={() => cetak("rtf")} disabled={sibuk !== "" || !!tahanKosong} className="w-full sm:w-auto">
                {sibuk === "rtf" ? "Menyiapkan..." : "Unduh RTF"}
              </Button>
              <Button variant="outline" onClick={() => cetak("pdf")} disabled={sibuk !== "" || !!tahanKosong} className="w-full sm:w-auto">
                {sibuk === "pdf" ? "Membuat PDF..." : "Unduh PDF"}
              </Button>
              <Button variant="outline" onClick={() => cetak("salinan")} disabled={sibuk !== "" || !!tahanKosong} className="w-full sm:w-auto">
                {sibuk === "salinan" ? "Membuat PDF salinan..." : "Unduh PDF SALINAN"}
              </Button>
            </div>
            {pratinjau.waktu.pdfMs !== undefined ? <p className="text-xs text-muted-foreground">PDF terakhir dibuat dalam {detik(pratinjau.waktu.pdfMs)} (termasuk LibreOffice di server).</p> : null}
            <div className="rounded-xl border border-border bg-card px-3 py-3 text-[15px] leading-relaxed sm:px-5">
              {pratinjau.paragraf.map((p) => (
                <p
                  key={p.i}
                  className="min-h-[1.5em] break-words"
                  style={{ textAlign: p.rata === "tengah" ? "center" : p.rata === "kanan" ? "right" : p.rata === "rata" ? "justify" : "left" }}
                >
                  {p.awalan ? <span className="mr-2 text-muted-foreground">{p.awalan}</span> : null}
                  {p.teks}
                </p>
              ))}
              {pratinjau.terpotong ? <p className="text-sm text-muted-foreground">Pratinjau dipotong pada {pratinjau.paragraf.length} alinea dari {pratinjau.jumlahParagraf}; berkas yang diunduh utuh.</p> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {pratinjau ? (
        <Card>
          <CardHeader>
            <CardTitle>3. Dibandingkan dengan cetakan ABT</CardTitle>
            <CardDescription>
              Unggah berkas RTF dari cetakan ABT untuk perkara dan blangko yang sama. Teks dibandingkan alinea demi alinea. Jumlah halaman dan letak tanda tangan hanya dapat dibandingkan dari dua PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-sm hover:bg-muted sm:w-auto">
                {sibuk === "banding" ? "Membandingkan..." : "Pilih RTF dari ABT"}
                <input type="file" accept=".rtf" className="sr-only" onChange={(e) => void pilihRtfAbt(e.target.files?.[0])} />
              </label>
              <label className={`inline-flex w-full items-center justify-center rounded-md border border-border px-3 py-2 text-sm sm:w-auto ${adaPdfAleta ? "cursor-pointer hover:bg-muted" : "opacity-50"}`}>
                {sibuk === "banding-pdf" ? "Membandingkan..." : "Pilih PDF dari ABT"}
                <input type="file" accept=".pdf" disabled={!adaPdfAleta} className="sr-only" onChange={(e) => void pilihPdfAbt(e.target.files?.[0])} />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={catatBanding} onChange={(e) => setCatatBanding(e.target.checked)} className="mt-1" />
              <span>
                Catat hasil teks di pembanding berdampingan
                <span className="block text-xs text-muted-foreground">Yang tersimpan hanya angka, nama blangko, dan jenis beda; bukan isi naskah.</span>
              </span>
            </label>
            {bandingRtf?.tercatat ? <p className="text-xs text-muted-foreground">Tercatat di pembanding berdampingan sebagai {bandingRtf.tercatat.hasil}.</p> : null}
            {!adaPdfAleta ? <p className="text-xs text-muted-foreground">Untuk membandingkan halaman, unduh dulu PDF dari layar ini (PDF dibuat LibreOffice di server).</p> : null}
            <div>
              <BarisUkur nama="Teks per alinea">
                {bandingRtf ? (
                  <Tanda status={bandingRtf.alinea.identik === bandingRtf.alinea.total ? "hijau" : bandingRtf.alinea.identik + bandingRtf.alinea.dijelaskan === bandingRtf.alinea.total ? "kuning" : "merah"}>
                    {bandingRtf.alinea.identik} dari {bandingRtf.alinea.total} identik
                    {bandingRtf.alinea.dijelaskan ? `, ${bandingRtf.alinea.dijelaskan} beda dijelaskan` : ""}
                  </Tanda>
                ) : (
                  <Tanda status="abu">belum dibandingkan</Tanda>
                )}
              </BarisUkur>
              <BarisUkur nama="Ukuran kertas">
                {bandingRtf ? (
                  <Tanda status={bandingRtf.kertas.abt.nama === bandingRtf.kertas.aleta.nama ? "hijau" : "merah"}>
                    {bandingRtf.kertas.abt.nama} dan {bandingRtf.kertas.aleta.nama}
                  </Tanda>
                ) : (
                  <Tanda status="abu">belum dibandingkan</Tanda>
                )}
              </BarisUkur>
              <BarisUkur nama="Jumlah halaman">
                {bandingPdf ? (
                  <Tanda status={bandingPdf.banding.jumlahHalaman.sama ? "hijau" : "merah"}>
                    {bandingPdf.banding.jumlahHalaman.abt} dan {bandingPdf.banding.jumlahHalaman.aleta}
                  </Tanda>
                ) : (
                  <Tanda status="abu">belum diukur</Tanda>
                )}
              </BarisUkur>
              <BarisUkur nama="Letak tanda tangan">
                {bandingPdf ? (
                  bandingPdf.banding.letakTandaTangan.sama === null ? (
                    <Tanda status="abu">baris jabatan tidak ditemukan</Tanda>
                  ) : (
                    <Tanda status={bandingPdf.banding.letakTandaTangan.sama ? "hijau" : "merah"}>
                      halaman {bandingPdf.banding.letakTandaTangan.abt?.halaman} dan {bandingPdf.banding.letakTandaTangan.aleta?.halaman}
                      {bandingPdf.banding.letakTandaTangan.sama ? ", sama" : ", berbeda"}
                    </Tanda>
                  )
                ) : (
                  <Tanda status="abu">belum diukur</Tanda>
                )}
              </BarisUkur>
              <BarisUkur nama="Waktu menyusun">
                <Tanda status="abu">{detik(pratinjau.waktu.totalMs)} pada server ini</Tanda>
              </BarisUkur>
            </div>
            {bandingRtf && bandingRtf.alinea.beda.length ? (
              <div className="space-y-2">
                <Button variant="outline" size="sm" onClick={() => setBerdampingan((x) => !x)}>
                  {berdampingan ? "Tutup dua naskah berdampingan" : "Lihat dua naskah berdampingan"}
                </Button>
                {berdampingan ? <DuaNaskah beda={bandingRtf.alinea.beda} terpotong={bandingRtf.alinea.terpotong} /> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DuaNaskah({ beda, terpotong }: { beda: BedaAlinea[]; terpotong: boolean }) {
  return (
    <div className="space-y-3">
      {beda.slice(0, 80).map((b, i) => (
        <div key={i} className="rounded-xl border border-border p-2 text-sm">
          <p className="mb-1 text-xs text-muted-foreground">{KELAS_BEDA_NAMA[b.kelas]}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="min-w-0 rounded-lg bg-muted/50 p-2">
              <p className="text-xs font-medium">ABT{b.nomorAbt ? `, alinea ${b.nomorAbt}` : ""}</p>
              <p className="break-words whitespace-pre-wrap">{b.abt || "(tidak ada)"}</p>
            </div>
            <div className="min-w-0 rounded-lg bg-muted/50 p-2">
              <p className="text-xs font-medium">ALETA ABT{b.nomorAleta ? `, alinea ${b.nomorAleta}` : ""}</p>
              <p className="break-words whitespace-pre-wrap">{b.aleta || "(tidak ada)"}</p>
            </div>
          </div>
        </div>
      ))}
      {beda.length > 80 || terpotong ? <p className="text-xs text-muted-foreground">Hanya 80 beda pertama yang ditampilkan.</p> : null}
    </div>
  );
}
