"use client";

import Link from "next/link";

import { BedaDenganAbt } from "@/components/portal/beda-dengan-abt";
import { PageIntro } from "@/components/portal/shared";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Beda dengan ABT (5 Nov 2026, Tahap 9). Hanya Super Admin; rute /api/aleta-abt/sinkron menjaga ulang di server
 * (layar ini hanya merapikan tampilan).
 */
export default function HalamanBedaDenganAbt() {
  const pengguna = usePenggunaAktifOpsional();
  const roleId = String(getEffectiveRoleId(pengguna ?? undefined) ?? "");
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro
        eyebrow="Blangko"
        title="Beda dengan ABT"
        description="Tinjau blangko yang berubah di ABT sedangkan ALETA ABT sudah mengubahnya, lalu pilih isi yang dipakai."
        actions={
          <Link href="/aleta-abt" className="text-sm text-muted-foreground underline">
            Kembali ke ALETA ABT
          </Link>
        }
      />
      {pengguna && roleId !== "super-admin" ? <p className="text-sm text-muted-foreground">Beda dengan ABT hanya untuk Super Admin.</p> : <BedaDenganAbt />}
    </div>
  );
}
