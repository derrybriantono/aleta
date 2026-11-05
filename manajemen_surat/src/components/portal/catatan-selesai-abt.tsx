"use client";

import { useEffect, useState } from "react";

import { TandaAlur, panggilAlur, type StatusTanda } from "@/components/portal/aleta-abt-umum";
import { judulLangkah, type IdLangkah, type StatusLangkah } from "@/lib/aleta-abt-selesai";
import { getEffectiveRoleId } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";

/**
 * Catatan "Selesaikan berkas" ALETA ABT di layar Status Perkara (5 Nov 2026). HANYA Super Admin: akun lain tidak melihat apa pun dan tidak
 * memanggil rute. Tidak tampil bila perkara ini belum pernah diselesaikan lewat tombol itu. Hanya status langkah, tanpa isi naskah.
 */

type Catatan = { berkasNama: string; jenis: string; status: string; diubahAt: string; langkah: Array<{ id: IdLangkah; status: StatusLangkah; pesan: string }> };

const WARNA: Record<StatusLangkah, StatusTanda> = { menunggu: "abu", jalan: "kuning", selesai: "hijau", gagal: "merah", dimatikan: "kuning", "tidak-berlaku": "abu" };
const NAMA: Record<StatusLangkah, string> = { menunggu: "menunggu", jalan: "berjalan", selesai: "selesai", gagal: "gagal", dimatikan: "dimatikan", "tidak-berlaku": "tidak perlu" };

export function CatatanSelesaiAbt({ perkaraId, pengguna }: { perkaraId: string; pengguna: UserPersona | null | undefined }) {
  const superAdmin = String(getEffectiveRoleId(pengguna ?? undefined) ?? "") === "super-admin";
  const [daftar, setDaftar] = useState<Catatan[]>([]);

  useEffect(() => {
    if (!superAdmin || !/^\d{1,12}$/.test(String(perkaraId ?? ""))) return;
    let batal = false;
    const t = window.setTimeout(() => {
      panggilAlur<{ daftar: Catatan[] }>(`selesai?perkaraId=${encodeURIComponent(perkaraId)}&daftar=1`)
        .then((h) => {
          if (!batal) setDaftar(Array.isArray(h.daftar) ? h.daftar : []);
        })
        .catch(() => {
          if (!batal) setDaftar([]);
        });
    }, 0);
    return () => {
      batal = true;
      window.clearTimeout(t);
    };
  }, [superAdmin, perkaraId]);

  if (!superAdmin || !daftar.length) return null;
  return (
    <section aria-label="Catatan selesaikan berkas" className="mb-3 space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Selesaikan berkas (hanya Super Admin)</p>
      {daftar.map((c) => (
        <div key={`${c.berkasNama}|${c.jenis}`} className="space-y-1">
          <p className="break-words text-xs text-muted-foreground">
            {c.berkasNama} - {c.diubahAt.slice(0, 10).split("-").reverse().join("-")}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {c.langkah.map((l) => (
              <li key={l.id} title={l.pesan}>
                <TandaAlur status={WARNA[l.status]}>
                  {judulLangkah(l.id)}: {NAMA[l.status]}
                </TandaAlur>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
