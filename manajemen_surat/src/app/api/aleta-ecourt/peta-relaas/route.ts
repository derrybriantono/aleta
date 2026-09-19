import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  getGatewayLapisanPeta,
  getGatewayPerkaraDesa,
  getGatewayPetaRelaas,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dua lapisan tambahan peta perkara, satu alamat.
 *
 * ============================================================================
 * KEDUANYA DIBACA HANYA KETIKA DIMINTA
 * ============================================================================
 *
 *   `apa=relaas`  sebaran panggilan tidak bertemu per desa - satu kueri yang
 *                 menyisir seluruh relaas pada rentangnya, terukur 884 md
 *                 untuk delapan tahun. Tidak ada gunanya dihitung bagi yang
 *                 hanya melihat jumlah perkara.
 *
 *   `apa=desa`    daftar perkara satu desa, ketika lingkarannya diketuk.
 *                 Sembilan ribu nomor perkara beserta tanggalnya berukuran
 *                 ratusan kilobita; yang dibuka orang paling banyak satu desa.
 *
 * Nama pihak pada daftar perkara datang sudah berupa INISIAL dari peladen.
 * Peta dibuka di layar yang kerap terlihat orang lain, dan daftar nama orang
 * berperkara per desa adalah hal yang paling tidak boleh terpajang.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const cari = request.nextUrl.searchParams;
    const periode = String(cari.get("periode") || "tahun");
    const acuan = String(cari.get("acuan") || "");
    const dari = String(cari.get("dari") || "");
    const sampai = String(cari.get("sampai") || "");

    if (String(cari.get("apa") || "") === "desa") {
      const kode = String(cari.get("kode") || "").trim();
      if (!kode) return ok({ available: true, ok: false, alasan: "Kode desa wajib diisi." });
      const hasil = await getGatewayPerkaraDesa({
        kelompok: String(cari.get("kelompok") || "perceraian"),
        kode,
        periode,
        acuan,
        dari,
        sampai,
      });
      if (!hasil.ok) {
        return ok({ available: false, ok: false, alasan: hasil.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
    }

    // Sembilan lapisan lain - biaya, faktor, kehadiran, berulang, perubahan,
    // jurusita, sidang keliling yang ada, dan desa tanpa perkara. Masing-masing
    // dibaca HANYA ketika lapisannya dipilih.
    const apa = String(cari.get("apa") || "");
    if (apa && apa !== "relaas") {
      const lapis = await getGatewayLapisanPeta({
        apa,
        induk: String(cari.get("induk") || ""),
        periode,
        acuan,
        dari,
        sampai,
      });
      if (!lapis.ok) {
        return ok({ available: false, ok: false, alasan: lapis.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({ available: true, ...(lapis.data as Record<string, unknown>) });
    }

    const hasil = await getGatewayPetaRelaas({ periode, acuan, dari, sampai });
    if (!hasil.ok) {
      return ok({ available: false, ok: false, alasan: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PETA_RELAAS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
