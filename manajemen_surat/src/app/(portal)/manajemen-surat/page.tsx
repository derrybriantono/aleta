"use client";

import { MailDashboardPage } from "@/components/portal/mail-dashboard-page";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

export default function ManajemenSuratDashboardPage() {
  const { accessiblePortalApps } = usePortal();
  const canOpenManajemenSurat = accessiblePortalApps.some((app) => app.id === "manajemen-surat");

  if (!canOpenManajemenSurat) {
    return <AccessDeniedCard />;
  }

  return <MailDashboardPage />;
}
