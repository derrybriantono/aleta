import { type NextRequest, NextResponse } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  exportAletaBotLatestWhatsappRowsXlsx,
  exportAletaBotWhatsappReportXlsx,
  getAletaBotWhatsappReport,
  WHATSAPP_REPORT_RANGES,
  WHATSAPP_REPORT_SOURCES,
} from "@/server/modules/aleta-bot/whatsapp-report";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { buildAttachmentContentDisposition, getAttachmentSecurityHeaders } from "@/server/shared/download-headers";
import { handleRouteError, ok, unauthorized } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) return unauthorized();

    const db = await getDatabase();
    const { searchParams } = request.nextUrl;
    const options = {
      range: searchParams.get("range"),
      status: searchParams.get("status"),
      sourceApp: searchParams.get("sourceApp"),
      search: searchParams.get("search"),
    };

    if (searchParams.get("format") === "latest-xlsx") {
      const result = await exportAletaBotLatestWhatsappRowsXlsx(db, actorUserId, {
        ...options,
        tableSearch: searchParams.get("tableSearch"),
        tableStatus: searchParams.get("tableStatus"),
        tableApp: searchParams.get("tableApp"),
        tableFeature: searchParams.get("tableFeature"),
        sortKey: searchParams.get("sortKey"),
        sortDirection: searchParams.get("sortDirection"),
      });
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId,
        action: "EXPORT_ALETA_BOT_LATEST_WHATSAPP_ROWS",
        entityType: "aleta_bot_whatsapp_report",
        entityId: "latest",
        payload: {
          rowCount: result.rowCount,
          options,
          tableStatus: searchParams.get("tableStatus"),
          tableApp: searchParams.get("tableApp"),
          tableFeature: searchParams.get("tableFeature"),
          ...getRequestAuditMetadata(request),
        },
      });
      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          ...getAttachmentSecurityHeaders(),
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": buildAttachmentContentDisposition(result.filename),
          "x-aleta-export-row-count": String(result.rowCount),
        },
      });
    }

    if (searchParams.get("format") === "xlsx") {
      const result = await exportAletaBotWhatsappReportXlsx(db, actorUserId, options);
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId,
        action: "EXPORT_ALETA_BOT_WHATSAPP_REPORT",
        entityType: "aleta_bot_whatsapp_report",
        entityId: "summary",
        payload: {
          rowCount: result.rowCount,
          options,
          ...getRequestAuditMetadata(request),
        },
      });
      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          ...getAttachmentSecurityHeaders(),
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": buildAttachmentContentDisposition(result.filename),
          "x-aleta-export-row-count": String(result.rowCount),
        },
      });
    }

    const report = await getAletaBotWhatsappReport(db, actorUserId, {
      ...options,
      limit: Number(searchParams.get("limit") || 80),
    });

    return ok({
      ...report,
      availableRanges: WHATSAPP_REPORT_RANGES,
      availableSources: WHATSAPP_REPORT_SOURCES,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
