"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import type { HukumAcara, PilihanHukumAcara } from "@/lib/identitas-satker";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Pengaturan SIPP & ABT > Identitas satker > Hukum acara (30 Okt 2026, G6 butir 6.1).
 * Satker di luar Jawa dan Madura memakai RBg, di Jawa dan Madura memakai HIR -
 * bawaan OTOMATIS dari provinsi satker. Super Admin dapat menetapkannya.
 * Blangko yang menyebut pasal hukum acara lewat variabel padanan langsung
 * mengikuti; tidak ada langkah lain bagi petugas.
 */

export type KeadaanHukumAcara = {
  ada: boolean;
  nilai: string;
  pilihan: PilihanHukumAcara;
  provinsi: string;
  otomatis: HukumAcara;
  bisa: boolean;
  sebab: string;
};

const NAMA: Record<HukumAcara, string> = {
  RBg: "RBg (Rechtsreglement Buitengewesten - luar Jawa dan Madura)",
  HIR: "HIR (Herzien Inlandsch Reglement - Jawa dan Madura)",
};

export function HukumAcaraSatker({ keadaan, bolehUbah, sesudah }: { keadaan: KeadaanHukumAcara | null; bolehUbah: boolean; sesudah: () => void }) {
  const [pilih, setPilih] = useState<PilihanHukumAcara | "">("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "galat" | "berhasil"; teks: string } | null>(null);
  if (!keadaan) return null;
  const sekarang = pilih || keadaan.pilihan;
  const berlaku = (keadaan.nilai === "HIR" || keadaan.nilai === "RBg" ? keadaan.nilai : keadaan.pilihan === "otomatis" ? keadaan.otomatis : keadaan.pilihan) as HukumAcara;

  async function terapkan() {
    setSibuk(true);
    setPesan(null);
    try {
      const r = await fetch(apiPath("/api/pengaturan-sipp-abt"), {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tindakan: "terapkan-hukum-acara", pilihan: sekarang }),
      });
      const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: { pesan?: string } } | null;
      if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
      setPesan({ jenis: "berhasil", teks: isi.data?.pesan || "Tersimpan di ABT." });
      setPilih("");
      sesudah();
    } catch (e) {
      setPesan({ jenis: "galat", teks: e instanceof Error ? e.message : String(e) });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Hukum acara perdata
          <span
            className="inline-flex cursor-help text-muted-foreground"
            title="Satker di luar Jawa dan Madura memakai RBg; satker di Jawa dan Madura memakai HIR. Pasal hukum acara di blangko yang sudah memakai variabel padanan (verstek, upaya damai, saksi, pembuktian, biaya perkara, eksepsi, putusan sela, dan lain-lain) otomatis menyebut pasal RBg atau HIR. Pasal yang padanannya belum pasti tetap menyebut RBg."
            aria-label="Keterangan hukum acara"
          >
            <Info className="h-4 w-4" />
          </span>
        </CardTitle>
        <CardDescription>
          Berlaku sekarang: <Badge variant="muted">{berlaku}</Badge>{" "}
          {keadaan.pilihan === "otomatis" ? `otomatis dari provinsi satker${keadaan.provinsi ? ` (${keadaan.provinsi})` : ""}` : "ditetapkan Super Admin"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!keadaan.ada || !keadaan.bisa ? <p className="text-muted-foreground">{keadaan.sebab}</p> : null}
        {keadaan.ada && keadaan.bisa && bolehUbah ? (
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect value={sekarang} onChange={(e) => setPilih(e.target.value as PilihanHukumAcara)} className="max-w-md" aria-label="Pilihan hukum acara">
              <option value="otomatis">Otomatis dari provinsi satker ({keadaan.otomatis})</option>
              <option value="RBg">{NAMA.RBg}</option>
              <option value="HIR">{NAMA.HIR}</option>
            </NativeSelect>
            {sekarang !== keadaan.pilihan ? (
              <Button size="sm" onClick={() => void terapkan()} disabled={sibuk}>
                {sibuk ? "Menyimpan..." : "Terapkan ke ABT"}
              </Button>
            ) : null}
          </div>
        ) : null}
        {keadaan.ada && keadaan.bisa && !bolehUbah ? <p className="text-muted-foreground">Hanya Super Admin yang dapat mengubahnya.</p> : null}
        {pesan ? (
          <p className={pesan.jenis === "galat" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}>{pesan.teks}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
