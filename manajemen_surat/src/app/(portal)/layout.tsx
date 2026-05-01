import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PortalShellV2 } from "@/components/layout/portal-shell-v2";
import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
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

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PortalShellV2>{children}</PortalShellV2>
    </Suspense>
  );
}
