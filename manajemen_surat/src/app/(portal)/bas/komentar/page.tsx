"use client";

import { BasKomentarHakim } from "@/components/portal/bas-komentar-hakim";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * Baca BAS & keterangan saksi - tempat hakim berkomentar.
 *
 * Gerbangnya sama dengan Alat Bantu Tulis BAS (/bas): siapa pun yang memegang
 * aplikasi ALETA E-Court. Siapa boleh MENULIS komentar ditentukan server
 * (hakim, Ketua, Wakil, Admin, Super Admin); pegawai lain membaca dan -
 * panitera pengganti - menandai komentar yang sudah ditanggapi.
 */
export default function BasKomentarPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-ecourt");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <BasKomentarHakim />;
}
