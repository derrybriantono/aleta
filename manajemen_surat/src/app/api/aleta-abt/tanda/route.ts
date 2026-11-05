import { type NextRequest } from "next/server";

import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { buatTanda } from "@/server/modules/aleta-abt-cetak/tanda";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tanda berumur pendek untuk layar cetak/simpan ALETA ABT (5 Nov 2026, Tahap 5; keputusan 206).
 *
 *   GET ?ekstensi=<versi ekstensi yang terbaca layar>   ->  { tanda, berlakuSampai }   (Super Admin saja)
 *
 * Layar mengirim versi ekstensi dari penanda <html data-aleta-ekstensi> yang dipasang skrip jembatan ekstensi di PC. Tanda
 * berlaku 10 menit dan terikat pada akun. TANDA BUKAN KUNCI KEAMANAN: pengaman utamanya akun (Super Admin) yang diputuskan
 * di server pada setiap permintaan cetak/simpan; penanda ekstensi dapat dipalsukan oleh Super Admin sendiri. Tanpa ekstensi
 * (HP) layar tidak memanggil rute ini; penjaga lalu memakai hak ALETA ABT di HP.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    if (String(getEffectiveRoleId(actor) ?? actor.roleId ?? "") !== "super-admin") throw new ApiError(403, "Layar cetak ALETA ABT hanya untuk Super Admin.");
    const t = buatTanda(String(actor.id), getSearchParam(request, "ekstensi") ?? "");
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: "ALETA_ABT_TANDA_DITERBITKAN",
      entityType: "aleta_abt_cetak",
      entityId: "tanda",
      payload: { berlakuSampai: t.berlakuSampai },
    });
    return ok(t, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ALETA_ABT_TANDA_FAILED",
      feature: "aleta_abt",
      entityId: "aleta-abt-tanda",
    });
  }
}
