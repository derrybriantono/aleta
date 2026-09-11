import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireAletaBotSuperAdmin } from "@/server/modules/aleta-bot/service";
import {
  getGatewayKelengkapanStatus,
  runGatewayKelengkapan,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kirim saat data lengkap - keadaan pemantau dan pratinjau daftar kirimnya.
 *
 * Keduanya dijawab bot, bukan portal: daftar kirim disusun dari SIPP, dan
 * portal tidak pernah menyentuh SIPP sendiri. Hanya Super Admin, sama dengan
 * seluruh pengaturan bot lainnya.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireAletaBotSuperAdmin(db, actorUserId ?? "");
    const hasil = await getGatewayKelengkapanStatus();
    if (!hasil.ok) {
      throw new ApiError(503, hasil.error || "ALETA Bot belum dapat dihubungi.");
    }
    return ok(hasil.data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireAletaBotSuperAdmin(db, actorUserId ?? "");
    const body = await readJsonBody<{ pratinjau?: boolean }>(request);
    // Bawaannya PRATINJAU: tombol yang salah tekan tidak boleh mengantrekan
    // pesan ke nomor orang. Pengiriman sungguhan diminta secara tegas.
    const pratinjau = body.pratinjau !== false;
    const hasil = await runGatewayKelengkapan({ pratinjau, olehSiapa: actor.name || actor.username || actor.id });
    if (!hasil.ok) {
      throw new ApiError(503, hasil.error || "ALETA Bot belum dapat dihubungi.");
    }
    return ok(hasil.data.hasil);
  } catch (error) {
    return handleRouteError(error);
  }
}
