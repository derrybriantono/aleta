"use client";

import { useCallback, useEffect, useState } from "react";

import { BatangKemajuan, GalatAlur, TandaAlur, kirimAlur, panggilAlur } from "@/components/portal/aleta-abt-umum";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KELAS_BEDA_NAMA, KELAS_DIJELASKAN, type KelasBeda } from "@/lib/aleta-abt-naskah";
import { NAMA_JENIS_BANDING, type RingkasanBerdampingan } from "@/lib/aleta-abt-berdampingan";
import type { BedaTerbaru, SetelanBerdampingan } from "@/server/modules/aleta-abt-berdampingan/service";

/**
 * Berdampingan dengan ABT (Tahap 7): petugas tetap mencetak dari ABT; ALETA ABT menyusun naskah yang sama di belakang dan mencatat bedanya.
 * Layar ini hanya menampilkan angka dan jenis beda (tidak ada isi naskah, tidak ada nama pihak). Pindah dari ABT tidak diputuskan di sini:
 * layar hanya menunjukkan apakah syarat 30 cetak dan dua pekan tanpa beda merah terpenuhi; keputusan ada pada pemilik.
 * Hanya Super Admin; rute /api/aleta-abt/berdampingan menjaga ulang di server.
 */

type Jawaban = { ringkasan: RingkasanBerdampingan; beda: BedaTerbaru[]; setelan: SetelanBerdampingan };

const NAMA_JAWABAN: Record<string, string> = { dijelaskan: "dijelaskan", "sudah-dibetulkan": "sudah dibetulkan", "salah-pembanding": "pembandingnya yang keliru" };
const tanggalPendek = (iso: string) => iso.slice(0, 10).split("-").reverse().join("-");

export function BerdampinganAbt() {
  const [j, setJ] = useState<Jawaban | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(async () => {
    setGalat("");
    try {
      setJ(await panggilAlur<Jawaban>("berdampingan"));
    } catch (e) {
      setGalat((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const ubahSetelan = async (aktif: boolean) => {
    setSibuk("setelan");
    setGalat("");
    try {
      await kirimAlur("berdampingan", { tindakan: "setelan", aktif });
      await muat();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
    }
  };

  const jawab = async (id: string, jawaban: string) => {
    setSibuk(id);
    setGalat("");
    try {
      await kirimAlur("berdampingan", { tindakan: "jawab", id, jawaban });
      await muat();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
    }
  };

  if (!j) return galat ? <GalatAlur pesan={galat} /> : <p className="text-sm text-muted-foreground">Membaca ringkasan...</p>;
  const r = j.ringkasan;

  return (
    <div className="space-y-5">
      <GalatAlur pesan={galat} />
      <Card>
        <CardHeader>
          <CardTitle>Berdampingan dengan ABT</CardTitle>
          <CardDescription>
            Petugas tetap mencetak dari ABT. Bila dinyalakan, ALETA ABT ikut menyusun naskah yang sama di belakang dan mencatat bedanya. Cetak petugas tidak diperlambat dan hasil cetak ABT tidak berubah.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <TandaAlur status={j.setelan.aktif ? "hijau" : "abu"}>{j.setelan.aktif ? "menyala" : "mati"}</TandaAlur>
            {j.setelan.diubahPada ? <span className="text-xs text-muted-foreground">diubah {tanggalPendek(j.setelan.diubahPada)}</span> : null}
          </div>
          <Button className="w-full sm:w-auto" variant={j.setelan.aktif ? "outline" : "default"} disabled={sibuk !== ""} onClick={() => void ubahSetelan(!j.setelan.aktif)}>
            {j.setelan.aktif ? "Matikan pembandingan otomatis" : "Nyalakan pembandingan otomatis"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Yang tersimpan hanya angka, nama blangko, jenis perkara, dan jenis beda. Isi naskah dan data pihak tidak disimpan. Berita acara baru dapat dibandingkan otomatis bila nomor sidangnya ikut terkirim saat cetak;
            selain itu dicatat sebagai belum diukur atau dibandingkan dari layar cetak.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {r.perJenis.map((p) => (
          <Card key={p.jenis}>
            <CardHeader>
              <CardTitle>{p.nama}</CardTitle>
              <CardDescription>
                {p.memenuhiSyarat ? "Syarat terpenuhi. Pindah menunggu keputusan pemilik." : "Syarat belum terpenuhi."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>Cetak yang dibandingkan</span>
                  <span className="text-muted-foreground">
                    {p.cetak} dari {p.target} cetak
                  </span>
                </div>
                <BatangKemajuan nilai={p.cetak} maks={p.target} label={`Cetak ${p.nama}`} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>Hari tanpa beda merah</span>
                  <span className="text-muted-foreground">
                    {p.hariTanpaMerah} dari {r.syaratHari} hari
                  </span>
                </div>
                <BatangKemajuan nilai={p.hariTanpaMerah} maks={r.syaratHari} label={`Hari tanpa beda merah ${p.nama}`} />
              </div>
              <div className="flex flex-wrap gap-2">
                <TandaAlur status="hijau">{p.hijau} sama</TandaAlur>
                <TandaAlur status="kuning">{p.kuning} beda dijelaskan</TandaAlur>
                <TandaAlur status={p.merah ? "merah" : "abu"}>{p.merah} merah</TandaAlur>
                <TandaAlur status="abu">{p.belumDiukur} belum diukur</TandaAlur>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan mingguan</CardTitle>
          <CardDescription>{r.total} hasil tercatat. {r.merahBelumDijawab ? `${r.merahBelumDijawab} beda merah menunggu jawaban Anda.` : "Tidak ada beda merah yang menunggu jawaban."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {r.mingguan.map((p) => (
            <div key={p.mulai} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-b-0">
              <span>Pekan mulai {tanggalPendek(p.mulai)}</span>
              <span className="flex flex-wrap gap-2">
                <TandaAlur status="abu">{p.total} cetak</TandaAlur>
                <TandaAlur status="hijau">{p.hijau}</TandaAlur>
                <TandaAlur status="kuning">{p.kuning}</TandaAlur>
                <TandaAlur status={p.merah ? "merah" : "abu"}>{p.merah}</TandaAlur>
              </span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Urutan angka: sama, beda dijelaskan, merah.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Beda dua pekan terakhir</CardTitle>
          <CardDescription>Beda spasi karena ABT menempelkan kata dicatat sebagai beda yang dijelaskan dan tidak dihitung gagal. Titik-titik isian kosong di BAS tetap dicetak.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!j.beda.length ? <p className="text-sm text-muted-foreground">Belum ada beda yang tercatat.</p> : null}
          {j.beda.map((b) => {
            const merah = b.hasil === "merah" && !b.jawaban;
            return (
              <div key={b.id} className="space-y-2 rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words font-medium">{b.berkasNama}</p>
                  <TandaAlur status={merah ? "merah" : "kuning"}>{merah ? "belum dijelaskan" : b.jawaban ? NAMA_JAWABAN[b.jawaban] : "dijelaskan"}</TandaAlur>
                </div>
                <p className="text-xs text-muted-foreground">
                  {NAMA_JENIS_BANDING[b.jenisPerkara]}, perkara {b.perkaraId}, {tanggalPendek(b.waktu)}: {b.identik} dari {b.total} alinea sama.
                </p>
                <ul className="list-disc pl-5 text-xs">
                  {(Object.keys(b.perKelas) as KelasBeda[])
                    .filter((k) => b.perKelas[k] > 0)
                    .map((k) => (
                      <li key={k}>
                        {b.perKelas[k]} alinea: {KELAS_BEDA_NAMA[k] ?? k} ({KELAS_DIJELASKAN[k] ? "sudah dijelaskan" : "belum dijelaskan"})
                      </li>
                    ))}
                </ul>
                {b.nomor.length ? (
                  <p className="break-words text-xs text-muted-foreground">
                    Alinea ABT / ALETA ABT: {b.nomor.slice(0, 12).map((n) => `${n.abt || "-"}/${n.aleta || "-"}`).join(", ")}
                    {b.nomor.length > 12 ? ", ..." : ""}
                  </p>
                ) : null}
                {merah ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {(["dijelaskan", "sudah-dibetulkan", "salah-pembanding"] as const).map((x) => (
                      <Button key={x} size="sm" variant="outline" className="w-full sm:w-auto" disabled={sibuk !== ""} onClick={() => void jawab(b.id, x)}>
                        {sibuk === b.id ? "Menyimpan..." : `Tandai ${NAMA_JAWABAN[x]}`}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
