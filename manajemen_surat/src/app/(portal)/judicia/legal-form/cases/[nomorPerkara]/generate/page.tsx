import { JlfGenerateDocumentPage } from "@/components/portal/judicia/legal-form/documents/jlf-document-pages";

export default async function JudiciaLegalFormGenerateDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ nomorPerkara: string }>;
  searchParams: Promise<{ templateId?: string }>;
}) {
  const [{ nomorPerkara }, query] = await Promise.all([params, searchParams]);
  return <JlfGenerateDocumentPage nomorPerkara={nomorPerkara} initialTemplateId={query.templateId} />;
}
