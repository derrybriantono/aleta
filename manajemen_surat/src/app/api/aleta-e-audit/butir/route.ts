import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayButirEAudit } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bentuk kode butir: dua huruf besar, dua angka. Misalnya KT06, IN01, LP17. */
const POLA_KODE = /^[A-Z]{2}\d{2}$/;

/**
 * Satu butir katalog beserta keadaannya.
 *
 * Bentuk kodenya diperiksa di sini, bukan diteruskan mentah-mentah. Kode yang
 * salah bentuk dijawab dengan kalimat yang dapat dibaca orang, bukan dengan
 * galat dari lapisan yang lebih dalam.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const kode = String(request.nextUrl.searchParams.get("kode") || "")
      .trim()
      .toUpperCase();

    if (!kode) {
      return ok({ available: true, ok: false, alasan: "Kode butir wajib disebut." });
    }
    if (!POLA_KODE.test(kode)) {
      return ok({
        available: true,
        ok: false,
        alasan: `Kode butir "${kode}" tidak berbentuk dua huruf diikuti dua angka.`,
      });
    }

    const hasil = await getGatewayButirEAudit(kode);
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
      feature: "aleta-e-audit",
      action: "butir",
    });
  }
}
