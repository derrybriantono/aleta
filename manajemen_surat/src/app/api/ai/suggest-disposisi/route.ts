import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { generateDispositionSuggestionInDb } from "@/server/modules/ai/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { badRequest, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      letterId?: string;
      currentInstruction?: string;
      targetOptions?: { id: string; label: string }[];
    }>(request);
    const letterId = body.letterId?.trim();

    if (!letterId) {
      badRequest("letterId wajib dikirim untuk memproses saran disposisi AI.");
    }

    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request, body.actorUserId);
    const insight = await generateDispositionSuggestionInDb(db, {
      actorUserId,
      letterId: letterId!,
      currentInstruction: body.currentInstruction ?? "",
      targetOptions: Array.isArray(body.targetOptions) ? body.targetOptions : [],
    });

    return ok(insight);
  } catch (error) {
    return handleRouteError(error);
  }
}
