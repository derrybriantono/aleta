"use client";

import { FiturSatkerAdmin } from "@/components/portal/fitur-satker-admin";
import { PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Fitur Satker (banyak satker, Tahap 0). Hanya Super Admin; rute
 * /api/satker/fitur memeriksa ulang dari akun yang masuk.
 */
export default function FiturSatkerPage() {
  const { currentUser } = usePortal();
  const roleId = String(getEffectiveRoleId(currentUser) ?? "");
  if (roleId !== "super-admin") {
    return (
      <div className="space-y-4 p-6">
        <PageIntro eyebrow="Sistem" title="Fitur Satker" description="Halaman ini hanya untuk Super Admin." />
      </div>
    );
  }
  return <FiturSatkerAdmin />;
}
