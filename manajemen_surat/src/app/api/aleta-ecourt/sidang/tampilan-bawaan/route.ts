import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  bacaHalamanBawaan,
  bawaanUntukPengguna,
  simpanBawaan,
} from "@/server/modules/aleta-ecourt/tampilan-jadwal-bawaan";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bawaan tampilan Jadwal Sidang (butir 22, 6 Okt 2026) - lihat
 * modules/aleta-ecourt/tampilan-jadwal-bawaan.
 *
 *   GET            -> { berlaku, sumber } bawaan yang berlaku bagi PEMANGGILNYA
 *   GET ?admin=1   -> halaman pengaturan (Super Admin)
 *   PUT {lingkup: "semua"|"pengguna", penggunaId?, pilihan|null, paksa?}
 *                  -> halaman pengaturan (Super Admin); pilihan null = hapus
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    if (request.nextUrl.searchParams.get("admin") === "1") {
      return ok(await bacaHalamanBawaan(db, actorUserId));
    }
    const actor = await requireActorUser(db, actorUserId);
    return ok(await bawaanUntukPengguna(db, actor.id));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SCHEDULE_DISPLAY_DEFAULT_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    let badan: Record<string, unknown> = {};
    try {
      const isi = (await request.json()) as unknown;
      badan = isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok(
      await simpanBawaan(db, actorUserId, {
        lingkup: badan.lingkup,
        penggunaId: badan.penggunaId,
        pilihan: badan.pilihan === undefined ? {} : badan.pilihan,
        paksa: badan.paksa,
      })
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SCHEDULE_DISPLAY_DEFAULT_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
