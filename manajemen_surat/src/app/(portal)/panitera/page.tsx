"use client";

import { PaniteraDashboard } from "@/components/portal/panitera-dashboard";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

export default function PaniteraPage() {
  const { accessiblePortalApps } = usePortal();
  // Menumpang izin ALETA Bot: isinya berasal dari bot yang sama, dan petugas
  // yang boleh membuka pemantauan bot adalah petugas yang sama.
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-bot");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <PaniteraDashboard />;
}
