import { JlfDocumentDetailPage } from "@/components/portal/judicia/legal-form/documents/jlf-document-pages";

export default async function JudiciaLegalFormDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JlfDocumentDetailPage documentId={id} />;
}
