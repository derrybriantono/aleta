import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { MAX_INSTITUTION_LOGO_FILE_SIZE } from "@/lib/institution-logo";
import { ApiError } from "@/server/shared/errors";

export const INSTITUTION_LOGO_PUBLIC_URL_PREFIX = "/api/public/institution/logo/";
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

type UploadableInstitutionLogoFile = {
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

function getInstitutionLogoStorageDirectories() {
  const exactUploadDir = process.env.ALETA_INSTITUTION_LOGO_UPLOAD_DIR?.trim();
  const uploadRootDir = process.env.ALETA_UPLOAD_DIR?.trim();

  return dedupeResolvedPaths(
    [
      exactUploadDir,
      uploadRootDir ? path.join(uploadRootDir, "institution-logo") : undefined,
      path.join(process.cwd(), "uploads", "institution-logo"),
      path.join(process.cwd(), "public", "uploads", "institution-logo"),
    ].filter((item): item is string => Boolean(item))
  );
}

function getPrimaryInstitutionLogoStorageDirectory() {
  return getInstitutionLogoStorageDirectories()[0] ?? path.join(process.cwd(), "uploads", "institution-logo");
}

function sanitizeStoredLogoFileName(fileName: string) {
  const parsed = path.parse(path.basename(fileName || "logo-instansi.png"));
  const extension = parsed.ext.toLowerCase();
  const safeBaseName =
    parsed.name
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 120) || "logo-instansi";

  return `${safeBaseName}${SUPPORTED_IMAGE_EXTENSIONS.has(extension) ? extension : ".png"}`;
}

function assertImageSignature(buffer: Buffer) {
  const png = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const webp = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const gif = ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));

  if (!png && !jpeg && !webp && !gif) {
    throw new ApiError(400, "File logo bukan gambar yang valid.");
  }
}

function getContentTypeFromFileName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

export function assertInstitutionLogoUploadMetadata(file: Pick<UploadableInstitutionLogoFile, "name" | "size" | "type">) {
  if (file.size <= 0) {
    throw new ApiError(400, "File logo kosong. Pilih gambar yang valid.");
  }

  if (file.size > MAX_INSTITUTION_LOGO_FILE_SIZE) {
    throw new ApiError(413, "Ukuran logo maksimal 2 MB.");
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    throw new ApiError(400, "Logo harus berupa PNG, JPG, WebP, atau GIF.");
  }

  const contentType = file.type?.trim().toLowerCase();
  if (contentType && !SUPPORTED_IMAGE_TYPES.has(contentType)) {
    throw new ApiError(400, "Tipe file logo tidak sesuai. Gunakan PNG, JPG, WebP, atau GIF.");
  }
}

export async function storeInstitutionLogoFile(file: UploadableInstitutionLogoFile) {
  assertInstitutionLogoUploadMetadata(file);

  const buffer = Buffer.from(await file.arrayBuffer());
  assertImageSignature(buffer);

  const directory = getPrimaryInstitutionLogoStorageDirectory();
  await mkdir(directory, { recursive: true });

  const safeFileName = sanitizeStoredLogoFileName(file.name);
  const uniqueFileName = `${Date.now()}-${safeFileName}`;
  const absolutePath = path.resolve(directory, uniqueFileName);
  const relativePath = path.relative(directory, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ApiError(400, "Path logo tidak valid.");
  }

  await writeFile(absolutePath, buffer);

  return {
    fileName: uniqueFileName,
    absolutePath,
    publicUrl: `${INSTITUTION_LOGO_PUBLIC_URL_PREFIX}${uniqueFileName}`,
  };
}

export async function findStoredInstitutionLogoFile(fileName: string) {
  const safeFileName = path.basename(fileName || "");

  if (
    !safeFileName ||
    safeFileName !== fileName ||
    safeFileName.includes("/") ||
    safeFileName.includes("\\") ||
    safeFileName.includes("..") ||
    !SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(safeFileName).toLowerCase())
  ) {
    throw new ApiError(400, "Nama file logo tidak valid.");
  }

  for (const directory of getInstitutionLogoStorageDirectories()) {
    const absolutePath = path.resolve(directory, safeFileName);
    const relativePath = path.relative(directory, absolutePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new ApiError(400, "Path logo tidak valid.");
    }

    try {
      const fileInfo = await stat(absolutePath);
      if (fileInfo.isFile() && fileInfo.size > 0) {
        return {
          fileName: safeFileName,
          absolutePath,
          contentType: getContentTypeFromFileName(safeFileName),
          fileInfo,
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new ApiError(404, "File logo instansi tidak ditemukan di penyimpanan server.");
}
