"use client";

import { AletaAiSaldo } from "@/components/portal/aleta-ai/aleta-ai-saldo";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/** Saldo dan mutasi ALETA Ai milik pengguna yang sedang masuk. */
export default function HalamanSaldoAletaAi() {
  const { accessiblePortalApps } = usePortal();
  if (!accessiblePortalApps.some((app) => app.id === "aleta-ai")) return <AccessDeniedCard />;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro eyebrow="ALETA Ai" title="Saldo ALETA Ai" description="Sisa saldo dan riwayat pemakaian atau pengisian Anda." />
      <AletaAiSaldo />
    </div>
  );
}
