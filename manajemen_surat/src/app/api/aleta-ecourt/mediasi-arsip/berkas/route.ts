import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { ambilIsiBerkas } from "@/server/modules/mediasi-arsip/layanan";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Isi satu berkas hasil mediasi.
 *
 *   GET ?id=&bentuk=pdf|asli&aksi=lihat|unduh -> berkasnya (biner), nama lewat Content-Disposition
 *
 * Hak: mediasi.arsip-lihat. Tiap pembacaan dicatat di jejak (siapa, kapan, lihat/unduh).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanAksi(db, actorUserId, "mediasi.arsip-lihat");
    const p = request.nextUrl.searchParams;
    const hasil = await ambilIsiBerkas(db, aktor, {
      id: p.get("id"),
      bentuk: p.get("bentuk"),
      aksi: p.get("aksi"),
      ip: getRequestAuditMetadata(request).ipAddress,
    });
    return new Response(Buffer.from(hasil.bita), {
      status: 200,
      headers: {
        "content-type": hasil.mime,
        "content-length": String(hasil.bita.length),
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(hasil.nama)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "MEDIASI_ARSIP_BERKAS_GAGAL", feature: "aleta_ecourt", entityId: "mediasi-arsip-berkas" });
  }
}
