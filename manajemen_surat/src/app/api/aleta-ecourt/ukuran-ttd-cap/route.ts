import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaUkuranTtdCap, simpanUkuranTtdCap } from "@/server/modules/aleta-ecourt/ukuran-ttd-cap";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * UKURAN TANDA TANGAN DAN CAP (20 Okt 2026) - kartu di halaman Tanda tangan
 * pejabat dan ekstensi ("Tambah tanda tangan ke PDF").
 *
 *   GET  semua pegawai yang masuk
 *        -> { ukuran, ukuranBot, bawaan, batas, tersimpan, lama, pemberitahuanLama, bolehMengubah }
 *   PUT  { lebarTtdMm, ttdTurunMm, diameterCapMm, capGeserKiriMm, capGeserAtasMm, opasitasCap }
 *        | { kembalikanBawaan: true }   Super Admin & Admin saja -> sama dengan GET.
 *
 * Hanya angka ukuran - tanpa gambar tanda tangan atau cap.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok(await bacaUkuranTtdCap(db, actor));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "UKURAN_TTD_CAP_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    let badan: Record<string, unknown>;
    try {
      const isi = (await request.json()) as unknown;
      badan = isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok(await simpanUkuranTtdCap(db, actorUserId, badan));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "UKURAN_TTD_CAP_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
