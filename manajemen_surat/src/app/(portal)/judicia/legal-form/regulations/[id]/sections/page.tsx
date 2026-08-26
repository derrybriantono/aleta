import { JlfRegulationSectionsPage } from "@/components/portal/judicia/legal-form/regulations/jlf-regulation-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JlfRegulationSectionsPage regulationId={id} />;
}
