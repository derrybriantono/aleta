import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  ambilBerkasSippGateway,
  type JenisBerkasSipp,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JENIS_SAH = new Set(["dokumen", "relaas", "resi", "bas", "putusan", "putusan-anonim", "penetapan", "ikrar-talak", "arsip", "petitum"]);

/**
 * Mengunduh berkas yang tersimpan di SIPP - dokumen perkara, relaas, resi pos.
 *
 * ============================================================================
 * BERKAS DIALIRKAN, TIDAK DIURAI
 * ============================================================================
 *
 * Seperti rute berkas e-Court: yang datang adalah isi PDF atau Word, dan
 * menguraikannya sebagai JSON akan merusaknya.
 *
 * ============================================================================
 * YANG DIKIRIM PERAMBAN HANYA NOMOR BARIS
 * ============================================================================
 *
 * Jalur berkasnya tidak pernah datang dari peramban - bot mencarinya sendiri
 * di SIPP berdasarkan nomor baris, lalu melewatkannya penyaring ekstensi dan
 * akar folder yang sudah ada. Dengan begitu tidak ada nama berkas yang dapat
 * disusun sendiri untuk membaca sesuatu di luar dokumen perkara.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "berkas");

    const jenis = String(request.nextUrl.searchParams.get("jenis") || "").trim();
    const id = String(request.nextUrl.searchParams.get("id") || "").trim();

    if (!JENIS_SAH.has(jenis)) {
      return Response.json({ ok: false, alasan: "jenis_tidak_dikenali" }, { status: 400 });
    }
    if (!/^[0-9]+$/.test(id)) {
      return Response.json({ ok: false, alasan: "nomor_berkas_tidak_sah" }, { status: 400 });
    }

    const respons = await ambilBerkasSippGateway(jenis as JenisBerkasSipp, id);

    if (!respons.ok) {
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
      action: "SIPP_BERKAS_PERKARA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
