import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { JlfSippProviderRegistry } from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";
import { normalizeSafeSearchQuery, readLimit } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    requireJlfPermission(actor, JLF_PERMISSION.ACCOUNT_SYNC_MANAGE);

    const query = normalizeSafeSearchQuery(getSearchParam(request, "query") ?? "", "Pencarian user SIPP", 2);
    const limit = readLimit(request.nextUrl.searchParams.get("limit"), 10, 25);
    JlfSippProviderRegistry.assertNoRawSql(query);

    const provider = JlfSippProviderRegistry.getProvider();
    const items = await provider.searchSippUsers(query, limit);

    return ok({
      provider: provider.key,
      items: items.slice(0, limit),
      sensitiveFieldsExcluded: true,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
