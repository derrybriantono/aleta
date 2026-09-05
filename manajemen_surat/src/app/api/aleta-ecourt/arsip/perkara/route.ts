import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayArsipPerkara,
  getGatewayArsipRincian,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kendali arsip e-Court.
 *
 * Satu rute melayani dua tampilan yang berbeda tingkatannya:
 *
 *   tanpa ?nomor  - satu baris per PERKARA, dengan hitungan berkasnya
 *   dengan ?nomor - satu baris per DOKUMEN pada perkara itu
 *
 * Digabung karena keduanya menjawab pertanyaan yang sama pada kedalaman yang
 * berbeda, dan memisahkannya hanya menambah satu berkas rute yang isinya
 * hampir sama persis.
 *
 * Arsip memuat ribuan dokumen. Tabel utama sengaja TIDAK memuat daftar dokumen
 * - halaman berisi tiga ribu baris tidak menjawab pertanyaan siapa pun.
 * Rinciannya baru diambil ketika satu perkara benar-benar dibuka.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();

    if (nomor) {
      const rincian = await getGatewayArsipRincian(nomor);
      if (!rincian.ok) {
        return ok({
          available: false,
          message: rincian.error || "ALETA Bot belum dapat dihubungi.",
          dokumen: [],
        });
      }
      return ok({
        available: true,
        nomorPerkara: rincian.data?.nomorPerkara ?? nomor,
        dokumen: rincian.data?.dokumen ?? [],
      });
    }

    const hasil = await getGatewayArsipPerkara({
      cari: String(request.nextUrl.searchParams.get("cari") || ""),
      belumLengkap: request.nextUrl.searchParams.get("belumLengkap") === "1",
      urutkan: String(request.nextUrl.searchParams.get("urutkan") || "terbaru"),
      batas: Number(request.nextUrl.searchParams.get("batas")) || 100,
      mulai: Number(request.nextUrl.searchParams.get("mulai")) || 0,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        perkara: [],
        total: 0,
      });
    }

    return ok({
      available: true,
      diperiksaPada: hasil.data?.diperiksaPada ?? "",
      total: hasil.data?.total ?? 0,
      perkara: hasil.data?.perkara ?? [],
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_ARSIP_PERKARA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
