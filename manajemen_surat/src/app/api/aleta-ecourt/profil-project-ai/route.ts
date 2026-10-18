import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import {
  bacaHalamanProfilProject,
  simpanProfilProject,
} from "@/server/modules/aleta-ecourt/profil-project-ai";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Profil Project ALETA AI (18 Okt 2026).
 *
 *   GET  -> profil yang berlaku + apakah pembaca boleh mengubah. Sama haknya
 *           dengan penyusun perintah di Status Perkara (status.analisa).
 *   PUT  -> simpan profil; hanya Super Admin.
 *   PUT {bawaan: true} -> kembali ke bawaan V.4.5.
 *
 * Isinya ringkasan instruksi Project, bukan rahasia; namun mengubahnya
 * mengubah isi setiap perintah AI yang disusun sesudahnya.
 */
async function bacaBadan(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.analisa");
    return ok(await bacaHalamanProfilProject(db, actorUserId));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PROFIL_PROJECT_AI_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "profil-project-ai",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = await bacaBadan(request);
    await simpanProfilProject(db, actorUserId, badan.bawaan === true ? null : badan);
    return ok(await bacaHalamanProfilProject(db, actorUserId));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PROFIL_PROJECT_AI_UPDATE_FAILED",
      feature: "aleta_ecourt",
      entityId: "profil-project-ai",
    });
  }
}
