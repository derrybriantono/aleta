"use client";

import { TenggatLayar } from "@/components/portal/tenggat-layar";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * Tenggat perkara (G1, 25 Okt 2026) - akta cerai, ikrar, relaas, mediasi, masa banding dan kasasi, dengan hitung
 * mundur. Berada di bawah /aleta-ecourt (seperti Rekap Petugas) supaya menu samping tetap menyorot ALETA e-Court,
 * dan dijaga pintu yang sama; rutenya sendiri memeriksa kemampuan panel dan menyaring perkara per orang.
 */
export default function HalamanTenggat() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt");
  if (!boleh) return <AccessDeniedCard />;
  return (
    <div className="flex flex-col gap-4 p-4 pt-1 sm:p-5 sm:pt-1">
      <PageIntro
        eyebrow="ALETA e-Court"
        title="Tenggat perkara"
        description="Tenggat yang sudah lewat, menjelang, dan masih berjalan - lengkap dengan sisa hari dan petugas perkaranya."
      />
      <TenggatLayar />
    </div>
  );
}
