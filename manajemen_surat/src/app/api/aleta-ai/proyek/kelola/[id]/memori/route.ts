import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuSuperAi } from "@/server/modules/aleta-ai/akses";
import { daftarMemoriProyek, tambahMemoriProyek } from "@/server/modules/aleta-ai/proyek-kelola";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - memori proyek (SUPER ADMIN SAJA).
 *   GET  -> [{id, isi, status: "disetujui" | "usulan", sumber, dibuat}]
 *   POST {isi} -> menambah memori (langsung disetujui)
 * Memori berstatus "usulan" berasal dari ALETA Ai dan baru ikut ke prompt setelah disetujui.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    return ok(await daftarMemoriProyek(db, pelaku, (await params).id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    const badan = (await request.json().catch(() => ({}))) as { isi?: unknown };
    return ok(await tambahMemoriProyek(db, pelaku, (await params).id, badan.isi), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
