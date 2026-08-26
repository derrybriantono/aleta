import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getUserForApiById, updateManagedUserInDb } from "@/server/modules/users/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { notFound, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import type { ExternalAppCredentialInput, RoleId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  let userId = "unknown";
  try {
    const { id } = await context.params;
    userId = id;
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const user = await getUserForApiById(db, actorUserId, id);

    if (!user) {
      notFound("Akun yang diminta tidak ditemukan.");
    }

    return ok({
      user,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "USER_MANAGEMENT_ACCESS_FAILED",
      feature: "user_management",
      entityId: userId,
    });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  let userId = "unknown";
  try {
    const { id } = await context.params;
    userId = id;
    const body = await readJsonBody<{
      actorUserId?: string;
      username?: string;
      password?: string;
      email?: string;
      whatsappNumber?: string;
      name?: string;
      nip?: string;
      positionId?: string;
      additionalRoleIds?: string[];
      isActive?: boolean;
      profilePhotoUrl?: string;
      roleOverride?: RoleId | null;
      externalCredentials?: ExternalAppCredentialInput[];
    }>(request);
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const user = await updateManagedUserInDb(db, {
      actorUserId,
      userId: id,
      payload: body,
    });

    return ok({
      user,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "USER_MANAGEMENT_ACCESS_FAILED",
      feature: "user_management",
      entityId: userId,
    });
  }
}
