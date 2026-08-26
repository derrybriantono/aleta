import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { asRecord, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { testSafeJlfWhatsappNotification } from "@/server/modules/judicia/legal-form/whatsapp/jlf-whatsapp-notification-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    return ok(await testSafeJlfWhatsappNotification(db, actor, {
      recipientPhone: readStringValue(payload, "recipientPhone", { required: true, maxLength: 40 }),
      eventType: readOptionalStringValue(payload, "eventType", { maxLength: 80 }) as never,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
