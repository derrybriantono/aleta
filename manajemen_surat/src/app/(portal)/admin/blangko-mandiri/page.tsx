"use client";

import { BlangkoMandiri } from "@/components/portal/blangko-mandiri";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * Layar kemandirian blangko.
 *
 * Memakai kewenangan "aleta-ecourt-admin" yang sudah ada, bukan mendaftarkan
 * aplikasi baru: menyalin kamus, mempelajari korpus, dan menggeser saklar
 * periksa mengenai SELURUH pengadilan - persis lingkup kewenangan itu.
 */
export default function BlangkoMandiriPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt-admin");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <BlangkoMandiri />;
}
