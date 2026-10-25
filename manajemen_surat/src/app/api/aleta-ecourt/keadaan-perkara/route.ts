import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { keadaanPerkaraDariCermin, type AlasanTidakAda } from "@/server/modules/cermin/keadaan-perkara";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Keadaan perkara" satu perkara dari Cermin Perkara (A6, 25 Okt 2026): SATU baca
 * Postgres, tanpa menyentuh SIPP. Kewenangannya "panel", sama dengan sipp-konteks.
 *
 *   GET ?nomor=...  -> { available: true, cermin: {...} | null, alasan }
 *
 * `cermin` null = tidak tersedia dari cermin (saklar Panel ekstensi mati, cermin
 * tertinggal, perkara belum ada, atau baru ada tulisan yang belum tercermin);
 * pemanggil memakai jalur lama (sipp-konteks lewat bot). Tanpa nama pihak dan
 * tanpa isi dokumen.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    let alasan: AlasanTidakAda | "" = "";
    const cermin = await keadaanPerkaraDariCermin(nomor, undefined, (a) => {
      alasan = a;
    });
    return ok({ available: true, cermin, alasan: cermin ? "" : alasan || "tidak-tersedia" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KEADAAN_PERKARA_CERMIN_READ_FAILED",
      feature: "cermin_perkara",
      entityId: "keadaan-perkara",
    });
  }
}
