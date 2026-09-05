"use client";

import { AletaEcourtPengguna } from "@/components/portal/aleta-ecourt-pengguna";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

export default function AletaEcourtPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <AletaEcourtPengguna />;
}
