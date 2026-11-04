import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { getGatewayRekeningStatus, mulaiGatewayRekeningSinkron } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * SINKRON REKENING DAN BANK PEMBAYAR DARI e-COURT (4 Nov 2026)
 * ============================================================================
 *
 *   GET  -> keadaan: terakhir sinkron, jumlah terbaca/tanpa rekening/gagal beserta sebab, cakupan, putaran terakhir.
 *   POST -> menjalankan sinkron sekarang (tombol "Sinkron rekening" di Integrasi e-Court).
 *
 * Hanya Super Admin dan Admin. Tidak ada nomor rekening di jawaban maupun di jejak audit (hitungan saja).
 * Sinkron otomatis berjalan sendiri di ujung putaran penarikan e-Court; rute ini hanya melihat dan memicunya.
 */
const ALASAN: Record<string, string> = {
  penarikan_sedang_berjalan: "Penarikan e-Court lain sedang berjalan. Coba lagi sesudah selesai; sinkron rekening juga berjalan otomatis di ujung tiap putaran.",
  penarikan_lain_masih_berjalan: "Ada penarikan e-Court lain di luar ALETA yang masih berjalan. Coba lagi sesudah selesai.",
};

async function pastikanAdmin(request: NextRequest) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Sinkron rekening e-Court hanya untuk Super Admin dan Admin.");
  }
  return { db, actorUserId, actor };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const dasar = await pastikanAdmin(request);
    db = dasar.db;
    actorUserId = dasar.actorUserId;
    const hasil = await getGatewayRekeningStatus();
    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    if (!hasil.data || hasil.data.ok === false) {
      return ok({ available: false, message: "Keadaan sinkron rekening belum dapat dibaca dari ALETA Bot." });
    }
    return ok({ available: true, status: hasil.data.status, penjadwal: hasil.data.penjadwal });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_REKENING_SINKRON_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "rekening-sinkron",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const dasar = await pastikanAdmin(request);
    db = dasar.db;
    actorUserId = dasar.actorUserId;
    const hasil = await mulaiGatewayRekeningSinkron(dasar.actor.name);
    if (!hasil.ok) {
      return ok({ available: false, ok: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    const dimulai = hasil.data.ok === true;
    await appendAuditLog(dasar.db, {
      id: await nextPrefixedId(dasar.db, "audit_logs", "adt"),
      actorUserId: dasar.actorUserId,
      action: dimulai ? "ECOURT_REKENING_SINKRON_DIMULAI" : "ECOURT_REKENING_SINKRON_DITOLAK",
      entityType: "ecourt",
      entityId: "rekening-sinkron",
      payload: { alasan: dimulai ? "" : String(hasil.data.alasan || "") },
    }).catch(() => {
      // Jejak yang gagal dicatat tidak membatalkan sinkron yang sudah dimulai.
    });
    return ok({
      available: true,
      ok: dimulai,
      alasan: dimulai ? "" : String(hasil.data.alasan || ""),
      message: dimulai
        ? "Sinkron rekening dimulai. Hasilnya muncul di kartu ini beberapa menit lagi."
        : ALASAN[String(hasil.data.alasan || "")] || "Sinkron rekening belum dapat dimulai.",
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_REKENING_SINKRON_FAILED",
      feature: "aleta_ecourt",
      entityId: "rekening-sinkron",
    });
  }
}
