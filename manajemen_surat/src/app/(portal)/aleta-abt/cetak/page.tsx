"use client";

import Link from "next/link";

import { CetakAletaAbt } from "@/components/portal/cetak-aleta-abt";
import { PageIntro } from "@/components/portal/shared";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Layar cetak ALETA ABT (5 Nov 2026, Tahap 5). Hanya Super Admin; rute /api/aleta-abt/cetak menjaga ulang di server
 * (layar ini hanya merapikan tampilan).
 */
export default function HalamanCetakAletaAbt() {
  const pengguna = usePenggunaAktifOpsional();
  const roleId = String(getEffectiveRoleId(pengguna ?? undefined) ?? "");
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro
        eyebrow="Blangko"
        title="Cetak ALETA ABT"
        description="Pilih perkara dan blangko, lihat naskahnya, lalu unduh RTF, PDF, atau PDF SALINAN."
        actions={
          <Link href="/aleta-abt" className="text-sm text-muted-foreground underline">
            Kembali ke ALETA ABT
          </Link>
        }
      />
      {pengguna && roleId !== "super-admin" ? <p className="text-sm text-muted-foreground">Cetak ALETA ABT hanya untuk Super Admin.</p> : <CetakAletaAbt />}
    </div>
  );
}
