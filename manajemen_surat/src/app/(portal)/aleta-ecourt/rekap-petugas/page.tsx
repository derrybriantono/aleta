"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { RekapPetugas } from "@/components/portal/rekap-petugas";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * Rekap satu petugas - hakim, panitera pengganti, juru sita, atau mediator.
 *
 * Dibuka di tab baru dari nama pada layar Status Perkara:
 * /aleta-ecourt/rekap-petugas?peran=hakim&id=26. Berada di bawah
 * /aleta-ecourt supaya menu samping portal tetap menyorot ALETA e-Court, dan
 * dijaga dengan pintu yang sama dengan halaman itu - rutenya sendiri memeriksa
 * kemampuan panel, persis seperti Status Perkara.
 */
function IsiHalaman() {
  const { accessiblePortalApps } = usePortal();
  const cari = useSearchParams();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="p-4 pt-1 sm:p-5 sm:pt-1">
      <RekapPetugas peran={String(cari.get("peran") ?? "")} id={String(cari.get("id") ?? "")} />
    </div>
  );
}

export default function HalamanRekapPetugas() {
  // useSearchParams menuntut batas Suspense pada halaman klien.
  return (
    <Suspense fallback={<div className="min-h-[20rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" />}>
      <IsiHalaman />
    </Suspense>
  );
}
