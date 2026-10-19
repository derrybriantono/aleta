import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

import { susunKehadiranSaya, type BarisKehadiranSaya } from "./susun";
import { getGatewayJadwalSidangSinggah } from "@/server/modules/aleta-bot/jadwal-sidang-singgah";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * F3.2 (17 Okt 2026) - widget ALETA: kehadiran sidang HARI INI milik akun.
 *
 * Perkara yang akun ini menjadi majelis, PP, atau JS-nya (Super Admin/Admin:
 * semua, dibatasi 40). Satu GET jadwal hari ini dengan antrian + kehadiran
 * rinci; hanya membaca.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const hariIni = waktuPengadilan().tanggal;

    const jadwal = await getGatewayJadwalSidangSinggah({ dari: hariIni, sampai: hariIni, cari: "", batas: 500, waktu: true });
    if (!jadwal.ok) {
      return ok({ available: false, ok: false, alasan: jadwal.error || "Jadwal sidang belum dapat dibaca.", perkara: [] });
    }
    const lihatSemua = isPrivilegedAdmin(actor);
    const hasil = susunKehadiranSaya(
      (Array.isArray(jadwal.data?.sidang) ? jadwal.data.sidang : []) as unknown as BarisKehadiranSaya[],
      (jadwal.data?.antrian ?? null) as Parameters<typeof susunKehadiranSaya>[1],
      { hariIni, nama: String(actor?.name || ""), lihatSemua }
    );
    return ok({ available: true, ok: true, hariIni, lihatSemua, jumlah: hasil.jumlah, perkara: hasil.perkara });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_KEHADIRAN_SAYA_FAILED",
      feature: "antrian",
      entityId: "antrian-kehadiran-saya",
    });
  }
}
