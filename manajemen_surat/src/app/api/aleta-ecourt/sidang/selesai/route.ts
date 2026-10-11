import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tombol "Selesai" Jadwal Sidang - sinkron dua arah dengan antrian sidang
 * (perbaikan 1 Oktober 2026, butir J2).
 *
 *   GET  ?dari&sampai  peta perkara|tanggal yang selesai menurut catatan ALETA,
 *                      antrian SIPP (antrian.status = 2), dan mesin antrian
 *                      ruang tunggu bila nilai selesainya disetel.
 *   GET  ?diagnosa=1   nilai disidang yang hidup hari ini di mesin ruang tunggu.
 *   POST               menandai / membatalkan selesai. Kewenangannya "panel",
 *                      sama dengan tombol tunda|putus dan Antrian di baris yang
 *                      sama. `kering: false` harus disebut tegas.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    if (request.nextUrl.searchParams.get("diagnosa") === "1") {
      const hasil = await panggilBotJadwalSidang("/selesai/diagnosa");
      return ok(hasil.ok ? { available: true, ...hasil.data } : { available: false, alasan: hasil.error });
    }

    const dari = String(request.nextUrl.searchParams.get("dari") || "").slice(0, 10);
    const sampai = String(request.nextUrl.searchParams.get("sampai") || dari).slice(0, 10);
    const hasil = await panggilBotJadwalSidang(
      `/selesai?${new URLSearchParams({ dari, sampai }).toString()}`
    );
    if (!hasil.ok) return ok({ available: false, peta: {}, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_SELESAI_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.jalannya"); // HAK-PERAN 12 Okt: matriks peran
    const badan = (await request.json()) as Record<string, unknown>;

    const hasil = await panggilBotJadwalSidang("/selesai", {
      method: "POST",
      body: {
        perkaraId: String(badan.perkaraId ?? ""),
        tanggalSidang: String(badan.tanggalSidang ?? "").slice(0, 10),
        nomorPerkara: String(badan.nomorPerkara ?? ""),
        ruangId: badan.ruangId ?? null,
        selesai: badan.selesai !== false,
        // Yang menekan tombolnya - tercatat di catatan selesai ALETA.
        operator: actor?.name || actorUserId || "portal",
        kering: badan.kering !== false,
      },
    });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_SELESAI_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
