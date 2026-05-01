import { NextRequest, NextResponse } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getPolicySkipReport } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const format = searchParams.get("format");
    const report = await getPolicySkipReport(db, actorUserId, {
      dateFrom: searchParams.get("dateFrom"),
      dateTo: searchParams.get("dateTo"),
      reason: searchParams.get("reason"),
      notificationKey: searchParams.get("notificationKey"),
      category: searchParams.get("category"),
      format,
    });

    if (format === "csv" && "csv" in report) {
      return new NextResponse(report.csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${report.filename}"`,
        },
      });
    }

    return ok(report);
  } catch (error) {
    return handleRouteError(error);
  }
}
