"use client";

import { AuditTrailBoard } from "@/components/portal/audit-trail-board";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

export default function AuditTrailPage() {
  const { currentUser } = usePortal();
  const isAllowed = currentUser?.roleId === "super-admin";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal Pengaturan Global"
        title="Audit Trail"
        description="Jejak audit terpusat untuk perubahan konfigurasi, manajemen akun, AI, WhatsApp, surat, dan aktivitas administratif penting."
      />
      {isAllowed ? <AuditTrailBoard /> : <AccessDeniedCard />}
    </div>
  );
}
