import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { gambarCap } from "@/server/modules/aleta-ecourt/penetapan-edoc";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gambar satu cap - untuk layar Berkas tanda tangan. Kewenangannya sama
 * dengan pengelolaannya: gambar cap pengadilan yang dapat diunduh siapa saja
 * adalah cap yang dapat ditempel di mana saja.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const { id } = await params;
    const g = await gambarCap(db, String(id).slice(0, 64));
    if (!g)
      return Response.json(
        { ok: false, alasan: "cap_tidak_ditemukan" },
        { status: 404 },
      );
    return new Response(new Uint8Array(g.isi), {
      status: 200,
      headers: {
        "Content-Type": g.jenis === "jpg" ? "image/jpeg" : "image/png",
        "Content-Length": String(g.isi.length),
        "Cache-Control": "private, max-age=300, no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "CAP_PENETAPAN_GAMBAR_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
