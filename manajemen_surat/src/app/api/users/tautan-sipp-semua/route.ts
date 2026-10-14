import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  batalkanTautanMassal,
  pratinjauTautanSemua,
  terapkanTautanSemua,
  type DepsTautanSemua,
  type JawabanDaftarSipp,
} from "@/server/modules/portal/tautan-semua-sipp";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Tautkan semua ke SIPP" (14 Okt 2026) - lihat
 * src/server/modules/portal/tautan-semua-sipp.ts.
 *
 *   GET  /api/users/tautan-sipp-semua                      -> pratinjau (tidak menulis)
 *   POST { aksi: "terapkan", tautkan: [{userId, usernameSipp}], buat: [usernameSipp], subPeran: [userId] }
 *   POST { aksi: "batal", userId }
 *
 * Hanya Admin / Super Admin. Tidak ada password di permintaan maupun jawaban.
 */
const deps: DepsTautanSemua = {
  daftarSipp: async () => (await callAletaBotSippBridge("user.daftarSipp", {}, { timeoutMs: 20_000 })) as JawabanDaftarSipp,
};

async function aktorAdmin(request: NextRequest) {
  const db = await getDatabase();
  const actorId = await resolveActorUserId(request);
  const actor = await requireActorUser(db, actorId);
  if (!isPrivilegedAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat menautkan akun ke SIPP.");
  return { db, actorId, actor };
}

export async function GET(request: NextRequest) {
  let actorId = "";
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  try {
    const sesi = await aktorAdmin(request);
    db = sesi.db;
    actorId = sesi.actorId;
    return ok(await pratinjauTautanSemua(sesi.db, deps));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId: actorId,
      action: "SIPP_BULK_LINK_PREVIEW_FAILED",
      feature: "user_management",
    });
  }
}

export async function POST(request: NextRequest) {
  let actorId = "";
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  try {
    const sesi = await aktorAdmin(request);
    db = sesi.db;
    actorId = sesi.actorId;
    const aktor = { id: sesi.actor.id, roleId: String(sesi.actor.roleId) };
    const badan = (await request.json().catch(() => ({}))) as {
      aksi?: unknown;
      userId?: unknown;
      tautkan?: unknown;
      buat?: unknown;
      subPeran?: unknown;
    };
    if (badan.aksi === "batal") {
      const userId = String(badan.userId ?? "").trim();
      if (!userId) throw new ApiError(400, "userId wajib diisi.");
      return ok(await batalkanTautanMassal(sesi.db, aktor, userId));
    }
    if (badan.aksi === "terapkan") {
      const tautkan = (Array.isArray(badan.tautkan) ? badan.tautkan : [])
        .slice(0, 500)
        .map((p) => ({
          userId: String((p as { userId?: unknown })?.userId ?? "").slice(0, 80),
          usernameSipp: String((p as { usernameSipp?: unknown })?.usernameSipp ?? "").slice(0, 60),
        }));
      const buat = (Array.isArray(badan.buat) ? badan.buat : []).slice(0, 500).map((u) => String(u ?? "").slice(0, 60));
      const subPeran = (Array.isArray(badan.subPeran) ? badan.subPeran : []).slice(0, 500).map((u) => String(u ?? "").slice(0, 80));
      return ok(await terapkanTautanSemua(sesi.db, deps, aktor, { tautkan, buat, subPeran }));
    }
    throw new ApiError(400, "Aksi harus 'terapkan' atau 'batal'.");
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId: actorId,
      action: "SIPP_BULK_LINK_APPLY_FAILED",
      feature: "user_management",
    });
  }
}
