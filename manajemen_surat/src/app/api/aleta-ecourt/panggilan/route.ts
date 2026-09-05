import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  getGatewayPengaturanPanggilan,
  simpanGatewayPengaturanPanggilan,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tenggang waktu kepatutan panggilan.
 *
 * ============================================================================
 * DIBACA BANYAK ORANG, DIUBAH SEDIKIT ORANG
 * ============================================================================
 *
 * Angka ambangnya ditampilkan pada tiap penilaian panggilan di layar Jadwal
 * Sidang, jadi siapa pun yang boleh melihat panel boleh membacanya - tanpa itu,
 * lencana "tidak patut" muncul tanpa keterangan dari mana angkanya.
 *
 * Mengubahnya lain soal: angka ini menentukan panggilan mana yang ditandai
 * cacat, dan itu keputusan pengadilan. Hanya Super Admin dan Admin.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hasil = await getGatewayPengaturanPanggilan();
    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        pengaturan: null,
      });
    }
    return ok({
      available: true,
      pengaturan: hasil.data?.pengaturan ?? null,
      // Keterangan jalur ikut dikirim: layar menampilkan dasar hukum dan cara
      // hitung tiap jalur, dan menyalinnya ke peramban berarti dua tempat yang
      // dapat berbeda isinya.
      jalur: hasil.data?.jalur ?? null,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PANGGILAN_PENGATURAN_READ_FAILED",
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
    const actor = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(
        403,
        "Hanya Super Admin dan Admin yang dapat mengubah tenggang waktu kepatutan panggilan."
      );
    }

    const body = await readJsonBody<{
      hariElektronik?: number;
      hariSuratTercatat?: number;
      hariBiasa?: number;
    }>(request);

    const hasil = await simpanGatewayPengaturanPanggilan({
      hariElektronik: Number(body.hariElektronik) || 0,
      hariSuratTercatat: Number(body.hariSuratTercatat) || 0,
      hariBiasa: Number(body.hariBiasa) || 0,
      olehSiapa: actor.name,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }
    return ok({ available: true, ...(hasil.data ?? { ok: false }) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PANGGILAN_PENGATURAN_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
