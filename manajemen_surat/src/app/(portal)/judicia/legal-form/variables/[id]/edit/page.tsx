import { JlfVariableEditPage } from "@/components/portal/judicia/legal-form/templates/jlf-variable-pages";

export default async function JudiciaLegalFormVariableEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JlfVariableEditPage variableId={id} />;
}
