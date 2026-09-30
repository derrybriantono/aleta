import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaPemetaanBlangko, simpanPemetaanBlangko } from "@/server/modules/aleta-ecourt/pemetaan-blangko";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pemetaan blangko putusan, relaas, dan pemberitahuan putusan (kontrak K3,
 * butir 16 dan 17 perbaikan 30 September 2026).
 *
 *   GET ?jenis=putusan|relaas|pbt   semua pegawai yang masuk
 *     -> { jenis, butir: [{ kunci, sebutan, namaBerkas, catatan, diubahPada,
 *          diubahOleh, sumber }], diubahPada, label, kunciBaku, saran,
 *          bolehMengubah }
 *   PUT { jenis, butir: [{ kunci, namaBerkas, catatan?, sebutan? }] }
 *     Super Admin & Admin -> sama dengan GET. namaBerkas kosong = hapus.
 *
 * Tanpa sesi: 401. Hanya menyentuh ALETA (aleta_pemetaan_blangko) - tidak ada
 * tulisan ke SIPP maupun ABT.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const jenis = String(request.nextUrl.searchParams.get("jenis") || "putusan").trim();
    return ok(await bacaPemetaanBlangko(db, jenis, actor));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_BLANGKO_MAPPING_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    let badan: Record<string, unknown>;
    try {
      const isi = (await request.json()) as unknown;
      badan = isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok(await simpanPemetaanBlangko(db, actorUserId, { jenis: badan.jenis, butir: badan.butir }));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_BLANGKO_MAPPING_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
