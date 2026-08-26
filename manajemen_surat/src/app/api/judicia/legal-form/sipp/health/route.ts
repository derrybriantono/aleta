import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import { requireAnyJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { JlfSippProviderRegistry } from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    requireAnyJlfPermission(actor, [JLF_PERMISSION.CASE_SEARCH, JLF_PERMISSION.SETTINGS_MANAGE]);

    const provider = JlfSippProviderRegistry.getProvider();
    const health = await provider.checkConnection();

    return ok({
      provider: provider.key,
      health,
      rawSqlEndpoint: false,
      directMysqlDependencyInstalled: false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
