"use client";

import { EKepegawaianPanel } from "@/components/portal/e-kepegawaian-panel";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

export default function AdminEKepegawaianPage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);

  if (effectiveRoleId !== "super-admin" && effectiveRoleId !== "admin") {
    return <AccessDeniedCard />;
  }

  return <EKepegawaianPanel initialSection="settings" settingsOnly />;
}
