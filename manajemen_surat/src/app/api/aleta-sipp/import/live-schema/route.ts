import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { AletaSippService } from "@/server/modules/aleta-sipp/aleta-sipp-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Menyelaraskan Kamus Database SIPP dari SIPP yang benar-benar terpasang.
 *
 * Berbeda dengan /import/sql-dump yang membaca berkas dump di disk, rute ini
 * membaca information_schema secara langsung lewat jembatan baca-saja di ALETA
 * Bot - sehingga selalu cocok dengan SIPP yang sedang berjalan, dan tidak ada
 * berkas yang perlu disalin ke server.
 *
 * Tidak menerima badan permintaan apa pun: nama skema tidak boleh datang dari
 * luar. Bot memakai DATABASE() milik koneksinya sendiri.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await AletaSippService.syncAletaSippDictionaryFromLive(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}
