import type { DocumentInitParameters, PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

import { withBasePath } from "@/lib/base-path";

export type { PDFDocumentLoadingTask as PdfDocumentLoadingTask, PDFDocumentProxy as PdfDocumentProxy };

export type PdfJsModule = {
  getDocument: (src?: string | URL | Uint8Array | ArrayBuffer | DocumentInitParameters) => PDFDocumentLoadingTask;
  GlobalWorkerOptions: {
    workerSrc: string;
  };
};

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
const pdfJsModuleUrl = withBasePath("/vendor/pdfjs/pdf.min.mjs");
const pdfJsWorkerUrl = withBasePath("/vendor/pdfjs/pdf.worker.min.mjs");

export async function loadPdfJsModule() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import(/* webpackIgnore: true */ pdfJsModuleUrl) as Promise<PdfJsModule>;
  }

  const pdfjs = await pdfJsModulePromise;
  pdfjs.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;

  return pdfjs;
}
