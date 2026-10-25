import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { passkeyTersedia } from "@/server/modules/verifikasi/pengaturan";
import { statusAkunVerifikasi } from "@/server/modules/verifikasi/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keadaan verifikasi dua langkah MILIK PEMANGGIL SENDIRI (halaman Akun). */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const asal = request.headers.get("origin") || request.nextUrl.origin;
    return ok({ ...(await statusAkunVerifikasi(db, actor.id)), passkey: passkeyTersedia(asal) });
  } catch (error) {
    return handleRouteError(error);
  }
}
