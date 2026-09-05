import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  antreanPerkara,
  antreanUntukSaya,
  titipkanPenetapan,
  tutupTitipan,
} from "@/server/modules/aleta-ecourt/penunjukan-antrean";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Antrean penetapan - menyerahkan pekerjaan, bukan akun.
 *
 * ============================================================================
 * GET  daftar yang menunggu saya, atau yang menunggu untuk satu perkara
 * POST meneruskan satu penetapan
 * PATCH menutupnya - dikerjakan atau dibatalkan
 * ============================================================================
 *
 * Meneruskan boleh dilakukan siapa pun yang boleh membuka papan penunjukan:
 * meneruskan bukan menetapkan, dan usulannya tetap harus diperiksa lalu
 * ditekan pejabatnya sendiri dengan akunnya sendiri.
 *
 * Yang dibatasi menutupnya sebagai "dikerjakan" - dan itu diperiksa di
 * layanannya, bukan di sini, supaya jalur mana pun yang memanggilnya tunduk
 * pada pemeriksaan yang sama.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");
    if (!actorUserId) return ok({ ok: false, alasan: "belum_masuk" });

    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    if (perkaraId) {
      return ok({ ok: true, antrean: await antreanPerkara(db, perkaraId) });
    }

    return ok({ ok: true, ...(await antreanUntukSaya(db, actorUserId)) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_ANTREAN_READ_FAILED",
      feature: "penunjukan",
      entityId: "antrean",
    });
  }
}

/** Meneruskan satu penetapan untuk pejabat yang berwenang. */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");
    if (!actorUserId) return ok({ ok: false, alasan: "belum_masuk" });

    const body = (await request.json()) as {
      perkaraId?: string;
      nomorPerkara?: string;
      jenis?: string;
      usulan?: Record<string, unknown>;
      ringkasan?: string;
      catatan?: string;
    };

    const hasil = await titipkanPenetapan(db, {
      actorUserId,
      perkaraId: String(body.perkaraId || ""),
      nomorPerkara: String(body.nomorPerkara || ""),
      jenis: String(body.jenis || ""),
      usulan: body.usulan ?? {},
      ringkasan: String(body.ringkasan || ""),
      catatan: String(body.catatan || ""),
    });

    return ok({ ok: true, ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_ANTREAN_TITIP_FAILED",
      feature: "penunjukan",
      entityId: "antrean",
    });
  }
}

/** Menutup satu penerusan: dikerjakan, atau dibatalkan. */
export async function PATCH(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");
    if (!actorUserId) return ok({ ok: false, alasan: "belum_masuk" });

    const body = (await request.json()) as {
      id?: string;
      keadaan?: string;
      akunSipp?: string;
      alasan?: string;
    };

    const keadaan = body.keadaan === "dibatalkan" ? "dibatalkan" : "dikerjakan";

    const hasil = await tutupTitipan(db, {
      actorUserId,
      id: String(body.id || ""),
      keadaan,
      akunSipp: String(body.akunSipp || ""),
      alasan: String(body.alasan || ""),
    });

    return ok({ ok: true, ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_ANTREAN_TUTUP_FAILED",
      feature: "penunjukan",
      entityId: "antrean",
    });
  }
}
