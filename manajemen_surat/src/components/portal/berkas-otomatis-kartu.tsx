"use client";

import { useCallback, useEffect, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Saklar isi otomatis dari berkas e-Court (G2, 25 Okt 2026) - hanya tampil bagi Super Admin; semuanya MATI bawaan.
 * Berada di layar Tenggat sementara (satu tempat pengaturan penjaga berkas e-Court); dapat dipindah ke Integrasi e-Court.
 */
type Setelan = { bukti: boolean; kesimpulan: boolean; buktiSaksi: boolean; diubahOleh: string };

const BARIS: Array<{ kunci: "bukti" | "kesimpulan" | "buktiSaksi"; judul: string; uraian: string }> = [
  {
    kunci: "bukti",
    judul: "Daftar alat bukti dari e-Court ditulis otomatis",
    uraian: "Daftar bukti P.x / T.x yang rapi ditulis ke isian bukti ABT yang masih kosong. Yang tidak rapi tetap usulan dengan tombol Salin.",
  },
  {
    kunci: "kesimpulan",
    judul: "Kesimpulan para pihak ditulis otomatis ke tanya-jawab",
    uraian: "Kesimpulan yang rapi ditulis ke tanya-jawab sidang beragenda kesimpulan bila barisnya kosong, seperti jawaban, replik, dan duplik.",
  },
  {
    kunci: "buktiSaksi",
    judul: "Usulan pemetaan bukti dan keterangan saksi",
    uraian: "Menautkan tiap bukti dengan saksi yang menerangkan hal yang sama, sebagai usulan untuk susun saksi dan pertimbangan. Tidak menulis apa pun.",
  },
];

export function BerkasOtomatisKartu() {
  const [data, setData] = useState<{ setelan: Setelan; bolehUbah: boolean } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/berkas-otomatis"), { cache: "no-store" });
      const mentah: unknown = await r.json().catch(() => null);
      if (r.ok) setData(((mentah as { data?: unknown } | null)?.data ?? null) as typeof data);
    } catch {
      /* tanpa kartu */
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const ubah = async (kunci: string, nilai: boolean) => {
    setSibuk(true);
    setPesan("");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/berkas-otomatis"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [kunci]: nilai }),
      });
      const mentah: unknown = await r.json().catch(() => null);
      setPesan(r.ok ? "Tersimpan." : pesanGalatPortal(mentah, "Gagal disimpan."));
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  if (!data || !data.bolehUbah) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-sm" aria-label="Isi otomatis dari berkas e-Court" data-berkas-otomatis="">
      <p className="font-medium">Isi otomatis dari berkas e-Court (Super Admin)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Semua mati bawaan. Hanya isian yang masih kosong yang pernah ditulis, hanya bila berkasnya rapi, dan hanya pada blangko Derry. Surat gugatan tidak dibaca ulang.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {BARIS.map((b) => (
          <label key={b.kunci} className="flex items-start gap-3">
            <Switch checked={data.setelan[b.kunci]} disabled={sibuk} onCheckedChange={(v) => void ubah(b.kunci, v)} aria-label={b.judul} />
            <span>
              <span className="block font-medium">
                {b.judul} {data.setelan[b.kunci] ? "(menyala)" : "(mati)"}
              </span>
              <span className="block text-xs text-muted-foreground">{b.uraian}</span>
            </span>
          </label>
        ))}
      </div>
      {data.setelan.diubahOleh ? <p className="mt-2 text-xs text-muted-foreground">Terakhir diubah {data.setelan.diubahOleh}.</p> : null}
      {pesan ? <p className="mt-2 text-xs">{pesan}</p> : null}
    </section>
  );
}
