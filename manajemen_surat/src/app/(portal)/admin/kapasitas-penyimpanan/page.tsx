"use client";

import { KapasitasPanel } from "@/components/portal/kapasitas-panel";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/** Kapasitas penyimpanan (30 Okt 2026): Super Admin mengatur, Admin membaca - ditegakkan juga di server. */
export default function AdminKapasitasPenyimpananPage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);

  if (effectiveRoleId !== "super-admin" && effectiveRoleId !== "admin") {
    return <AccessDeniedCard />;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Kapasitas Penyimpanan"
        description="Seberapa penuh ruang server, kapan perlu diperingatkan, dan cara menambah ruang. Peringatan juga muncul di Pusat Kesehatan Sistem."
      />
      <KapasitasPanel />
    </div>
  );
}
