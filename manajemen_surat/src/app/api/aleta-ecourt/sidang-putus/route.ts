import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  getGatewayStatusPutusan,
  postGatewayTulisPutusan,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penulisan putusan akhir ke SIPP.
 *
 * ============================================================================
 * TULISAN PALING BERAT YANG DIKERJAKAN ALETA
 * ============================================================================
 *
 * Yang dicatat di sini dibaca pengadilan tingkat banding, dipakai menyusun akta
 * cerai, dan dikirim ke Direktori Putusan. Penetapan menunjuk siapa yang
 * menyidangkan; penundaan memindahkan tanggal; yang ini mencatat PUTUSAN.
 *
 * Kering sebagai bawaan berlaku sama tegasnya, dan akun SIPP-nya wajib disebut:
 * nama itulah yang muncul pada audit trail, dan ALETA tidak pernah menulis atas
 * nama dirinya sendiri.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hasil = await getGatewayStatusPutusan();
    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_STATUS_PUTUSAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const badan = (await request.json()) as Record<string, unknown>;
    const olehUsername = String(badan.olehUsername || "").trim();
    if (!olehUsername) {
      return ok({
        available: true,
        ok: false,
        alasan: "Akun SIPP yang menuliskannya wajib disebut - audit trail memakai namanya.",
      });
    }

    const hasil = await postGatewayTulisPutusan({
      perkaraId: badan.perkaraId,
      tanggalPutusan: String(badan.tanggalPutusan || ""),
      statusPutusanId: badan.statusPutusanId,
      amarPutusan: String(badan.amarPutusan || ""),
      catatanPutusan: String(badan.catatanPutusan || ""),
      sumberHukumId: String(badan.sumberHukumId || ""),
      verstek: String(badan.verstek || ""),
      pertimbanganHukum: String(badan.pertimbanganHukum || ""),
      olehUsername,
      operator: actorUserId || "portal",
      kering: badan.kering !== false,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PUTUSAN_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
