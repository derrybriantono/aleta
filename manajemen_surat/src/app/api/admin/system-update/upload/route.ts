import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { stageAletaUpdatePackage } from "@/server/modules/system-update/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unggah paket pembaruan (.tar.gz) dari halaman Pembaruan Sistem.
 *
 * Endpoint ini HANYA menampung dan memverifikasi berkas; ia tidak pernah
 * mengekstrak apa pun dan tidak menjalankan perintah apa pun. Penerapan update
 * dikerjakan di sisi host, karena container portal sengaja tidak diberi akses
 * ke folder aplikasi maupun socket Docker — memberi akses itu berarti siapa pun
 * yang menembus portal langsung menguasai server.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    // Mengunggah paket pembaruan sama artinya dengan mengganti kode yang
    // berjalan di server, jadi dibatasi hanya untuk Super Admin.
    if (actor.roleId !== "super-admin") {
      throw new ApiError(403, "Hanya Super Admin yang dapat mengunggah paket pembaruan.");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "Paket pembaruan wajib dikirim pada field 'file'.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const staged = await stageAletaUpdatePackage({
      fileName: file.name,
      bytes,
      expectedSha256: String(formData.get("sha256") ?? ""),
      actorLabel: actor.name || actor.username || actor.id,
    });

    return ok({ staged });
  } catch (error) {
    return handleRouteError(error);
  }
}
