"use client";

import { BlangkoSaya } from "@/components/portal/blangko-saya";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { bolehBuatBlangkoSendiri, superAdminKah } from "@/lib/blangko-sendiri";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * Blangko Saya: hakim, panitera, dan konseptor menyunting atau mengunggah
 * blangko miliknya, memetakan isiannya, lalu memakainya untuk putusan mandiri
 * atau mengajukannya untuk ABT. Penjaga sesungguhnya ada di server
 * (/api/aleta-ecourt/blangko-sendiri); pemeriksaan di sini hanya merapikan tampilan.
 */
export default function HalamanBlangkoSaya() {
  const { currentUser } = usePortal();
  const peran = getEffectiveRoleId(currentUser);

  if (!bolehBuatBlangkoSendiri(peran)) return <AccessDeniedCard />;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="Blangko"
        title="Blangko Saya"
        description="Sunting atau unggah blangko Anda sendiri, periksa isian yang dikenali, lalu pakai untuk putusan mandiri atau ajukan untuk ABT. Blangko ini milik Anda; hanya Anda yang dapat mengubahnya."
      />
      <BlangkoSaya superAdmin={superAdminKah(peran)} />
    </div>
  );
}
