import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { tampilKurs } from "@/server/modules/aleta-ai/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - GET /api/aleta-ai/kurs (Super Admin).
 * {kurs, tanggal, sumber, basi, tersimpan, penyanggaKursPersen, kursDipakai}.
 * Membuka halaman ini ikut mengambil kurs hari ini bila belum ada.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    wajibSuperAdmin(await pelakuAi(db, await resolveActorUserId(request)));
    return ok(await tampilKurs(db, { segarkan: process.env.NODE_ENV !== "test" }));
  } catch (error) {
    return handleRouteError(error);
  }
}
