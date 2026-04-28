import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { processApproval, submitApprovalRequest } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import type { AletaBotApprovalRequest } from "@/lib/aleta-bot-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
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
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    if (body.mode === "submit") {
      if (!body.entityType || !body.entityId || !body.entityName) {
        return handleRouteError(new Error("entityType, entityId, entityName wajib diisi."));
      }
      return ok(
        await submitApprovalRequest(db, {
          actorUserId,
          entityType: body.entityType,
          entityId: body.entityId,
          entityName: body.entityName,
          snapshotJson: body.snapshotJson,
          notes: body.notes,
        })
      );
    }

    if (body.mode === "review") {
      if (!body.approvalId || !body.decision) {
        return handleRouteError(new Error("approvalId dan decision wajib diisi."));
      }
      return ok(
        await processApproval(db, {
          actorUserId,
          approvalId: body.approvalId,
          decision: body.decision,
          notes: body.notes,
        })
      );
    }

    return handleRouteError(new Error("mode tidak valid. Gunakan 'submit' atau 'review'."));
  } catch (error) {
    return handleRouteError(error);
  }
}
