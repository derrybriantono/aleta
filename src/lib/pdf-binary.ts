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

async function readArrayBufferViaXhr(url: string) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Gagal memuat PDF (${request.status}).`));
        return;
      }

      resolve(new Uint8Array(request.response ?? new ArrayBuffer(0)));
    };

    request.onerror = () => {
      reject(new Error("Koneksi ke file PDF gagal diproses."));
    };

    request.send();
  });
}

export async function loadPdfBinary(documentUrl: string) {
  const sourceUrl = buildPdfBinaryRoute(documentUrl);
  const attempts: Array<() => Promise<Uint8Array>> = [
    () => readArrayBufferViaFetch(sourceUrl),
    () =>
      readArrayBufferViaFetch(appendCacheBust(sourceUrl, `${Date.now()}-reload`), {
        cache: "reload",
        headers: {
          "cache-control": "no-cache, no-store, max-age=0",
          pragma: "no-cache",
        },
      }),
    () => readArrayBufferViaXhr(appendCacheBust(sourceUrl, `${Date.now()}-xhr`)),
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      const pdfBytes = await attempt();
      if (pdfBytes.byteLength > 0) {
        return pdfBytes;
      }

      lastError = new Error("The PDF file is empty, i.e. its size is zero bytes.");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Preview PDF tidak dapat dimuat.");
    }
  }

  throw lastError ?? new Error("Preview PDF tidak dapat dimuat.");
}
