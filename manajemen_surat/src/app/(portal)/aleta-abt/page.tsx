"use client";

import { AletaAbtPintu } from "@/components/portal/aleta-abt-pintu";
import { PageIntro } from "@/components/portal/shared";

/**
 * ALETA ABT (5 Nov 2026). Hak diputuskan server lewat /api/aleta-abt/hak; halaman tidak menyembunyikan apa pun
 * yang membahayakan, hanya menerangkan keadaan akun. Layar ALETA ABT untuk HP belum ada.
 */
export default function HalamanAletaAbt() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro eyebrow="Blangko" title="ALETA ABT" description="Pintu menuju Blangko ABT by Derry Briantono." />
      <AletaAbtPintu />
    </div>
  );
}
