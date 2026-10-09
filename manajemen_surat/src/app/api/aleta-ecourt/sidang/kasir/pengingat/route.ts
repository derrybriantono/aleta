import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { bacaPengingatKasir, kosongkanSinggahPengingatKasir, pastikanHakKasir } from "@/server/modules/aleta-ecourt/kasir-otomatis";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pengingat tugas kasir (1.189.x butir 5).
 *
 *   GET            sisa panjar belum dikembalikan, perkara putus belum dijurnal,
 *                  panjar kurang, PNBP belum disetor. Hanya membaca SIPP.
 *   POST           { tanggal: string[], ntpn?, keterangan? } - tandai hari-hari
 *                  ber-PNBP sudah disetor. Ditulis ke basis data ALETA bot
 *                  (aleta_bot_kasir_setor_pnbp), TIDAK ke SIPP; jumlahnya
 *                  dibaca dari jurnal SIPP, bukan diketik.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanHakKasir(db, actorUserId);
    const hasil = await bacaPengingatKasir({ segar: request.nextUrl.searchParams.get("segar") === "1" });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.alasan });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_PENGINGAT_READ_FAILED",
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
    const aktor = await pastikanHakKasir(db, actorUserId);
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const tanggal = (Array.isArray(badan.tanggal) ? badan.tanggal : [badan.tanggal]).map((x) => String(x ?? "").slice(0, 10)).slice(0, 62);
    const akun = await akunSippPengguna(db, aktor.id);
    const hasil = await panggilBotJadwalSidang("/kasir/setor-pnbp", {
      method: "POST",
      body: {
        tanggal,
        ntpn: String(badan.ntpn ?? "").slice(0, 60),
        keterangan: String(badan.keterangan ?? "").slice(0, 200),
        operator: String(aktor.name || aktor.email || aktor.id),
        akunSipp: akun.ok ? akun.username : "",
        ip: alamatIpPeramban(request),
      },
      timeoutMs: 20_000,
    });
    kosongkanSinggahPengingatKasir();
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_SETOR_PNBP_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
