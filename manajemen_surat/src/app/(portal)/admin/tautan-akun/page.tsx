"use client";

import { KartuTautanAkun } from "@/components/portal/kartu-tautan-akun";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehAksi } from "@/lib/matriks-peran";

/** Kartu tautan akun pegawai ALETA - SIPP - ABT - e-Court (30 Okt 2026): Super Admin & Admin - ditegakkan juga di server. */
export default function TautanAkunPage() {
  const { currentUser } = usePortal();
  const boleh = bolehAksi(currentUser, "tautan-akun.atur");
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Tautan Akun Pegawai"
        description="Akun ALETA, SIPP, ABT, dan e-Court tiap pegawai dalam satu layar: keadaan tautan, pilihan untuk yang ragu, dan pengisian akun e-Court pegawai."
      />
      {boleh ? <KartuTautanAkun /> : <AccessDeniedCard />}
    </div>
  );
}
