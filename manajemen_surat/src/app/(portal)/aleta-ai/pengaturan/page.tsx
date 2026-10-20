"use client";

import { useMemo } from "react";

import { AletaAiPengaturan } from "@/components/portal/aleta-ai/aleta-ai-pengaturan";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/** Pengaturan ALETA Ai - Super Admin saja (server juga menolak peran lain). */
export default function HalamanPengaturanAletaAi() {
  const { currentUser, activeUsers, positions } = usePortal();
  const boleh = currentUser?.roleId === "super-admin";
  const pengguna = useMemo(
    () =>
      (activeUsers ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        jabatan: (positions ?? []).find((p) => p.id === u.positionId)?.name,
      })),
    [activeUsers, positions]
  );

  if (!boleh) return <AccessDeniedCard />;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="ALETA Ai"
        title="Pengaturan ALETA Ai"
        description="Atur harga, kurs, rute model, proyek pengetahuan, saldo pengguna, dan lihat laporan laba. Hanya Super Admin yang melihat halaman ini."
      />
      <AletaAiPengaturan pengguna={pengguna} />
    </div>
  );
}
