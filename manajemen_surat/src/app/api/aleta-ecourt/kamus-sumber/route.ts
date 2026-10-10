import { type NextRequest } from "next/server";

import { CERMIN_SIPP, LABEL_STATUS, LABEL_SUMBER } from "@/lib/kamus-sumber-abt";
import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  daftarKamusSumber,
  pastikanKamusAwal,
  suntingKamusSumber,
  uraiUlangKamus,
} from "@/server/modules/aleta-ecourt/kamus-sumber";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kamus variabel ABT - D1 (10 Okt 2026): sumber, arti, blangko pemakai, status.
 *
 *   GET   ?cari=&status=&sumber=&dipakai=1&cermin=1&mulai=&batas=
 *         -> { rekap, rekapDipakai, jumlahCocok, butir, asal, bolehMenyunting, label }
 *   PATCH {noVar, arti, sumber, sumberRinci, cermin}     Super Admin
 *   PATCH {noVar, kembalikan: true}                       Super Admin - buang suntingan
 *   POST  {tindakan: "urai-ulang"}                        Super Admin
 *
 * Membaca terbuka bagi pemegang panel (alasan yang sama dengan rute kamus
 * 0033): arti sebuah variabel pantas dibaca siapa pun yang memakai blangko.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanKamusAwal(db);
    const daftar = await daftarKamusSumber(db, {
      cari: getSearchParam(request, "cari") ?? "",
      status: getSearchParam(request, "status") ?? "",
      sumber: getSearchParam(request, "sumber") ?? "",
      hanyaDipakai: getSearchParam(request, "dipakai") === "1",
      hanyaCermin: getSearchParam(request, "cermin") === "1",
      mulai: Number(getSearchParam(request, "mulai") ?? 0),
      batas: Number(getSearchParam(request, "batas") ?? 50),
    });
    return ok({
      ...daftar,
      bolehMenyunting: bolehMenyuntingAkses(actor),
      label: { status: LABEL_STATUS, sumber: LABEL_SUMBER, cermin: CERMIN_SIPP },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_VARIABLE_DICTIONARY_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "kamus-sumber",
    });
  }
}

async function bacaBadan(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function PATCH(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKamusAwal(db);
    const badan = await bacaBadan(request);
    return ok({ butir: await suntingKamusSumber(db, actorUserId, badan) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_VARIABLE_DICTIONARY_UPDATE_FAILED",
      feature: "aleta_ecourt",
      entityId: "kamus-sumber",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    if (!bolehMenyuntingAkses(actor)) throw new ApiError(403, "Hanya Super Admin yang dapat mengurai ulang kamus.");
    const badan = await bacaBadan(request);
    if (String(badan.tindakan ?? "") !== "urai-ulang") throw new ApiError(400, 'Tindakan tidak dikenali - "urai-ulang".');
    await pastikanKamusAwal(db);
    return ok({ hasil: await uraiUlangKamus(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_VARIABLE_DICTIONARY_REPARSE_FAILED",
      feature: "aleta_ecourt",
      entityId: "kamus-sumber",
    });
  }
}
