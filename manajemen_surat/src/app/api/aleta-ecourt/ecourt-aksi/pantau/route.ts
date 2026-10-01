import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { kalimatAlasan, panggilBot } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keadaan dan pengaturan pemantau putusan e-Court (E11). */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    const hasil = await panggilBot<Record<string, unknown>>("/ecourt-aksi/pantau-putusan");
    if (!hasil.ok) return ok({ tersedia: false, pesan: kalimatAlasan(hasil.alasan), keadaan: null });
    return ok({ tersedia: true, pesan: "", keadaan: hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PANTAU_PUTUSAN_READ_FAILED",
      feature: "ecourt_aksi",
      entityId: "pantau",
    });
  }
}

/** Hanya Super Admin dan Admin yang mengubah jarak dan batas pemantau. */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    if (!isPrivilegedAdmin(actor)) throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengatur pemantau putusan.");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const isi: Record<string, unknown> = {};
    if (typeof body.aktif === "boolean") isi.aktif = body.aktif;
    for (const k of ["jarakMenit", "maksPerJam", "jedaUlangJam", "rentangHari"]) {
      if (body[k] !== undefined && Number.isFinite(Number(body[k]))) isi[k] = Number(body[k]);
    }
    const hasil = await panggilBot<Record<string, unknown>>("/ecourt-aksi/pantau-putusan", { method: "POST", body: isi });
    if (!hasil.ok) return ok({ tersedia: false, pesan: kalimatAlasan(hasil.alasan), keadaan: null });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ECOURT_PANTAU_PUTUSAN",
      entityType: "ecourt_pantau_putusan",
      entityId: "pengaturan",
      payload: isi,
    });
    return ok({ tersedia: true, pesan: "", keadaan: hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PANTAU_PUTUSAN_UPDATE_FAILED",
      feature: "ecourt_aksi",
      entityId: "pantau",
    });
  }
}
