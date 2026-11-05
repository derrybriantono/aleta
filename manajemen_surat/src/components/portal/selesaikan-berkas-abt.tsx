"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { GalatAlur, TandaAlur, kirimAlur, panggilAlur, type StatusTanda } from "@/components/portal/aleta-abt-umum";
import { LANGKAH_SELESAI, type IdLangkah, type KeadaanSelesai, type StatusLangkah } from "@/lib/aleta-abt-selesai";

/**
 * Tombol "Selesaikan berkas" (Tahap 6): lima langkah, satu pemeriksaan. Hanya yang gagal yang diulang. Langkah yang menulis ke SIPP dan
 * e-Court mati sampai pemilik menyalakannya; layar ini menyebutkannya apa adanya dan tidak menyalakannya. Rute di server hanya Super Admin.
 */

type Saklar = { "edoc-sipp": boolean; ecourt: boolean };
type Jawaban = { keadaan: KeadaanSelesai; saklar: Saklar; ada?: boolean };

const NAMA_STATUS: Record<StatusLangkah, string> = {
  menunggu: "menunggu",
  jalan: "berjalan",
  selesai: "selesai",
  gagal: "gagal",
  dimatikan: "dimatikan",
  "tidak-berlaku": "tidak perlu",
};
const WARNA: Record<StatusLangkah, StatusTanda> = { menunggu: "abu", jalan: "kuning", selesai: "hijau", gagal: "merah", dimatikan: "kuning", "tidak-berlaku": "abu" };

export type TargetSelesai = { perkaraId: string; berkasId: string; jenis: "putusan" | "penetapan" | "bas" | "relaas"; nomorPerkara: string; sidangKe: number };

export function SelesaikanBerkasAbt({ target }: { target: TargetSelesai }) {
  const [jawab, setJawab] = useState<Jawaban | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(async () => {
    try {
      const h = await panggilAlur<Jawaban>(`selesai?perkaraId=${encodeURIComponent(target.perkaraId)}&berkasId=${encodeURIComponent(target.berkasId)}`);
      setJawab(h);
    } catch (e) {
      setGalat((e as Error).message);
    }
  }, [target.perkaraId, target.berkasId]);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const jalankan = async (ulangi?: IdLangkah) => {
    setGalat("");
    setSibuk(ulangi ?? "semua");
    try {
      const dasar = { perkaraId: target.perkaraId, berkasId: target.berkasId, jenis: target.jenis, nomorPerkara: target.nomorPerkara, sidangKe: target.sidangKe };
      const h = await kirimAlur<Jawaban>("selesai", ulangi ? { tindakan: "ulangi", langkah: [ulangi], ...dasar } : { tindakan: "jalankan", ...dasar });
      setJawab(h);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk("");
    }
  };

  const k = jawab?.keadaan;
  const adaMati = k ? LANGKAH_SELESAI.some((l) => k.langkah[l.id].status === "dimatikan") : false;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Selesaikan berkas</p>
        {k ? <TandaAlur status={k.status === "selesai" ? "hijau" : k.status === "gagal" ? "merah" : k.status === "sebagian" ? "kuning" : "abu"}>{k.status === "selesai" ? "semua selesai" : k.status === "gagal" ? "ada yang gagal" : k.status === "sebagian" ? "sebagian selesai" : "belum dijalankan"}</TandaAlur> : null}
      </div>
      <GalatAlur pesan={galat} />
      <ul className="space-y-2">
        {LANGKAH_SELESAI.map((l, i) => {
          const s = k?.langkah[l.id];
          const status = s?.status ?? "menunggu";
          return (
            <li key={l.id} className="rounded-lg border border-border bg-card p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">
                  {i + 1}. {l.judul}
                  {l.keLuar ? <span className="ml-1 text-xs text-muted-foreground">(menulis ke luar)</span> : null}
                </span>
                <TandaAlur status={WARNA[status]}>{NAMA_STATUS[status]}</TandaAlur>
              </div>
              {s?.pesan ? <p className="mt-1 break-words text-xs text-muted-foreground">{s.pesan}</p> : null}
              {status === "gagal" ? (
                <Button size="sm" variant="outline" className="mt-2 w-full sm:w-auto" disabled={sibuk !== ""} onClick={() => void jalankan(l.id)}>
                  {sibuk === l.id ? "Mengulang..." : "Ulangi langkah ini"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {adaMati ? (
        <p className="text-xs text-muted-foreground">
          Langkah yang menulis ke SIPP dan e-Court dimatikan sampai pemilik menyalakannya. Langkah lainnya tetap berjalan.
        </p>
      ) : null}
      <Button className="w-full sm:w-auto" disabled={sibuk !== "" || k?.status === "selesai"} onClick={() => void jalankan()}>
        {sibuk === "semua" ? "Menyelesaikan..." : k?.status === "gagal" || k?.status === "sebagian" ? "Lanjutkan yang belum selesai" : "Selesaikan berkas"}
      </Button>
    </div>
  );
}
