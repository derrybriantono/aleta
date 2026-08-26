import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { findStoredPdfFile, getLocalPdfFileName, getPdfStorageDirectories } from "@/server/shared/pdf-storage";

const originalPdfUploadDir = process.env.ALETA_PDF_UPLOAD_DIR;
const originalUploadDir = process.env.ALETA_UPLOAD_DIR;
const tempDirectories: string[] = [];

describe("pdf storage resolver", () => {
  afterEach(async () => {
    if (originalPdfUploadDir === undefined) {
      delete process.env.ALETA_PDF_UPLOAD_DIR;
    } else {
      process.env.ALETA_PDF_UPLOAD_DIR = originalPdfUploadDir;
    }

    if (originalUploadDir === undefined) {
      delete process.env.ALETA_UPLOAD_DIR;
    } else {
      process.env.ALETA_UPLOAD_DIR = originalUploadDir;
    }

    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
  });

  it("accepts current and legacy public PDF paths from database metadata", () => {
    expect(getLocalPdfFileName("/uploads/pdf/surat-masuk.pdf")).toBe("surat-masuk.pdf");
    expect(getLocalPdfFileName("/aleta/uploads/pdf/surat-keluar.pdf")).toBe("surat-keluar.pdf");
    expect(getLocalPdfFileName("/aleta-pdf/arsip-lama.pdf")).toBe("arsip-lama.pdf");
    expect(getLocalPdfFileName("http://192.168.10.10/aleta-pdf/legacy.pdf")).toBe("legacy.pdf");
  });

  it("uses the configured Docker PDF mount before fallback directories", () => {
    process.env.ALETA_PDF_UPLOAD_DIR = "/app/uploads/pdf";
    process.env.ALETA_UPLOAD_DIR = "/app/uploads";

    const directories = getPdfStorageDirectories();

    expect(directories[0]).toBe(path.resolve("/app/uploads/pdf"));
    expect(directories).toContain(path.resolve(process.cwd(), "aleta-pdf"));
  });

  it("skips zero-byte PDF files and uses the next valid Docker storage fallback", async () => {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "aleta-pdf-storage-"));
    tempDirectories.push(rootDirectory);
    const primaryDirectory = path.join(rootDirectory, "primary-pdf");
    const uploadRootDirectory = path.join(rootDirectory, "uploads");
    const fallbackPdfDirectory = path.join(uploadRootDirectory, "pdf");
    const fileName = "surat-valid.pdf";

    await mkdir(primaryDirectory, { recursive: true });
    await mkdir(fallbackPdfDirectory, { recursive: true });
    await writeFile(path.join(primaryDirectory, fileName), Buffer.alloc(0));
    await writeFile(path.join(fallbackPdfDirectory, fileName), Buffer.from("%PDF-1.7\n%%EOF\n"));

    process.env.ALETA_PDF_UPLOAD_DIR = primaryDirectory;
    process.env.ALETA_UPLOAD_DIR = uploadRootDirectory;

    const storedFile = await findStoredPdfFile(`/uploads/pdf/${fileName}`);

    expect(storedFile.absolutePath).toBe(path.resolve(fallbackPdfDirectory, fileName));
    expect(storedFile.fileInfo.size).toBeGreaterThan(0);
  });
});
