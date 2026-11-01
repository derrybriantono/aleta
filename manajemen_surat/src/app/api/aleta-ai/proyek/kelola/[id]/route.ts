import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuSuperAi } from "@/server/modules/aleta-ai/akses";
import { hapusProyekKelola, rincianProyekKelola, ubahProyekKelola } from "@/server/modules/aleta-ai/proyek-kelola";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - satu proyek kelolaan (SUPER ADMIN SAJA).
 *   GET    -> rincian: pengaturan, instruksi, daftar berkas (tanpa isi), memori + usulan, riwayat
 *   PUT    {nama?, deskripsi?, instruksi?, sertakanBawaan?, akses?, aksesPeran?, aksesPengguna?, memoriAktif?, aktif?}
 *   DELETE -> proyek, berkas, dan memorinya dihapus
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    return ok(await rincianProyekKelola(db, pelaku, (await params).id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return ok(await ubahProyekKelola(db, pelaku, (await params).id, badan));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    const { id } = await params;
    await hapusProyekKelola(db, pelaku, id);
    return ok({ id, dihapus: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
