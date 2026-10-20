import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { ambilPercakapan, sembunyikanPercakapan, ubahJudul } from "@/server/modules/aleta-ai/percakapan";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - satu percakapan. HANYA pemiliknya; Super Admin pun mendapat 404
 * (rahasia musyawarah).
 *   GET    -> {id, judul, pesan:[{id, peran, isi, mode?, biayaRp?, waktu}]}
 *   PATCH  {judul} -> {id, judul}
 *   DELETE -> disembunyikan (bukan dihapus permanen)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const { id } = await params;
    return ok(await ambilPercakapan(db, pelaku.id, id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const { id } = await params;
    const badan = (await request.json().catch(() => ({}))) as { judul?: unknown };
    return ok(await ubahJudul(db, pelaku.id, id, String(badan.judul ?? "")));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const { id } = await params;
    await sembunyikanPercakapan(db, pelaku.id, id);
    return ok({ id, disembunyikan: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
