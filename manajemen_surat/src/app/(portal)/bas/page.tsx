"use client";

import { BasPanitera } from "@/components/portal/bas-panitera";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

export default function BasPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <BasPanitera />;
}
