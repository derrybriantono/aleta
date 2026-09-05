import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayEcourtSesi,
  keluarGatewayEcourt,
  kirimGatewayEcourtLogin,
  mulaiGatewayEcourtLogin,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keadaan sesi e-Court. */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const penuh = request.nextUrl.searchParams.get("periksa") === "penuh";
    const hasil = await getGatewayEcourtSesi(penuh);

    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi.", sesi: null });
    }
    return ok({
      available: true,
      message: "",
      sesi: hasil.data?.sesi ?? null,
      // Bentuk baru: keadaan bernilai tiga - berlaku, kedaluwarsa, atau belum
      // dipastikan - beserta nama pengguna dan kapan terakhir diperiksa.
      keadaan: (hasil.data as { keadaan?: unknown })?.keadaan ?? null,
      menunggu: hasil.data?.menunggu === true,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_SESSION_READ_FAILED",
      feature: "ecourt",
      entityId: "sesi",
    });
  }
}

/**
 * Membuka, mengirim, atau menutup login e-Court.
 *
 * ============================================================================
 * BADAN PERMINTAAN INI DAPAT MEMUAT SANDI
 * ============================================================================
 *
 * Aksi "kirim" membawa sandi e-Court petugas. Tidak ada satu pun bagian
 * badan permintaan yang boleh dicatat: bukan ke log, bukan ke jejak audit,
 * bukan ke pesan galat. Yang dicatat hanya AKSI dan hasilnya.
 *
 * Sandi diteruskan langsung ke bot dan tidak pernah disimpan di portal.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const body = (await request.json()) as {
      aksi?: string;
      email?: string;
      sandi?: string;
      captcha?: string;
    };

    if (body.aksi === "mulai") {
      const hasil = await mulaiGatewayEcourtLogin();
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
      return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
    }

    if (body.aksi === "kirim") {
      const hasil = await kirimGatewayEcourtLogin({
        email: String(body.email || ""),
        sandi: String(body.sandi || ""),
        captcha: String(body.captcha || ""),
      });
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
      return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
    }

    if (body.aksi === "keluar") {
      const hasil = await keluarGatewayEcourt();
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
      return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
    }

    return ok({ ok: false, alasan: "aksi_tidak_dikenali" });
  } catch (error) {
    // Galat sengaja tidak diteruskan apa adanya: pesannya dapat memuat
    // potongan badan permintaan, dan badan permintaan ini memuat sandi.
    return handleAdminRouteError(new Error("Permintaan login e-Court gagal diproses."), request, {
      db,
      actorUserId,
      action: "ECOURT_LOGIN_FAILED",
      feature: "ecourt",
      entityId: "login",
    });
  }
}
