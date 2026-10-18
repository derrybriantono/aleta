import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { postGatewayIsiIkrar } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mengisi form "Penetapan Ikrar Talak" SIPP sesudah ikrar terlaksana.
 *
 * INI MENULIS KE SIPP (perkara_ikrar_talak, perkara_akta_cerai, riwayat perkara,
 * sys_audittrail). Hak aksesnya sama dengan tombol tunda/putus Jadwal Sidang.
 * Akun SIPP yang tercatat diturunkan bot dari perkaranya (ketua majelis ikrar) -
 * tidak pernah diketik. Penekan sebenarnya dikirim hanya untuk jejak ALETA.
 * Kering kecuali disebut tegas `kering: false`.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.tunda-putus");

    const badan = (await request.json()) as Record<string, unknown>;
    const akunPenekan = await akunSippPengguna(db, aktor.id).catch(() => null);
    const hasil = await postGatewayIsiIkrar({
      jadwalId: badan.jadwalId,
      perkaraId: badan.perkaraId,
      operator: actorUserId || "portal",
      operatorNama: String(aktor.name || aktor.email || ""),
      operatorAkunSipp: akunPenekan && akunPenekan.milik.length ? akunPenekan.milik.join(", ") : "",
      ip: alamatIpPeramban(request),
      kering: badan.kering !== false,
      // Keputusan 104 (18 Okt 2026): pilihan jam kerja diteruskan apa adanya ke bot.
      tanyaJamKerja: badan.tanyaJamKerja === true,
      jamKerja: badan.jamKerja === "antrekan" || badan.jamKerja === "sekarang" ? badan.jamKerja : undefined,
    });
    if (!hasil.ok) {
      return ok({
        available: Boolean(hasil.status),
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
        kode: hasil.kode,
      });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_IKRAR_ISI_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
