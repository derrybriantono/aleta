"use client";

import { PemeliharaanPanel } from "@/components/portal/pemeliharaan-panel";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehAksi } from "@/lib/matriks-peran";

/** Mode pemeliharaan (E3, 25 Okt 2026): hanya Super Admin - ditegakkan juga di server. */
export default function PemeliharaanPage() {
  const { currentUser } = usePortal();
  const boleh = bolehAksi(currentUser, "pemeliharaan.atur");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Mode Pemeliharaan"
        description="Beri tahu pengguna sebelum pemasangan, hentikan perubahan data selama pemasangan, lalu buka kembali sendiri. Mati sampai Anda menyalakannya."
      />
      {boleh ? <PemeliharaanPanel /> : <AccessDeniedCard />}
    </div>
  );
}
