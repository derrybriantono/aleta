import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  getGatewayPetaPerkara,
  getGatewayPetaPerkaraMenu,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Peta perkara - dari mana perkara datang, dan kenapa.
 *
 * ============================================================================
 * SEBARAN, BUKAN PETA GEOGRAFIS
 * ============================================================================
 *
 * Koordinat pada `kode_pos` tidak dapat dipakai: kolom lintang dan bujurnya
 * tertukar, dan sesudah ditukar pun tiap kabupaten hanya punya SATU titik yang
 * sebagian menunjuk pulau lain - Morowali Utara jatuh di Papua, Banggai di
 * Laut Sawu. Sebarannya karena itu disusun berjenjang dari kode wilayah resmi.
 *
 * Yang dipulangkan sudah terkelompok - beberapa ratus baris, bukan empat belas
 * ribu. Layar yang menerima empat belas ribu baris lalu mengelompokkannya
 * sendiri akan tersendat pada peramban petugas, dan tersendatnya tidak akan
 * terlihat di mesin siapa pun yang membangunnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "analitik.peta-beban"); // HAK-PERAN 12 Okt: matriks peran

    const cari = request.nextUrl.searchParams;

    // Menu dan datanya lewat satu alamat: layar memanggil menunya sekali saat
    // dibuka, lalu datanya tiap kali pilihannya berubah.
    if (cari.get("menu") === "1") {
      const menu = await getGatewayPetaPerkaraMenu();
      if (!menu.ok) {
        return ok({ available: false, ok: false, alasan: menu.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({ available: true, ...(menu.data as Record<string, unknown>) });
    }

    const hasil = await getGatewayPetaPerkara({
      kelompok: String(cari.get("kelompok") || "perceraian"),
      tingkat: String(cari.get("tingkat") || "kecamatan"),
      induk: String(cari.get("induk") || ""),
      periode: String(cari.get("periode") || "tahun"),
      acuan: String(cari.get("acuan") || ""),
      dari: String(cari.get("dari") || ""),
      sampai: String(cari.get("sampai") || ""),
    });
    if (!hasil.ok) {
      return ok({ available: false, ok: false, alasan: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PETA_PERKARA_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
