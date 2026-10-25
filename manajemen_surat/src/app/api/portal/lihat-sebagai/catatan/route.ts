import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaCatatanDilihat } from "@/server/modules/lihat-sebagai/layanan";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Catatan "dilihat oleh Super Admin" milik PEMANGGIL SENDIRI (halaman Akun). Tidak ada ruas yang menyebut akun lain. */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok({ catatan: await bacaCatatanDilihat(db, actor.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}
