import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createVersion } from "@/server/modules/judicia/legal-form/templates/jlf-template-service";
import { normalizeId } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { created, handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const changeNote = String(formData.get("changeNote") ?? "").trim();
    if (!(file instanceof File)) {
      throw new ApiError(400, "File template wajib dikirim pada field 'file'.");
    }

    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const version = await createVersion(db, actor, normalizeId(id, "ID template"), file, { changeNote });

    return created(version);
  } catch (error) {
    return handleRouteError(error);
  }
}
