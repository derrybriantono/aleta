import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { daftarAkunBelumMemenuhi, setPaksaGanti } from "@/server/modules/keamanan/kebijakan-sandi";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Menandai (atau menarik tanda) "ganti sandi pada masuk berikutnya" untuk satu akun. Super Admin. */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "keamanan.atur");
    const body = await readJsonBody<{ userId?: string; paksa?: boolean }>(request).catch(() => ({}) as { userId?: string; paksa?: boolean });
    const userId = String(body.userId ?? "").trim();
    const paksa = body.paksa !== false;
    await setPaksaGanti(db, userId, paksa, actor.id);
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: paksa ? "SECURITY_PASSWORD_FORCE_CHANGE" : "SECURITY_PASSWORD_FORCE_CHANGE_CANCEL",
      entityType: "user",
      entityId: userId,
      payload: { paksa },
    });
    return ok({ belumMemenuhi: await daftarAkunBelumMemenuhi(db) });
  } catch (error) {
    return handleRouteError(error);
  }
}
