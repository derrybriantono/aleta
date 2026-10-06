"use client";

import { SumberDayaPanel } from "@/components/portal/sumber-daya-panel";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/** Sumber daya server (butir 3, 6 Okt 2026): Super Admin dan Admin - ditegakkan juga di server. */
export default function AdminSumberDayaPage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);

  if (effectiveRoleId !== "super-admin" && effectiveRoleId !== "admin") {
    return <AccessDeniedCard />;
  }

  return <SumberDayaPanel />;
}
