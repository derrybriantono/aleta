"use client";

import { RuangPerkara } from "@/components/portal/ruang-perkara";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

export default function PerkaraPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "perkara");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <RuangPerkara />;
}
