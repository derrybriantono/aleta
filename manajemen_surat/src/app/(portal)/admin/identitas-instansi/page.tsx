"use client";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { IdentitySettingsForm } from "@/components/portal/institution-settings-panel";
import { usePortal } from "@/lib/app-state";

export default function IdentitasInstansiPage() {
  const { currentUser } = usePortal();
  const isAllowed = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal Pengaturan Global"
        title="Identitas Instansi"
        description="Kelola identitas pengadilan, footer aplikasi, dan kanal resmi ALETA secara terpusat."
      />
      {isAllowed ? <IdentitySettingsForm /> : <AccessDeniedCard />}
    </div>
  );
}
