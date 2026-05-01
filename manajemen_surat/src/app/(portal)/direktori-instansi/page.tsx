"use client";

import { OrganizationDirectory } from "@/components/portal/organization-directory";
import { PageIntro } from "@/components/portal/shared";

export default function DirektoriInstansiPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Direktori"
        title="Direktori Atasan Instansi"
        description="Visualisasi tree chart organisasi ALETA untuk melihat struktur atasan langsung, posisi jabatan, serta status PLH/PLT yang sedang aktif."
      />
      <OrganizationDirectory />
    </div>
  );
}
