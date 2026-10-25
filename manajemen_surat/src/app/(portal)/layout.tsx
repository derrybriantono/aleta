import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PortalShellV2 } from "@/components/layout/portal-shell-v2";
import { PenangkapGalat } from "@/components/portal/penangkap-galat";
import { HalamanPemeliharaan, PitaPemeliharaan, type KeadaanPublik } from "@/components/portal/pemeliharaan";
import { PitaKembaran } from "@/components/portal/pita-kembaran";
import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { bolehLewatPemeliharaan, keadaanPemeliharaan } from "@/server/modules/pemeliharaan/layanan";
import { getUserByIdFromDb } from "@/server/modules/organization/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const db = await getDatabase();
  const actor = await getUserByIdFromDb(db, session.user.id);

  if (!actor?.isActive) {
    redirect("/login");
  }

  // Mode pemeliharaan (E3): pengguna yang tidak dikecualikan melihat layar pemeliharaan. Gagal baca = portal biasa.
  let pemeliharaan: KeadaanPublik | null = null;
  let dikecualikan = false;
  let tutupPortal = false;
  try {
    const keadaan = await keadaanPemeliharaan(db);
    const { adminBoleh: _adminBoleh, ...publik } = keadaan;
    dikecualikan = bolehLewatPemeliharaan(actor.roleId, keadaan);
    if (keadaan.aktif || keadaan.menitSampaiMulai !== null) pemeliharaan = publik;
    tutupPortal = keadaan.aktif && !dikecualikan;
  } catch {
    /* tidak terbaca: portal berjalan seperti biasa */
  }
  if (tutupPortal && pemeliharaan) return <HalamanPemeliharaan awal={pemeliharaan} />;

  return (
    <>
      <PitaKembaran />
      <PitaPemeliharaan awal={pemeliharaan} dikecualikan={dikecualikan} />
      <PenangkapGalat />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <PortalShellV2>{children}</PortalShellV2>
      </Suspense>
    </>
  );
}
