import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { assertInstitutionLogoUploadMetadata, storeInstitutionLogoFile } from "@/server/shared/institution-logo-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actorUser = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actorUser)) {
      throw new ApiError(403, "Hanya admin yang dapat mengunggah logo instansi.");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "File logo wajib dikirim pada field 'file'.");
    }

    assertInstitutionLogoUploadMetadata(file);
    const storedFile = await storeInstitutionLogoFile(file);

    return ok({
      fileName: storedFile.fileName,
      fileSizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
      publicUrl: storedFile.publicUrl,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "INSTITUTION_LOGO_ACCESS_FAILED",
      feature: "identitas_instansi",
    });
  }
}
