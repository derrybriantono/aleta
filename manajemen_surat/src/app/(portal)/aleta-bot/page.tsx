"use client";

import { AletaBotDashboard } from "@/components/portal/aleta-bot-dashboard";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

export default function AletaBotPage() {
  const { accessiblePortalApps } = usePortal();
  const canOpenAletaBot = accessiblePortalApps.some((app) => app.id === "aleta-bot");

  if (!canOpenAletaBot) {
    return <AccessDeniedCard />;
  }

  return <AletaBotDashboard />;
}
