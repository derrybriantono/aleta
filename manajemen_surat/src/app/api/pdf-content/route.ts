import { readFile } from "node:fs/promises";

import { NextRequest } from "next/server";

import { getAccessibleLetters } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { listDispositionsFromDb } from "@/server/modules/dispositions/service";
import { searchLettersInDb } from "@/server/modules/letters/service";
import { getPositionsFromDb, requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getAttachmentSecurityHeaders, getInlineFileSecurityHeaders } from "@/server/shared/download-headers";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { findStoredPdfFile, getLocalPdfFileName, sanitizePdfDownloadFileName } from "@/server/shared/pdf-storage";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildContentDisposition(disposition: "inline" | "attachment", fileName?: string) {
  const safeFileName = sanitizePdfDownloadFileName(fileName);

  return `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`;
}

function buildPdfHeaders({
  fileName,
  byteLength,
  contentType = "application/pdf",
  disposition = "inline",
  preview = false,
}: {
  fileName?: string;
  byteLength?: number;
  contentType?: string;
  disposition?: "inline" | "attachment";
  preview?: boolean;
}) {
  const headers: Record<string, string> = {
    ...(disposition === "attachment" ? getAttachmentSecurityHeaders() : getInlineFileSecurityHeaders()),
    "content-type": contentType,
    "accept-ranges": "none",
    ...(typeof byteLength === "number" ? { "content-length": String(byteLength) } : {}),
    ...(typeof byteLength === "number" ? { "x-aleta-pdf-bytes": String(byteLength) } : {}),
  };

  if (!preview || disposition === "attachment") {
    headers["content-disposition"] = buildContentDisposition(disposition, fileName);
  }

  return headers;
}

function toResponseBody(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);

  return arrayBuffer;
}

async function assertActorCanReadPdf(
  db: Awaited<ReturnType<typeof getDatabase>>,
  actorUser: Awaited<ReturnType<typeof requireActorUser>>,
  documentUrl: string,
  fileName: string
) {
  const [letters, dispositions, positions] = await Promise.all([
    searchLettersInDb(db, { limit: 5000 }),
    listDispositionsFromDb(db),
    getPositionsFromDb(db),
  ]);
  const accessibleLetters = getAccessibleLetters(actorUser, letters, dispositions, positions);
  const canRead = accessibleLetters.some((letter) => {
    if (!letter.documentUrl) return false;

    try {
      return getLocalPdfFileName(letter.documentUrl) === fileName;
    } catch {
      return letter.documentUrl.trim() === documentUrl.trim();
    }
  });

  if (!canRead) {
    throw new ApiError(403, "Anda tidak memiliki akses ke dokumen PDF ini.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actorUser = await requireActorUser(db, actorUserId);

    const documentUrl = request.nextUrl.searchParams.get("file");
    const requestedFileName = request.nextUrl.searchParams.get("name");
    const isDownload = request.nextUrl.searchParams.get("download") === "1";
    const isPreview = request.nextUrl.searchParams.get("preview") === "1" && !isDownload;
    const disposition = isDownload ? "attachment" : "inline";

    if (!documentUrl) {
      throw new ApiError(400, "Query parameter 'file' wajib diisi.");
    }

    if (documentUrl.startsWith("http://") || documentUrl.startsWith("https://")) {
      throw new ApiError(400, "PDF eksternal tidak diizinkan. Unggah PDF ke penyimpanan internal ALETA.");
    }

    const storedFile = await findStoredPdfFile(documentUrl);
    await assertActorCanReadPdf(db, actorUser, documentUrl, storedFile.fileName);
    const buffer = await readFile(storedFile.absolutePath);
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actorUser.id,
      action: isDownload ? "DOWNLOAD_PDF" : "VIEW_PDF",
      entityType: "pdf",
      entityId: storedFile.fileName,
      payload: {
        fileName: storedFile.fileName,
        requestedFileName,
        preview: isPreview,
        byteLength: buffer.byteLength,
        ...getRequestAuditMetadata(request),
      },
    });

    return new Response(toResponseBody(buffer), {
      headers: buildPdfHeaders({
        fileName: requestedFileName ?? storedFile.fileName,
        byteLength: buffer.byteLength,
        disposition,
        preview: isPreview,
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
