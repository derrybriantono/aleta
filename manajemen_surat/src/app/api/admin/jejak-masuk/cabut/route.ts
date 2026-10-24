import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { ipKlien } from "@/server/modules/perangkat/jaringan";
import { cabutSesiAkun } from "@/server/modules/perangkat/sesi";
import { sesiPemanggil } from "@/server/modules/perangkat/sesi-pemanggil";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin mengeluarkan sesi akun mana pun: satu perangkat atau semuanya. */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await pastikanAksi(db, actorUserId, "jejak-masuk.lihat");
    const body = await readJsonBody<{ userId?: string; perangkatId?: string; semua?: boolean }>(request).catch(
      () => ({}) as { userId?: string; perangkatId?: string; semua?: boolean }
    );
    const userId = String(body.userId ?? "").trim();
    if (!userId) throw new ApiError(400, "Akun belum dipilih.");
    if (!body.semua && !body.perangkatId) throw new ApiError(400, "Pilih perangkat yang dikeluarkan.");
    const sesi = await sesiPemanggil(request.headers);
    const dicabut = await cabutSesiAkun(db, {
      userId,
      alasan: "oleh-admin",
      pelaku: { id: actor.id, nama: actor.name },
      perangkatId: body.semua ? undefined : String(body.perangkatId),
      semua: Boolean(body.semua),
      // Admin yang mengeluarkan "semua" dari akunnya sendiri tidak ikut terputus.
      kecualiSessionId: userId === actor.id ? sesi?.sessionId ?? null : null,
      ip: ipKlien(request.headers),
    });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SESSION_REVOKE",
      entityType: "user",
      entityId: userId,
      payload: { perangkatId: body.perangkatId ?? "", semua: Boolean(body.semua), dicabut },
    });
    return ok({ dicabut });
  } catch (error) {
    return handleRouteError(error);
  }
}
