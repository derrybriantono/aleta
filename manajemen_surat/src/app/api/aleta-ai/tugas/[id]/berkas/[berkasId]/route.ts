import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { unduhBerkas } from "@/server/modules/aleta-ai/tugas";
import { resolveActorUserId } from "@/server/shared/auth";
import { buildAttachmentContentDisposition, getAttachmentSecurityHeaders } from "@/server/shared/download-headers";
import { handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ALETA Ai tahap 3 - unduh berkas keluaran tugas (data asli). Hanya pemilik tugas. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; berkasId: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const { id, berkasId } = await params;
    const b = await unduhBerkas(db, pelaku, id, berkasId);
    return new Response(new Uint8Array(b.bita), {
      headers: { ...getAttachmentSecurityHeaders(), "content-type": b.mime, "content-disposition": buildAttachmentContentDisposition(b.nama), "content-length": String(b.bita.length) },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
