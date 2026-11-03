// Modul pekerja pdfjs (tanpa berkas tipe bawaan) - dimuat di utas utama server oleh muatPdfjs (aleta-ecourt/baca-pdf.ts).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
