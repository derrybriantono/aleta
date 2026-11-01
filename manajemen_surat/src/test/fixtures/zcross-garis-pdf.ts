import { pasangRintisanPeramban } from "@/server/modules/aleta-ecourt/baca-pdf";

/**
 * Membaca GARIS vektor dari PDF (pdfjs getOperatorList): ruas lurus hasil stroke dan persegi panjang tipis hasil fill (cara Word menggambar
 * garis tebal 0,75 pt). Koordinat poin PDF dari KIRI-ATAS. Hanya untuk uji.
 */
export type GarisPdf = { halaman: number; x1: number; y1: number; x2: number; y2: number };

type Mat = [number, number, number, number, number, number];
const kali = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const terap = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export async function bacaGarisPdf(pdf: Uint8Array): Promise<GarisPdf[]> {
  pasangRintisanPeramban();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const OPS = pdfjs.OPS as Record<string, number>;
  const dok = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, isEvalSupported: false }).promise;
  const hasil: GarisPdf[] = [];
  try {
    for (let n = 1; n <= dok.numPages; n += 1) {
      const hal = await dok.getPage(n);
      const tinggi = (hal.view as number[])[3] - (hal.view as number[])[1];
      const ops = await hal.getOperatorList();
      let ctm: Mat = [1, 0, 0, 1, 0, 0];
      const tumpuk: Mat[] = [];
      for (let i = 0; i < ops.fnArray.length; i += 1) {
        const fn = ops.fnArray[i];
        const arg = ops.argsArray[i] as unknown[];
        if (fn === OPS.save) tumpuk.push(ctm);
        else if (fn === OPS.restore) ctm = tumpuk.pop() ?? ctm;
        else if (fn === OPS.transform) ctm = kali(ctm, arg as unknown as Mat);
        else if (fn === OPS.constructPath) {
          const lukis = arg[0] as number;
          const data = (arg[1] as Array<Float32Array | null>)[0];
          if (!data) continue;
          const stroke = lukis === OPS.stroke || lukis === OPS.closeStroke || lukis === OPS.fillStroke || lukis === OPS.closeFillStroke;
          const isi = lukis === OPS.fill || lukis === OPS.eoFill || lukis === OPS.fillStroke || lukis === OPS.eoFillStroke || lukis === OPS.closeFillStroke;
          // uraikan subpath
          const sub: Array<Array<[number, number]>> = [];
          let kini: Array<[number, number]> = [];
          for (let k = 0; k < data.length; ) {
            const op = data[k];
            if (op === 0) {
              if (kini.length) sub.push(kini);
              kini = [terap(ctm, data[k + 1], data[k + 2])];
              k += 3;
            } else if (op === 1) {
              kini.push(terap(ctm, data[k + 1], data[k + 2]));
              k += 3;
            } else if (op === 2) {
              kini.push(terap(ctm, data[k + 5], data[k + 6]));
              k += 7;
            } else if (op === 3) {
              kini.push(terap(ctm, data[k + 3], data[k + 4]));
              k += 5;
            } else k += 1;
          }
          if (kini.length) sub.push(kini);
          for (const s of sub) {
            if (stroke) {
              for (let q = 0; q + 1 < s.length; q += 1) hasil.push({ halaman: n, x1: s[q][0], y1: tinggi - s[q][1], x2: s[q + 1][0], y2: tinggi - s[q + 1][1] });
            } else if (isi && s.length >= 4) {
              const xs = s.map((p) => p[0]);
              const ys = s.map((p) => p[1]);
              const w = Math.max(...xs) - Math.min(...xs);
              const h = Math.max(...ys) - Math.min(...ys);
              if (h < 1.6 && w > 4) {
                const y = tinggi - (Math.max(...ys) + Math.min(...ys)) / 2;
                hasil.push({ halaman: n, x1: Math.min(...xs), y1: y, x2: Math.max(...xs), y2: y });
              } else if (w < 1.6 && h > 4) {
                const x = (Math.max(...xs) + Math.min(...xs)) / 2;
                hasil.push({ halaman: n, x1: x, y1: tinggi - Math.min(...ys), x2: x, y2: tinggi - Math.max(...ys) });
              }
            }
          }
        }
      }
    }
  } finally {
    await dok.destroy();
  }
  return hasil;
}
