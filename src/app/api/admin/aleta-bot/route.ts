import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getAletaBotSnapshot,
  updateAletaBotNotification,
  updateAletaBotQuery,
  updateAletaBotSettings,
  updateAletaBotTemplate,
} from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    return ok(await getAletaBotSnapshot(db, actorUserId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      settings?: {
        botEnabled?: boolean;
        notificationsEnabled?: boolean;
        adminWhatsappNumber?: string;
        messageDelayMs?: number;
        retryLimit?: number;
        dryRunEnabled?: boolean;
        scheduleCron?: string;
        testTargetNumber?: string;
        securityNotes?: string;
      };
      template?: {
        id: string;
        body: string;
      };
      query?: {
        id?: string;
        name: string;
        category: "employee" | "party" | "system";
        description?: string;
        sqlText: string;
        outputColumns?: string[] | string;
        recipientColumn?: string;
        isActive?: boolean;
      };
      notification?: {
        id?: string;
        name: string;
        category: "employee" | "party";
        description?: string;
        queryId: string;
        templateId: string;
        recipientMapping?: Record<string, unknown>;
        scheduleConfig?: {
          type: "cron" | "manual" | "event";
          cron: string;
          trigger: string;
        };
        isActive?: boolean;
        delayMs?: number;
        retryLimit?: number;
      };
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    if (body.template) {
      return ok(
        await updateAletaBotTemplate(db, {
          actorUserId,
          templateId: body.template.id,
          body: body.template.body,
        })
      );
    }

    if (body.query) {
      return ok(
        await updateAletaBotQuery(db, {
          actorUserId,
          query: body.query,
        })
      );
    }

    if (body.notification) {
      return ok(
        await updateAletaBotNotification(db, {
          actorUserId,
          notification: body.notification,
        })
      );
    }

    return ok(
      await updateAletaBotSettings(db, {
        actorUserId,
        payload: body.settings ?? {},
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
