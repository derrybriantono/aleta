"use client";

import { AletaAntrianLayar } from "@/components/portal/aleta-antrian-layar";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * Layar antrian sidang - untuk televisi ruang tunggu.
 *
 * Halamannya sendiri, bukan tab di dalam panel e-Court: layar ini dibuka
 * sekali lalu dibiarkan menyala sepanjang hari pada perangkat yang tidak
 * disentuh siapa pun. Menaruhnya sebagai tab berarti sekali salah klik ia
 * berpindah dan tidak ada yang menyadarinya sampai ada yang bertanya kenapa
 * layarnya menampilkan daftar berkas.
 */
export default function AletaAntrianPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <AletaAntrianLayar />;
}
