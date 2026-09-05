"use client";

import { AletaAntrianAmbil } from "@/components/portal/aleta-antrian-ambil";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * Halaman pengambilan antrian - dibuka petugas, dengan dua tampilan.
 *
 * Tampilan pihak adalah layar yang DIPUTAR menghadap orang yang datang, bukan
 * halaman yang dibuka sendiri oleh pihak berperkara: yang dari rumah memakai
 * WhatsApp, jalur yang identitasnya terbukti dari nomor pengirimnya.
 */
export default function AletaAntrianAmbilPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="p-4">
      <AletaAntrianAmbil />
    </div>
  );
}
