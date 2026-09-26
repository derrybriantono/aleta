"use client";

import { BlangkoMandiri } from "@/components/portal/blangko-mandiri";
import { AccessDeniedCard } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Layar kemandirian blangko.
 *
 * Menyalin kamus, mempelajari korpus, dan menggeser saklar periksa mengenai
 * SELURUH pengadilan, jadi yang boleh membukanya sama dengan halaman admin
 * ALETA E-Court: Super Admin dan Admin, menurut peran berlakunya.
 *
 * Sebelumnya halaman ini memeriksa id "aleta-ecourt-admin" di
 * accessiblePortalApps - padahal id itu hanya ada di larik modules, tidak
 * pernah di portalApps, sehingga halamannya menolak siapa pun termasuk Super
 * Admin (diukur: false untuk keduanya). Kesalahan yang sama sudah pernah
 * diperbaiki di /admin/aleta-ecourt.
 */
export default function BlangkoMandiriPage() {
  const { currentUser } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);
  const boleh = roleId === "super-admin" || roleId === "admin";

  if (!boleh) {
    return <AccessDeniedCard />;
  }

  return <BlangkoMandiri />;
}
