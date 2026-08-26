import { JlfDocumentValidationPage } from "@/components/portal/judicia/legal-form/documents/jlf-document-pages";

export default async function JudiciaLegalFormDocumentValidationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JlfDocumentValidationPage documentId={id} />;
}
