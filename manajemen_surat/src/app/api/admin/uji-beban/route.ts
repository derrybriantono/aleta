import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { daftarUjiBeban, imporUjiBeban } from "@/server/modules/kesehatan/layanan";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hasil uji beban (E1/E2).
 *   GET   -> hasil yang sudah diimpor (terbaru dulu)
 *   POST  -> impor berkas JSON dari scripts/uji-beban.mjs (Super Admin, aksi "kesehatan.atur").
 *            Berkas yang sasarannya bukan localhost ditolak: uji beban hanya sah dari kembaran laptop.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanAksi(db, await resolveActorUserId(request), "kesehatan.lihat");
    return ok({ hasil: await daftarUjiBeban(db, 20) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "kesehatan.atur");
    const berkas = await readJsonBody<unknown>(request).catch(() => null);
    const ringkas = await imporUjiBeban(db, berkas, actor.name ?? actor.id);
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "IMPOR_UJI_BEBAN",
      entityType: "aleta_uji_beban_hasil",
      entityId: ringkas.id,
      payload: { perangkat: ringkas.perangkat, p95Ms: ringkas.p95Ms, galatPersen: ringkas.galatPersen },
    });
    return ok({ hasil: ringkas });
  } catch (error) {
    return handleRouteError(error);
  }
}
