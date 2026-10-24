import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ipKlien } from "@/server/modules/perangkat/jaringan";
import { cabutSesiAkun } from "@/server/modules/perangkat/sesi";
import { sesiPemanggil } from "@/server/modules/perangkat/sesi-pemanggil";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mengeluarkan perangkat MILIK SENDIRI: satu perangkat, atau "semua kecuali
 * ini". Sesi pemanggil tidak pernah ikut dicabut lewat rute ini (untuk itu
 * ada tombol Keluar).
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const sesi = await sesiPemanggil(request.headers);
    const body = await readJsonBody<{ perangkatId?: string; semuaKecualiIni?: boolean }>(request).catch(
      () => ({}) as { perangkatId?: string; semuaKecualiIni?: boolean }
    );
    if (!body.semuaKecualiIni && !body.perangkatId) throw new ApiError(400, "Pilih perangkat yang dikeluarkan.");
    const jumlah = await cabutSesiAkun(db, {
      userId: actor.id,
      alasan: "oleh-diri",
      pelaku: { id: actor.id, nama: actor.name },
      perangkatId: body.semuaKecualiIni ? undefined : String(body.perangkatId),
      semua: Boolean(body.semuaKecualiIni),
      kecualiSessionId: sesi?.sessionId ?? null,
      ip: ipKlien(request.headers),
    });
    return ok({ dicabut: jumlah });
  } catch (error) {
    return handleRouteError(error);
  }
}
