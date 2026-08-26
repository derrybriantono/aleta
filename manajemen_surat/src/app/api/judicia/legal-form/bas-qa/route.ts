import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createBasQaTemplate, listBasQaTemplates } from "@/server/modules/judicia/legal-form/bas-qa/jlf-bas-qa-service";
import { asRecord } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok({ items: await listBasQaTemplates(db, actor) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return created(await createBasQaTemplate(
      db,
      actor,
      payload as { code: unknown; name: unknown; caseType?: unknown; paperSize?: unknown },
      getRequestAuditMetadata(request)
    ));
  } catch (error) {
    return handleRouteError(error);
  }
}
