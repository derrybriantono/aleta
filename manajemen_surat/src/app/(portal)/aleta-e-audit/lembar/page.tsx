"use client";

import { AletaEAuditLembar } from "@/components/portal/aleta-e-audit-lembar";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/**
 * ============================================================================
 * LEMBAR AUDIT ALETA e-AUDIT
 * ============================================================================
 *
 * Pagarnya sama persis dengan halaman induknya: pengenal aplikasi yang sama,
 * sehingga peran yang boleh membuka e-Audit boleh membuka lembarnya, dan yang
 * tidak boleh tidak boleh keduanya.
 *
 * Menuliskan pagar yang berbeda di sini - misalnya membolehkan lebih banyak
 * peran karena "ini cuma menampilkan" - berarti dua pagar yang perlahan
 * menyimpang, dan lembar ini justru memuat lebih banyak daripada halaman
 * induknya: nomor perkara beserta sebab mengapa ia perlu dibuka.
 *
 * Lapis keduanya tetap ada di rute API-nya: /api/aleta-e-audit/katalog dan
 * /api/aleta-penilaian/jalankan sama-sama menuntut kapabilitas panel. Menjaga
 * layar saja tidak pernah cukup.
 */
export default function AletaEAuditLembarPage() {
  const { accessiblePortalApps } = usePortal();
  const boleh = accessiblePortalApps.some((app) => app.id === "aleta-e-audit");

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <AletaEAuditLembar />;
}
