import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuSuperAi } from "@/server/modules/aleta-ai/akses";
import { hapusMemoriProyek, putuskanUsulanMemori, ubahMemoriProyek } from "@/server/modules/aleta-ai/proyek-kelola";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - satu memori proyek (SUPER ADMIN SAJA).
 *   PUT {isi}                        -> mengubah isi memori
 *   PUT {putusan: "setuju"|"tolak"}  -> memutuskan usulan dari ALETA Ai (tolak = dihapus)
 *   DELETE                           -> menghapus memori
 */
type Konteks = { params: Promise<{ id: string; memoriId: string }> };

export async function PUT(request: NextRequest, { params }: Konteks) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    const { id, memoriId } = await params;
    const badan = (await request.json().catch(() => ({}))) as { isi?: unknown; putusan?: unknown };
    if (badan.putusan !== undefined) {
      if (badan.putusan !== "setuju" && badan.putusan !== "tolak") throw new ApiError(400, 'Putusan harus "setuju" atau "tolak".');
      await putuskanUsulanMemori(db, pelaku, id, memoriId, badan.putusan === "setuju");
      return ok({ id: memoriId, putusan: badan.putusan });
    }
    return ok(await ubahMemoriProyek(db, pelaku, id, memoriId, badan.isi));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Konteks) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    const { id, memoriId } = await params;
    await hapusMemoriProyek(db, pelaku, id, memoriId);
    return ok({ id: memoriId, dihapus: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
