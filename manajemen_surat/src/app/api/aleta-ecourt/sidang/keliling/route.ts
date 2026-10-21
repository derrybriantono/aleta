import { type NextRequest } from "next/server";

import { bolehAksi } from "@/lib/matriks-peran";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaKelilingHari, simpanKelilingHari } from "@/server/modules/aleta-ecourt/sidang-keliling-hakim";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saklar Sidang keliling per tanggal (22 Okt 2026, migrasi 0083) - hanya di
 * ALETA, tidak ditulis ke SIPP. Bawaan MATI. Tunda otomatis membaca saklar ini
 * (sidangKelilingAktif) dan berjalan pukul 14.00 pada hari yang menyala.
 *
 *   GET ?tanggal=YYYY-MM-DD -> { keliling, bolehUbah }
 *   PUT { tanggal, aktif }  -> { keliling }   (Hakim, Ketua/Wakil, Panitera, PP, Admin)
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const keliling = await bacaKelilingHari(db, String(request.nextUrl.searchParams.get("tanggal") || ""));
    return ok({ keliling, bolehUbah: bolehAksi(aktor, "sidang.keliling") });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_KELILING_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "sidang-keliling",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const aktor = await pastikanAksi(db, actorUserId, "sidang.keliling");
    let badan: Record<string, unknown> = {};
    try {
      badan = ((await request.json()) as Record<string, unknown>) ?? {};
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    const keliling = await simpanKelilingHari(db, {
      tanggal: badan.tanggal,
      aktif: badan.aktif,
      olehId: String(actorUserId ?? ""),
      olehNama: String(aktor.name || aktor.email || ""),
    });
    return ok({ keliling });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_KELILING_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "sidang-keliling",
    });
  }
}
