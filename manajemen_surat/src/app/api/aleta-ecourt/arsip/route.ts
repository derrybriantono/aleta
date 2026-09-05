import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  bersihkanGatewayEcourtArsip,
  getGatewayEcourtArsip,
  saveGatewayEcourtArsip,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keadaan ruang dan masa simpan arsip. */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const hasil = await getGatewayEcourtArsip();
    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi.", arsip: null });
    }
    return ok({ available: true, message: "", arsip: hasil.data?.arsip ?? null });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_ARSIP_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "arsip",
    });
  }
}

/**
 * Menyimpan pengaturan arsip, atau membersihkan berkas kedaluwarsa.
 *
 * Penghapusan berkas perkara adalah tindakan yang tidak dapat ditarik kembali,
 * jadi nama pelakunya selalu diambil dari akun yang login dan tercatat di
 * jejak keamanan.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    const body = (await request.json()) as {
      aksi?: string;
      hapus?: boolean;
      minRuangGb?: number;
      maksBerkasMb?: number;
      simpanBulan?: number;
    };

    if (body.aksi === "bersihkan") {
      const hasil = await bersihkanGatewayEcourtArsip({
        // hapus:true hanya bila dinyatakan tegas. Tanpa itu, yang dikembalikan
        // adalah laporan tentang apa yang AKAN dihapus.
        hapus: body.hapus === true,
        olehSiapa: actor.name,
      });
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
      return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
    }

    const hasil = await saveGatewayEcourtArsip({
      minRuangGb: Number(body.minRuangGb),
      maksBerkasMb: Number(body.maksBerkasMb),
      simpanBulan: Number(body.simpanBulan),
      olehSiapa: actor.name,
    });

    if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
    return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_ARSIP_WRITE_FAILED",
      feature: "aleta_ecourt",
      entityId: "arsip",
    });
  }
}
