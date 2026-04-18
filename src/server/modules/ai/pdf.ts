export async function extractTextFromPdfBuffer(buffer: ArrayBuffer, pageLimit = 5) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const documentTask = pdfjs.getDocument({ data: buffer });
  const pdf = await documentTask.promise;
  const totalPages = Math.min(pdf.numPages, pageLimit);
  const pageTexts: string[] = [];

  for (let index = 1; index <= totalPages; index += 1) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pageTexts.push(pageText);
    }
  }

  return {
    extractedText: pageTexts.join(" ").slice(0, 12000),
    scannedPageCount: totalPages,
  };
}
