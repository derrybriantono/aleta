"use client";

import { CerminPerkaraPanel } from "@/components/portal/cermin-perkara-panel";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Pemantau Cermin Perkara (C0, 25 Okt 2026): Super Admin dan Admin melihat;
 * mengubah saklar hanya Super Admin - ditegakkan juga di server.
 */
export default function AdminCerminPerkaraPage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);

  if (effectiveRoleId !== "super-admin" && effectiveRoleId !== "admin") {
    return <AccessDeniedCard />;
  }

  return <CerminPerkaraPanel />;
}
