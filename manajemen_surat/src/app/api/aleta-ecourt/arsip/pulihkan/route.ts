import { type NextRequest } from "next/server";

import { type FaktaArsip, rencanaPemulihan } from "@/lib/arsip-ecourt-bertindak";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { gatewayCocokkanArsip } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * AGEN ARSIP e-COURT BERTINDAK (TAHAP 5) - RENCANANYA DULU
 * ============================================================================
 *
 *   GET   rencana pemulihan: berapa hilang, berapa akan ditarik, dan APAKAH
 *         menariknya sekarang ada gunanya
 *
 * GET SAJA untuk sekarang - dan itu keputusan, bukan pekerjaan yang belum
 * selesai. Ini agen pertama yang benar-benar BERTINDAK, dan tindakannya
 * menarik ratusan berkas dari sistem milik Mahkamah Agung memakai sesi login
 * pengadilan. Rencananya harus dapat dibaca dan dibatalkan sebelum satu
 * permintaan pun dikirim ke sana.
 *
 * Diukur di peladen 15 September 2026: 400 berkas tercatat, 0 ada di cakram,
 * 400 hilang, dan seluruh 400 punya alamat sumber. Akarnya kini terpasang
 * sebagai volume, jadi menariknya ulang tidak akan menghapus dirinya sendiri
 * seperti yang sudah terjadi sekali.
 *
 * Kewenangannya "penunjukan" - kewenangan yang sama dengan menuliskan
 * penetapan, bukan kewenangan membaca panel. Yang menarik ratusan berkas
 * bukan pembaca.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const batas = Number(request.nextUrl.searchParams.get("batas")) || undefined;

    const jawab = await gatewayCocokkanArsip();
    if (!jawab.ok) {
      return ok({
        tersedia: false,
        alasan: jawab.error || "aleta_bot tidak dapat dihubungi",
      });
    }

    const fakta = jawab.data?.fakta as FaktaArsip | undefined;
    if (!fakta) {
      return ok({ tersedia: false, alasan: "pencocokan arsip tidak memulangkan fakta" });
    }

    const rencana = rencanaPemulihan(fakta, batas);
    return ok({ tersedia: true, ...rencana });
  } catch (galat) {
    return handleAdminRouteError(galat, request, {
      db,
      actorUserId,
      action: "ECOURT_ARSIP_PULIHKAN_RENCANA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
