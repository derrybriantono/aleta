import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { ApiError } from "@/server/shared/errors";

const DOCUMENT_STORAGE_PREFIX = "jlf/documents/";

function getJlfDocumentStorageDirectory() {
  const root = process.env.ALETA_UPLOAD_DIR?.trim();
  return root ? path.join(root, "jlf", "documents") : path.join(process.cwd(), "uploads", "jlf", "documents");
}

function sanitizeFileName(fileName: string) {
  return (
    path
      .basename(fileName || "dokumen-jlf")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 180) || "dokumen-jlf"
  );
}

function resolveCandidatePath(directory: string, fileName: string) {
  const absolutePath = path.resolve(directory, fileName);
  const relativePath = path.relative(directory, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ApiError(400, "Path dokumen JLF tidak valid.");
  }

  return absolutePath;
}

function extensionForType(fileType: string) {
  const normalized = fileType.trim().toLowerCase().replace(/^\./, "");
  if (normalized === "rtf") return "rtf";
  if (normalized === "txt" || normalized === "text") return "txt";
  throw new ApiError(400, "Format output dokumen JLF belum didukung.");
}

export function getJlfDocumentContentType(fileType: string) {
  const normalized = fileType.trim().toLowerCase();
  if (normalized === "rtf") return "application/rtf";
  return "text/plain; charset=utf-8";
}

export function getJlfDocumentStoragePath(fileName: string) {
  return `${DOCUMENT_STORAGE_PREFIX}${fileName}`;
}

export async function storeJlfGeneratedDocumentFile(input: {
  buffer: Buffer;
  fileType: string;
  suggestedFileName: string;
}) {
  if (input.buffer.byteLength <= 0) {
    throw new ApiError(400, "Output dokumen JLF kosong.");
  }

  const extension = extensionForType(input.fileType);
  const directory = getJlfDocumentStorageDirectory();
  await mkdir(directory, { recursive: true });

  const safeBaseName = sanitizeFileName(input.suggestedFileName).replace(/\.[^.]+$/, "");
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBaseName}.${extension}`;
  const absolutePath = resolveCandidatePath(directory, fileName);
  await writeFile(absolutePath, input.buffer);

  return {
    fileName,
    absolutePath,
    storagePath: getJlfDocumentStoragePath(fileName),
    fileType: extension,
    checksum: createHash("sha256").update(input.buffer).digest("hex"),
    size: input.buffer.byteLength,
  };
}

export async function readStoredJlfGeneratedDocumentFile(storagePath: string) {
  const normalizedPath = storagePath.replace(/\\/g, "/").trim();
  if (!normalizedPath.startsWith(DOCUMENT_STORAGE_PREFIX)) {
    throw new ApiError(400, "Path dokumen JLF tidak valid.");
  }

  const fileName = normalizedPath.slice(DOCUMENT_STORAGE_PREFIX.length);
  if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new ApiError(400, "Nama dokumen JLF tidak valid.");
  }

  const directory = getJlfDocumentStorageDirectory();
  const absolutePath = resolveCandidatePath(directory, fileName);
  const fileInfo = await stat(absolutePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      throw new ApiError(404, "File dokumen JLF tidak ditemukan di penyimpanan server.");
    }
    throw error;
  });

  if (!fileInfo.isFile() || fileInfo.size <= 0) {
    throw new ApiError(404, "File dokumen JLF tidak valid atau kosong.");
  }

  return {
    fileName,
    absolutePath,
    fileInfo,
    buffer: await readFile(absolutePath),
  };
}

export const JlfDocumentStorageService = {
  storeGeneratedDocumentFile: storeJlfGeneratedDocumentFile,
  readGeneratedDocumentFile: readStoredJlfGeneratedDocumentFile,
  getContentType: getJlfDocumentContentType,
};
