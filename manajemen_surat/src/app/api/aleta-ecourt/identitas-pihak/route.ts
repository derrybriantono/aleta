import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayIdentitasPihak } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Identitas para pihak satu perkara.
 *
 * ============================================================================
 * ALAMAT TERSENDIRI, DAN DIBACA HANYA KETIKA DIMINTA
 * ============================================================================
 *
 * Nama para pihak sudah tampil di Status Perkara. Yang di sini SIAPA orang itu
 * - umur, pekerjaan, pendidikan, dan dari desa mana ia datang.
 *
 * Ia tidak ditempelkan ke muatan status, dan itu disengaja: layar Status
 * Perkara dibuka di meja yang kerap terlihat orang lain, dan pada 2.22.0
 * bagian para pihak justru DICIUTKAN karena itu. Ditempelkan ke muatan status,
 * identitas lengkapnya ikut terkirim pada setiap perkara yang dibuka siapa pun
 * - termasuk yang hanya ingin melihat jadwal sidang - lalu ikut tersimpan di
 * singgahan peramban.
 *
 * NIK dan nomor telepon disamarkan di PELADEN, bukan di layar. Yang disamarkan
 * di layar tetap melintasi jaringan dalam bentuk utuhnya, dan tetap dapat
 * dibaca siapa pun yang membuka alat pengembang.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak"); // HAK-PERAN 12 Okt: matriks peran

    const nomorPerkara = String(request.nextUrl.searchParams.get("nomorPerkara") || "").trim();
    if (!nomorPerkara) {
      return ok({ available: true, ok: false, alasan: "Nomor perkara wajib diisi." });
    }

    const hasil = await getGatewayIdentitasPihak(nomorPerkara);
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
      action: "SIPP_IDENTITAS_PIHAK_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
