import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { susunChecklist } from "@/server/modules/aleta-ecourt/checklist-milestone";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checklist milestone - pekerjaan penting pengguna, dihitung dari SIPP dan
 * basis data ALETA, dibaca widget ekstensi.
 *
 *   GET ?peran=<kunci opsional>
 *
 * Selalu tentang PEMANGGILNYA SENDIRI - sama dengan /ekstensi/siapa. Peran
 * yang diminta tetapi tidak dimiliki pengguna tidak dibuka; jawabannya jatuh
 * ke peran bawaannya dan sebabnya disebut di `galat`. Peran satker (panitera,
 * ketua) hanya tersedia bagi yang memegangnya.
 *
 * Tanpa sesi: 401, seperti rute ekstensi lain (requireActorUser).
 * Hanya membaca: tidak ada satu pun tulisan ke SIPP maupun ke ALETA.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const data = await susunChecklist(db, actor, {
      peranDiminta: request.nextUrl.searchParams.get("peran") || "",
    });
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
