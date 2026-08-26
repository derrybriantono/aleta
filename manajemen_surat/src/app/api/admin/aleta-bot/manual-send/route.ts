import { NextRequest } from "next/server";

import type { AletaBotManualSendMode } from "@/lib/aleta-bot-types";
import { getDatabase } from "@/server/db/client";
import {
  getAletaBotManualSendHistory,
  previewAletaBotManualSend,
  runAletaBotManualSend,
} from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManualSendRequestBody = {
  action: "preview" | "send";
  mode: AletaBotManualSendMode;
  message?: string;
  queryId?: string;
  templateId?: string;
  params?: Record<string, string>;
  manualValues?: Record<string, string>;
  selectedRowIndex?: number;
  recipients?: Array<{ input: string; name?: string; documentPath?: string; message?: string }>;
  runQuery?: boolean;
  isTest?: boolean;
  clientRequestId?: string;
  confirmMultiple?: boolean;
  attachDocument?: boolean;
  notificationId?: string;
  referenceDate?: string;
};

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    return ok({ history: await getAletaBotManualSendHistory(db, actorUserId, limit) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<ManualSendRequestBody>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    if (body.action === "preview") {
      return ok(
        await previewAletaBotManualSend(db, {
          actorUserId,
          mode: body.mode,
          message: body.message,
          queryId: body.queryId,
          templateId: body.templateId,
          params: body.params,
          manualValues: body.manualValues,
          selectedRowIndex: body.selectedRowIndex,
          recipients: body.recipients,
          runQuery: body.runQuery,
          notificationId: body.notificationId,
          referenceDate: body.referenceDate,
        })
      );
    }

    if (body.action === "send") {
      return ok(
        await runAletaBotManualSend(db, {
          actorUserId,
          mode: body.mode,
          message: String(body.message ?? ""),
          recipients: body.recipients ?? [],
          isTest: body.isTest,
          clientRequestId: String(body.clientRequestId ?? ""),
          confirmMultiple: body.confirmMultiple,
          queryId: body.queryId,
          templateId: body.templateId,
          params: body.params,
          attachDocument: body.attachDocument,
        })
      );
    }

    throw new ApiError(400, "Aksi Kirim Manual tidak valid. Gunakan preview atau send.");
  } catch (error) {
    return handleRouteError(error);
  }
}
