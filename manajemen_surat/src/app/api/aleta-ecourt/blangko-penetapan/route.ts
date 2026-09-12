import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayBlangkoPenetapan,
  simpanBlangkoPenetapan,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * ALAMAT BLANGKO PENETAPAN DI ABT
 * ============================================================================
 *
 * Blangko penetapan disusun ABT - form PTSP pada blangko satker, dengan
 * penanda @PMH, @PPP, @PJS, dan @PHS. ABT hanya ada di peladen, dan alamat
 * blangkonya berbeda antar pemasangan; karena itu alamatnya DISUNTING di sini,
 * bukan ditulis tetap di dalam kode.
 *
 * {nomor} dan {nomorBersih} di dalam alamat diganti nomor perkaranya -
 * "225/Pdt.P/2026/PA.Dgl" dan "225_PdtP_2026_PADgl".
 *
 * akarSipp menunjuk folder tempat SIPP menyimpan berkasnya. Tanpa itu satu-
 * satunya jalan adalah menebak, dan berkas yang ditulis ke folder yang keliru
 * tercatat di basis data sebagai ada padahal tidak pernah dapat dibuka.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const respons = await getGatewayBlangkoPenetapan();
    return Response.json(respons, { status: respons?.ok === false ? 502 : 200 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_PENETAPAN_BACA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const badan = (await request.json()) as Record<string, unknown>;

    // Hanya ruas yang dikenal yang diteruskan. Meneruskan badan permintaan apa
    // adanya berarti membiarkan peramban menulis ruas mana pun ke dalam
    // konfigurasi runtime bot.
    const muatan: Record<string, unknown> = {};
    for (const kunci of ["pmh", "ppp", "pjs", "phs", "akarSipp"]) {
      if (badan[kunci] !== undefined) muatan[kunci] = String(badan[kunci] ?? "").slice(0, 500);
    }
    if (badan.aktif !== undefined) muatan.aktif = badan.aktif === true;

    const respons = await simpanBlangkoPenetapan(muatan);
    return Response.json(respons, { status: respons?.ok === false ? 502 : 200 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_PENETAPAN_SIMPAN_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
