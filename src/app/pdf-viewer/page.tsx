import { PdfLiveViewer } from "@/components/pdf/pdf-live-viewer";
import { normalizePdfDocumentPath } from "@/lib/pdf-viewer-route";

export default async function PdfViewerPage({
  searchParams,
}: {
  searchParams: Promise<{ file?: string; name?: string; embedded?: string }>;
}) {
  const params = await searchParams;
  const documentUrl = normalizePdfDocumentPath(params.file);
  const isEmbedded = params.embedded === "1";

  if (!documentUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold text-foreground">PDF tidak tersedia</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Tautan viewer tidak valid. Buka ulang dokumen dari halaman surat.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={isEmbedded ? "h-screen overflow-hidden bg-transparent" : "min-h-screen bg-background"}>
      <PdfLiveViewer documentUrl={documentUrl} documentFileName={params.name} embedded={isEmbedded} />
    </main>
  );
}
