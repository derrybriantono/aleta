import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { ApiError } from "@/server/shared/errors";
import { assertPdfBuffer } from "@/server/shared/pdf-storage";

type UploadableFile = {
  name: string;
  size: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const HR_PUBLIC_URL_PREFIX = "/uploads/hr/";
const DEFAULT_ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"];

function getHrStorageDirectory() {
  const root = process.env.ALETA_UPLOAD_DIR?.trim();
  return root ? path.join(root, "hr") : path.join(process.cwd(), "uploads", "hr");
}

function sanitizeStoredFileName(fileName: string) {
  const baseName = path.basename(fileName || "dokumen");
  return (baseName
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180) || "dokumen");
}

function getExtension(fileName: string) {
  return path.extname(fileName).replace(/^\./, "").toLowerCase();
}

function resolveCandidatePath(directory: string, fileName: string) {
  const absolutePath = path.resolve(directory, fileName);
  const relativePath = path.relative(directory, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ApiError(400, "Path dokumen kepegawaian tidak valid.");
  }

  return absolutePath;
}

export function assertHrUploadMetadata(
  file: Pick<UploadableFile, "name" | "size" | "type">,
  {
    allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
    maxSizeMb = 10,
  }: {
    allowedExtensions?: string[];
    maxSizeMb?: number;
  } = {}
) {
  if (file.size <= 0) {
    throw new ApiError(400, "File kosong. Silakan unggah ulang dokumen yang valid.");
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new ApiError(413, `Ukuran file melebihi batas ${maxSizeMb}MB.`);
  }

  const baseName = path.basename(file.name || "");
  if (!baseName || /[\u0000-\u001F]/.test(baseName)) {
    throw new ApiError(400, "Nama file tidak valid.");
  }

  const extension = getExtension(baseName);
  const allowed = new Set(allowedExtensions.map((item) => item.toLowerCase().replace(/^\./, "")));
  if (!allowed.has(extension)) {
    throw new ApiError(400, `Ekstensi .${extension || "-"} belum diizinkan untuk dokumen kepegawaian.`);
  }
}

export async function storeHrUploadedFile(
  file: UploadableFile,
  options?: {
    allowedExtensions?: string[];
    maxSizeMb?: number;
  }
) {
  assertHrUploadMetadata(file, options);

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = getExtension(file.name);

  if (extension === "pdf") {
    assertPdfBuffer(buffer);
  }

  const directory = getHrStorageDirectory();
  await mkdir(directory, { recursive: true });

  const safeFileName = sanitizeStoredFileName(file.name);
  const uniqueFileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeFileName}`;
  const absolutePath = resolveCandidatePath(directory, uniqueFileName);

  await writeFile(absolutePath, buffer);

  return {
    fileName: uniqueFileName,
    originalFileName: file.name,
    absolutePath,
    publicUrl: `${HR_PUBLIC_URL_PREFIX}${uniqueFileName}`,
    fileType: file.type || extension || "application/octet-stream",
    fileSize: buffer.byteLength,
  };
}

export async function storeHrGeneratedFile(
  buffer: Buffer,
  originalFileName: string,
  fileType = "application/pdf"
) {
  if (buffer.byteLength <= 0) {
    throw new ApiError(500, "Dokumen E-Kepegawaian gagal dibuat.");
  }

  const directory = getHrStorageDirectory();
  await mkdir(directory, { recursive: true });

  const safeFileName = sanitizeStoredFileName(originalFileName || "dokumen-kepegawaian.pdf");
  const uniqueFileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeFileName}`;
  const absolutePath = resolveCandidatePath(directory, uniqueFileName);
  await writeFile(absolutePath, buffer);

  return {
    fileName: uniqueFileName,
    originalFileName,
    absolutePath,
    publicUrl: `${HR_PUBLIC_URL_PREFIX}${uniqueFileName}`,
    fileType,
    fileSize: buffer.byteLength,
  };
}

export function sanitizeHrDownloadFileName(fileName?: string | null) {
  const fallback = "dokumen-kepegawaian";
  const safeName = path.basename(fileName || fallback).replace(/[\r\n"]/g, "_").trim();
  return safeName || fallback;
}

function getLocalHrFileName(fileUrlOrName: string) {
  const raw = fileUrlOrName.trim();
  const parsedPath = (() => {
    try {
      return new URL(raw).pathname;
    } catch {
      return raw;
    }
  })().replace(/\\/g, "/");
  const fileName = parsedPath.startsWith(HR_PUBLIC_URL_PREFIX)
    ? parsedPath.slice(HR_PUBLIC_URL_PREFIX.length)
    : path.basename(parsedPath);

  if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new ApiError(400, "Nama dokumen kepegawaian tidak valid.");
  }

  return fileName;
}

export async function findStoredHrFile(fileUrlOrName: string) {
  const fileName = getLocalHrFileName(fileUrlOrName);
  const directory = getHrStorageDirectory();
  const absolutePath = resolveCandidatePath(directory, fileName);
  const fileInfo = await stat(absolutePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      throw new ApiError(404, "File dokumen kepegawaian tidak ditemukan di penyimpanan server.");
    }
    throw error;
  });

  if (!fileInfo.isFile() || fileInfo.size <= 0) {
    throw new ApiError(404, "File dokumen kepegawaian tidak valid atau kosong.");
  }

  return {
    fileName,
    absolutePath,
    fileInfo,
  };
}
