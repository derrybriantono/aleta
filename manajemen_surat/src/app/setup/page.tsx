import { redirect } from "next/navigation";

import { FirstRunSetup } from "@/components/install/first-run-setup";
import { getInstallStatus } from "@/server/modules/install/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const params = await searchParams;
  const previewMode = params.preview === "1" || params.preview === "true";
  const status = await getInstallStatus();

  if (!status.setupRequired && !previewMode) {
    redirect("/login");
  }

  return <FirstRunSetup initialStatus={status} previewMode={previewMode} />;
}
