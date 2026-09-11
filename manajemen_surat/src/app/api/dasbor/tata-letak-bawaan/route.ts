import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  bacaTataLetakBawaan,
  hapusTataLetakBawaan,
  simpanTataLetakBawaan,
} from "@/server/modules/portal/tata-letak-dasbor";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Susunan bawaan dasbor - titik berangkat bagi seluruh pegawai.
 *
 * Membacanya terbuka bagi siapa pun yang sudah masuk: dasbor setiap orang
 * memang menggambarnya, jadi menyembunyikan isinya tidak menyembunyikan apa
 * pun. Mengubahnya hanya Super Admin, dan itu ditegakkan di layanannya.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    return ok({ bawaan: await bacaTataLetakBawaan(db, getSearchParam(request, "halaman") || "") });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const body = await readJsonBody<{ halaman?: unknown; susunan?: unknown }>(request);

    return ok({
      bawaan: await simpanTataLetakBawaan(db, actorUserId, String(body.halaman || ""), body.susunan),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Mengembalikan bawaan ke urutan yang tertulis di kode. */
export async function DELETE(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    return ok({
      bawaan: await hapusTataLetakBawaan(db, actorUserId, getSearchParam(request, "halaman") || ""),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
