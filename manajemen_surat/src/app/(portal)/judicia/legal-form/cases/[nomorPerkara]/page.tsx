import { JlfCaseDetailPage } from "@/components/portal/judicia/legal-form/documents/jlf-document-pages";

export default async function JudiciaLegalFormCaseDetailPage({
  params,
}: {
  params: Promise<{ nomorPerkara: string }>;
}) {
  const { nomorPerkara } = await params;
  return <JlfCaseDetailPage nomorPerkara={nomorPerkara} />;
}
