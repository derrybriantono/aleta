import { JlfVariableReviewPage } from "@/components/portal/judicia/legal-form/documents/jlf-variable-review-page";

export default async function JudiciaLegalFormCaseVariableReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ nomorPerkara: string }>;
  searchParams: Promise<{ templateId?: string }>;
}) {
  const [{ nomorPerkara }, query] = await Promise.all([params, searchParams]);
  return <JlfVariableReviewPage nomorPerkara={nomorPerkara} initialTemplateId={query.templateId} />;
}
