import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { tegakkanPengaman } from "@/server/modules/keamanan/pengaman-aksi";
import { bacaSetelanJejak, simpanSetelanJejak, type SetelanJejak } from "@/server/modules/perangkat/jejak";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Setelan riwayat masuk: retensi, jam kerja, saklar akun Windows. Baca = Admin; ubah = Super Admin. */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanAksi(db, await resolveActorUserId(request), "jejak-masuk.lihat");
    return ok({ setelan: await bacaSetelanJejak(db) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "perangkat.batas-peran");
    const body = await readJsonBody<Partial<SetelanJejak>>(request).catch(() => ({}) as Partial<SetelanJejak>);
    // Pengaman aksi admin (Bagian 6c): hanya saat masa simpan riwayat masuk benar-benar berubah.
    if (body.retensiHari !== undefined && Number(body.retensiHari) !== (await bacaSetelanJejak(db)).retensiHari) {
      await tegakkanPengaman(db, request, actor, "audit.ubah-retensi", { rincian: { retensiHari: Number(body.retensiHari) } });
    }
    let setelan: SetelanJejak;
    try {
      setelan = await simpanSetelanJejak(db, body, actor.id);
    } catch (galat) {
      throw new ApiError(400, galat instanceof Error ? galat.message : "Setelan tidak tersimpan.");
    }
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SESSION_LOGIN_SETTINGS_UPDATE",
      entityType: "login_settings",
      entityId: "jejak-masuk",
      payload: setelan,
    });
    return ok({ setelan });
  } catch (error) {
    return handleRouteError(error);
  }
}
