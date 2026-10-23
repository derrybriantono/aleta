import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  KATALOG_AGEN,
  LABEL_PERAN_AGEN,
  bacaSetelan,
  bolehLihatSemua,
  kelasBerlaku,
  simpanSetelan,
  tugasBisaJalan,
  type Kelas,
} from "@/server/modules/aleta-ecourt/agen";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pengaturan agen per tugas (kelas A/B/C, aktif). Hanya Super Admin.
 * Tindakan hukum selalu C - kelas yang dikirim untuknya diabaikan.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    if (!bolehLihatSemua(actor)) throw new ApiError(403, "Pengaturan agen hanya untuk Super Admin.");
    const setelan = await bacaSetelan(db);
    return ok({
      tugas: KATALOG_AGEN.map((t) => {
        const s = setelan.get(t.kunci);
        return {
          ...t,
          peranLabel: LABEL_PERAN_AGEN[t.peran],
          kelas: kelasBerlaku(t, s),
          aktif: s ? s.aktif : true,
          bisaJalan: tugasBisaJalan(t),
        };
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    if (!bolehLihatSemua(actor)) throw new ApiError(403, "Pengaturan agen hanya untuk Super Admin.");
    const body = (await request.json().catch(() => ({}))) as { tugas?: string; kelas?: string; aktif?: boolean };
    try {
      const s = await simpanSetelan(db, actor, {
        tugas: String(body.tugas || ""),
        kelas: String(body.kelas || "A") as Kelas,
        aktif: body.aktif !== false,
      });
      return ok(s);
    } catch (e) {
      throw new ApiError(400, String((e as Error)?.message ?? e));
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
