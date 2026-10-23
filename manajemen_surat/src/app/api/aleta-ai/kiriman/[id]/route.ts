import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { konfirmasiKiriman } from "@/server/modules/aleta-ai/kiriman";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ALETA Ai tahap 3 - langkah 2: konfirmasi petugas atas pratinjau. POST {setuju: true|false}. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const { id } = await params;
    const badan = (await request.json().catch(() => ({}))) as { setuju?: unknown };
    if (typeof badan.setuju !== "boolean") throw new ApiError(400, "Konfirmasi wajib berisi setuju: true atau false.");
    return ok(await konfirmasiKiriman(db, pelaku, id, badan.setuju));
  } catch (error) {
    return handleRouteError(error);
  }
}
