import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilAntrian } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Memanggil satu nomor antrian.
 *
 * ============================================================================
 * SATU-SATUNYA TINDAKAN YANG BENAR-BENAR MENGUBAH KEADAAN
 * ============================================================================
 *
 * Mengambil antrian menambah orang ke deret; memanggil MEMINDAHKAN gilirannya.
 * Karena itu kemampuan yang dituntut "permintaan" - sama dengan menyuruh ALETA
 * mengerjakan sesuatu di luar dirinya - bukan "panel" yang hanya membaca.
 *
 * Yang ditulis persis yang ditulis mesin antrian, sehingga layar aplikasi
 * antrian tetap benar. Yang ditambahkan ALETA hanya riwayatnya: sudah
 * dipanggil berapa kali, jam berapa saja, dan oleh siapa.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "permintaan");

    const isi = (await request.json().catch(() => ({}))) as {
      perkaraId?: string;
      nomorPerkara?: string;
      nomorAntrian?: number | null;
      noRuang?: number | null;
    };

    if (!String(isi.perkaraId || "").trim()) {
      return ok({ available: true, ok: false, alasan: "Perkara belum dipilih." });
    }

    const hasil = await panggilAntrian({
      perkaraId: String(isi.perkaraId),
      nomorPerkara: String(isi.nomorPerkara || ""),
      nomorAntrian: isi.nomorAntrian ?? null,
      noRuang: isi.noRuang ?? null,
      oleh: actor.name || actor.id,
    });

    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }

    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_PANGGIL_FAILED",
      feature: "antrian",
      entityId: "antrian-panggil",
    });
  }
}
