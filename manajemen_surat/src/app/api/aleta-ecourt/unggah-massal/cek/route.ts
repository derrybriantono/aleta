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
    // Banyak perkara menurut NOMOR (layar massal dari berkas yang hanya mengenal nama berkas), dipisah "|".
    const nomorBanyak = String(q.get("nomor") ?? "").trim();
    if (jenis === "putusan" && nomorBanyak) {
      const nomor = [...new Set(nomorBanyak.split("|").map((x) => x.trim()).filter(Boolean))];
      if (nomor.length > 200 || !nomor.every((x) => /^[0-9A-Za-z./ -]{3,60}$/.test(x))) {
        return Response.json({ ok: false, alasan: "Daftar nomor perkara tidak sah (paling banyak 200)." }, { status: 400 });
      }
      if (!hakUnggahMassal(actor).putusan) {
        return Response.json({ ok: false, alasan: "Peran Anda tidak diberi hak unggah untuk jenis dokumen ini." }, { status: 403 });
      }
      const menurutNomor = await getGatewayUnggahMassalCek({ jenis: "putusan", perkaraId: "", nomor: nomor.join("|") });
      if (!menurutNomor.ok) return Response.json({ ok: false, alasan: menurutNomor.error || "SIPP belum dapat dibaca." }, { status: 502 });
      return ok(menurutNomor.data);
    }
    // Banyak perkara sekaligus (5 Nov 2026): penanda sudah/belum diunggah di layar massal, SATU kueri.
    if (jenis === "putusan" && perkaraId.includes(",")) {
      const id = [...new Set(perkaraId.split(",").map((x) => x.trim()).filter(Boolean))];
      if (id.length > 200 || !id.every((x) => /^\d{1,12}$/.test(x))) {
        return Response.json({ ok: false, alasan: "Daftar perkara tidak sah (paling banyak 200 nomor induk)." }, { status: 400 });
      }
      const hakBanyak = hakUnggahMassal(actor);
      if (!hakBanyak.putusan) {
        return Response.json({ ok: false, alasan: "Peran Anda tidak diberi hak unggah untuk jenis dokumen ini." }, { status: 403 });
      }
      const banyak = await getGatewayUnggahMassalCek({ jenis: "putusan", perkaraId: id.join(",") });
      if (!banyak.ok) return Response.json({ ok: false, alasan: banyak.error || "SIPP belum dapat dibaca." }, { status: 502 });
      return ok(banyak.data);
    }
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
