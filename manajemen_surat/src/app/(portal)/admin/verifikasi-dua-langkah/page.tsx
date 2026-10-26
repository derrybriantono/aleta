"use client";

import { VerifikasiPanel } from "@/components/portal/verifikasi-panel";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehAksi } from "@/lib/matriks-peran";

/** Verifikasi dua langkah (E5, 25 Okt 2026): Super Admin mengatur; Admin boleh membantu - ditegakkan juga di server. */
export default function VerifikasiDuaLangkahPage() {
  const { currentUser } = usePortal();
  const bolehAtur = bolehAksi(currentUser, "verifikasi.atur");
  const bolehBantu = bolehAksi(currentUser, "verifikasi.bantu");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Verifikasi Dua Langkah"
        description="OTP WhatsApp dan authenticator untuk masuk dari perangkat baru atau luar kantor. Mati sampai Super Admin menyalakannya."
      />
      {bolehBantu ? <VerifikasiPanel bolehAtur={bolehAtur} /> : <AccessDeniedCard />}
    </div>
  );
}
