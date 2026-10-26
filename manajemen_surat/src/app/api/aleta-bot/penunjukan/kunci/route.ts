import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { ambilKunciPenetapanGateway, lepasKunciPenetapanGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getUserByIdFromDb } from "@/server/modules/organization/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kunci penetapan per perkara untuk pekerjaan yang berjalan DI PERAMBAN:
 * mengisi borang SIPP lalu menekan Simpan SIPP, atau mengunggah e-Doc sesudah
 * penetapan tertulis. Kunci yang sama dipegang jalur server (kerjakan, rantai,
 * antrean) - dua pekerjaan atas satu perkara tidak berjalan bersamaan.
 *
 * Badan: { perkaraId, aksi: "ambil" | "lepas", token?, tujuan?, ttlDetik? }.
 * Operator diambil dari sesi ALETA, bukan dari badan.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");
    const aktor = actorUserId ? await getUserByIdFromDb(db, actorUserId) : null;
    const operator = String(aktor?.name || aktor?.email || actorUserId || "").trim();
    if (!operator) return Response.json({ ok: false, alasan: "operator_tidak_dikenali" }, { status: 403 });

    const badan = (await request.json()) as Record<string, unknown>;
    const perkaraId = Number(badan.perkaraId);
    if (!Number.isFinite(perkaraId) || perkaraId <= 0) return ok({ ok: false, alasan: "perkara_tidak_sah" });
    const token = String(badan.token || "");

    if (badan.aksi === "lepas") {
      if (!token) return ok({ ok: false, alasan: "kunci_tidak_sah" });
      const r = await lepasKunciPenetapanGateway({ perkaraId, token });
      return ok(r.ok ? r.data : { ok: false, alasan: r.error });
    }

    const r = await ambilKunciPenetapanGateway({
      perkaraId,
      operator,
      tujuan: String(badan.tujuan || "peramban").slice(0, 80),
      ttlDetik: Number(badan.ttlDetik) > 0 ? Number(badan.ttlDetik) : undefined,
      token: token || undefined,
      ambilAlih: badan.ambilAlih === true,
    });
    if (r.ok) return ok(r.data);
    return ok({
      ok: false,
      alasan: r.error === "sedang_dikerjakan" ? "sedang_dikerjakan" : "kunci_tidak_tersedia",
      pesan: r.error,
      ...(r.badan
        ? {
            oleh: r.badan.oleh,
            sampai: r.badan.sampai,
            tujuan: r.badan.tujuan,
            sejak: r.badan.sejak,
            terakhirAktif: r.badan.terakhirAktif,
            milikSendiri: r.badan.milikSendiri,
            tungguDetik: r.badan.tungguDetik,
          }
        : {}),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENETAPAN_KUNCI_FAILED",
      feature: "penunjukan",
      entityId: "kunci",
    });
  }
}
