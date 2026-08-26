import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  createWhatsappTemplate,
  listWhatsappTemplates,
  updateWhatsappTemplate,
} from "@/server/modules/judicia/legal-form/whatsapp/jlf-whatsapp-template-service";
import { asRecord, readBooleanValue, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok({ items: await listWhatsappTemplates(db, actor) });
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

    return created(await createWhatsappTemplate(db, actor, {
      key: readStringValue(payload, "key", { required: true, maxLength: 140 }),
      name: readStringValue(payload, "name", { required: true, maxLength: 160 }),
      eventType: readStringValue(payload, "eventType", { required: true, maxLength: 80 }),
      messageTemplate: readStringValue(payload, "messageTemplate", { required: true, maxLength: 600 }),
      isActive: readBooleanValue(payload, "isActive", true),
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    return ok(await updateWhatsappTemplate(db, actor, {
      id: readStringValue(payload, "id", { required: true, maxLength: 160 }),
      name: readOptionalStringValue(payload, "name", { maxLength: 160 }),
      messageTemplate: readOptionalStringValue(payload, "messageTemplate", { maxLength: 600 }),
      isActive: Object.prototype.hasOwnProperty.call(payload, "isActive")
        ? readBooleanValue(payload, "isActive", true)
        : undefined,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
