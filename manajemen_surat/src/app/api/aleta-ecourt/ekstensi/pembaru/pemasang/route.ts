import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { alamatDasarPortal } from "@/server/shared/ekstensi-alamat";
import { susunPemasang } from "@/server/shared/pembaru-pemasang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pemasang pembaru otomatis - SATU berkas .cmd, diklik dua kali sekali per komputer.
 *
 * Menuntut sesi portal seperti rute unduh ekstensi. ?id= (opsional) adalah ID
 * ekstensi yang memintanya; nilai yang bukan 32 huruf a-p diabaikan.
 *
 * Nama berkasnya .cmd - bukan .zip - sehingga tidak dicegat Internet Download
 * Manager (yang mencegat ZIP dan mengosongkannya).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const isi = susunPemasang({
      asalPortal: alamatDasarPortal(request),
      idEkstensi: request.nextUrl.searchParams.get("id") || "",
    });
    const bita = Buffer.from(isi, "utf8");
    return new Response(new Uint8Array(bita), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="pasang-pembaru-aleta.cmd"',
        "Content-Length": String(bita.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "EKSTENSI_PEMBARU_PEMASANG_FAILED",
      feature: "aleta_ecourt",
      entityId: "ekstensi",
    });
  }
}
