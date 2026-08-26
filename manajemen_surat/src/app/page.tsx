import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";
import { getInstallStatus } from "@/server/modules/install/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const installStatus = await getInstallStatus();
  if (installStatus.setupRequired) {
    redirect("/setup");
  }

  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/portal");
  }

  redirect("/login");
}
