import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Jadwal Sidang RINGAN (22 Okt 2026): hanya kolom yang berubah sepanjang hari
 * (ditunda, hasil/putus, kehadiran, sidang berikutnya, tanggal putusan) untuk
 * seluruh sidang satu rentang - empat kueri berindeks di bot (10-12 ms, 15 KB,
 * dibanding jadwal penuh 216-277 ms, 83-96 KB). Ditanyakan layar tiap 8 detik
 * saat tab terlihat - lihat @/lib/jadwal-ringan. Tanpa singgahan: bacaannya
 * murah, dan singgahan hanya menunda perubahan yang justru ingin cepat terlihat.
 * Kewenangannya "panel", sama dengan jadwalnya. Bot lama (tanpa rute ini)
 * dijawab available:false - layar tetap memakai jadwal penuh seperti semula.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const kueri = new URLSearchParams({
      dari: String(request.nextUrl.searchParams.get("dari") || ""),
      sampai: String(request.nextUrl.searchParams.get("sampai") || ""),
    });
    const hasil = await panggilBotJadwalSidang(`/ringan?${kueri.toString()}`, { timeoutMs: 4000 });
    if (!hasil.ok) return ok({ available: false, alasan: hasil.error, baris: [] });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_RINGAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
