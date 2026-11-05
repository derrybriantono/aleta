import { type NextRequest } from "next/server";

import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { bacaLayarAbtHp, hakAbtHpUntuk, simpanUbahanAbtHp } from "@/server/modules/aleta-abt/hak-hp";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hak ALETA ABT di HP (5 Nov 2026).
 *
 *   GET                       hak akun yang masuk: { terbuka, sumber }   (semua akun masuk)
 *   GET ?bagian=pengaturan[&cari=]   peran + pengguna dengan pilihannya   (Super Admin saja)
 *   POST {tindakan:"ubah-peran", id, nilai: true|false|"bawaan"}          (Super Admin saja, tercatat di audit)
 *   POST {tindakan:"ubah-pengguna", id, nilai: "ikuti"|"aktif"|"mati"}    (Super Admin saja, tercatat di audit)
 *
 * Menolak diputuskan di sini; menyembunyikan menu/tombol di layar hanya merapikan tampilan.
 */
async function aktorDari(request: NextRequest) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  const actor = await requireActorUser(db, actorUserId);
  const roleId = String(getEffectiveRoleId(actor) ?? actor.roleId ?? "");
  return { db, actorUserId, actor, roleId, superAdmin: roleId === "super-admin" };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorDari(request);
    db = a.db;
    actorUserId = a.actorUserId;
    const bagian = getSearchParam(request, "bagian") ?? "";
    if (bagian === "pengaturan") {
      if (!a.superAdmin) throw new ApiError(403, "Pengaturan ALETA ABT di HP hanya untuk Super Admin.");
      return ok(await bacaLayarAbtHp(a.db, getSearchParam(request, "cari") ?? ""));
    }
    if (bagian) throw new ApiError(400, "Bagian tidak dikenal.");
    return ok(await hakAbtHpUntuk(a.db, { id: a.actor.id, roleId: a.roleId }));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ALETA_ABT_HP_READ_FAILED",
      feature: "aleta_abt",
      entityId: "aleta-abt-hp",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorDari(request);
    db = a.db;
    actorUserId = a.actorUserId;
    if (!a.superAdmin) throw new ApiError(403, "Hanya Super Admin yang dapat mengubah pengaturan ALETA ABT di HP.");
    let badan: Record<string, unknown> = {};
    try {
      const isi = (await request.json()) as unknown;
      if (isi && typeof isi === "object" && !Array.isArray(isi)) badan = isi as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    const id = String(badan.id ?? "").trim();
    const aktor = { id: a.actor.id, name: a.actor.name };
    switch (String(badan.tindakan ?? "")) {
      case "ubah-peran":
        if (typeof badan.nilai !== "boolean" && badan.nilai !== "bawaan") throw new ApiError(400, "Pilihan peran tidak sah.");
        return ok(await simpanUbahanAbtHp(a.db, aktor, { jenis: "peran", id, nilai: badan.nilai }));
      case "ubah-pengguna":
        if (badan.nilai !== "ikuti" && badan.nilai !== "aktif" && badan.nilai !== "mati") throw new ApiError(400, "Pilihan pengguna tidak sah.");
        return ok(await simpanUbahanAbtHp(a.db, aktor, { jenis: "pengguna", id, nilai: badan.nilai }));
      default:
        throw new ApiError(400, "Tindakan tidak dikenal.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ALETA_ABT_HP_WRITE_FAILED",
      feature: "aleta_abt",
      entityId: "aleta-abt-hp",
    });
  }
}
