export type UploadedPdfDraft = {
  file: File;
  optimizedFile: File;
  fileName: string;
  fileSizeMb: number;
  extractedText: string;
  compressionNote: string;
};

export async function processPdfUpload(file: File): Promise<UploadedPdfDraft> {
  const sizeMb = Number((file.size / (1024 * 1024)).toFixed(2));
  if (sizeMb > 100) {
    throw new Error("Ukuran PDF melebihi 100MB. Gunakan file yang lebih kecil agar tetap ringan.");
  }

  const sourceBuffer = await file.arrayBuffer();
  let optimizedFile = file;
  let compressionNote = "PDF dipakai dalam mode asli karena sudah cukup ringan.";

  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true });
    const optimizedBytes = await pdfDoc.save({ useObjectStreams: true });
    const optimizedBuffer = optimizedBytes.buffer.slice(
      optimizedBytes.byteOffset,
      optimizedBytes.byteOffset + optimizedBytes.byteLength
    ) as ArrayBuffer;

    if (optimizedBytes.byteLength <= sourceBuffer.byteLength) {
      optimizedFile = new File([optimizedBuffer], file.name, { type: "application/pdf" });
      const optimizedSizeMb = Number((optimizedBytes.byteLength / (1024 * 1024)).toFixed(2));
      compressionNote =
        optimizedSizeMb < sizeMb
          ? `PDF dioptimalkan di sisi klien dari ${sizeMb}MB menjadi ${optimizedSizeMb}MB.`
          : "PDF diproses ulang di sisi klien untuk optimasi struktur dokumen.";
    }
  } catch {
    compressionNote = "PDF tetap digunakan tanpa optimasi lanjutan untuk menjaga kompatibilitas dokumen.";
  }

  let extractedText = "";

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const documentTask = pdfjs.getDocument({ data: await optimizedFile.arrayBuffer() });
    const pdf = await documentTask.promise;
    const pageLimit = Math.min(pdf.numPages, 3);
    const pageTexts: string[] = [];

    for (let index = 1; index <= pageLimit; index += 1) {
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

    extractedText = pageTexts.join(" ").slice(0, 6000);
  } catch {
    extractedText = file.name.replace(/\.pdf$/i, "");
  }

  return {
    file,
    optimizedFile,
    fileName: optimizedFile.name,
    fileSizeMb: Number((optimizedFile.size / (1024 * 1024)).toFixed(2)),
    extractedText,
    compressionNote,
  };
}
