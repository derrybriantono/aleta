import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Skors sidang - perbaikan 2 Oktober 2026, butir 10.
 *
 *   POST  { perkaraId, tanggalSidang, nomorPerkara, ruangId, skors, alasan,
 *           panggilSaatSkors, hasilSidangSelesai, kering }
 *
 * skors: true  = sidang yang sedang berjalan dinyatakan BELUM SELESAI (dapat
 *                dilanjutkan). Ditolak bila sidangnya sudah selesai secara sah.
 * skors: false = dilanjutkan.
 *
 * Peta skors yang berlaku ikut dibaca lewat GET /sidang/selesai (field
 * `skors`) - satu bacaan untuk kedua tanda, tidak ada rute baca baru.
 *
 * Kewenangannya "panel", sama dengan tombol Selesai di baris yang sama.
 * `kering: false` harus disebut tegas. Yang tertulis ke SIPP hanya
 * antrian.status asli; nama petugas, waktu, IP, dan "lewat ALETA" hanya di
 * tabel ALETA (butir 14).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.jalannya"); // HAK-PERAN 12 Okt: matriks peran
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const hasil = await panggilBotJadwalSidang("/skors", {
      method: "POST",
      body: {
        perkaraId: String(badan.perkaraId ?? ""),
        tanggalSidang: String(badan.tanggalSidang ?? "").slice(0, 10),
        nomorPerkara: String(badan.nomorPerkara ?? ""),
        ruangId: badan.ruangId ?? null,
        skors: badan.skors !== false,
        alasan: String(badan.alasan ?? "").slice(0, 191),
        panggilSaatSkors: String(badan.panggilSaatSkors ?? "").slice(0, 32),
        hasilSidangSelesai: badan.hasilSidangSelesai === true,
        // Yang menekan tombolnya - tercatat di catatan skors ALETA saja.
        operator: actor?.name || actorUserId || "portal",
        ip: alamatIpPeramban(request),
        kering: badan.kering !== false,
      },
    });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_SKORS_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
