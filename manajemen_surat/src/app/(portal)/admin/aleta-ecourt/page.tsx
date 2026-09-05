"use client";

import { AletaEcourtAdmin } from "@/components/portal/aleta-ecourt-admin";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

export default function AletaEcourtAdminPage() {
  const { currentUser } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);
  // Dijaga berdasarkan peran, seperti halaman admin ALETA Bot. Sebelumnya
  // halaman ini memeriksa id "aleta-ecourt-admin" di accessiblePortalApps -
  // padahal id itu hanya ada di larik modules, tidak pernah di portalApps,
  // sehingga halamannya selalu menolak siapa pun termasuk super-admin.
  const bolehBuka = roleId === "super-admin" || roleId === "admin";

  if (!bolehBuka) {
    return <AccessDeniedCard />;
  }

  return <AletaEcourtAdmin />;
}
