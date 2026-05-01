import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { createManagedUserInDb, listUsersFromDb } from "@/server/modules/users/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    const items = await listUsersFromDb(db, actorUserId);
    return ok({
      items,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      username: string;
      password: string;
      email: string;
      whatsappNumber: string;
      name: string;
      nip: string;
      positionId: string;
      profilePhotoUrl?: string;
      roleOverride?: "admin" | "super-admin" | null;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const user = await createManagedUserInDb(db, actorUserId, body);

    return created({
      user,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
