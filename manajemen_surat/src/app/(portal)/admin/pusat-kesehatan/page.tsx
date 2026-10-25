"use client";

import { PusatKesehatanPanel } from "@/components/portal/pusat-kesehatan-panel";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehAksi } from "@/lib/matriks-peran";

/** Pusat kesehatan sistem (E2, 25 Okt 2026): Admin dan Super Admin - ditegakkan juga di server. */
export default function PusatKesehatanPage() {
  const { currentUser } = usePortal();
  const boleh = bolehAksi(currentUser, "kesehatan.lihat");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Pusat Kesehatan Sistem"
        description="Keadaan portal, bot, WhatsApp, SIPP, ABT, e-Court, cadangan, server, dan ekstensi di tiap PC; catatan galat; serta hasil uji beban terakhir."
      />
      {boleh ? <PusatKesehatanPanel /> : <AccessDeniedCard />}
    </div>
  );
}
