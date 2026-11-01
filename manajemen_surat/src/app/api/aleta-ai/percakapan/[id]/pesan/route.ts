import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi, pelakuAiBerhak } from "@/server/modules/aleta-ai/akses";
import { masukanDariBadan, type BadanFitur } from "@/server/modules/aleta-ai/fitur-blangko";
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
 * ALETA Ai - POST /api/aleta-ai/percakapan/[id]/pesan   body {teks, pemicu?} atau, untuk fitur bantu panel Blangko Derry,
 * {fitur: "A1".."E3", bahan: {...}, proyekId?} (pesan tugas disusun server dari bahan; lihat lib/aleta-ai/fitur-blangko.ts)
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
    const aktorId = await resolveActorUserId(request);
    const badan = (await request.json().catch(() => ({}))) as BadanFitur;
    // Permintaan dari alat bantu panel (fitur / menu proyek dengan bahan): peran yang aplikasinya belum dibuka ditolak dengan kalimat biasa.
    const dariPanel = Boolean(String(badan.fitur ?? "").trim() || (badan.bahan && typeof badan.bahan === "object"));
    const pelaku = dariPanel ? await pelakuAiBerhak(db, aktorId, "aleta-ai.dompet") : await pelakuAi(db, aktorId);
    const { id } = await params;
    // Bukan milik sendiri (termasuk Super Admin): 404 biasa, bukan aliran.
    if (!(await ambilMilik(db, pelaku.id, id))) throw new ApiError(404, "Percakapan tidak ditemukan.");
    const masukan = masukanDariBadan(badan);

    const kendali = new AbortController();
    request.signal.addEventListener("abort", () => kendali.abort(), { once: true });
    const generator: AsyncGenerator<EventAi, void, void> = kirimPesan(
      db,
      pelaku,
      id,
      masukan,
      { sinyal: kendali.signal }
    );
    return new Response(aliranSse(generator, () => kendali.abort()), { status: 200, headers: HEADER_SSE });
  } catch (error) {
    return handleRouteError(error);
  }
}
