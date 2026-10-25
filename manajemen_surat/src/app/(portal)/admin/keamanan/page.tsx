"use client";

import { PengaturanKeamananBoard } from "@/components/portal/pengaturan-keamanan-board";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehAksi } from "@/lib/matriks-peran";

export default function PengaturanKeamananPage() {
  const { currentUser } = usePortal();
  const boleh = bolehAksi(currentUser, "keamanan.lihat");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Pengaturan Keamanan"
        description="Kebijakan sandi, batas jaringan per peran, pengaman aksi berdampak besar, dan uji pulih cadangan. Semua saklar mati sampai Super Admin menyalakannya."
      />
      {boleh ? <PengaturanKeamananBoard /> : <AccessDeniedCard />}
    </div>
  );
}
