"use client";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { WhatsAppStatusPanel } from "@/components/portal/institution-settings-panel";
import { WhatsAppControl } from "@/components/portal/whatsapp-control";
import { usePortal } from "@/lib/app-state";

export default function StatusWhatsAppPage() {
  const { currentUser } = usePortal();
  const isAllowed = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal Pengaturan Global"
        title="Status WhatsApp Gateway"
        description="Pantau konektivitas sesi WhatsApp Web, lakukan pemindaian ulang QR Code, dan pastikan gateway notifikasi berjalan optimal."
      />
      {isAllowed ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
          <WhatsAppControl />
          <WhatsAppStatusPanel />
        </div>
      ) : (
        <AccessDeniedCard />
      )}
    </div>
  );
}
