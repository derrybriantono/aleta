import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaHalamanProfil,
  hapusProfilSaklar,
  simpanProfilSaklar,
} from "@/server/modules/aleta-ecourt/profil-saklar";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Profil saklar ekstensi per peran (kontrak K4, butir 25 perbaikan 30 Sep 2026).
 * HANYA Super Admin dan Admin - membaca maupun mengubah.
 *
 *   GET                              -> { peran: [...], kunciSaklar, daftarFitur, bagian, bolehMenyunting }
 *   PUT { peran, saklar, fitur, catatan? }  -> sama + fiturDibuang (fitur null = semua boleh)
 *   DELETE ?peran=                   -> sama (perannya kembali ke bawaan)
 *
 * Profil milik PEMANGGIL dibaca ekstensi lewat GET /ekstensi/tampilan (data.profil).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanAdminIstimewa(db, actorUserId, "melihat profil saklar per peran");
    return ok(await bacaHalamanProfil(db, actor));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_SWITCH_PROFILE_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    let badan: Record<string, unknown>;
    try {
      const isi = (await request.json()) as unknown;
      badan = isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok(
      await simpanProfilSaklar(db, actorUserId, {
        peran: badan.peran,
        saklar: badan.saklar,
        fitur: badan.fitur,
        catatan: badan.catatan,
      })
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_SWITCH_PROFILE_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function DELETE(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const peran = String(request.nextUrl.searchParams.get("peran") || "");
    return ok(await hapusProfilSaklar(db, actorUserId, peran));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_SWITCH_PROFILE_DELETE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
