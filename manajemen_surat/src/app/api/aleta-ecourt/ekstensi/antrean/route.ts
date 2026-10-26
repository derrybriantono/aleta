import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { akhiriAntrean, daftarAntrean, simpanAntrean } from "@/server/modules/aleta-ecourt/antrean-peramban";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Antrean kerja peramban MILIK PEMANGGILNYA (K15, rantai B).
 *
 *   GET  [?jenis=]                 -> { aktif, antrean: [{jenis, kunci, ringkas, selesai, total, muatan, ...}] }
 *   PUT  {jenis, kunci, ...}       -> { disimpan, alasan? }        (upsert keadaan)
 *   POST {jenis, kunci, status}    -> { diakhiri }                 (selesai | dibuang)
 *
 * Pengguna selalu dari sesi. Saklar kinerja.antreanDiServer mati = tulisan ditolak halus dan bacaan kosong.
 * Tidak menjalankan apa pun dan tidak menyentuh SIPP/ABT.
 */
async function pengguna(request: NextRequest) {
  const db = await getDatabase();
  const actor = await requireActorUser(db, await resolveActorUserId(request));
  return { db, id: actor.id };
}

async function badan(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const { db, id } = await pengguna(request);
    return ok(await daftarAntrean(db, id, new URL(request.url).searchParams.get("jenis") ?? undefined));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { db, id } = await pengguna(request);
    return ok(await simpanAntrean(db, id, await badan(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, id } = await pengguna(request);
    const b = (await badan(request)) as { jenis?: unknown; kunci?: unknown; status?: unknown } | null;
    return ok(await akhiriAntrean(db, id, b?.jenis, b?.kunci, b?.status));
  } catch (error) {
    return handleRouteError(error);
  }
}
