"use client";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { AIControlPanel } from "@/components/portal/ai-control-panel";
import { usePortal } from "@/lib/app-state";

export default function PengaturanAIPage() {
  const { currentUser } = usePortal();
  const isAllowed = currentUser?.roleId === "super-admin";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal Pengaturan Global"
        title="Pengaturan AI"
        description="Konfigurasi parameter kecerdasan buatan, pemilihan model, serta pengelolaan API Key secara terpusat untuk seluruh ekosistem ALETA."
      />
      {isAllowed ? (
        <AIControlPanel />
      ) : (
        <AccessDeniedCard />
      )}
    </div>
  );
}
