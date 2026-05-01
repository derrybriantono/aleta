"use client";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { MappingBoard } from "@/components/portal/admin-panels";
import { usePortal } from "@/lib/app-state";

export default function MappingUserJabatanPage() {
  const { currentUser } = usePortal();
  const isAllowed = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal Pengaturan Global"
        title="Edit Akun"
        description="Area admin untuk memperbarui akun yang ada sekaligus membuat akun baru dengan data identitas, jabatan, email, WA, dan foto profil secara terpusat."
      />
      {isAllowed ? <MappingBoard /> : <AccessDeniedCard />}
    </div>
  );
}
