import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  transitionOutgoingLetterWorkflowInDb,
  type LetterWorkflowAction,
} from "@/server/modules/letters/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkflowBody = {
  action?: LetterWorkflowAction;
  rejectionNote?: string | null;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody<WorkflowBody>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await transitionOutgoingLetterWorkflowInDb(db, {
      actorUserId,
      letterId: id,
      action: body.action ?? "submit",
      rejectionNote: body.rejectionNote,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
