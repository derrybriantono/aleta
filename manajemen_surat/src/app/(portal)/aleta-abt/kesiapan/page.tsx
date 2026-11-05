"use client";

import Link from "next/link";

import { KesiapanAletaAbt } from "@/components/portal/kesiapan-aleta-abt";
import { PageIntro } from "@/components/portal/shared";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Kesiapan pindah ke ALETA ABT per jenis perkara (5 Nov 2026, Tahap 8). Hanya Super Admin; rute /api/aleta-abt/pindah menjaga ulang di server.
 * Layar ini hanya menunjukkan kesiapan dan menyediakan tombol per jenis; tombolnya menolak menyala bila syarat belum terpenuhi.
 */
export default function HalamanKesiapanAletaAbt() {
  const pengguna = usePenggunaAktifOpsional();
  const roleId = String(getEffectiveRoleId(pengguna ?? undefined) ?? "");
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro
        eyebrow="Blangko"
        title="Kesiapan pindah ke ALETA ABT"
        description="Jenis perkara mana yang sudah terbukti sama dengan ABT dan boleh dicetak tanpa ABT."
        actions={
          <Link href="/aleta-abt" className="text-sm text-muted-foreground underline">
            Kembali ke ALETA ABT
          </Link>
        }
      />
      {pengguna && roleId !== "super-admin" ? <p className="text-sm text-muted-foreground">Kesiapan pindah hanya untuk Super Admin.</p> : <KesiapanAletaAbt />}
    </div>
  );
}
