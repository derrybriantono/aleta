"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GalatAlur, TandaAlur, kirimAlur, panggilAlur } from "@/components/portal/aleta-abt-umum";
import { SelesaikanBerkasAbt } from "@/components/portal/selesaikan-berkas-abt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LABEL_PERAN_ALUR, PERAN_ALUR, type PeranAlur } from "@/lib/aleta-abt-siap";
import type { HasilPeriksa, JawabanSiap, SaranSiap } from "@/server/modules/aleta-abt-siap/service";

/**
 * "Siap diperiksa" (Tahap 6): daftar pekerjaan per peran dari jadwal sidang, dengan blangko yang disarankan. ALETA ABT masih khusus Super Admin,
 * jadi Super Admin memilih peran yang ingin diperiksa ("lihat sebagai peran"); pilihan ini tidak memberi hak kepada akun lain, dan peran
 * lain ditolak di server. Naskah diperiksa atas permintaan (tidak disusun otomatis untuk semua perkara supaya tidak membebani SIPP).
 */

const hariIni = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Makassar" });

const NAMA_KEYAKINAN: Record<string, string> = { pasti: "pasti", cukup: "cukup", perkiraan: "perkiraan" };

function Periksa({ perkaraId, saran }: { perkaraId: string; saran: SaranSiap }) {
  const [h, setH] = useState<HasilPeriksa | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const periksa = async () => {
    setGalat("");
    setSibuk(true);
    try {
      setH(await kirimAlur<HasilPeriksa>("siap", { tindakan: "periksa", berkasId: saran.berkasId, perkaraId }));
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={sibuk} onClick={() => void periksa()}>
        {sibuk ? "Memeriksa..." : "Periksa naskah"}
      </Button>
      <GalatAlur pesan={galat} />
      {h ? (
        <div className="flex flex-wrap gap-2">
          <TandaAlur status="hijau">{h.pasti} isian pasti</TandaAlur>
          <TandaAlur status={h.periksaKembali ? "kuning" : "abu"}>{h.periksaKembali} perlu dilihat</TandaAlur>
          <TandaAlur status={h.jumlahKosong ? "merah" : "abu"}>{h.jumlahKosong} kosong</TandaAlur>
          <TandaAlur status={h.dapatDicetak ? "hijau" : "merah"}>{h.dapatDicetak ? "dapat dicetak" : "belum dapat dicetak"}</TandaAlur>
        </div>
      ) : null}
      {h?.mesinGalat ? <p className="break-words text-xs text-muted-foreground">{h.mesinGalat}</p> : null}
    </div>
  );
}

function Saran({ butir, saran }: { butir: JawabanSiap["butir"][number]; saran: SaranSiap }) {
  const [buka, setBuka] = useState(false);
  return (
    <li className="space-y-2 rounded-lg border border-border bg-card p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words font-medium">{saran.label || saran.berkas}</span>
        {saran.utama ? <TandaAlur status="hijau">disarankan</TandaAlur> : <TandaAlur status="abu">alternatif</TandaAlur>}
        <TandaAlur status={saran.keyakinan === "pasti" ? "hijau" : saran.keyakinan === "cukup" ? "kuning" : "abu"}>{NAMA_KEYAKINAN[saran.keyakinan]}</TandaAlur>
        {saran.tingkatHak === "bebas" ? <TandaAlur status="hijau">peran ini boleh</TandaAlur> : null}
        {saran.tingkatHak === "ditunjuk" ? <TandaAlur status="kuning">boleh bila ditunjuk</TandaAlur> : null}
        {saran.hakBoleh === false ? <TandaAlur status="merah">peran ini tidak diberi hak</TandaAlur> : null}
      </div>
      {saran.alasan ? <p className="break-words text-xs text-muted-foreground">{saran.alasan}</p> : null}
      {saran.peringatan ? (
        <p role="note" className="break-words rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Di luar tahapan: {saran.peringatan}
        </p>
      ) : null}
      {!saran.diPustaka ? (
        <p className="text-xs text-muted-foreground">Blangko ini belum ada di pustaka ALETA ABT, jadi naskahnya belum dapat disusun di sini.</p>
      ) : (
        <div className="space-y-2">
          <Periksa perkaraId={butir.perkaraId} saran={saran} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setBuka((b) => !b)}>
              {buka ? "Tutup" : "Selesaikan berkas"}
            </Button>
            <Button asChild size="sm" variant="ghost" className="w-full sm:w-auto">
              <Link href="/aleta-abt/cetak">Buka layar cetak</Link>
            </Button>
          </div>
          {buka ? (
            <SelesaikanBerkasAbt
              target={{
                perkaraId: butir.perkaraId,
                berkasId: saran.berkasId,
                jenis: butir.jenis === "bas" ? "bas" : butir.jenis === "relaas" ? "relaas" : butir.jenis === "penetapan" ? "penetapan" : "putusan",
                nomorPerkara: butir.nomorPerkara,
                sidangKe: 0,
              }}
            />
          ) : null}
        </div>
      )}
    </li>
  );
}

export function SiapDiperiksaAbt() {
  const [peran, setPeran] = useState<PeranAlur>("hakim");
  const [tanggal, setTanggal] = useState(hariIni());
  const [jawab, setJawab] = useState<JawabanSiap | null>(null);
  const [galat, setGalat] = useState("");
  const [muat, setMuat] = useState(false);

  const ambil = useCallback(async () => {
    setGalat("");
    setMuat(true);
    try {
      setJawab(await panggilAlur<JawabanSiap>(`siap?peran=${peran}&tanggal=${encodeURIComponent(tanggal)}`));
    } catch (e) {
      setJawab(null);
      setGalat((e as Error).message);
    } finally {
      setMuat(false);
    }
  }, [peran, tanggal]);

  useEffect(() => {
    const t = window.setTimeout(() => void ambil(), 0);
    return () => window.clearTimeout(t);
  }, [ambil]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Lihat sebagai peran</CardTitle>
          <CardDescription>
            ALETA ABT masih khusus Super Admin. Pilih peran yang ingin Anda periksa pekerjaannya; pilihan ini tidak memberi hak kepada siapa pun.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PERAN_ALUR.map((p) => (
              <Button key={p} size="sm" variant={p === peran ? "default" : "outline"} aria-pressed={p === peran} onClick={() => setPeran(p)}>
                {LABEL_PERAN_ALUR[p]}
              </Button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
            Tanggal sidang
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </label>
        </CardContent>
      </Card>

      <GalatAlur pesan={galat} />
      {muat ? <p className="text-sm text-muted-foreground">Membaca jadwal sidang...</p> : null}

      {jawab && !jawab.tersedia ? (
        <Card>
          <CardHeader>
            <CardTitle>Jadwal sidang belum dapat dibaca</CardTitle>
            <CardDescription>{jawab.keterangan}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {jawab && jawab.tersedia ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Siap diperiksa: {LABEL_PERAN_ALUR[jawab.peran]} <span className="text-sm font-normal text-muted-foreground">({jawab.butir.length} pekerjaan)</span>
            </CardTitle>
            <CardDescription>
              {jawab.hakFolder.berlaku ? "Hak folder sudah disetujui dan ikut ditampilkan." : "Hak folder belum disetujui pemilik, jadi belum berlaku; semua saran ditampilkan."}
              {jawab.keterangan ? ` ${jawab.keterangan}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!jawab.butir.length ? <p className="text-sm text-muted-foreground">Tidak ada pekerjaan untuk peran ini pada tanggal itu.</p> : null}
            {jawab.butir.map((b) => (
              <div key={b.kunci} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold">{b.nomorPerkara || `Perkara ${b.perkaraId}`}</p>
                  <TandaAlur status="abu">{b.judul}</TandaAlur>
                </div>
                <p className="break-words text-xs text-muted-foreground">
                  {[b.jenisPerkara, b.tanggalSidang ? `sidang ${b.tanggalSidang}` : "", b.keterangan].filter(Boolean).join(" - ")}
                </p>
                {b.saran.length ? (
                  <ul className="space-y-2">
                    {b.saran.map((s) => (
                      <Saran key={`${s.folder}|${s.berkas}`} butir={b} saran={s} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Belum ada blangko yang disarankan untuk pekerjaan ini di pustaka.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
