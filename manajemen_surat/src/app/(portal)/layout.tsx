import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PortalShellV2 } from "@/components/layout/portal-shell-v2";
import { GantiSandiWajib } from "@/components/portal/ganti-sandi-wajib";
import { PitaKembaran } from "@/components/portal/pita-kembaran";
import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { wajibGantiSandi } from "@/server/modules/keamanan/kebijakan-sandi";
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

  // Kebijakan sandi (Bagian 6a): mati bawaan; menyala -> akun yang dipaksa ganti atau sandinya kedaluwarsa menggantinya dulu.
  const gantiSandi = await wajibGantiSandi(db, session.user.id);
  if (gantiSandi.wajib && gantiSandi.alasan) {
    return <GantiSandiWajib alasan={gantiSandi.alasan} nama={actor.name} />;
  }

  return (
    <>
      <PitaKembaran />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <PortalShellV2>{children}</PortalShellV2>
      </Suspense>
    </>
  );
}
