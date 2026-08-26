import path from "node:path";
import { pathToFileURL } from "node:url";

function ensurePdfJsNodePolyfills() {
  const scope = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };

  if (typeof scope.DOMMatrix === "undefined") {
    class NodeDOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      m11 = 1;
      m12 = 0;
      m13 = 0;
      m14 = 0;
      m21 = 0;
      m22 = 1;
      m23 = 0;
      m24 = 0;
      m31 = 0;
      m32 = 0;
      m33 = 1;
      m34 = 0;
      m41 = 0;
      m42 = 0;
      m43 = 0;
      m44 = 1;
      is2D = true;
      isIdentity = true;

      multiplySelf() {
        return this;
      }

      preMultiplySelf() {
        return this;
      }

      translateSelf() {
        return this;
      }

      scaleSelf() {
        return this;
      }

      rotateSelf() {
        return this;
      }

      invertSelf() {
        return this;
      }

      multiply() {
        return new NodeDOMMatrix();
      }

      translate() {
        return new NodeDOMMatrix();
      }

      scale() {
        return new NodeDOMMatrix();
      }

      rotate() {
        return new NodeDOMMatrix();
      }

      inverse() {
        return new NodeDOMMatrix();
      }

      transformPoint<T>(point?: T) {
        return point ?? ({ x: 0, y: 0, z: 0, w: 1 } as T);
      }

      toFloat32Array() {
        return new Float32Array([1, 0, 0, 1, 0, 0]);
      }

      toFloat64Array() {
        return new Float64Array([1, 0, 0, 1, 0, 0]);
      }
    }

    scope.DOMMatrix = NodeDOMMatrix as unknown as typeof DOMMatrix;
  }

  if (typeof scope.ImageData === "undefined") {
    class NodeImageData {
      colorSpace: PredefinedColorSpace = "srgb";
      data: Uint8ClampedArray;
      height: number;
      width: number;

      constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
        if (typeof dataOrWidth === "number") {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
          return;
        }

        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height ?? 0;
      }
    }

    scope.ImageData = NodeImageData as unknown as typeof ImageData;
  }

  if (typeof scope.Path2D === "undefined") {
    class NodePath2D {
      addPath() {}
      arc() {}
      arcTo() {}
      bezierCurveTo() {}
      closePath() {}
      ellipse() {}
      lineTo() {}
      moveTo() {}
      quadraticCurveTo() {}
      rect() {}
      roundRect() {}
    }

    scope.Path2D = NodePath2D as unknown as typeof Path2D;
  }
}

function getPdfJsWorkerSrc() {
  return pathToFileURL(
    path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")
  ).href;
}

export async function extractTextFromPdfBuffer(buffer: ArrayBuffer, pageLimit = 5) {
  ensurePdfJsNodePolyfills();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = getPdfJsWorkerSrc();

  const documentTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableAutoFetch: true,
    disableRange: true,
    disableStream: true,
    isEvalSupported: false,
  });
  const pdf = await documentTask.promise;

  try {
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
  } finally {
    await pdf.destroy();
  }
}
