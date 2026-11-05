"use client";

import Link from "next/link";

import { SiapDiperiksaAbt } from "@/components/portal/siap-diperiksa-abt";
import { PageIntro } from "@/components/portal/shared";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Siap diperiksa (5 Nov 2026, Tahap 6). Hanya Super Admin; rute /api/aleta-abt/siap menjaga ulang di server
 * (layar ini hanya merapikan tampilan).
 */
export default function HalamanSiapDiperiksaAbt() {
  const pengguna = usePenggunaAktifOpsional();
  const roleId = String(getEffectiveRoleId(pengguna ?? undefined) ?? "");
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro
        eyebrow="Blangko"
        title="Siap diperiksa"
        description="Pekerjaan tiap peran dari jadwal sidang, dengan blangko yang disarankan. Pilih peran yang ingin diperiksa."
        actions={
          <Link href="/aleta-abt" className="text-sm text-muted-foreground underline">
            Kembali ke ALETA ABT
          </Link>
        }
      />
      {pengguna && roleId !== "super-admin" ? <p className="text-sm text-muted-foreground">Siap diperiksa hanya untuk Super Admin.</p> : <SiapDiperiksaAbt />}
    </div>
  );
}
