"use client";

import { AletaAntrianPanggil } from "@/components/portal/aleta-antrian-panggil";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * Papan panggil - untuk petugas di ruang sidang.
 *
 * Memanggil adalah satu-satunya tindakan yang benar-benar memindahkan giliran,
 * dan sampai sekarang hanya dapat dilakukan dari aplikasi antrian. Dengan
 * halaman ini petugas tidak perlu berpindah aplikasi - dan yang ditulis persis
 * sama, sehingga layar aplikasi antrian tetap benar.
 */
export default function AletaAntrianPanggilPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="p-4">
      <AletaAntrianPanggil />
    </div>
  );
}
