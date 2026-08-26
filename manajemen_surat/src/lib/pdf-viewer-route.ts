import { apiPath, withBasePath, withoutBasePath } from "@/lib/base-path";

const PDF_VIEWER_ROUTE = "/pdf-viewer";
const PDF_BINARY_ROUTE = "/api/pdf-content";

export function normalizePdfDocumentPath(documentUrl: string | undefined) {
  if (!documentUrl) return null;
  const normalizedDocumentUrl = withoutBasePath(documentUrl.trim());

  if (normalizedDocumentUrl.startsWith("/")) return normalizedDocumentUrl;
  if (documentUrl.startsWith("http://") || documentUrl.startsWith("https://")) return documentUrl;

  return null;
}

export function buildPdfDocumentHref(documentUrl: string) {
  const normalizedDocumentUrl = normalizePdfDocumentPath(documentUrl);

  if (!normalizedDocumentUrl) {
    return documentUrl;
  }

  if (normalizedDocumentUrl.startsWith("http://") || normalizedDocumentUrl.startsWith("https://")) {
    return normalizedDocumentUrl;
  }

  return buildPdfBinaryRoute(normalizedDocumentUrl);
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
  const normalizedDocumentUrl = normalizePdfDocumentPath(documentUrl) ?? documentUrl;
  const params = new URLSearchParams({
    file: normalizedDocumentUrl,
  });

  if (documentFileName) {
    params.set("name", documentFileName);
  }

  if (embedded) {
    params.set("embedded", "1");
  }

  return `${withBasePath(PDF_VIEWER_ROUTE)}?${params.toString()}`;
}

export function buildPdfBinaryRoute(
  documentUrl: string,
  options: {
    download?: boolean;
    preview?: boolean;
    fileName?: string;
  } = {}
) {
  const normalizedDocumentUrl = normalizePdfDocumentPath(documentUrl) ?? documentUrl;
  const params = new URLSearchParams({
    file: normalizedDocumentUrl,
  });

  if (options.download) {
    params.set("download", "1");
  }

  if (options.preview) {
    params.set("preview", "1");
  }

  if (options.fileName) {
    params.set("name", options.fileName);
  }

  return apiPath(`${PDF_BINARY_ROUTE}?${params.toString()}`);
}
