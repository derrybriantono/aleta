"use client";

import { SinkronCadanganPanel } from "@/components/portal/sinkron-cadangan-panel";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/** Sinkron & cadangan (butir 29/30): Admin melihat, Super Admin mengubah - ditegakkan server. */
export default function AdminSinkronCadanganPage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);

  if (effectiveRoleId !== "super-admin" && effectiveRoleId !== "admin") {
    return <AccessDeniedCard />;
  }

  return <SinkronCadanganPanel />;
}
