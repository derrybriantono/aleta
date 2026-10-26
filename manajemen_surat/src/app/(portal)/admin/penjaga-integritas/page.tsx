"use client";

import { IntegritasPanel } from "@/components/portal/integritas-panel";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehAksi } from "@/lib/matriks-peran";

/** Penjaga integritas berkas (E6, 25 Okt 2026): Admin melihat temuan, Super Admin mengatur - ditegakkan juga di server. */
export default function PenjagaIntegritasPage() {
  const { currentUser } = usePortal();
  const boleh = bolehAksi(currentUser, "integritas.lihat");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Penjaga Integritas Berkas"
        description="Pantau folder website satker, SIPP, dan ABT (baca-saja): PHP baru atau berubah, webshell, dan kata judi online. Mati sampai Super Admin menyalakannya."
      />
      {boleh ? <IntegritasPanel /> : <AccessDeniedCard />}
    </div>
  );
}
