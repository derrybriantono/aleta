"use client";

import { SinkronKembaranPanel } from "@/components/portal/sinkron-kembaran-panel";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/** Sinkron kembaran (laptop): hanya Super Admin - melihat maupun memutuskan. Ditegakkan server. */
export default function AdminSinkronKembaranPage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);

  if (effectiveRoleId !== "super-admin") {
    return <AccessDeniedCard />;
  }

  return <SinkronKembaranPanel />;
}
