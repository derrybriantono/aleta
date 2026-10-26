import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { wajibGantiSandi } from "@/server/modules/keamanan/kebijakan-sandi";
import { requireActorUser } from "@/server/modules/organization/service";
import { sesiPemanggil } from "@/server/modules/perangkat/sesi-pemanggil";
import { updateManagedUserInDb } from "@/server/modules/users/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";
import { readJsonBody } from "@/server/shared/request";
import { hashSecret } from "@/server/shared/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ganti sandi sendiri DENGAN sandi lama (Bagian 6a) - dipakai layar "Ganti sandi
 * sekarang" yang muncul bila kebijakan sandi menyala dan akun dipaksa ganti atau
 * sandinya kedaluwarsa. Aturan sandi baru ditegakkan updateManagedUserInDb (kebijakan
 * sandi); sesi pemanggil dipertahankan, sesi perangkat lain akun ini dicabut.
 * Jalur lama (halaman Akun) tidak diubah.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    assertRateLimit("ganti-sandi", request, actor.id);
    const body = await readJsonBody<{ sandiLama?: string; sandiBaru?: string }>(request).catch(() => ({}) as { sandiLama?: string; sandiBaru?: string });
    const lama = String(body.sandiLama ?? "");
    const baru = String(body.sandiBaru ?? "").trim();
    if (!lama || !baru) throw new ApiError(400, "Isi sandi lama dan sandi baru.");

    const baris = await db.queryOne<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL", [actor.id]);
    if (!baris?.password_hash || baris.password_hash !== hashSecret(lama)) {
      recordRateLimitFailure("ganti-sandi", request, actor.id);
      throw new ApiError(400, "Sandi lama tidak cocok.");
    }
    if (lama === baru) throw new ApiError(400, "Sandi baru harus berbeda dari sandi lama.");

    await updateManagedUserInDb(db, {
      actorUserId: actor.id,
      userId: actor.id,
      payload: { password: baru },
      sesiPemanggilId: (await sesiPemanggil(request.headers))?.sessionId ?? null,
    });
    clearRateLimit("ganti-sandi", request, actor.id);
    const sisa = await wajibGantiSandi(db, actor.id);
    return ok({ diganti: true, masihWajib: sisa.wajib });
  } catch (error) {
    return handleRouteError(error);
  }
}
