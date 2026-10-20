import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { tampilSaldo } from "@/server/modules/aleta-ai/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ALETA Ai - GET /api/aleta-ai/saldo -> {saldoRp, mutasi:[...]} milik sendiri. */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    return ok(await tampilSaldo(db, pelaku));
  } catch (error) {
    return handleRouteError(error);
  }
}
