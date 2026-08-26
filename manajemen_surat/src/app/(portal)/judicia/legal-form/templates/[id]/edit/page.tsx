import { JlfTemplateEditPage } from "@/components/portal/judicia/legal-form/templates/jlf-template-pages";

export default async function JudiciaLegalFormTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JlfTemplateEditPage templateId={id} />;
}
