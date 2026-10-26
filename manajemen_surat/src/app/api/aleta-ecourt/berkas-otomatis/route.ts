import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaSetelanBerkas, simpanSetelanBerkas } from "@/server/modules/aleta-ecourt/berkas-otomatis";
import { buangSinggahanIsiGugatan } from "@/server/modules/aleta-ecourt/isi-gugatan-singgah";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saklar isi otomatis dari berkas e-Court (G2, 25 Okt 2026): daftar bukti, kesimpulan, pemetaan bukti dan saksi. SEMUANYA mati bawaan.
 *   GET   setelan (semua akun ber-"panel"); bolehUbah = Super Admin
 *   POST  { bukti?, kesimpulan?, buktiSaksi? }   hanya Super Admin
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

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    if (!bolehMenyuntingAkses(aktor)) throw new ApiError(403, "Saklar isi otomatis dari berkas e-Court hanya dapat diubah Super Admin.");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const setelan = await simpanSetelanBerkas(db, { id: aktor.id, name: String(aktor.name || aktor.email || aktor.id) }, badan);
    // Singgahan memuat hasil menurut saklar lama: dibuang agar perubahan langsung berlaku.
    buangSinggahanIsiGugatan();
    return ok({ ok: true, setelan });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "BERKAS_OTOMATIS_UBAH_FAILED", feature: "aleta_ecourt", entityId: "berkas-otomatis" });
  }
}
