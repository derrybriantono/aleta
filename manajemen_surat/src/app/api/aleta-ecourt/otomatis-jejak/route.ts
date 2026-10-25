import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaLaporanOtomatis, isiUlangDariRiwayat } from "@/server/modules/otomatis-jejak/laporan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * KETEPATAN TUNDA / PUTUS OTOMATIS PER ATURAN (U19, 25 Okt 2026)
 * ============================================================================
 *
 * Hanya Super Admin dan Admin. Hanya membaca/menulis basis data ALETA.
 *
 *   GET  ?hari=90&fitur=tunda|putus   -> laporan per aturan, sebab dilewati, rincian terakhir
 *   POST {aksi: "isi-ulang"}          -> menyusun ulang jejak dari riwayat harian lama (idempoten)
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const q = request.nextUrl.searchParams;
    return ok(await bacaLaporanOtomatis(db, actorUserId, { hari: q.get("hari"), fitur: q.get("fitur") }));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "OTOMATIS_JEJAK_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "otomatis-jejak",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    let badan: Record<string, unknown> = {};
    try {
      const isi = (await request.json()) as unknown;
      badan = isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    if (badan.aksi !== "isi-ulang") throw new ApiError(400, 'Aksi tidak dikenal (yang tersedia: "isi-ulang").');
    return ok(await isiUlangDariRiwayat(db, actorUserId));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "OTOMATIS_JEJAK_ISI_ULANG_FAILED",
      feature: "aleta_ecourt",
      entityId: "otomatis-jejak",
    });
  }
}
