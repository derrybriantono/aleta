import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayPromptPutusan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bahan penyusun perintah putusan.
 *
 * ============================================================================
 * BAHAN, BUKAN PERINTAHNYA
 * ============================================================================
 *
 * Yang dikembalikan rute ini adalah keterangan mentah satu perkara: riwayat
 * sidang, mediasi, saksi, kuasa, berkas e-Court. Perangkaiannya menjadi
 * perintah dikerjakan di layar - sehingga penyusun melihat kalimatnya berubah
 * tiap kali ia mengubah arah putusan atau hasil mediasi, tanpa satu pun
 * perjalanan pulang ke peladen.
 *
 * Kewenangannya sama dengan layar Status Perkara: isinya keterangan perkara
 * yang sama, hanya disusun untuk keperluan menulis putusan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) {
      return ok({ available: true, ok: false, alasan: "Nomor perkara wajib diisi." });
    }

    const hasil = await getGatewayPromptPutusan(nomor);
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
      action: "SIPP_PROMPT_PUTUSAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
