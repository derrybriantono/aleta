import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  KETERANGAN_KAPABILITAS,
  bacaAksesEkstensi,
  kapabilitasPeran,
  simpanAksesEkstensi,
} from "@/server/modules/aleta-ecourt/akses";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { type RoleId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Akses ekstensi ALETA E-Court per peran.
 *
 * ============================================================================
 * SATU RUTE, DUA PEMBACA YANG BERBEDA
 * ============================================================================
 *
 * Ekstensi menanyakan "saya boleh apa" - dan hanya itu yang dijawab kepadanya.
 * Halaman pengaturan menanyakan seluruh matriks peran, dan itu hanya dijawab
 * kepada Super Admin dan Admin.
 *
 * Perbedaannya penting: daftar lengkap peran beserta kewenangannya adalah peta
 * cara menembus penjagaan ini. Tidak ada alasan seorang staf perlu tahu peran
 * mana saja yang boleh mengunduh berkas.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    const kemampuanSaya = await kapabilitasPeran(db, actor.roleId as RoleId);
    const penuh = isPrivilegedAdmin(actor);

    if (!penuh) {
      return ok({
        available: true,
        saya: kemampuanSaya,
        bolehMengatur: false,
        peran: [],
        keterangan: KETERANGAN_KAPABILITAS,
      });
    }

    return ok({
      available: true,
      // Super Admin dan Admin selalu penuh, tanpa melihat tabel sama sekali.
      saya: { panel: true, berkas: true, permintaan: true },
      bolehMengatur: true,
      peran: await bacaAksesEkstensi(db),
      keterangan: KETERANGAN_KAPABILITAS,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_EXTENSION_ACCESS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

/** Menyalakan atau mematikan satu kemampuan bagi satu peran. */
export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const body = await readJsonBody<{
      roleId?: string;
      kapabilitas?: string;
      aktif?: boolean;
    }>(request);

    const peran = await simpanAksesEkstensi(db, {
      actorUserId: String(actorUserId || ""),
      roleId: String(body.roleId || "") as RoleId,
      kapabilitas: String(body.kapabilitas || ""),
      aktif: Boolean(body.aktif),
    });

    return ok({ available: true, peran, keterangan: KETERANGAN_KAPABILITAS });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_EXTENSION_ACCESS_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
