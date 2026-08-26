import { EKepegawaianPublicPanel } from "@/components/public/e-kepegawaian-public-panel";

export const dynamic = "force-dynamic";

export default async function PublicEKepegawaianServicePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  return <EKepegawaianPublicPanel initialService={service} />;
}
