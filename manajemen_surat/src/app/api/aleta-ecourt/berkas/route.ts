import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ambilBerkasGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mengunduh satu berkas dokumen e-Court, dipanggil ekstensi dari halaman SIPP.
 *
 * ============================================================================
 * BERKAS DIALIRKAN, TIDAK DIURAI
 * ============================================================================
 *
 * Rute ini tidak memakai gatewayFetch seperti rute lain, karena gatewayFetch
 * mengurai jawabannya sebagai JSON. Yang datang di sini adalah isi berkas PDF
 * atau Word - menguraikannya sebagai JSON akan merusaknya.
 *
 * Isinya diteruskan apa adanya beserta tipe dan nama berkasnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "berkas");

    const documentKey = String(request.nextUrl.searchParams.get("documentKey") || "").trim();
    const format = request.nextUrl.searchParams.get("format") === "word" ? "word" : "pdf";
    if (!documentKey) {
      return Response.json({ ok: false, alasan: "document_key_kosong" }, { status: 400 });
    }

    const respons = await ambilBerkasGateway(documentKey, format);

    if (!respons.ok) {
      // Jawaban galat dari bot berupa JSON; diteruskan apa adanya supaya
      // ekstensi dapat menjelaskan sebabnya ke petugas.
      const teks = await respons.text();
      return new Response(teks, {
        status: respons.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isi = await respons.arrayBuffer();
    return new Response(isi, {
      status: 200,
      headers: {
        "Content-Type": respons.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": respons.headers.get("content-disposition") || "attachment",
        "Content-Length": String(isi.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "EKSTENSI_BERKAS_FAILED",
      feature: "aleta_ecourt",
      entityId: "berkas",
    });
  }
}
