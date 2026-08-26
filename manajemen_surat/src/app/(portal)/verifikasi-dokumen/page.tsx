"use client";

import { VerifikasiDokumen } from "@/components/portal/verifikasi-dokumen";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

export default function VerifikasiDokumenPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-bot");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  // Penyaringan sesungguhnya ada di bot: hanya hakim yang duduk pada majelis
  // perkara yang mendapat daftarnya. Izin portal di sini hanya membuka pintu;
  // halaman akan menolak sendiri bila penggunanya bukan hakim.
  return <VerifikasiDokumen />;
}
