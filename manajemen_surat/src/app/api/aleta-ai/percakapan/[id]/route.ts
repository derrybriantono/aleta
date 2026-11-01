import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { ambilMilik, ambilPercakapan, sembunyikanPercakapan, ubahJudul } from "@/server/modules/aleta-ai/percakapan";
import { setPilihanPercakapan } from "@/server/modules/aleta-ai/proyek-kelola";
import { ApiError } from "@/server/shared/errors";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - satu percakapan. HANYA pemiliknya; Super Admin pun mendapat 404
 * (rahasia musyawarah).
 *   GET    -> {id, judul, pesan:[{id, peran, isi, mode?, biayaRp?, waktu}], proyekId}
 *   PATCH  {judul?, proyekId?} -> {id, judul?, proyekId?}   (proyekId "" = proyek bawaan satker)
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
    const badan = (await request.json().catch(() => ({}))) as { judul?: unknown; proyekId?: unknown };
    if (badan.proyekId !== undefined) {
      if (!(await ambilMilik(db, pelaku.id, id))) throw new ApiError(404, "Percakapan tidak ditemukan.");
      const pilihan = await setPilihanPercakapan(db, pelaku, id, String(badan.proyekId ?? ""));
      if (badan.judul === undefined) return ok({ id, ...pilihan });
    }
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
