import type { PdfDocumentProxy } from "@/lib/pdfjs-client";

type PrintPdfOptions = {
  title?: string;
  mode?: "smart" | "original" | "fallback";
  watermark?: string;
};

function removeFrame(frame: HTMLIFrameElement) {
  window.setTimeout(() => {
    frame.remove();
  }, 1200);
}

export async function printPdfDocument(pdfDocument: PdfDocumentProxy, options: PrintPdfOptions = {}) {
  const frame = document.createElement("iframe");
  const frameTitle = options.title || "dokumen.pdf";

  frame.setAttribute("title", "Cetak PDF");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.border = "0";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";

  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument ?? printWindow?.document;

  if (!printWindow || !printDocument) {
    frame.remove();
    window.print();
    return;
  }

  printDocument.open();
  printDocument.write(`<!doctype html>
<html>
  <head>
    <title>${frameTitle.replace(/[<>&"]/g, "_")}</title>
    <style>
      @page { margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #ffffff; color: #0f172a; font-family: Arial, sans-serif; }
      .page { break-after: page; page-break-after: always; display: flex; justify-content: center; width: 100%; }
      .page:last-child { break-after: auto; page-break-after: auto; }
      canvas { display: block; max-width: 100%; height: auto; background: #ffffff; }
    </style>
  </head>
  <body>
    <main id="print-pages"></main>
  </body>
</html>`);
  printDocument.close();

  const root = printDocument.getElementById("print-pages");

  if (!root) {
    frame.remove();
    window.print();
    return;
  }

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: options.mode === "original" ? 1.45 : 1.25 });
    const pageNode = printDocument.createElement("section");
    const canvas = printDocument.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) continue;

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    pageNode.className = "page";
    pageNode.appendChild(canvas);
    root.appendChild(pageNode);

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    if (options.watermark) {
      context.save();
      context.font = "20px Arial, sans-serif";
      context.fillStyle = "rgba(30, 41, 59, 0.14)";
      context.translate(viewport.width / 2, viewport.height / 2);
      context.rotate((-24 * Math.PI) / 180);
      context.textAlign = "center";
      context.fillText(options.watermark, 0, 0);
      context.restore();
    }
  }

  printWindow.addEventListener("afterprint", () => removeFrame(frame), { once: true });
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
    window.setTimeout(() => {
      if (document.body.contains(frame)) {
        removeFrame(frame);
      }
    }, 60000);
  }, 100);
}
