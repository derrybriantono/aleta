"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { salinTeks } from "@/lib/salin-teks";

/**
 * Tombol Salin dengan umpan balik yang jujur. Berhasil: label berubah "Tersalin". Ditolak peramban (izin, dokumen tidak berfokus, atau peladen
 * satker tanpa HTTPS): label TIDAK berubah, dan teksnya disodorkan di kotak yang sudah terpilih seluruhnya supaya tinggal Ctrl+C. Diam berarti
 * penggunanya menempelkan isi papan klip yang lama (lihat lib/salin-teks.ts). Hasil dilupakan bila teksnya berganti.
 */
export function TombolSalinTeks({ teks, label, apa, disabled = false }: { teks: string; label: string; apa: string; disabled?: boolean }) {
  const [hasil, setHasil] = useState<"" | "tersalin" | "gagal">("");
  const [untuk, setUntuk] = useState(teks);
  if (untuk !== teks) {
    setUntuk(teks);
    setHasil("");
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          void salinTeks(teks).then((j) => setHasil(j === "gagal" ? "gagal" : "tersalin"));
        }}
      >
        {hasil === "tersalin" ? "Tersalin" : label}
      </Button>
      {hasil === "gagal" ? (
        <div role="status" className="w-full basis-full rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-100">
          <p className="mb-1.5">Peramban menolak menyalin otomatis. Isi {apa} sudah terpilih di kotak ini, tekan Ctrl+C untuk menyalinnya (di HP: tekan lama, lalu Salin).</p>
          <textarea
            readOnly
            autoFocus
            aria-label={`Isi ${apa} untuk disalin tangan`}
            value={teks}
            rows={Math.min(12, Math.max(2, teks.split("\n").length))}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-y rounded border border-border bg-background p-1.5 text-xs text-foreground"
          />
          <div className="mt-1 flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => setHasil("")}>
              Tutup
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
