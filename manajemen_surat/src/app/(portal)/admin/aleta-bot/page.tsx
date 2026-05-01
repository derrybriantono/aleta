"use client";

import { AletaBotAdminPanel } from "@/components/portal/aleta-bot-admin";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

export default function AletaBotPage() {
  const { currentUser } = usePortal();
  const isSuperAdmin = getEffectiveRoleId(currentUser) === "super-admin";

  if (!isSuperAdmin) {
    return <AccessDeniedCard />;
  }

  return <AletaBotAdminPanel />;
}
