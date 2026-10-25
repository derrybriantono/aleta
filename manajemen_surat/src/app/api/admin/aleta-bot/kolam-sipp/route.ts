import { NextRequest } from "next/server";

import { rapikanKolamSipp } from "@/lib/kolam-sipp";
import { getDatabase } from "@/server/db/client";
import { bacaKolamSippTersimpan, simpanKolamSipp } from "@/server/modules/aleta-bot/kolam-sipp";
import { requireAletaBotSuperAdmin, syncAletaBotRuntimeConfigFromDb } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kolam sambungan SIPP di bot (K3). Hanya Super Admin.
 *   GET               -> setelan berlaku (bawaan bila belum pernah disimpan)
 *   PUT {...}         -> simpan, lalu teruskan ke bot (berlaku tanpa mulai ulang)
 *   PUT {bawaan:true} -> kembali ke bawaan
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await requireAletaBotSuperAdmin(db, await resolveActorUserId(request));
    const tersimpan = await bacaKolamSippTersimpan(db);
    return ok({ setelan: rapikanKolamSipp(tersimpan), tersimpan: Boolean(tersimpan) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireAletaBotSuperAdmin(db, actorUserId);
    const badan = await readJsonBody<Record<string, unknown>>(request);
    const setelan = await simpanKolamSipp(db, actorUserId, badan.bawaan === true ? null : badan);
    const sinkron = await syncAletaBotRuntimeConfigFromDb(db).catch((error: unknown) => ({
      runtimeSync: { attempted: true, ok: false, message: error instanceof Error ? error.message : "Sinkron ke bot gagal." },
    }));
    const hasilSinkron = (sinkron as { runtimeSync?: { ok: boolean; message: string } }).runtimeSync ?? null;
    return ok({ setelan, tersimpan: true, sinkron: hasilSinkron });
  } catch (error) {
    return handleRouteError(error);
  }
}
