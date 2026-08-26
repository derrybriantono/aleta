import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayVerifikasiList,
  postGatewayVerifikasiDecision,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifikasi dokumen e-Court lewat portal.
 *
 * ============================================================================
 * NAMA HAKIM TIDAK PERNAH DATANG DARI PERMINTAAN
 * ============================================================================
 *
 * Nama yang diteruskan ke bot SELALU diambil dari akun yang sudah login, tidak
 * pernah dari badan permintaan atau parameter URL. Bila nama boleh dikirim
 * pemanggil, siapa pun yang punya akun portal dapat mengaku sebagai hakim mana
 * pun - dan verifikasi dokumen adalah keputusan hukum, bukan tampilan data.
 *
 * Bot masih memeriksa ulang bahwa nama itu terdaftar sebagai hakim dan duduk
 * pada majelis perkaranya. Rute ini hanya memastikan namanya benar milik yang
 * sedang login.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
    const hasil = await getGatewayVerifikasiList(actor.name, { limit });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        daftar: null,
      });
    }

    return ok({ available: true, message: "", daftar: hasil.data ?? null });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_VERIFICATION_LIST_FAILED",
      feature: "ecourt_verifikasi",
      entityId: "daftar",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    const body = (await request.json()) as {
      documentKey?: string;
      keputusan?: string;
      konfirmasi?: boolean;
      keterangan?: string;
    };

    const keputusan = body.keputusan === "valid" || body.keputusan === "tidak_valid" ? body.keputusan : null;
    if (!keputusan) {
      return ok({ ok: false, alasan: "keputusan_tidak_dikenali" });
    }

    const hasil = await postGatewayVerifikasiDecision({
      // Nama dari akun yang login, bukan dari badan permintaan.
      nama: actor.name,
      documentKey: String(body.documentKey || ""),
      keputusan,
      konfirmasi: body.konfirmasi === true,
      keterangan: String(body.keterangan || ""),
    });

    if (!hasil.ok) {
      return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
    }

    return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_VERIFICATION_DECIDE_FAILED",
      feature: "ecourt_verifikasi",
      entityId: "keputusan",
    });
  }
}
