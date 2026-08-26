import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listAuditLogs, type JlfAuditLogFilters } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { readLimit } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_GROUPS = new Set(["ai", "account_sync", "document", "whatsapp", "regulation", "template", "variable", "anonymizer"]);

function readEventGroup(value: string | null): JlfAuditLogFilters["eventGroup"] {
  return value && EVENT_GROUPS.has(value) ? (value as JlfAuditLogFilters["eventGroup"]) : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const result = await listAuditLogs(db, actor, {
      userId: searchParams.get("userId")?.trim() || undefined,
      action: searchParams.get("action")?.trim() || undefined,
      entityType: searchParams.get("entityType")?.trim() || undefined,
      entityId: searchParams.get("entityId")?.trim() || undefined,
      nomorPerkara: searchParams.get("nomorPerkara")?.trim() || undefined,
      eventGroup: readEventGroup(searchParams.get("eventGroup")),
      from: searchParams.get("from")?.trim() || undefined,
      to: searchParams.get("to")?.trim() || undefined,
      limit: readLimit(searchParams.get("limit"), 50, 200),
      offset: Math.max(0, Number(searchParams.get("offset") ?? 0) || 0),
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
