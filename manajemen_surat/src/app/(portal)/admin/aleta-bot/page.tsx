"use client";

import { AletaBotAdminPanel } from "@/components/portal/aleta-bot-admin";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

export default function AletaBotPage() {
  const { currentUser } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);
  // Admin mendapat akses operasional; fitur kebijakan tetap disembunyikan di panel
  // dan ditolak backend (guard per-role Tahap 1).
  const canOpenPanel = roleId === "super-admin" || roleId === "admin";

  if (!canOpenPanel) {
    return <AccessDeniedCard />;
  }

  return <AletaBotAdminPanel />;
}
