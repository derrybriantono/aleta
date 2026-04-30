import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { processApproval, submitApprovalRequest } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { badRequest, handleRouteError, ok, unauthorized } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import type { AletaBotApprovalRequest } from "@/lib/aleta-bot-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) {
      unauthorized();
    }
    const body = await readJsonBody<{
      mode: "submit" | "review";
      entityType?: AletaBotApprovalRequest["entityType"];
      entityId?: string;
      entityName?: string;
      snapshotJson?: string;
      notes?: string;
      approvalId?: string;
      decision?: "approved" | "rejected";
    }>(request);

    if (body.mode === "submit") {
      if (!body.entityType || !body.entityId || !body.entityName) {
        badRequest("entityType, entityId, entityName wajib diisi.");
      }
      const entityType = body.entityType;
      const entityId = body.entityId;
      const entityName = body.entityName;
      if (!entityType || !entityId || !entityName) return;
      return ok(
        await submitApprovalRequest(db, {
          actorUserId,
          entityType,
          entityId,
          entityName,
          snapshotJson: body.snapshotJson,
          notes: body.notes,
        })
      );
    }

    if (body.mode === "review") {
      if (!body.approvalId || !body.decision) {
        badRequest("approvalId dan decision wajib diisi.");
      }
      const approvalId = body.approvalId;
      const decision = body.decision;
      if (!approvalId || !decision) return;
      return ok(
        await processApproval(db, {
          actorUserId,
          approvalId,
          decision,
          notes: body.notes,
        })
      );
    }

    badRequest("mode tidak valid. Gunakan 'submit' atau 'review'.");
  } catch (error) {
    return handleRouteError(error);
  }
}
