"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import type { KeputusanPutusOtomatis, SetelanPutusOtomatis } from "@/lib/putus-otomatis";

/**
 * PUTUS OTOMATIS GUGUR / TIDAK DAPAT DITERIMA (22 Okt 2026) - bagian di jendela
 * Tunda otomatis Jadwal Sidang. Saklar TERPISAH (Super Admin), daftar calon hari
 * itu, tombol "Jangan putus otomatis" per perkara sampai jam pemicu.
 */

type Butir = {
  jadwalId: string;
  nomorPerkara: string;
  agenda: string;
  keputusan: KeputusanPutusOtomatis;
  tulis?: { status: string; pesan: string; atasNama?: string };
  edoc?: { status: string; pesan: string };
};
type Daftar = {
  ada?: boolean;
  setelan: Omit<SetelanPutusOtomatis, "ip" | "diubahOlehId">;
  kalimatSetelan: string;
  jamPemicu: string;
  tahap: "pratinjau" | "jalan";
  butir: Butir[];
  galat: string;
  bolehUbahSetelan: boolean;
  /** Audit hak 23 Okt 2026: boleh menekan "Jangan putus otomatis" / "Ikutkan lagi" (aksi sidang.tunda-putus). */
  bolehBatal?: boolean;
};

export function BagianPutusOtomatis({ tanggal }: { tanggal: string }) {
  const [daftar, setDaftar] = useState<Daftar | null>(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    try {
      const r = await fetch(apiPath(`/api/aleta-ecourt/putus-otomatis?${new URLSearchParams({ tanggal }).toString()}`), { cache: "no-store" });
      const mentah: unknown = await r.json().catch(() => null);
      const isi = ((mentah as { data?: unknown } | null)?.data ?? null) as Daftar | null;
      if (!r.ok || !isi?.ada) setPesan(pesanGalatPortal(mentah, "Daftar putus otomatis tidak terbaca."));
      else setDaftar(isi);
    } catch {
      setPesan("Daftar putus otomatis tidak terbaca.");
    }
  }, [tanggal]);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const kirim = async (badan: Record<string, unknown>) => {
    setSibuk(true);
    setPesan("");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/putus-otomatis"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan) });
      const mentah: unknown = await r.json().catch(() => null);
      const isi = ((mentah as { data?: unknown } | null)?.data ?? null) as { pesan?: string; kalimatSetelan?: string } | null;
      setPesan(r.ok ? String(isi?.pesan || isi?.kalimatSetelan || "Tersimpan.") : pesanGalatPortal(mentah, "Gagal disimpan."));
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  const s = daftar?.setelan;
  const kunci = !daftar?.bolehUbahSetelan || sibuk;
  return (
    <section className="mt-4 rounded-lg border p-3" data-putus-otomatis="">
      <h3 className="text-sm font-semibold">Putus otomatis gugur / tidak dapat diterima</h3>
      <p className="text-xs text-muted-foreground">
        {daftar ? `${daftar.kalimatSetelan} Jam pemicu ${daftar.jamPemicu.replace(":", ".")} WITA.` : "Memuat..."}
      </p>
      {s ? (
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Switch checked={s.nyala} disabled={kunci} onCheckedChange={(v) => void kirim({ aksi: "setelan", nyala: v })} />
            Putus otomatis {s.nyala ? "menyala" : "mati"}
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={s.kering} disabled={kunci} onCheckedChange={(v) => void kirim({ aksi: "setelan", kering: v })} />
            Mode kering
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={s.unggahEdoc} disabled={kunci} onCheckedChange={(v) => void kirim({ aksi: "setelan", unggahEdoc: v })} />
            Susun putusan dan unggah e-Doc
          </label>
          <label className="flex items-center gap-2">
            Hadir lalu 2x tidak hadir:
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={s.hasilAturan8}
              disabled={kunci}
              onChange={(e) => void kirim({ aksi: "setelan", hasilAturan8: e.target.value })}
            >
              <option value="tidak-dapat-diterima">Tidak dapat diterima</option>
              <option value="gugur">Gugur</option>
            </select>
          </label>
          {daftar?.bolehUbahSetelan && daftar.tahap === "pratinjau" && s.nyala ? (
            <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim({ aksi: "jalankan", tanggal })}>
              Jalankan sekarang
            </Button>
          ) : null}
        </div>
      ) : null}
      {pesan ? <p className="mt-2 text-sm">{pesan}</p> : null}
      <ul className="mt-2 space-y-1 text-xs">
        {(daftar?.butir ?? []).map((b) => {
          const k = b.keputusan;
          return (
            <li key={b.jadwalId} className="flex flex-wrap items-start gap-2 border-b pb-1" data-baris-putus-otomatis={b.jadwalId}>
              <span className="font-medium">{b.nomorPerkara}</span>
              <Badge variant={k.jenis === "putus" ? "warning" : "muted"}>{k.jenis === "putus" ? (k.status === "gugur" ? "Gugur" : "Tidak dapat diterima") : "Dilewati"}</Badge>
              <span className="min-w-0 flex-1 text-muted-foreground">
                {k.penjelasan} {b.tulis ? b.tulis.pesan : ""} {b.edoc ? b.edoc.pesan : ""}
              </span>
              {daftar?.tahap === "pratinjau" && daftar.bolehBatal !== false ? (
                k.jenis === "putus" ? (
                  <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim({ aksi: "batal", tanggal, jadwalId: b.jadwalId })}>
                    Jangan putus otomatis
                  </Button>
                ) : k.sebab === "dibatalkan-petugas" ? (
                  <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={() => void kirim({ aksi: "pulihkan", tanggal, jadwalId: b.jadwalId })}>
                    Ikutkan lagi
                  </Button>
                ) : null
              ) : null}
            </li>
          );
        })}
      </ul>
      {daftar && daftar.butir.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">Tidak ada calon putus gugur/tidak dapat diterima pada tanggal ini.</p> : null}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Tidak pernah untuk Penggugat/Pemohon yang tercatat hadir hari itu, ikrar talak, perlawanan, atau eksekusi. Keterangan putus ditulis atas nama panitera
        sidang perkara; putusan hanya diunggah bila blangkonya pas dan seluruh isiannya terisi.
      </p>
    </section>
  );
}
