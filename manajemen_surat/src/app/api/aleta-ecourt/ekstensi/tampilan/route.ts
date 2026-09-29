import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { tampilanUntukPengguna } from "@/server/modules/aleta-ecourt/tampilan-ekstensi";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tampilan ekstensi yang berlaku bagi PEMANGGILNYA, beserta setelan
 * pribadinya - dibaca ekstensi saat mulai dan tiap kali versinya berubah.
 *
 *   GET -> { tampilan, versi, setelan, keteranganSetelan, dibuatPada }
 *
 * Selalu tentang pemanggilnya sendiri, sama dengan /ekstensi/siapa; tidak ada
 * ruas yang menyebut orang lain. Tanpa sesi: 401 (requireActorUser).
 * Hanya membaca: tidak ada tulisan ke ALETA maupun SIPP.
 *
 * `tampilan.diterapkan === true` berarti tampilan ini DITERAPKAN admin, bukan
 * sedang dicoba - ekstensi tidak menahan tulisan untuknya (lihat
 * src/lib/tampilan-ekstensi.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok(
      await tampilanUntukPengguna(db, {
        id: actor.id,
        roleId: String(actor.roleId || ""),
        additionalRoleIds: actor.additionalRoleIds ?? [],
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
