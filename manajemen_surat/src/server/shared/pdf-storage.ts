import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { withoutBasePath } from "@/lib/base-path";
import { ApiError } from "@/server/shared/errors";

export const PDF_PUBLIC_URL_PREFIX = "/uploads/pdf/";
export const MAX_PDF_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;
const MIN_PDF_UPLOAD_SIZE_BYTES = 64;
const LEGACY_PDF_PUBLIC_URL_PREFIXES = ["/aleta-pdf/"];

type UploadablePdfFile = {
  name: string;
  size: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function dedupeResolvedPaths(paths: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of paths) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;

    seen.add(resolved);
    result.push(resolved);
  }

  return result;
}

export function getPdfStorageDirectories() {
  const exactUploadDir = process.env.ALETA_PDF_UPLOAD_DIR?.trim();
  const uploadRootDir = process.env.ALETA_UPLOAD_DIR?.trim();

  return dedupeResolvedPaths(
    [
      exactUploadDir,
      uploadRootDir ? path.join(uploadRootDir, "pdf") : undefined,
      path.join(process.cwd(), "uploads", "pdf"),
      path.join(process.cwd(), "aleta-pdf"),
      path.join(process.cwd(), "public", "uploads", "pdf"),
    ].filter((item): item is string => Boolean(item))
  );
}

export function getPrimaryPdfStorageDirectory() {
  return getPdfStorageDirectories()[0] ?? path.join(process.cwd(), "uploads", "pdf");
}

export function sanitizeStoredPdfFileName(fileName: string) {
  const baseName = path.basename(fileName || "document.pdf");
  const safeName = baseName
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180);

  const normalized = safeName || "document.pdf";
  return normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized}.pdf`;
}

export function sanitizePdfDownloadFileName(fileName?: string | null) {
  const fallback = "document.pdf";
  const baseName = path.basename(fileName || fallback);
  const safeName = baseName.replace(/[\r\n"]/g, "_").trim();

  return safeName || fallback;
}

export function assertPdfUploadMetadata(file: Pick<UploadablePdfFile, "name" | "size" | "type">) {
  if (file.size <= 0) {
    throw new ApiError(400, "File PDF kosong. Silakan unggah ulang dokumen PDF yang valid.");
  }

  if (file.size < MIN_PDF_UPLOAD_SIZE_BYTES) {
    throw new ApiError(400, "File terlalu kecil untuk menjadi dokumen PDF yang valid.");
  }

  if (file.size > MAX_PDF_UPLOAD_SIZE_BYTES) {
    throw new ApiError(413, "Ukuran PDF melebihi batas 100MB.");
  }

  const baseName = path.basename(file.name || "");
  if (!baseName || /[\u0000-\u001F]/.test(baseName) || !baseName.toLowerCase().endsWith(".pdf")) {
    throw new ApiError(400, "File harus berformat PDF.");
  }

  const contentType = file.type?.trim().toLowerCase();
  if (contentType && contentType !== "application/pdf") {
    throw new ApiError(400, "Tipe file tidak sesuai. Unggah dokumen PDF yang valid.");
  }
}

export function assertPdfBuffer(buffer: Buffer) {
  if (buffer.byteLength <= 0) {
    throw new ApiError(400, "File PDF kosong. Silakan unggah ulang dokumen PDF yang valid.");
  }

  if (buffer.byteLength < MIN_PDF_UPLOAD_SIZE_BYTES) {
    throw new ApiError(400, "File terlalu kecil untuk menjadi dokumen PDF yang valid.");
  }

  if (buffer.byteLength > MAX_PDF_UPLOAD_SIZE_BYTES) {
    throw new ApiError(413, "Ukuran PDF melebihi batas 100MB.");
  }

  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new ApiError(400, "File bukan PDF valid.");
  }

  const header = buffer.subarray(0, 12).toString("ascii");
  if (!/^%PDF-(1\.[0-7]|2\.0)(?:\s|[\r\n%])/.test(header)) {
    throw new ApiError(400, "Header PDF tidak valid atau versi PDF tidak dikenali.");
  }

  const eofWindow = buffer.subarray(Math.max(0, buffer.byteLength - 1024 * 1024)).toString("latin1");
  if (!eofWindow.includes("%%EOF")) {
    throw new ApiError(400, "Struktur PDF tidak lengkap. Marker akhir PDF tidak ditemukan.");
  }
}

export function getPdfPublicUrl(fileName: string) {
  return `${PDF_PUBLIC_URL_PREFIX}${fileName}`;
}

export function getLocalPdfFileName(documentUrl: string) {
  const rawDocumentUrl = documentUrl.trim();
  const parsedPath = (() => {
    try {
      return new URL(rawDocumentUrl).pathname;
    } catch {
      return rawDocumentUrl;
    }
  })();
  const normalizedParsedPath = parsedPath.replace(/\\/g, "/");
  const configuredBasePath = withoutBasePath(normalizedParsedPath).replace(/\\/g, "/");
  const normalizedPath = configuredBasePath.startsWith("/") ? configuredBasePath : `/${configuredBasePath}`;
  const candidates = [normalizedPath];

  if (normalizedPath.startsWith("/aleta/")) {
    candidates.push(normalizedPath.slice("/aleta".length));
  }

  const matchedPath = candidates
    .map((candidate) => ({
      candidate,
      prefix: [PDF_PUBLIC_URL_PREFIX, ...LEGACY_PDF_PUBLIC_URL_PREFIXES].find((prefix) =>
        candidate.startsWith(prefix)
      ),
    }))
    .find((match) => match.prefix);

  if (!matchedPath?.prefix) {
    throw new ApiError(400, "Path PDF tidak valid.");
  }

  const fileName = matchedPath.candidate.slice(matchedPath.prefix.length);

  if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new ApiError(400, "Nama file PDF tidak valid.");
  }

  return fileName;
}

function resolveCandidatePath(directory: string, fileName: string) {
  const absolutePath = path.resolve(directory, fileName);
  const relativePath = path.relative(directory, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ApiError(400, "Path PDF tidak valid.");
  }

  return absolutePath;
}

export async function storeUploadedPdfFile(file: UploadablePdfFile) {
  assertPdfUploadMetadata(file);

  const directory = getPrimaryPdfStorageDirectory();
  await mkdir(directory, { recursive: true });

  const safeFileName = sanitizeStoredPdfFileName(file.name);
  const uniqueFileName = `${Date.now()}-${safeFileName}`;
  const absolutePath = resolveCandidatePath(directory, uniqueFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  assertPdfBuffer(buffer);

  await writeFile(absolutePath, buffer);

  return {
    fileName: uniqueFileName,
    absolutePath,
    publicUrl: getPdfPublicUrl(uniqueFileName),
  };
}

export async function findStoredPdfFile(documentUrl: string) {
  const fileName = getLocalPdfFileName(documentUrl);
  let foundEmptyFile = false;

  for (const directory of getPdfStorageDirectories()) {
    const absolutePath = resolveCandidatePath(directory, fileName);

    try {
      const fileInfo = await stat(absolutePath);
      if (fileInfo.isFile()) {
        if (fileInfo.size <= 0) {
          foundEmptyFile = true;
          continue;
        }

        return {
          fileName,
          absolutePath,
          fileInfo,
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (foundEmptyFile) {
    throw new ApiError(422, "File PDF kosong di penyimpanan server. Silakan unggah ulang dokumen PDF.");
  }

  throw new ApiError(404, "File PDF tidak ditemukan di penyimpanan server.");
}

export async function deleteStoredPdfFile(documentUrl: string) {
  const fileName = getLocalPdfFileName(documentUrl);
  let deleted = false;

  for (const directory of getPdfStorageDirectories()) {
    const absolutePath = resolveCandidatePath(directory, fileName);

    try {
      await unlink(absolutePath);
      deleted = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return {
    fileName,
    deleted,
  };
}
