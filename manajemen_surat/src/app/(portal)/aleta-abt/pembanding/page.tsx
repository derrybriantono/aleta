"use client";

import Link from "next/link";

import { LaporanPembanding } from "@/components/portal/laporan-pembanding-aleta-abt";
import { PageIntro } from "@/components/portal/shared";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Laporan pembanding ALETA ABT lawan ABT (5 Nov 2026, Tahap 5). Hanya Super Admin. Laporan dibaca di peramban dari berkas hasil
 * skrip pengukur; tidak ada yang dikirim atau disimpan di peladen.
 */
export default function HalamanLaporanPembanding() {
  const pengguna = usePenggunaAktifOpsional();
  const roleId = String(getEffectiveRoleId(pengguna ?? undefined) ?? "");
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro
        eyebrow="Blangko"
        title="Laporan pembanding"
        description="Hasil membandingkan naskah ALETA ABT dengan cetakan ABT, alinea demi alinea."
        actions={
          <Link href="/aleta-abt" className="text-sm text-muted-foreground underline">
            Kembali ke ALETA ABT
          </Link>
        }
      />
      {pengguna && roleId !== "super-admin" ? <p className="text-sm text-muted-foreground">Laporan pembanding hanya untuk Super Admin.</p> : <LaporanPembanding />}
    </div>
  );
}
