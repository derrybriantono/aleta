import { type NextRequest } from "next/server";

import { type Ruangan, SEBUTAN_SIFAT, kelompokkanRuangan, sifatRuangan } from "@/lib/ruangan-sidang";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { gatewayDaftarRuangan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ruangan sidang yang dapat dipilih pada penetapan hari sidang - termasuk
 * SIDANG KELILING.
 *
 * Sebelum ini ruangannya dipatok: JADWAL_BAWAAN.ruanganId = 1, "Ruang Sidang 1
 * Dalam Gedung". Penetapan hari sidang untuk sidang keliling karena itu selalu
 * menulis ruangan yang keliru, dan kolom sidang_keliling pada
 * perkara_jadwal_sidang selalu 0 - laporan sidang keliling salah hitung tanpa
 * ada yang menyadarinya.
 *
 * Sifatnya (dalam gedung / keliling / terpadu) diputuskan di portal, bukan di
 * bot: bendera SIPP saja tidak cukup - 2.140 sidang 2025-2026 memakai ruangan
 * yang tidak terdaftar di ruangan_sidang sama sekali.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const jawab = await gatewayDaftarRuangan();
    if (!jawab.ok) {
      return ok({ tersedia: false, alasan: jawab.error || "aleta_bot tidak dapat dihubungi" });
    }

    const daftar = (jawab.data?.ruangan || []) as Ruangan[];
    const kelompok = kelompokkanRuangan(daftar);

    return ok({
      tersedia: true,
      sebutan: SEBUTAN_SIFAT,
      kelompok,
      // Rata - dipakai layar yang hanya perlu satu daftar.
      ruangan: daftar.map((r) => ({ ...r, sifat: sifatRuangan(r.nama, r.benderaKeliling) })),
    });
  } catch (galat) {
    return handleAdminRouteError(galat, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_RUANGAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
