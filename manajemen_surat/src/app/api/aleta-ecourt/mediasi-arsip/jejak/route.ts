import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { catatKirimanSipp } from "@/server/modules/mediasi-arsip/layanan";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mencatat kiriman berkas hasil mediasi ke e-Doc Akta Perdamaian SIPP.
 *
 *   POST { id, hasil: "berhasil"|"gagal", ringkas?, akunSipp?, menimpa? } -> { ok }
 *
 * Kirimannya DIKERJAKAN peramban petugas lewat jalur unggah SIPP sendiri atas akun SIPP yang
 * masuk (SIPP yang mencatat auditnya). Rute ini hanya menulis jejak di arsip ALETA.
 * Hak: mediasi.arsip-unggah.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanAksi(db, actorUserId, "mediasi.arsip-unggah");
    const badan = (await readJsonBody(request)) as { id?: unknown; hasil?: unknown; ringkas?: unknown; akunSipp?: unknown; menimpa?: unknown };
    return ok(await catatKirimanSipp(db, aktor, { ...badan, ip: getRequestAuditMetadata(request).ipAddress }));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "MEDIASI_ARSIP_JEJAK_GAGAL", feature: "aleta_ecourt", entityId: "mediasi-arsip-jejak" });
  }
}
