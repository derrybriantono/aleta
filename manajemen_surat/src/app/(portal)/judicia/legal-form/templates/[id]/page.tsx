import { JlfTemplateDetailPage } from "@/components/portal/judicia/legal-form/templates/jlf-template-pages";

export default async function JudiciaLegalFormTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JlfTemplateDetailPage templateId={id} />;
}
