import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { kirimPesan, type EventAi } from "@/server/modules/aleta-ai/mesin";
import { ambilMilik } from "@/server/modules/aleta-ai/percakapan";
import { aliranSse, HEADER_SSE } from "@/server/modules/aleta-ai/sse";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Jawaban panjang (berpikir + penulisan) dapat melebihi beberapa menit.
export const maxDuration = 800;

/**
 * ALETA Ai - POST /api/aleta-ai/percakapan/[id]/pesan   body {teks, pemicu?}
 *
 * Menjawab SSE (text/event-stream), satu `data: {json}` per peristiwa:
 *   {jenis:'perkiraan', mode, label, perkiraanRp}
 *   {jenis:'teks', delta}
 *   {jenis:'selesai', pesanId, mode, label, biayaRp, saldoRp}
 *   {jenis:'gagal', pesan}
 * Galat sebelum aliran dimulai (belum masuk, percakapan bukan milik sendiri)
 * dijawab JSON biasa {ok:false, error:{message}} dengan status HTTP-nya.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const { id } = await params;
    // Bukan milik sendiri (termasuk Super Admin): 404 biasa, bukan aliran.
    if (!(await ambilMilik(db, pelaku.id, id))) throw new ApiError(404, "Percakapan tidak ditemukan.");
    const badan = (await request.json().catch(() => ({}))) as { teks?: unknown; pemicu?: unknown };

    const kendali = new AbortController();
    request.signal.addEventListener("abort", () => kendali.abort(), { once: true });
    const generator: AsyncGenerator<EventAi, void, void> = kirimPesan(
      db,
      pelaku,
      id,
      { teks: String(badan.teks ?? ""), pemicu: String(badan.pemicu ?? "") },
      { sinyal: kendali.signal }
    );
    return new Response(aliranSse(generator, () => kendali.abort()), { status: 200, headers: HEADER_SSE });
  } catch (error) {
    return handleRouteError(error);
  }
}
