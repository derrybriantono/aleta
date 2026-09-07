"use client";

import { AletaEAudit } from "@/components/portal/aleta-e-audit";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * ============================================================================
 * ALETA e-AUDIT
 * ============================================================================
 *
 * Halaman ini berada di dalam grup (portal), sehingga sidebar, bilah atas, dan
 * kaki halamannya datang dari PortalShellV2 - sama persis dengan aplikasi lain.
 * Tidak ada satu pun bagian kerangka yang ditulis ulang di sini; menuliskannya
 * sendiri berarti dua kerangka yang perlahan menyimpang, dan pada suatu hari
 * satu aplikasi terlihat berbeda dari saudaranya tanpa ada yang berniat begitu.
 *
 * ============================================================================
 * PAGARNYA DUA LAPIS, DAN KEDUANYA HARUS DILEWATI
 * ============================================================================
 *
 * Lapis pertama di sini: aplikasi harus benar-benar terjangkau oleh peran yang
 * sedang masuk. Selama pengenalnya belum ada pada DEFAULT_PORTAL_APP_IDS, hanya
 * super admin yang lolos - dan itu yang dikehendaki selama angkanya belum
 * disandingkan dengan angka dari luar ALETA.
 *
 * Lapis kedua ada pada tiap rute API-nya kelak. Menjaga layar saja tidak cukup:
 * rute yang tidak dijaga tetap dapat dipanggil langsung oleh siapa pun yang
 * mengetahui alamatnya.
 */
export default function AletaEAuditPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-e-audit");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <AletaEAudit />;
}
