"use client";

import { AletaAiTugas } from "@/components/portal/aleta-ai/aleta-ai-tugas";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/** ALETA Ai tahap 3: tugas bertahap (draf putusan, panduan sidang, komparasi) dengan berkas hasil. */
export default function HalamanTugasAletaAi() {
  const { accessiblePortalApps } = usePortal();
  if (!accessiblePortalApps.some((app) => app.id === "aleta-ai")) return <AccessDeniedCard />;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro eyebrow="ALETA Ai" title="Tugas ALETA Ai" description="Pekerjaan panjang yang berjalan bertahap dan menghasilkan berkas. Halaman boleh ditutup; tugas tetap berjalan." />
      <AletaAiTugas />
    </div>
  );
}
