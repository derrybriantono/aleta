import { buildPdfBinaryRoute } from "@/lib/pdf-viewer-route";

function appendCacheBust(url: string, token: string) {
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}pdf_preview_bust=${encodeURIComponent(token)}`;
}

async function readArrayBufferViaFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Gagal memuat PDF (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function loadPdfBinary(documentUrl: string) {
  const sourceUrl = appendCacheBust(buildPdfBinaryRoute(documentUrl, { preview: true }), `${Date.now()}-preview`);
  const pdfBytes = await readArrayBufferViaFetch(sourceUrl, {
    cache: "no-store",
    headers: {
      accept: "application/pdf,application/octet-stream,*/*",
      "cache-control": "no-cache, no-store, max-age=0",
      pragma: "no-cache",
    },
  });

  if (pdfBytes.byteLength > 0) {
    return pdfBytes;
  }

  throw new Error("File PDF kosong di penyimpanan server.");
}
