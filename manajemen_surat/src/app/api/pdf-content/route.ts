import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDF_UPLOAD_DIR = path.resolve(process.cwd(), "public", "uploads", "pdf");

function buildPdfHeaders(fileName?: string, byteLength?: number, contentType = "application/pdf") {
  return {
    "cache-control": "no-store, no-cache, max-age=0, must-revalidate",
    pragma: "no-cache",
    expires: "0",
    "content-type": contentType,
    "content-disposition": `inline; filename="${fileName ?? "document.pdf"}"`,
    ...(typeof byteLength === "number" ? { "content-length": String(byteLength) } : {}),
  };
}

function resolveLocalPdfPath(documentUrl: string) {
  const normalizedPath = documentUrl.startsWith("/") ? documentUrl.slice(1) : documentUrl;
  const absolutePath = path.resolve(process.cwd(), "public", normalizedPath);

  if (!absolutePath.startsWith(PDF_UPLOAD_DIR)) {
    throw new ApiError(400, "Path PDF tidak valid.");
  }

  return absolutePath;
}

async function fetchRemotePdf(documentUrl: string) {
  const response = await fetch(documentUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(response.status, `Gagal mengambil PDF eksternal (${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  return new NextResponse(buffer, {
    headers: buildPdfHeaders(
      path.basename(new URL(documentUrl).pathname) || "document.pdf",
      buffer.byteLength,
      response.headers.get("content-type") || "application/pdf"
    ),
  });
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const documentUrl = request.nextUrl.searchParams.get("file");

    if (!documentUrl) {
      throw new ApiError(400, "Query parameter 'file' wajib diisi.");
    }

    if (documentUrl.startsWith("http://") || documentUrl.startsWith("https://")) {
      return fetchRemotePdf(documentUrl);
    }

    const absolutePath = resolveLocalPdfPath(documentUrl);
    const fileInfo = await stat(absolutePath);

    if (!fileInfo.isFile()) {
      throw new ApiError(404, "File PDF tidak ditemukan.");
    }

    const buffer = await readFile(absolutePath);

    return new NextResponse(buffer, {
      headers: buildPdfHeaders(path.basename(absolutePath), buffer.byteLength),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
