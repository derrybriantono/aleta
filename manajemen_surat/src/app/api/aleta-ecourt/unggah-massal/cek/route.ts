import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayUnggahMassalCek } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { hakUnggahMassal } from "@/server/modules/aleta-ecourt/unggah-massal";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CEK DOBEL SATU e-DOC (F4.1) - BACA SAJA
 *
 *   GET ?jenis=putusan&perkaraId=  -> { adaBaris, adaPutusan, adaAnonim, jalurPutusan, jalurAnonim, tanggalPutusan }
 *   GET ?jenis=bas&perkaraId=&sidangId= -> { adaBas, jalur, urutan, tanggalSidang }
 *
 * Dipanggil ekstensi tepat sebelum tiap unggahan: e-Doc yang SUDAH ada (diisi
 * orang lain sejak daftar dimuat) tidak diganti - sejalan dengan penjaga dobel
 * L1 di tingkap e-Doc SIPP. Hak sama dengan jenisnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const q = request.nextUrl.searchParams;
    const jenis = q.get("jenis") === "bas" ? "bas" : q.get("jenis") === "putusan" ? "putusan" : null;
    const perkaraId = String(q.get("perkaraId") ?? "").trim();
    const sidangId = String(q.get("sidangId") ?? "").trim();
    if (!jenis || !/^\d{1,12}$/.test(perkaraId) || (jenis === "bas" && !/^\d{1,12}$/.test(sidangId))) {
      return Response.json({ ok: false, alasan: "Perkara atau sidang belum disebut dengan benar." }, { status: 400 });
    }
    const hak = hakUnggahMassal(actor);
    if (!hak[jenis]) {
      return Response.json({ ok: false, alasan: "Peran Anda tidak diberi hak unggah untuk jenis dokumen ini." }, { status: 403 });
    }
    const jawab = await getGatewayUnggahMassalCek({ jenis, perkaraId, sidangId });
    if (!jawab.ok) return Response.json({ ok: false, alasan: jawab.error || "SIPP belum dapat dibaca." }, { status: 502 });
    return ok(jawab.data);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "UNGGAH_MASSAL_CEK_FAILED",
      feature: "aleta_ecourt",
      entityId: "unggah-massal-cek",
    });
  }
}
