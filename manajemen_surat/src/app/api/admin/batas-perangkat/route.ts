import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { bacaKebijakanSemua, hapusKebijakan, simpanKebijakan, type Perilaku } from "@/server/modules/perangkat/batas";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Badan = { cakupan?: string; sasaran?: string; maks?: number; perilaku?: string; berlakuSampai?: string; alasan?: string };

/** Peran = Super Admin (perangkat.batas-peran); akun = Admin + Super Admin (perangkat.batas-akun). */
function aksiUntuk(cakupan: unknown) {
  if (cakupan === "peran") return "perangkat.batas-peran" as const;
  if (cakupan === "akun") return "perangkat.batas-akun" as const;
  throw new ApiError(400, "Cakupan harus peran atau akun.");
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanAksi(db, await resolveActorUserId(request), "perangkat.batas-akun");
    return ok({ kebijakan: await bacaKebijakanSemua(db) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const body = await readJsonBody<Badan>(request).catch(() => ({}) as Badan);
    const actor = await pastikanAksi(db, await resolveActorUserId(request), aksiUntuk(body.cakupan));
    try {
      await simpanKebijakan(
        db,
        {
          cakupan: body.cakupan as "peran" | "akun",
          sasaran: String(body.sasaran ?? ""),
          maks: Number(body.maks),
          perilaku: String(body.perilaku ?? "") as Perilaku,
          berlakuSampai: body.berlakuSampai,
          alasan: body.alasan,
        },
        { id: actor.id, nama: actor.name }
      );
    } catch (galat) {
      throw new ApiError(400, galat instanceof Error ? galat.message : "Kebijakan tidak tersimpan.");
    }
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SESSION_DEVICE_LIMIT_UPDATE",
      entityType: "device_limit",
      entityId: `${body.cakupan}:${body.sasaran}`,
      payload: { maks: body.maks, perilaku: body.perilaku, berlakuSampai: body.berlakuSampai ?? "", alasan: body.alasan ?? "" },
    });
    return ok({ kebijakan: await bacaKebijakanSemua(db) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = await getDatabase();
    const cakupan = request.nextUrl.searchParams.get("cakupan");
    const sasaran = String(request.nextUrl.searchParams.get("sasaran") ?? "");
    const actor = await pastikanAksi(db, await resolveActorUserId(request), aksiUntuk(cakupan));
    const n = await hapusKebijakan(db, cakupan as "peran" | "akun", sasaran);
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SESSION_DEVICE_LIMIT_DELETE",
      entityType: "device_limit",
      entityId: `${cakupan}:${sasaran}`,
      payload: { dihapus: n },
    });
    return ok({ dihapus: n, kebijakan: await bacaKebijakanSemua(db) });
  } catch (error) {
    return handleRouteError(error);
  }
}
