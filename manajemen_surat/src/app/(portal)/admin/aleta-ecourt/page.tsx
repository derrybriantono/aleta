"use client";

import { AletaEcourtAdmin } from "@/components/portal/aleta-ecourt-admin";
import { EcourtSesiPribadi } from "@/components/portal/ecourt-sesi-pribadi";
import { PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

export default function AletaEcourtAdminPage() {
  const { currentUser } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);
  // Dijaga berdasarkan peran, seperti halaman admin ALETA Bot. Sebelumnya
  // halaman ini memeriksa id "aleta-ecourt-admin" di accessiblePortalApps -
  // padahal id itu hanya ada di larik modules, tidak pernah di portalApps,
  // sehingga halamannya selalu menolak siapa pun termasuk super-admin.
  const bolehBuka = roleId === "super-admin" || roleId === "admin";

  // Bukan admin: hanya kartu "Sesi e-Court saya" (perbaikan 1 Okt 2026, E10) -
  // tiap pengguna menyambungkan sesi e-Court akunnya sendiri. Pengaturan
  // lain di halaman ini tetap khusus Super Admin dan Admin.
  if (!bolehBuka) {
    return (
      <div className="space-y-4 p-6">
        <PageIntro
          eyebrow="Pengaturan"
          title="Integrasi e-Court"
          description="Sesi e-Court akun Anda sendiri untuk verifikasi, TTE, dan unggah salinan putusan."
        />
        <EcourtSesiPribadi />
      </div>
    );
  }

  return <AletaEcourtAdmin />;
}
