import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanBolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { bacaPengaturan } from "@/server/modules/putusan-terjadwal/dasar";
import { simpanPengaturan } from "@/server/modules/putusan-terjadwal/layanan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pengaturan unggah putusan terjadwal: berapa hari berkas disimpan sesudah
 * selesai, dan saklar pelaksana server. Dibaca semua yang berhak unggah putusan;
 * diubah hanya Super Admin dan Admin.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAksi(db, actorUserId, "putusan.unggah");
    await pastikanBolehUnggahPutusan(db, actorUserId);
    return ok({ ok: true, pengaturan: await bacaPengaturan(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_PENGATURAN_BACA_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal-pengaturan",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAksi(db, actorUserId, "putusan.unggah");
    const pelaku = await pastikanBolehUnggahPutusan(db, actorUserId);
    const badan = await readJsonBody<{ hapusHari?: unknown; pelaksanaNyala?: unknown }>(request);
    return ok({ ok: true, pengaturan: await simpanPengaturan(db, pelaku, badan) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_PENGATURAN_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal-pengaturan",
    });
  }
}
