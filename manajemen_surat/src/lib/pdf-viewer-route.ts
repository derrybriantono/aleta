const PDF_VIEWER_ROUTE = "/pdf-viewer";
const PDF_BINARY_ROUTE = "/api/pdf-content";

export function normalizePdfDocumentPath(documentUrl: string | undefined) {
  if (!documentUrl) return null;
  if (documentUrl.startsWith("/")) return documentUrl;
  if (documentUrl.startsWith("http://") || documentUrl.startsWith("https://")) return documentUrl;

  return null;
}

export function buildPdfViewerRoute({
  documentUrl,
  documentFileName,
  embedded = false,
}: {
  documentUrl: string;
  documentFileName?: string;
  embedded?: boolean;
}) {
  const params = new URLSearchParams({
    file: documentUrl,
  });

  if (documentFileName) {
    params.set("name", documentFileName);
  }

  if (embedded) {
    params.set("embedded", "1");
  }

  return `${PDF_VIEWER_ROUTE}?${params.toString()}`;
}

export function buildPdfBinaryRoute(documentUrl: string) {
  const params = new URLSearchParams({
    file: documentUrl,
  });

  return `${PDF_BINARY_ROUTE}?${params.toString()}`;
}
