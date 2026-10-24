import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { kirimanUntukAlur } from "@/server/modules/aleta-ai/kiriman";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai tahap 3 - dibaca alur tujuan (Blangko ABT by Derry / Draf H-7 / BAS):
 * GET ?tujuan=draf-h7&perkara=<nomor> -> kiriman TERKONFIRMASI milik pengguna.
 * Petugas yang menempel/menyimpannya di alur itu; tidak ada tulis ke SIPP/ABT.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const q = request.nextUrl.searchParams;
    return ok(await kirimanUntukAlur(db, pelaku, String(q.get("tujuan") ?? ""), String(q.get("perkara") ?? "")));
  } catch (error) {
    return handleRouteError(error);
  }
}
