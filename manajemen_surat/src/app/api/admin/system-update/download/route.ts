import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { downloadAndStageUpdateFromManifest } from "@/server/modules/system-update/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mengunduh paket rilis baru yang diumumkan manifest langsung dari halaman
 * Pembaruan Sistem, tanpa perlu menyalinnya lewat SSH.
 *
 * Seperti unggah manual, endpoint ini hanya menampung dan memverifikasi berkas.
 * Ia tidak pernah mengekstrak maupun menjalankan apa pun — penerapan tetap di
 * host, karena container portal sengaja tidak diberi akses ke folder aplikasi
 * maupun socket Docker.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    // Menarik kode yang akan berjalan di server: khusus Super Admin.
    if (actor.roleId !== "super-admin") {
      throw new ApiError(403, "Hanya Super Admin yang dapat mengunduh paket pembaruan.");
    }

    const staged = await downloadAndStageUpdateFromManifest({
      actorLabel: actor.name || actor.username || actor.id,
    });

    return ok({ staged });
  } catch (error) {
    return handleRouteError(error);
  }
}
