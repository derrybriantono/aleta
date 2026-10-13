import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayEcourtJadwal,
  jalankanGatewayEcourtSekarang,
  saveGatewayEcourtJadwal,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keadaan penjadwal penarikan e-Court. */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const hasil = await getGatewayEcourtJadwal();
    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi.", jadwal: null });
    }
    return ok({ available: true, message: "", jadwal: hasil.data?.jadwal ?? null });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_JADWAL_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "jadwal",
    });
  }
}

/**
 * Menyimpan pengaturan penjadwal, atau menjalankan satu putaran sekarang.
 *
 * Nama pelaku selalu diambil dari akun yang sedang login. Menyalakan penarikan
 * berkala dari sistem Mahkamah Agung adalah keputusan yang perlu punya jejak
 * siapa yang mengambilnya.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Mengatur atau menjalankan penarikan dari e-Court: Super Admin dan Admin
    // saja (U5, 9 Okt 2026) - kartunya hanya digambar bagi keduanya.
    const actor = await pastikanAdminIstimewa(db, actorUserId, "mengatur atau menjalankan penarikan e-Court");

    const body = (await request.json()) as {
      aksi?: string;
      aktif?: boolean;
      jarakJam?: number;
      jamMulai?: number;
      jamSelesai?: number;
      maksPerkara?: number;
      selangMinMenit?: number;
      selangMaksMenit?: number;
      pagiAktif?: boolean;
      jamPagi?: number;
      menitPagi?: number;
    };

    if (body.aksi === "jalankan") {
      const hasil = await jalankanGatewayEcourtSekarang();
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
      return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
    }

    const hasil = await saveGatewayEcourtJadwal({
      aktif: body.aktif === true,
      jarakJam: Number(body.jarakJam),
      jamMulai: Number(body.jamMulai),
      jamSelesai: Number(body.jamSelesai),
      maksPerkara: Number(body.maksPerkara),
      // 13 Okt 2026: selang acak berkala + tarikan pagi. Tidak dikirim = bot
      // mempertahankan nilai sekarang.
      ...(body.selangMinMenit !== undefined ? { selangMinMenit: Number(body.selangMinMenit) } : {}),
      ...(body.selangMaksMenit !== undefined ? { selangMaksMenit: Number(body.selangMaksMenit) } : {}),
      ...(typeof body.pagiAktif === "boolean" ? { pagiAktif: body.pagiAktif } : {}),
      ...(body.jamPagi !== undefined ? { jamPagi: Number(body.jamPagi) } : {}),
      ...(body.menitPagi !== undefined ? { menitPagi: Number(body.menitPagi) } : {}),
      olehSiapa: actor.name,
    });

    if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
    return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_JADWAL_WRITE_FAILED",
      feature: "aleta_ecourt",
      entityId: "jadwal",
    });
  }
}
