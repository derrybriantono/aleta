"use client";

import { AletaAiSaldo } from "@/components/portal/aleta-ai/aleta-ai-saldo";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/** Dompet ALETA Ai milik pengguna yang sedang masuk: saldo, rincian biaya per giliran, struk, mutasi. */
export default function HalamanSaldoAletaAi() {
  const { accessiblePortalApps } = usePortal();
  if (!accessiblePortalApps.some((app) => app.id === "aleta-ai")) return <AccessDeniedCard />;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro eyebrow="ALETA Ai" title="Dompet ALETA Ai" description="Saldo, rincian biaya tiap jawaban beserta struknya, dan riwayat pengisian Anda." />
      <AletaAiSaldo />
    </div>
  );
}
