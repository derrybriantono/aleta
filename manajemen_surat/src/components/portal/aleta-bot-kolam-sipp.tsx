"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import {
  KOLAM_SIPP_BAWAAN,
  KOLAM_SIPP_RENTANG,
  peringatanKolamSipp,
  rapikanKolamSipp,
  totalSambunganMaks,
  type KolamSippSetelan,
} from "@/lib/kolam-sipp";

/**
 * Sambungan bot ke SIPP (Super Admin). Semua saklar mati bawaan: tanpa diubah, bot memakai
 * satu kolam 10 sambungan seperti sebelumnya. Perubahan berlaku di bot tanpa mulai ulang.
 */
export function AletaBotKolamSipp() {
  const [setelan, setSetelan] = useState<KolamSippSetelan>(KOLAM_SIPP_BAWAAN);
  const [tersimpan, setTersimpan] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [maxConnections, setMaxConnections] = useState("");

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const jawaban = await fetch(apiPath("/api/admin/aleta-bot/kolam-sipp"), { cache: "no-store" });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(isi?.error?.message || isi?.message || "Gagal membaca pengaturan sambungan SIPP.");
        const data = isi?.data ?? isi;
        if (batal) return;
        setSetelan(rapikanKolamSipp(data.setelan));
        setTersimpan(Boolean(data.tersimpan));
      } catch (e) {
        if (!batal) setGalat(e instanceof Error ? e.message : "Gagal membaca pengaturan sambungan SIPP.");
      } finally {
        if (!batal) setMemuat(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  const kirim = useCallback(async (badan: Record<string, unknown>) => {
    setSibuk(true);
    setPesan("");
    setGalat("");
    try {
      const jawaban = await fetch(apiPath("/api/admin/aleta-bot/kolam-sipp"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(isi?.error?.message || isi?.message || "Gagal menyimpan pengaturan sambungan SIPP.");
      const data = isi?.data ?? isi;
      setSetelan(rapikanKolamSipp(data.setelan));
      setTersimpan(true);
      const sinkron = data.sinkron as { ok?: boolean; message?: string } | null;
      setPesan(
        sinkron && sinkron.ok === false
          ? "Tersimpan di portal, tetapi bot belum menerimanya. Akan dikirim saat bot dapat dihubungi."
          : "Tersimpan dan sudah dikirim ke bot."
      );
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan pengaturan sambungan SIPP.");
    } finally {
      setSibuk(false);
    }
  }, []);

  const ubahAngka = (kunci: "batas" | "batasInteraktif" | "antreMaksMs" | "antreanMaks", nilai: string) =>
    setSetelan((s) => ({ ...s, [kunci]: Number(nilai.replace(/[^0-9]/g, "")) || 0 }));

  const peringatan = peringatanKolamSipp(rapikanKolamSipp(setelan), Number(maxConnections) || null);

  return (
    <Card id="sambungan-sipp" className="mt-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Sambungan Bot ke SIPP
          <Badge variant={tersimpan ? "warning" : "success"}>{tersimpan ? "Diatur" : "Bawaan"}</Badge>
        </CardTitle>
        <CardDescription>
          Memisahkan sambungan untuk layar dari kerja latar, agar kerja latar tidak membuat semua layar menunggu. Selama
          tidak diubah, bot memakai satu kolam 10 sambungan seperti biasa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {memuat ? <p className="text-sm text-muted-foreground">Memuat pengaturan...</p> : null}
        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
            <span className="text-sm">
              <span className="block font-medium text-foreground">Pisahkan sambungan layar dan latar</span>
              <span className="block text-xs text-muted-foreground">Layar memakai kolam sendiri; WhatsApp, penilaian, dan jadwal otomatis memakai kolam lain.</span>
            </span>
            <Switch checked={setelan.terpisah} onCheckedChange={(v) => setSetelan((s) => ({ ...s, terpisah: v }))} aria-label="Pisahkan sambungan layar dan latar" />
          </label>
          <label className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
            <span className="text-sm">
              <span className="block font-medium text-foreground">Hentikan kueri lambat di SIPP</span>
              <span className="block text-xs text-muted-foreground">Kueri yang melewati batas waktu ikut dihentikan di server SIPP, bukan hanya ditinggalkan bot.</span>
            </span>
            <Switch checked={setelan.putusKueriLambat} onCheckedChange={(v) => setSetelan((s) => ({ ...s, putusKueriLambat: v }))} aria-label="Hentikan kueri lambat di SIPP" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">{setelan.terpisah ? "Sambungan latar" : "Sambungan bot"}</span>
            <Input inputMode="numeric" value={String(setelan.batas)} onChange={(e) => ubahAngka("batas", e.target.value)} />
            <span className="block text-xs text-muted-foreground">{KOLAM_SIPP_RENTANG.batas.min}-{KOLAM_SIPP_RENTANG.batas.maks}; bawaan 10</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Sambungan layar</span>
            <Input inputMode="numeric" value={String(setelan.batasInteraktif)} disabled={!setelan.terpisah} onChange={(e) => ubahAngka("batasInteraktif", e.target.value)} />
            <span className="block text-xs text-muted-foreground">Dipakai bila dipisahkan; bawaan 10</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Tunggu sambungan (milidetik)</span>
            <Input inputMode="numeric" value={String(setelan.antreMaksMs)} onChange={(e) => ubahAngka("antreMaksMs", e.target.value)} />
            <span className="block text-xs text-muted-foreground">0 = menunggu tanpa batas (seperti dulu); disarankan 4000</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Antrean terpanjang</span>
            <Input inputMode="numeric" value={String(setelan.antreanMaks)} onChange={(e) => ubahAngka("antreanMaks", e.target.value)} />
            <span className="block text-xs text-muted-foreground">0 = tanpa batas (seperti dulu)</span>
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Batas sambungan SIPP (opsional)</span>
            <Input inputMode="numeric" className="w-40" value={maxConnections} placeholder="mis. 151" onChange={(e) => setMaxConnections(e.target.value.replace(/[^0-9]/g, ""))} />
          </label>
          <p className="pb-2 text-xs text-muted-foreground">Total sambungan bot paling banyak: {totalSambunganMaks(rapikanKolamSipp(setelan))}</p>
        </div>
        {peringatan.map((teks) => (
          <p key={teks} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
            {teks}
          </p>
        ))}
        {pesan ? <p className="text-sm text-muted-foreground">{pesan}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void kirim({ ...rapikanKolamSipp(setelan) })} disabled={sibuk || memuat}>
            Simpan dan kirim ke bot
          </Button>
          <Button variant="outline" onClick={() => void kirim({ bawaan: true })} disabled={sibuk || memuat}>
            Kembali ke bawaan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
