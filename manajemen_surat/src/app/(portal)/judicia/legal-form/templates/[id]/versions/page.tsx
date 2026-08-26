import { JlfTemplateVersionsPage } from "@/components/portal/judicia/legal-form/templates/jlf-template-pages";

export default async function JudiciaLegalFormTemplateVersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JlfTemplateVersionsPage templateId={id} />;
}
