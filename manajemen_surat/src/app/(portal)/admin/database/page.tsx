"use client";

import { DatabaseAdminPanel } from "@/components/portal/database-admin-panel";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

export default function AdminDatabasePage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);

  if (effectiveRoleId !== "super-admin") {
    return <AccessDeniedCard />;
  }

  return <DatabaseAdminPanel />;
}
