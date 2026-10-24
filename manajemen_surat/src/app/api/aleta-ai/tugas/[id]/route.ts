import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { ambilAlihTugas, ambilTugas, hentikanTugas, jalankanTugas, pastikanLajuTugas } from "@/server/modules/aleta-ai/tugas";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai tahap 3 - satu tugas. HANYA pemiliknya (Super Admin pun 404:
 * rahasia musyawarah).
 *   GET                         -> tugas + langkah + berkas + hasil
 *   POST {aksi: "hentikan"}     -> berhenti di batas langkah berikutnya (status "dijeda")
 *   POST {aksi: "lanjutkan"}    -> lanjut dari langkah yang belum selesai, DI LATAR
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const { id } = await params;
    return ok(await ambilTugas(db, pelaku, id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const { id } = await params;
    const badan = (await request.json().catch(() => ({}))) as { aksi?: unknown };
    const aksi = String(badan.aksi ?? "");
    if (aksi === "hentikan") return ok(await hentikanTugas(db, pelaku, id));
    if (aksi === "lanjutkan" || aksi === "mulai") {
      await pastikanLajuTugas(db, pelaku);
      const tugas = await ambilAlihTugas(db, pelaku, id);
      void jalankanTugas(db, pelaku, tugas).catch(() => undefined);
      return ok(await ambilTugas(db, pelaku, id));
    }
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleRouteError(error);
  }
}
