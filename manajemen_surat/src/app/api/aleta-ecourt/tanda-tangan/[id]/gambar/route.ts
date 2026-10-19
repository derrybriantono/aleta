import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { ambilGambarTandaTangan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { getGatewayTandaTangan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { getUserByIdFromDb } from "@/server/modules/organization/service";
import { barisTtdMilik, type BarisTtd } from "@/lib/ttd-milik-sendiri";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gambar satu tanda tangan.
 *
 * Dipakai layar pengesahan: yang menamai HARUS melihat gambarnya. Menamai
 * tanda tangan dari daftar tanpa melihat gambarnya sama saja dengan menebak,
 * dan yang ditebak di sini tanda tangan hakim pada penetapan pengadilan.
 *
 * Kewenangannya sama dengan pengesahannya - dan bukan hanya karena
 * kerapian: gambar tanda tangan pejabat yang dapat diunduh siapa saja adalah
 * gambar yang dapat dipasang di mana saja.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const { id } = await params;
    const nomor = Number(id);
    try {
      await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    } catch (galat) {
      // Akun tanpa kapabilitas hanya boleh mengambil gambar tanda tangan SAH miliknya sendiri (cetak PDF Blangko Derry).
      if (!(galat instanceof ApiError) || galat.status !== 403 || !Number.isFinite(nomor) || nomor <= 0) throw galat;
      const aktor = actorUserId ? await getUserByIdFromDb(db, actorUserId) : null;
      const daftar = (await getGatewayTandaTangan(true)) as { ok?: boolean; baris?: BarisTtd[] } | null;
      const milik = aktor && daftar && daftar.ok !== false ? barisTtdMilik(daftar.baris ?? [], { id: String(aktor.id), name: String(aktor.name ?? "") }) : [];
      if (!milik.some((b) => Number(b.id) === nomor)) throw galat;
    }
    if (!Number.isFinite(nomor) || nomor <= 0) {
      return Response.json({ ok: false, alasan: "id_tidak_sah" }, { status: 400 });
    }

    const respons = await ambilGambarTandaTangan(nomor);
    if (!respons.ok) {
      return Response.json(
        { ok: false, alasan: respons.status === 404 ? "tanda_tangan_tidak_ketemu" : "gambar_tidak_terambil" },
        { status: respons.status === 404 ? 404 : 502 }
      );
    }

    const isi = Buffer.from(await respons.arrayBuffer());
    return new Response(new Uint8Array(isi), {
      status: 200,
      headers: {
        "Content-Type": respons.headers.get("content-type") || "image/png",
        "Content-Length": String(isi.length),
        // Tidak pernah disimpan peramban bersama - ia gambar tanda tangan
        // pejabat, bukan ikon.
        "Cache-Control": "private, max-age=300, no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "TANDA_TANGAN_GAMBAR_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
