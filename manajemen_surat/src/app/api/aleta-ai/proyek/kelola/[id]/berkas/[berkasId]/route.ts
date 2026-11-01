import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuSuperAi } from "@/server/modules/aleta-ai/akses";
import { bacaBerkasPengetahuan, hapusBerkasPengetahuan, ubahBerkasPengetahuan } from "@/server/modules/aleta-ai/proyek-kelola";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - satu berkas pengetahuan (SUPER ADMIN SAJA).
 *   GET    -> {id, nama, jenis, ukuran, teks, selalu, diubah}
 *   PUT    {nama?, teks?, selalu?} -> menyunting isi teks hasil bacaan, nama, atau tanda "selalu ikut"
 *   DELETE -> berkas dihapus
 */
type Konteks = { params: Promise<{ id: string; berkasId: string }> };

export async function GET(request: NextRequest, { params }: Konteks) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    const { id, berkasId } = await params;
    return ok(await bacaBerkasPengetahuan(db, pelaku, id, berkasId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest, { params }: Konteks) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    const { id, berkasId } = await params;
    const badan = (await request.json().catch(() => ({}))) as { nama?: unknown; teks?: unknown; selalu?: unknown };
    return ok(await ubahBerkasPengetahuan(db, pelaku, id, berkasId, badan));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Konteks) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    const { id, berkasId } = await params;
    await hapusBerkasPengetahuan(db, pelaku, id, berkasId);
    return ok({ id: berkasId, dihapus: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
