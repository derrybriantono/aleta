import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminSinkron } from "@/server/modules/sinkron/akses";
import {
  bacaCapTarik,
  kalimatPita,
  modeKembaran,
  panggilBotKembaran,
  type BarisAntrean,
} from "@/server/modules/sinkron/kembaran";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/sinkron-kembaran - gambaran antrean "menunggu sinkron" mode
 * kembaran (laptop). HANYA Super Admin, juga untuk melihat: isinya cuplikan
 * data perkara yang belum disetujui keluar.
 *
 * Di portal yang BUKAN mode kembaran (server kantor) jawabannya aktif:false -
 * layar menjelaskan bahwa tidak ada antrean, dan rute aksi menolak bekerja.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await pastikanAdminSinkron(db, actorUserId, true);

    const aktif = modeKembaran();
    const cap = aktif ? await bacaCapTarik() : null;
    if (!aktif) {
      return ok({ aktif: false, pita: "", cap: null, hitung: [], baris: [], bot: null });
    }
    const status = new URL(request.url).searchParams.get("status") || "";
    const [bot, daftar] = await Promise.all([
      panggilBotKembaran<{ aktif: boolean; hitung: Array<{ status: string; hasil: string | null; n: number }>; penjaga?: Record<string, unknown>; antreanGalat?: string }>("/status"),
      panggilBotKembaran<{ baris: BarisAntrean[] }>(`/antrean?batas=1500${status ? `&status=${encodeURIComponent(status)}` : ""}`),
    ]);
    return ok({
      aktif: true,
      pita: kalimatPita(cap),
      cap,
      hitung: bot.ok ? bot.data.hitung : [],
      penjaga: bot.ok ? (bot.data.penjaga ?? null) : null,
      antreanGalat: bot.ok ? (bot.data.antreanGalat ?? null) : null,
      baris: daftar.ok ? daftar.data.baris : [],
      botGalat: !bot.ok ? bot.error : !daftar.ok ? daftar.error : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
