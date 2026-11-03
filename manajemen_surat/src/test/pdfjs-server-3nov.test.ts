// @vitest-environment node
/**
 * ============================================================================
 * pdfjs DI SERVER: SATU CARA UNTUK SEMUA PEMBACA PDF (3 Nov 2026)
 * ============================================================================
 *
 * Diukur di container aleta-portal 1.205.63: pdfjs hasil bundel memuat pekerjanya lewat import RELATIF "./pdf.worker.mjs"
 * terhadap potongan .next/server/chunks/ - berkas itu tidak ada, sehingga SETIAP pembacaan PDF di server gagal
 * ("Setting up fake worker failed: Cannot find module '/app/.next/server/chunks/pdf.worker.mjs'"), padahal lolos di laptop.
 * Semua pembaca PDF server kini lewat muatPdfjs (aleta-ecourt/baca-pdf.ts): pekerja dimuat di utas utama
 * (globalThis.pdfjsWorker), jalur workerSrc tidak pernah dipakai.
 *
 * Uji pertama meniru bundel: workerSrc menunjuk berkas yang tidak ada dan pekerja belum terpasang - pembaca harus tetap
 * membaca. PDF uji = fixture rekaan ttd-salinan-3nov (keluaran LibreOffice 7.4).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractTextFromPdfBuffer } from "@/server/modules/ai/pdf";
import { pasangRintisanPeramban } from "@/server/modules/aleta-ecourt/baca-pdf";
import { bacaBerkas } from "@/server/modules/aleta-ecourt/berkas-gugatan";

const PDF = readFileSync(path.join(process.cwd(), "src/test/fixtures/ttd-salinan-3nov/bas-04-3-salinan-lo74.pdf"));

describe("pembaca PDF server tidak bergantung pada import relatif pdf.worker.mjs", () => {
  it("berkas gugatan PDF (bacaBerkas) terbaca walau jalur pekerja tidak ada - seperti bundel server", async () => {
    pasangRintisanPeramban(); // pdf.mjs menyentuh DOMMatrix saat dimuat
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const lama = pdfjs.GlobalWorkerOptions.workerSrc;
    delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
    pdfjs.GlobalWorkerOptions.workerSrc = path.join(os.tmpdir(), "tidak-ada", "pdf.worker.mjs");
    try {
      const hasil = await bacaBerkas("gugatan.pdf", PDF);
      expect(hasil.alasan).toBe("");
      expect(hasil.jenis).toBe("pdf");
      expect(hasil.teks).toContain("BERITA ACARA SIDANG");
      expect(hasil.teks).toContain("Hidayat Rekaan Wijaya");
    } finally {
      pdfjs.GlobalWorkerOptions.workerSrc = lama;
    }
  });

  it("ekstraksi teks PDF untuk AI (extractTextFromPdfBuffer) membaca isi halaman", async () => {
    const bita = new Uint8Array(PDF);
    const h = await extractTextFromPdfBuffer(bita.buffer.slice(bita.byteOffset, bita.byteOffset + bita.byteLength), 5);
    expect(h.scannedPageCount).toBe(3);
    expect(h.extractedText).toContain("BERITA ACARA SIDANG");
  });

  it("penjaga: tidak ada modul server yang memuat pdfjs langsung selain muatPdfjs", () => {
    const akar = path.join(process.cwd(), "src/server");
    const temuan: string[] = [];
    const jalan = (dir: string) => {
      for (const nama of readdirSync(dir)) {
        const p = path.join(dir, nama);
        if (statSync(p).isDirectory()) jalan(p);
        else if (/\.(ts|tsx|mjs|js)$/.test(nama) && /import\(\s*["']pdfjs-dist\/legacy\/build\/pdf\.mjs["']\s*\)/.test(readFileSync(p, "utf8"))) temuan.push(path.relative(akar, p).replace(/\\/g, "/"));
      }
    };
    jalan(akar);
    expect(temuan).toEqual(["modules/aleta-ecourt/baca-pdf.ts"]);
  });
});
