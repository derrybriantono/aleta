"use client";

import { AdminHub } from "@/components/portal/admin-hub";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

export default function AdminPage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const isAdmin = effectiveRoleId === "super-admin" || effectiveRoleId === "admin";

  if (!isAdmin) {
    return <AccessDeniedCard />;
  }

  return <AdminHub />;
}
