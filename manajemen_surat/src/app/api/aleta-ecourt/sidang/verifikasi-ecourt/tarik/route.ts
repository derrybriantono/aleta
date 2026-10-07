import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tarik ulang e-Court SATU perkara dari penanda "belum upload" Jadwal Sidang
 * (7 Okt 2026).
 *
 *   POST { nomorPerkara, tanggal }   memulai (atau bergabung ke) tarikan -
 *                                    tidak menunggu selesai
 *   GET  ?nomorPerkara               keadaan tarikan itu; ditanya layar
 *                                    berkala sampai selesai
 *
 * Kewenangannya "panel" - SAMA dengan rute yang membaca penandanya
 * (sidang/verifikasi-ecourt): yang dapat melihat penanda dapat menekannya.
 * Tidak menulis ke SIPP maupun ke e-Court (hanya membaca halaman e-Court);
 * hasilnya ke tabel dan arsip e-Court ALETA. Kunci ganda, jeda per perkara,
 * dan penolakan saat penarikan lain berjalan dijaga di bot
 * (ecourtVerifikasiHarianService.tarikSekarang).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const hasil = await panggilBotJadwalSidang("/belum-upload/tarik", {
      method: "POST",
      body: {
        nomorPerkara: String(badan.nomorPerkara ?? "").slice(0, 191),
        tanggal: String(badan.tanggal ?? "").slice(0, 10),
        // Yang menekan - hanya di catatan ALETA, tidak ke e-Court.
        operator: actor?.name || actorUserId || "portal",
      },
      timeoutMs: 15000,
    });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: "bot_tidak_tersambung", pesan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_TARIK_BELUM_UPLOAD_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const nomor = String(request.nextUrl.searchParams.get("nomorPerkara") || "").slice(0, 191);
    const hasil = await panggilBotJadwalSidang(`/belum-upload/tarik?nomorPerkara=${encodeURIComponent(nomor)}`, {
      timeoutMs: 6000,
    });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: "bot_tidak_tersambung", pesan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_TARIK_BELUM_UPLOAD_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
