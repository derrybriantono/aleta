"use client";

import { PencocokLayar } from "@/components/portal/pencocok-layar";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * Pencocok data (N3, 1 Nov 2026) - perkara yang datanya berbeda antara SIPP, ABT, dan e-Court. Berada di bawah
 * /aleta-ecourt (seperti Tenggat perkara) supaya menu samping tetap menyorot ALETA e-Court, dan dijaga pintu yang sama;
 * rutenya sendiri memeriksa kemampuan panel dan menyaring perkara per orang.
 */
export default function HalamanPencocok() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt");
  if (!boleh) return <AccessDeniedCard />;
  return (
    <div className="flex flex-col gap-4 p-4 pt-1 sm:p-5 sm:pt-1">
      <PageIntro
        eyebrow="ALETA e-Court"
        title="Pencocok data"
        description="Perkara yang datanya berbeda antara SIPP, ABT, dan e-Court - tanggal putus, kehadiran, pihak, majelis, jadwal, dokumen, biaya, dan tahapan."
      />
      <PencocokLayar />
    </div>
  );
}
