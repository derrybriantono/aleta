import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  listLetterTemplatesInDb,
  upsertLetterTemplateInDb,
  type LetterTemplateInput,
} from "@/server/modules/letters/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { getBooleanSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const items = await listLetterTemplatesInDb(db, actorUserId, {
      activeOnly: getBooleanSearchParam(request, "activeOnly"),
    });

    return ok({ items, total: items.length });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const body = await readJsonBody<Omit<LetterTemplateInput, "actorUserId">>(request);
    const item = await upsertLetterTemplateInDb(db, {
      ...body,
      actorUserId,
    });

    return created(item);
  } catch (error) {
    return handleRouteError(error);
  }
}
