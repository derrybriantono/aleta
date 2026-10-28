import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { pastikanHakKasir } from "@/server/modules/aleta-ecourt/kasir-otomatis";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Riwayat pekerjaan Kasir ALETA (28 Okt 2026).
 *
 *   GET ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&nomor=<potongan nomor perkara>&batas=<n>
 *
 * Jurnal yang SUNGGUH ditulis Kasir otomatis, Kasir Manual (satu hari), dan
 * Kasir per perkara: waktu, nomor perkara, uraian, nominal, atas akun SIPP
 * siapa, dijalankan pengguna ALETA siapa, berhasil/gagal. Dibaca dari jejak
 * ALETA (basis data bot), tanpa menyentuh SIPP. Hak sama dengan Kasir (baca).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanHakKasir(db, actorUserId);
    const p = request.nextUrl.searchParams;
    const kueri = new URLSearchParams();
    for (const kunci of ["dari", "sampai", "nomor", "batas"]) {
      const nilai = String(p.get(kunci) ?? "").trim().slice(0, 60);
      if (nilai) kueri.set(kunci, nilai);
    }
    const hasil = await panggilBotJadwalSidang(`/kasir/riwayat?${kueri.toString()}`, { timeoutMs: 20_000 });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error, pekerjaan: [] });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_RIWAYAT_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
