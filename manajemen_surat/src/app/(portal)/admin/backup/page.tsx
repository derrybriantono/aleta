"use client";

import { BackupAdminPanel } from "@/components/portal/backup-admin-panel";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

export default function AdminBackupPage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);

  if (effectiveRoleId !== "super-admin" && effectiveRoleId !== "admin") {
    return <AccessDeniedCard />;
  }

  return <BackupAdminPanel />;
}
