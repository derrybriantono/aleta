import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayRelaasMassal } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Relaas panggilan sidang dan pemberitahuan putusan pada SATU tanggal,
 * dikelompokkan per juru sita - bahan cetak massal.
 *
 * ============================================================================
 * KEWENANGANNYA "panel", BUKAN "jurusita"
 * ============================================================================
 *
 * Permintaan pengguna 25 September 2026 menyebut layarnya "untuk jurusita
 * (keliatan juga di superadmin dan admin)". Yang menegakkannya di sini
 * kapabilitas "panel":
 *
 *   - KAPABILITAS_EKSTENSI pada akses.ts memuat DELAPAN kunci - panel, berkas,
 *     permintaan, penunjukan, penunjukan-otomatis, blangko-abt, data-umum,
 *     kerjakan. "jurusita" BUKAN salah satunya; ia peran (RoleId) pada
 *     lib/types.ts dan anggota PERAN_PEMEGANG_PERKARA. Menuliskannya sebagai
 *     kapabilitas tidak akan lolos tsc.
 *   - "panel" bawaannya menyala bagi seluruh PERAN_PEMEGANG_PERKARA, dan
 *     "jurusita" ada di dalam daftar itu - jadi juru sita lolos tanpa
 *     pengaturan apa pun.
 *   - Admin dan Super Admin lolos LEBIH DAHULU lewat pulang-awal
 *     isPrivilegedAdmin() di pastikanKapabilitas, sebelum tabel kapabilitas
 *     dibaca sama sekali.
 *
 * Kapabilitas baru sengaja TIDAK dibuat: menambah kunci ke
 * KAPABILITAS_EKSTENSI berarti kunci itu mati bawaannya bagi tiap peran, dan
 * layar yang baru dibangun akan tampak rusak bagi juru sita sampai ada
 * administrator yang menyalakannya satu per satu.
 *
 * ============================================================================
 * TANGGAL YANG TIDAK BERBENTUK DITOLAK, BUKAN DIGANTI HARI INI
 * ============================================================================
 *
 * Mengganti ruas yang salah bentuk dengan hari ini membuat layar menggambar
 * hari yang BUKAN yang diminta, dengan angka yang tampak meyakinkan. Yang
 * kosong tetap boleh - itu artinya "hari ini menurut zona pengadilan", dan
 * yang memutuskannya bot, supaya jawabannya satu untuk semua pemanggil.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const tanggal = (request.nextUrl.searchParams.get("tanggal") || "").trim();
    if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return Response.json(
        { ok: false, alasan: `Tanggal "${tanggal}" tidak berbentuk YYYY-MM-DD.` },
        { status: 400 }
      );
    }

    const hasil = await getGatewayRelaasMassal({ tanggal });
    if (!hasil.ok) {
      // Sebab dari bot diteruskan apa adanya - termasuk "halaman 404" ketika
      // rutenya belum ada. Menggantinya dengan daftar kosong akan terbaca
      // sebagai "hari ini tidak ada relaas", dan itu dua keadaan yang berbeda.
      return Response.json(
        { ok: false, alasan: hasil.error || "relaas_massal_belum_dapat_dibaca" },
        { status: 502 }
      );
    }
    return ok(hasil.data);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "RELAAS_MASSAL_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
