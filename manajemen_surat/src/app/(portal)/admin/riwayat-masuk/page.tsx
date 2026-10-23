"use client";

import { RiwayatMasukBoard } from "@/components/portal/riwayat-masuk-board";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehAksi } from "@/lib/matriks-peran";

export default function RiwayatMasukPage() {
  const { currentUser } = usePortal();
  const boleh = bolehAksi(currentUser, "jejak-masuk.lihat");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Riwayat Masuk & Perangkat"
        description="Siapa masuk kapan, lewat jalur apa, dari perangkat dan alamat mana; perangkat yang sedang masuk; batas perangkat per peran dan per akun."
      />
      {boleh ? <RiwayatMasukBoard /> : <AccessDeniedCard />}
    </div>
  );
}
