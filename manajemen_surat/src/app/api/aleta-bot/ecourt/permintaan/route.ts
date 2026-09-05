import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayEcourtPermintaan,
  titipGatewayEcourtPermintaan,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permintaan penarikan satu perkara dari e-Court.
 *
 * Petugas membuka perkara di SIPP dan datanya belum ada. Permintaannya
 * DITITIPKAN, bukan dikerjakan seketika: alamat e-Court buram, sehingga
 * menariknya berarti menyapu daftar lebih dulu - satu sampai tiga menit yang
 * tidak masuk akal untuk ditunggu di depan layar.
 *
 * Penjagaan terhadap banjir permintaan ada di bot: satu permintaan tertunda
 * per perkara, jeda setelah selesai, dan batas panjang antrean.
 */

/** Keadaan permintaan terakhir untuk satu perkara. */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "permintaan");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) return ok({ available: true, keadaan: null, alasan: "nomor_perkara_kosong" });

    const hasil = await getGatewayEcourtPermintaan(nomor);
    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi.", keadaan: null });
    }
    return ok({ available: true, keadaan: hasil.data?.keadaan ?? null });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PERMINTAAN_READ_FAILED",
      feature: "sipp_konteks",
    });
  }
}

/** Menitipkan permintaan baru. */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "permintaan");

    const body = await readJsonBody<{ nomorPerkara?: string }>(request).catch(
      () => ({}) as { nomorPerkara?: string }
    );
    const nomor = String(body.nomorPerkara || "").trim();
    if (!nomor) return ok({ available: true, ok: false, alasan: "nomor_perkara_kosong" });

    // Nama peminta SELALU dari akun yang login, tidak pernah dari permintaan.
    // Ini catatan siapa yang meminta penarikan, dan catatan yang dapat diisi
    // pemanggil bukan catatan.
    const hasil = await titipGatewayEcourtPermintaan(nomor, actor.name);
    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi.", ok: false });
    }

    return ok({ available: true, ...(hasil.data ?? { ok: false, alasan: "jawaban_kosong" }) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PERMINTAAN_TITIP_FAILED",
      feature: "sipp_konteks",
    });
  }
}
