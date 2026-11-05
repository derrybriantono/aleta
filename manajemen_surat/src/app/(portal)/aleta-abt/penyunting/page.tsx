"use client";

import Link from "next/link";

import { PenyuntingBlangko } from "@/components/portal/penyunting-blangko";
import { PageIntro } from "@/components/portal/shared";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Penyunting blangko ALETA ABT (5 Nov 2026, Tahap 3). Hanya Super Admin; rute /api/aleta-abt/penyunting menjaga ulang di server
 * (layar ini hanya merapikan tampilan).
 */
export default function HalamanPenyuntingBlangko() {
  const pengguna = usePenggunaAktifOpsional();
  const roleId = String(getEffectiveRoleId(pengguna ?? undefined) ?? "");
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro
        eyebrow="Blangko"
        title="Penyunting blangko"
        description="Ubah teks blangko langsung di layar. Tiap simpan menjadi versi baru dan baru dipakai setelah diterbitkan."
        actions={
          <Link href="/aleta-abt" className="text-sm text-muted-foreground underline">
            Kembali ke ALETA ABT
          </Link>
        }
      />
      {pengguna && roleId !== "super-admin" ? (
        <p className="text-sm text-muted-foreground">Penyunting blangko hanya untuk Super Admin.</p>
      ) : (
        <PenyuntingBlangko />
      )}
    </div>
  );
}
