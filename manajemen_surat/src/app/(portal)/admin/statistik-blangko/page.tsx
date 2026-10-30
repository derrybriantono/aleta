"use client";

import { StatistikBlangkoPanel } from "@/components/portal/statistik-blangko-panel";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/** Statistik pemakaian blangko (30 Okt 2026): Super Admin dan Admin, baca saja - ditegakkan juga di server. */
export default function AdminStatistikBlangkoPage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);

  if (effectiveRoleId !== "super-admin" && effectiveRoleId !== "admin") {
    return <AccessDeniedCard />;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Statistik Pemakaian Blangko"
        description="Blangko yang paling sering dan yang tidak pernah dicetak per folder dan per jenis perkara, serta varian yang hampir sama. Hanya informasi - tidak ada blangko yang dipindah atau dihapus."
      />
      <StatistikBlangkoPanel />
    </div>
  );
}
