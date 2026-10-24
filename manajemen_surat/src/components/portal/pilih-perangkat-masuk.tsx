"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { waktuWita } from "@/lib/jejak-masuk-tampilan";
import type { InfoBatasPerangkat } from "@/lib/masuk-sipp-klien";

/**
 * Layar masuk saat batas perangkat penuh (23 Okt 2026): password sudah
 * terbukti benar, server memberi tiket sekali pakai 5 menit. Pengguna memilih
 * perangkat yang dikeluarkan; sesudah berhasil, onLanjut() mengulang masuk
 * (password diperiksa lagi, kini batasnya tidak penuh).
 */
export function PilihPerangkatMasuk({
  info,
  onLanjut,
  onBatal,
  ambil = fetch,
}: {
  info: InfoBatasPerangkat;
  onLanjut: () => void;
  onBatal: () => void;
  ambil?: typeof fetch;
}) {
  const [sibuk, setSibuk] = useState("");
  const [galat, setGalat] = useState("");

  const keluarkan = async (perangkatId: string) => {
    setSibuk(perangkatId);
    setGalat("");
    try {
      const r = await ambil(apiPath("/api/portal/perangkat/tiket"), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tiket: info.tiket, perangkatId }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Perangkat belum dapat dikeluarkan.");
      onLanjut();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Perangkat belum dapat dikeluarkan.");
      setSibuk("");
    }
  };

  return (
    <div
      className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100"
      data-pilih-perangkat
    >
      <p>{info.pesan || "Akun ini sudah masuk di perangkat lain sebanyak batasnya."}</p>
      <p className="text-xs">Pilih perangkat yang dikeluarkan (berlaku 5 menit). Masuk Anda lalu dilanjutkan otomatis.</p>
      <ul className="space-y-2">
        {info.perangkat.map((p) => (
          <li key={p.perangkatId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/60 bg-card px-3 py-2 text-foreground">
            <span>
              <span className="block font-medium">{p.nama}</span>
              <span className="text-xs text-muted-foreground">Terakhir aktif {waktuWita(p.terakhirAktif)} · {p.ip || "alamat tidak terbaca"}</span>
            </span>
            <Button type="button" size="sm" variant="outline" disabled={Boolean(sibuk)} onClick={() => void keluarkan(p.perangkatId)}>
              <LogOut className="h-4 w-4" /> {sibuk === p.perangkatId ? "Mengeluarkan..." : "Keluarkan & lanjutkan"}
            </Button>
          </li>
        ))}
      </ul>
      {galat && <p className="text-rose-700 dark:text-rose-200">{galat}</p>}
      <button type="button" className="text-xs underline" onClick={onBatal}>
        Batal
      </button>
    </div>
  );
}
