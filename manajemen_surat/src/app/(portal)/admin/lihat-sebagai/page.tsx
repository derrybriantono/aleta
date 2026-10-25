"use client";

import { LihatSebagaiPanel } from "@/components/portal/lihat-sebagai-panel";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehAksi } from "@/lib/matriks-peran";

/** Lihat sebagai (E4, 25 Okt 2026): hanya Super Admin - ditegakkan juga di server. */
export default function LihatSebagaiPage() {
  const { currentUser } = usePortal();
  const boleh = bolehAksi(currentUser, "lihat-sebagai.pakai");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Lihat Sebagai"
        description="Periksa menu apa yang tampil bagi sebuah akun atau peran dan kenapa menu lain tersembunyi. Pratinjau baca-saja, tercatat."
      />
      {boleh ? <LihatSebagaiPanel /> : <AccessDeniedCard />}
    </div>
  );
}
