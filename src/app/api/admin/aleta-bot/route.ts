import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getAletaBotSnapshot,
  updateAletaBotDbConnection,
  updateAletaBotNotification,
  updateAletaBotPublicQaIntent,
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
      dbConnection?: {
        id?: string;
        key: string;
        name: string;
        description?: string;
        driver?: "mysql";
        host: string;
        port?: number;
        databaseName: string;
        username: string;
        passwordEnvKey?: string;
        sslEnabled?: boolean;
        connectionTimeoutMs?: number;
        isActive?: boolean;
        isDefault?: boolean;
        legacySource?: string;
      };
      publicQaIntent?: {
        id?: string;
        key: string;
        name: string;
        description?: string;
        category: "informasi_umum" | "status_perkara" | "jadwal_sidang" | "biaya_panjar" | "akta_cerai" | "layanan" | "pengaduan" | "ecourt" | "fallback";
        audience: "party" | "public" | "employee" | "admin";
        isActive?: boolean;
        aiEnabled?: boolean;
        exactTriggers?: string[] | string;
        exampleQuestions?: string[] | string;
        requiredParameters?: string[] | string;
        queryKey?: string;
        legacyHandler?: string;
        legacyCommand?: string;
        parameterizedLegacyCommand?: string;
        templateKey?: string;
        responseMode: "static_template" | "query_template" | "legacy_handler" | "ai_guided_template" | "fallback";
        confidenceThreshold?: number;
        requiresVerification?: boolean;
        requiresCaseNumber?: boolean;
        maxAttempts?: number;
        fallbackMessage?: string;
        riskLevel: "low" | "medium" | "high";
        notes?: string;
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

    if (body.dbConnection) {
      return ok(
        await updateAletaBotDbConnection(db, {
          actorUserId,
          connection: body.dbConnection,
        })
      );
    }

    if (body.publicQaIntent) {
      return ok(
        await updateAletaBotPublicQaIntent(db, {
          actorUserId,
          intent: body.publicQaIntent,
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
