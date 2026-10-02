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
 * Email dan persetujuan saluran elektronik para pihak satu perkara - perbaikan
 * 2 Oktober 2026 malam, butir 1e/1f. HANYA MEMBACA.
 *
 *   GET  ?perkaraId   { kontak: { ecourtTerbaca, sebab, penggugat: { adaEmail,
 *                     sumber }, tergugat: { adaEmail, persetujuan }, terakhirTerlihat } }
 *
 * Bahan aturan tunda karena ketidakhadiran (@/lib/bawaan-tunda): tergugat yang
 * tidak hadir dipanggil ulang sepekan bila punya email dan menyetujui e-Court,
 * dua pekan bila tidak. Datanya dari jembatan e-Court yang SUDAH ada (tabel bot
 * aleta_bot_ecourt_pihak) dan SIPP - route ini tidak menyentuh e-Court.
 *
 * DATA PRIBADI: alamat email tidak pernah sampai sini - hanya ada/tidaknya.
 * Kewenangannya "panel", sama dengan keadaan sidang yang dibaca bersamanya;
 * pesan galat tidak diteruskan apa adanya.
 *
 *   kontak: null   tidak terbaca - layar menjatuhkan aturan ke "tanpa email" dan
 *                  menyebut sebabnya, tidak menebak.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    if (!/^\d{1,20}$/.test(perkaraId)) {
      return ok({ available: true, ok: false, alasan: "Nomor perkara wajib diisi.", kontak: null });
    }
    const hasil = await panggilBotJadwalSidang(`/pihak-elektronik?${new URLSearchParams({ perkaraId }).toString()}`);
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: "ALETA Bot belum dapat dihubungi.", kontak: null });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_KONTAK_PIHAK_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
