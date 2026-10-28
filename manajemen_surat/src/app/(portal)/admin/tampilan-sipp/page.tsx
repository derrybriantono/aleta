"use client";

import { TampilanSippAdmin } from "@/components/portal/tampilan-sipp-admin";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehAksi } from "@/lib/matriks-peran";

/** Tampilan ALETA di halaman SIPP per peran & per pengguna (28 Okt 2026): Super Admin & Admin - ditegakkan juga di server. */
export default function TampilanSippAdminPage() {
  const { currentUser } = usePortal();
  const boleh = bolehAksi(currentUser, "tampilan-sipp.atur");
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pusat Kendali"
        title="Tampilan SIPP per Peran"
        description="Atur bagian ALETA yang tampil di halaman SIPP untuk tiap peran dan tiap pegawai: boleh diatur sendiri, selalu tampil, atau tidak tersedia."
      />
      {boleh ? <TampilanSippAdmin /> : <AccessDeniedCard />}
    </div>
  );
}
