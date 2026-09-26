import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayTagPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Katalog tag perkara beserta jumlahnya.
 *
 * ============================================================================
 * TERPISAH DARI PENCARIANNYA - DAN ITU DISENGAJA
 * ============================================================================
 *
 * Angka tiap tag dihitung atas LINGKUP RENTANG WAKTU saja, bukan atas hasil
 * yang sudah tersaring tag lain. Bila ikut menyusut, menyalakan satu tag akan
 * membuat tag lain terbaca nol, dan pengguna tidak punya cara menduga mana
 * yang masih masuk akal untuk dinyalakan berikutnya.
 *
 * Katalognya sendiri (daftar tag, kelompok, dasar tanggal) ikut dikirim dari
 * bot supaya layar tidak menyalin ulang daftar yang sama - dan tidak dapat
 * menyimpang darinya ketika tagnya bertambah.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const p = request.nextUrl.searchParams;
    const hasil = await getGatewayTagPerkara({
      dasarTanggal: String(p.get("dasarTanggal") || "").trim(),
      periode: String(p.get("periode") || "").trim(),
      acuan: String(p.get("acuan") || "").trim(),
      tagDari: String(p.get("tagDari") || "").trim(),
      tagSampai: String(p.get("tagSampai") || "").trim(),
      // Katalog saja: dijawab bot tanpa menyentuh SIPP, jadi panel dapat
      // berdiri seketika sebelum angkanya selesai dihitung.
      katalogSaja: p.get("katalogSaja") === "1" ? "1" : "",
    });

    const kosong = { jumlah: {}, tag: [], kelompok: [], dasar: [] };
    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        ...kosong,
      });
    }
    if (!hasil.data?.ok) {
      return ok({ available: false, message: "SIPP tidak dapat dibaca.", ...kosong });
    }

    return ok({
      available: true,
      // null berarti BELUM DIHITUNG - berbeda dari {} yang berarti sudah
      // dihitung dan hasilnya kosong. Layar menggambar tanda "…" untuk yang
      // belum dihitung, bukan angka nol yang mematikan chipnya.
      jumlah: hasil.data.katalogSaja ? null : (hasil.data.jumlah ?? {}),
      lingkup: hasil.data.lingkup ?? null,
      tag: hasil.data.tag ?? [],
      kelompok: hasil.data.kelompok ?? [],
      dasar: hasil.data.dasar ?? [],
      batasId: hasil.data.batasId ?? null,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_STATUS_PERKARA_TAG_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
