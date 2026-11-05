"use client";

import Link from "next/link";

import { HakFolderAbt } from "@/components/portal/hak-folder-abt";
import { PageIntro } from "@/components/portal/shared";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Hak folder blangko (5 Nov 2026, Tahap 6). Hanya Super Admin; rute /api/aleta-abt/hak-folder menjaga ulang di server
 * (layar ini hanya merapikan tampilan).
 */
export default function HalamanHakFolderAbt() {
  const pengguna = usePenggunaAktifOpsional();
  const roleId = String(getEffectiveRoleId(pengguna ?? undefined) ?? "");
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro
        eyebrow="Blangko"
        title="Hak folder blangko"
        description="Siapa yang membuka folder blangko, menurut tahapan, jenis perkara, dan penunjukan seperti di ABT. Untuk disetujui pemilik."
        actions={
          <Link href="/aleta-abt" className="text-sm text-muted-foreground underline">
            Kembali ke ALETA ABT
          </Link>
        }
      />
      {pengguna && roleId !== "super-admin" ? <p className="text-sm text-muted-foreground">Hak folder blangko hanya untuk Super Admin.</p> : <HakFolderAbt />}
    </div>
  );
}
