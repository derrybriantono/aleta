"use client";

import { PageIntro } from "@/components/portal/shared";
import { PengaturanSippAbt } from "@/components/portal/pengaturan-sipp-abt";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Pengaturan SIPP & ABT (16 Okt 2026, Tahap H). Dijaga berdasarkan peran,
 * seperti halaman admin Integrasi e-Court; rute /api/pengaturan-sipp-abt
 * memeriksa ulang dari akun yang masuk.
 */
export default function PengaturanSippAbtPage() {
  const { currentUser } = usePortal();
  const roleId = String(getEffectiveRoleId(currentUser) ?? "");
  if (roleId !== "super-admin" && roleId !== "admin") {
    return (
      <div className="space-y-4 p-6">
        <PageIntro eyebrow="Pengaturan" title="Pengaturan SIPP & ABT" description="Halaman ini hanya untuk Super Admin dan Admin." />
      </div>
    );
  }
  return <PengaturanSippAbt roleId={roleId} />;
}
