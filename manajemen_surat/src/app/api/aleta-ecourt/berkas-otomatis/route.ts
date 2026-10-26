import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaSetelanBerkas } from "@/server/modules/aleta-ecourt/berkas-otomatis";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keadaan saklar isi otomatis dari berkas e-Court (G2): daftar bukti, kesimpulan, pemetaan bukti dan saksi. SEMUANYA mati bawaan.
 *   GET   keadaan (semua akun ber-"panel"), baca saja. Sejak 26 Okt 2026 saklarnya diubah di Fitur Satker (Super Admin).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    return ok({ setelan: await bacaSetelanBerkas(db), bolehUbah: bolehMenyuntingAkses(aktor) });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "BERKAS_OTOMATIS_BACA_FAILED", feature: "aleta_ecourt", entityId: "berkas-otomatis" });
  }
}
