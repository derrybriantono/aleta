import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { buildExternalAppLaunchHtml } from "@/server/modules/external-apps/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    appId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  let appId = "unknown";
  try {
    const params = await context.params;
    appId = params.appId;
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const html = await buildExternalAppLaunchHtml(db, { actor, appId });

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "EXTERNAL_APP_AUTO_LOGIN_FAILED",
      feature: "external_app_sso",
      entityId: appId,
    });
  }
}
