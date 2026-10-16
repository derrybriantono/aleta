import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mediator dari Jadwal Sidang dan Hasil Sidang (perbaikan 1 Oktober 2026,
 * butir J1 dan J7).
 *
 *   GET  ?perkaraId   proses mediasi perkara (penetapan, mediator, jadwal
 *                     pertemuan, hasil) + daftar mediator aktif + akun SIPP
 *                     yang akan tercatat. Hanya membaca.
 *   POST              penetapan mediator ke SIPP - MENULIS, persis blangko
 *                     "Penetapan Mediasi" SIPP. Kering kecuali `kering: false`
 *                     disebut tegas; layar memperlihatkan rencananya dan
 *                     meminta konfirmasi sebelum yang sungguhan.
 *
 * AKUN SIPP TIDAK DIKETIK: ketua majelis (bawaan) atau panitera pengganti
 * perkara itu, dibaca bot dari perkara_hakim_pn / perkara_panitera_pn - sama
 * dengan penundaan sidang. Operator (yang menekan) tercatat terpisah di jejak
 * ALETA.
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
      return ok({ available: true, ok: false, alasan: "Nomor perkara SIPP tidak dikenali." });
    }
    const hasil = await panggilBotJadwalSidang(`/mediasi?${new URLSearchParams({ perkaraId }).toString()}`);
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_MEDIASI_READ_FAILED",
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
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.mediator"); // HAK-PERAN 12 Okt: matriks peran
    const badan = (await request.json()) as Record<string, unknown>;

    const hasil = await panggilBotJadwalSidang("/mediator", {
      method: "POST",
      body: {
        perkaraId: String(badan.perkaraId ?? ""),
        mediatorId: Number(badan.mediatorId) || 0,
        tanggalPenetapan: String(badan.tanggalPenetapan ?? "").slice(0, 10),
        nomorSk: String(badan.nomorSk ?? ""),
        jenisPenetapan: String(badan.jenisPenetapan ?? ""),
        atasNama: badan.atasNama === "panitera" ? "panitera" : "hakim",
        operator: actorUserId || "portal",
        // Butir 45 (17 Okt): alamat PERAMBAN petugas untuk sys_audittrail - tanpa ini bot
        // dulu mencatat alamat peti portal (172.18.0.2), penanda ALETA di audit SIPP.
        ip: alamatIpPeramban(request),
        kering: badan.kering !== false,
      },
      timeoutMs: 20_000,
    });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_MEDIATOR_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
