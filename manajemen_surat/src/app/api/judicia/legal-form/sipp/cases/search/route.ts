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
    requireJlfPermission(actor, JLF_PERMISSION.CASE_SEARCH);

    const nomorPerkara = getSearchParam(request, "nomorPerkara") ?? getSearchParam(request, "number");
    const partyName = getSearchParam(request, "partyName") ?? getSearchParam(request, "name");
    const year = getSearchParam(request, "year");
    const caseType = getSearchParam(request, "caseType");
    const limit = readLimit(request.nextUrl.searchParams.get("limit"), 20, 50);

    const provider = JlfSippProviderRegistry.getProvider();
    JlfSippProviderRegistry.assertNoRawSql(nomorPerkara);
    JlfSippProviderRegistry.assertNoRawSql(partyName);

    const filters = { year, caseType, limit };
    const items = nomorPerkara
      ? await provider.searchCasesByNumber(normalizeSafeSearchQuery(nomorPerkara, "Nomor perkara", 3), filters)
      : await provider.searchCasesByPartyName(normalizeSafeSearchQuery(partyName ?? "", "Nama pihak", 3), filters);

    return ok({
      provider: provider.key,
      items: items.slice(0, limit),
      rawSqlEndpoint: false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
