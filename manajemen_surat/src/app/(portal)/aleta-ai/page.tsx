"use client";

import { AletaAiChat } from "@/components/portal/aleta-ai/aleta-ai-chat";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * ALETA Ai: layar percakapan gaya chatbot. Penjaga sesungguhnya (hak peran,
 * saldo, batas pemakaian) ada di server /api/aleta-ai/*; pemeriksaan di sini
 * hanya merapikan tampilan.
 */
export default function HalamanAletaAi() {
  const { accessiblePortalApps } = usePortal();
  if (!accessiblePortalApps.some((app) => app.id === "aleta-ai")) return <AccessDeniedCard />;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">ALETA Ai</h1>
      <AletaAiChat />
    </div>
  );
}
