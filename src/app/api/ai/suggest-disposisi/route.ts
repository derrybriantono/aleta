import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { suggestDispositionInDb } from "@/server/modules/ai/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      letterSubject: string;
      letterSummary: string;
      currentInstruction: string;
      targetOptions: { id: string; label: string }[];
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request, body.actorUserId);
    const result = await suggestDispositionInDb(db, {
      actorUserId,
      letterSubject: body.letterSubject,
      letterSummary: body.letterSummary,
      currentInstruction: body.currentInstruction,
      targetOptions: body.targetOptions,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
