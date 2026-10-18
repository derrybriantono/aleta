"use client";

import { HakAksesPeran } from "@/components/portal/hak-akses-peran";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Pengaturan > Hak akses per peran (18 Okt 2026). Admin membaca; Super Admin lengkap.
 * Rute /api/hak-akses/peta memeriksa ulang dari akun yang masuk.
 */
export default function HakAksesPage() {
  const { currentUser, users } = usePortal();
  const roleId = String(getEffectiveRoleId(currentUser) ?? "");
  const boleh = roleId === "super-admin" || roleId === "admin";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pengaturan"
        title="Hak akses per peran"
        description="Fitur, blangko, dan kewenangan yang dapat dibuka tiap peran. Super Admin dapat membuka semuanya."
      />
      {boleh ? <HakAksesPeran pengguna={users} /> : <AccessDeniedCard />}
    </div>
  );
}
