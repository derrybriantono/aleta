import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { lakukanPanggilan } from "@/server/modules/panggil-petugas/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Panggil petugas sidang / pihak - butir 33, 34, 36 (5 Oktober 2026).
 *
 *   POST { perkaraId, tanggal, mediasiId?, konteks: "sidang"|"mediasi",
 *          kunci, saluran: "whatsapp"|"audio", ruang?, agenda?,
 *          nomorPerkara?, setujuBelumTerverifikasi? }
 *
 * Kewenangannya "panel" - sama dengan Tunda/Putus/Selesai/Skors di baris
 * jadwal yang sama; pihak luar (tanpa akun ALETA berkapabilitas) tidak dapat
 * memicunya. Sasaran dan nomornya dibaca ULANG di peladen dari SIPP dan akun
 * ALETA - yang dikirim layar hanya kunci orangnya, tidak pernah nomor.
 * Tiap panggilan dicatat di aleta_bot_panggil_riwayat dan audit_logs.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.antrian"); // HAK-PERAN 12 Okt: matriks peran
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const hasil = await lakukanPanggilan(
      db,
      { id: actorUserId, nama: actor?.name || actorUserId || "portal", ip: alamatIpPeramban(request) },
      {
        perkaraId: String(badan.perkaraId ?? ""),
        tanggal: String(badan.tanggal ?? "").slice(0, 10),
        mediasiId: String(badan.mediasiId ?? "").slice(0, 32),
        konteks: badan.konteks === "mediasi" ? "mediasi" : "sidang",
        kunci: String(badan.kunci ?? "").slice(0, 64),
        saluran: badan.saluran === "audio" ? "audio" : "whatsapp",
        ruang: String(badan.ruang ?? "").slice(0, 128),
        agenda: String(badan.agenda ?? "").slice(0, 160),
        nomorPerkara: String(badan.nomorPerkara ?? "").slice(0, 64),
        setujuBelumTerverifikasi: badan.setujuBelumTerverifikasi === true,
      }
    );
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PANGGIL_PETUGAS_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
