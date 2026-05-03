"use client";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { RoleVisibilityPanel } from "@/components/portal/admin-panels";
import { usePortal } from "@/lib/app-state";

export default function VisibilityRolePage() {
  const { currentUser, moduleVisibility, toggleModuleVisibility } = usePortal();
  const isAllowed = currentUser?.roleId === "super-admin";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal Pengaturan Global"
        title="Akses Tampilan per Peran"
        description="Pengaturan ini hanya tersedia untuk Super Admin agar akses modul tetap jelas dan terpusat."
      />
      {isAllowed ? (
        <RoleVisibilityPanel visibility={moduleVisibility} onToggle={toggleModuleVisibility} />
      ) : (
        <AccessDeniedCard />
      )}
    </div>
  );
}
