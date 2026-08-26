import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { searchJlfCases } from "@/server/modules/judicia/legal-form/cases/jlf-case-service";
import { readLimit } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const nomorPerkara = getSearchParam(request, "nomorPerkara") ?? getSearchParam(request, "number");
    const partyName = getSearchParam(request, "partyName") ?? getSearchParam(request, "name");
    const mode = nomorPerkara ? "number" : "party";

    const result = await searchJlfCases(
      db,
      actor,
      {
        mode,
        query: nomorPerkara ?? partyName ?? "",
        year: getSearchParam(request, "year"),
        caseType: getSearchParam(request, "caseType"),
        limit: readLimit(request.nextUrl.searchParams.get("limit"), 20, 50),
      },
      getRequestAuditMetadata(request)
    );

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
