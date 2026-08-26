import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { ApiError } from "@/server/shared/errors";

type UploadableTemplateFile = {
  name: string;
  size: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const DEFAULT_TEMPLATE_EXTENSIONS = ["docx", "rtf"];
const EXECUTABLE_EXTENSIONS = new Set([
  "bat",
  "cmd",
  "com",
  "dll",
  "exe",
  "js",
  "msi",
  "ps1",
  "scr",
  "sh",
  "vbs",
]);

function getJlfTemplateStorageDirectory() {
  const root = process.env.ALETA_UPLOAD_DIR?.trim();
  return root ? path.join(root, "jlf", "templates") : path.join(process.cwd(), "uploads", "jlf", "templates");
}

function sanitizeStoredTemplateFileName(fileName: string) {
  const baseName = path.basename(fileName || "template");
  return (
    baseName
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 180) || "template"
  );
}

export function getJlfTemplateExtension(fileName: string) {
  return path.extname(fileName || "").replace(/^\./, "").toLowerCase();
}

function resolveCandidatePath(directory: string, fileName: string) {
  const absolutePath = path.resolve(directory, fileName);
  const relativePath = path.relative(directory, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ApiError(400, "Path template JLF tidak valid.");
  }

  return absolutePath;
}

function normalizeAllowedTemplateExtensions(allowedExtensions: string[] | undefined) {
  const allowed = (allowedExtensions?.length ? allowedExtensions : DEFAULT_TEMPLATE_EXTENSIONS)
    .map((item) => item.toLowerCase().replace(/^\./, "").trim())
    .filter(Boolean)
    .filter((extension) => extension === "docx" || extension === "rtf");

  return allowed.length ? allowed : DEFAULT_TEMPLATE_EXTENSIONS;
}

export function assertJlfTemplateUploadMetadata(
  file: Pick<UploadableTemplateFile, "name" | "size" | "type">,
  {
    allowedExtensions,
    maxSizeMb = 25,
  }: {
    allowedExtensions?: string[];
    maxSizeMb?: number;
  } = {}
) {
  if (file.size <= 0) {
    throw new ApiError(400, "File template kosong. Silakan unggah ulang dokumen yang valid.");
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new ApiError(413, `Ukuran file template melebihi batas ${maxSizeMb}MB.`);
  }

  const baseName = path.basename(file.name || "");
  if (!baseName || /[\u0000-\u001F]/.test(baseName)) {
    throw new ApiError(400, "Nama file template tidak valid.");
  }

  const extension = getJlfTemplateExtension(baseName);
  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    throw new ApiError(400, "File executable tidak boleh diunggah sebagai template JLF.");
  }

  const allowed = new Set(normalizeAllowedTemplateExtensions(allowedExtensions));
  if (!allowed.has(extension)) {
    throw new ApiError(400, `Ekstensi .${extension || "-"} belum diizinkan untuk template JLF.`);
  }

  const contentType = file.type?.trim().toLowerCase();
  const looseAllowedMimeTypes = new Set([
    "",
    "application/octet-stream",
    "application/msword",
    "application/x-msword",
    "application/vnd.ms-word",
    "application/x-rtf",
    "application/rtf",
    "text/plain",
    "text/richtext",
    "text/rtf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  if (contentType && !looseAllowedMimeTypes.has(contentType)) {
    throw new ApiError(400, "Tipe file template tidak sesuai dengan ekstensi yang diizinkan.");
  }
}

function assertNoOfficeMacroPayload(buffer: Buffer) {
  const scan = buffer.subarray(0, Math.min(buffer.byteLength, 1024 * 512)).toString("latin1").toLowerCase();
  if (scan.includes("vbaproject") || scan.includes("vba/")) {
    throw new ApiError(400, "Template yang mengandung macro VBA tidak boleh diunggah.");
  }
}

function assertJlfTemplateFileSignature(buffer: Buffer, fileType: string) {
  if (fileType === "rtf") {
    const header = buffer
      .subarray(0, Math.min(buffer.byteLength, 128))
      .toString("latin1")
      .replace(/^\uFEFF/, "")
      .replace(/^\u00EF\u00BB\u00BF/, "")
      .trimStart();
    if (!header.startsWith("{\\rtf")) {
      throw new ApiError(400, "File .rtf tidak valid. Pastikan file berasal dari dokumen RTF, bukan file lain yang diganti ekstensi.");
    }
    return;
  }

  if (fileType === "docx") {
    const isZipPackage = buffer.byteLength >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
    if (!isZipPackage) {
      throw new ApiError(400, "File .docx tidak valid. Pastikan file berasal dari dokumen DOCX yang benar.");
    }
  }
}

export function getJlfTemplateStoragePath(fileName: string) {
  return `jlf/templates/${fileName}`;
}

export async function storeJlfTemplateFile(
  file: UploadableTemplateFile,
  options?: {
    allowedExtensions?: string[];
    maxSizeMb?: number;
  }
) {
  assertJlfTemplateUploadMetadata(file, options);

  const buffer = Buffer.from(await file.arrayBuffer());
  assertJlfTemplateFileSignature(buffer, getJlfTemplateExtension(file.name));
  assertNoOfficeMacroPayload(buffer);

  const directory = getJlfTemplateStorageDirectory();
  await mkdir(directory, { recursive: true });

  const safeFileName = sanitizeStoredTemplateFileName(file.name);
  const uniqueFileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeFileName}`;
  const absolutePath = resolveCandidatePath(directory, uniqueFileName);
  await writeFile(absolutePath, buffer);

  return {
    fileName: uniqueFileName,
    originalFileName: file.name,
    absolutePath,
    storagePath: getJlfTemplateStoragePath(uniqueFileName),
    fileType: getJlfTemplateExtension(file.name),
    mimeType: file.type || "application/octet-stream",
    fileSize: buffer.byteLength,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function readStoredJlfTemplateFile(storagePath: string) {
  const normalizedPath = storagePath.replace(/\\/g, "/").trim();
  const prefix = "jlf/templates/";
  if (!normalizedPath.startsWith(prefix)) {
    throw new ApiError(400, "Path template JLF tidak valid.");
  }

  const fileName = normalizedPath.slice(prefix.length);
  if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new ApiError(400, "Nama template JLF tidak valid.");
  }

  const directory = getJlfTemplateStorageDirectory();
  const absolutePath = resolveCandidatePath(directory, fileName);
  const fileInfo = await stat(absolutePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      throw new ApiError(404, "File template JLF tidak ditemukan di penyimpanan server.");
    }
    throw error;
  });

  if (!fileInfo.isFile() || fileInfo.size <= 0) {
    throw new ApiError(404, "File template JLF tidak valid atau kosong.");
  }

  return {
    fileName,
    absolutePath,
    fileInfo,
    buffer: await readFile(absolutePath),
  };
}
