"use client";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { WhatsAppStatusPanel } from "@/components/portal/institution-settings-panel";
import { usePortal } from "@/lib/app-state";

export default function StatusWhatsAppPage() {
  const { currentUser } = usePortal();
  const isAllowed = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal Pengaturan Global"
        title="Status WhatsApp Gateway"
        description="Pusat koneksi WhatsApp ALETA. QR, status layanan, nomor resmi, dan kontrol sesi dikelola di halaman ini agar tidak ada alur ganda."
      />
      {isAllowed ? (
        <div className="max-w-5xl">
          <WhatsAppStatusPanel showFooterPreview={false} />
        </div>
      ) : (
        <AccessDeniedCard />
      )}
    </div>
  );
}
