import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getUserForApiById, updateManagedUserInDb } from "@/server/modules/users/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, notFound, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(_);
    const user = await getUserForApiById(db, actorUserId, id);

    if (!user) {
      notFound("Akun yang diminta tidak ditemukan.");
    }

    return ok({
      user,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody<{
      actorUserId?: string;
      username?: string;
      password?: string;
      email?: string;
      whatsappNumber?: string;
      name?: string;
      nip?: string;
      positionId?: string;
      isActive?: boolean;
      profilePhotoUrl?: string;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const user = await updateManagedUserInDb(db, {
      actorUserId,
      userId: id,
      payload: body,
    });

    return ok({
      user,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
