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
 * Tanda "sedang berjalan" manual - perbaikan 2 Oktober 2026 malam, butir 3.
 *
 *   POST  { perkaraId, tanggalSidang, nomorPerkara, ruang, berjalan,
 *           hasilSidangSelesai, kering }
 *
 * berjalan: true  = "Tandai sedang berjalan" - perkara lagi disidangkan tetapi
 *                   tidak terdeteksi dari antrian. Ditolak bila sidangnya sudah
 *                   selesai secara sah atau sedang diskors.
 * berjalan: false = "Batalkan tanda" (hanya tanda manual).
 *
 * Peta tanda yang berlaku ikut dibaca lewat GET /sidang/selesai (field
 * `berjalan`) - satu bacaan untuk ketiga tanda (selesai, skors, berjalan).
 *
 * Kewenangannya "panel", sama dengan tombol Selesai dan Skors di baris yang
 * sama. `kering: false` harus disebut tegas. Yang tertulis ke aplikasi antrian
 * ruang tunggu hanya nilai asli aplikasinya (nomor ruang / NULL - bawaan sejak
 * 5 Okt 2026, kecuali ALETA_ANTRIAN_DISIDANG_PROSES=mati); nama petugas, waktu, IP, dan
 * "lewat ALETA" hanya di tabel ALETA (butir 14).
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

    const hasil = await panggilBotJadwalSidang("/berjalan", {
      method: "POST",
      body: {
        perkaraId: String(badan.perkaraId ?? ""),
        tanggalSidang: String(badan.tanggalSidang ?? "").slice(0, 10),
        nomorPerkara: String(badan.nomorPerkara ?? ""),
        ruang: String(badan.ruang ?? "").slice(0, 64),
        berjalan: badan.berjalan !== false,
        hasilSidangSelesai: badan.hasilSidangSelesai === true,
        // Yang menekan tombolnya - tercatat di catatan ALETA saja.
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
      action: "SIDANG_BERJALAN_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
