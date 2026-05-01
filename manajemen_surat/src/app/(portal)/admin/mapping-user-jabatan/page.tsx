"use client";

import { useSearchParams } from "next/navigation";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { MappingBoard } from "@/components/portal/admin-panels";
import { usePortal } from "@/lib/app-state";

export default function MappingUserJabatanPage() {
  const searchParams = useSearchParams();
  const { currentUser } = usePortal();
  const isAllowed = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";
  const missingWhatsappOnly = searchParams.get("missingWhatsapp") === "true";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal Pengaturan Global"
        title="Edit Akun"
        description="Area admin untuk memperbarui akun yang ada sekaligus membuat akun baru dengan data identitas, jabatan, email, WA, dan foto profil secara terpusat."
      />
      {isAllowed ? <MappingBoard missingWhatsappOnly={missingWhatsappOnly} /> : <AccessDeniedCard />}
    </div>
  );
}
