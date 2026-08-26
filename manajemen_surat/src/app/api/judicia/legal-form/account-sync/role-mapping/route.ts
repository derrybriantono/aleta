import { NextRequest } from "next/server";

import type { RoleId } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import {
  createMapping,
  disableMapping,
  listMappings,
  updateMapping,
} from "@/server/modules/judicia/legal-form/jlf-account-sync-service";
import {
  asRecord,
  normalizeId,
  readBooleanValue,
  readJsonSettingValue,
  readOptionalStringValue,
  readStringValue,
} from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSuggestedPermissions(payload: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(payload, "suggestedPermissions")) {
    return undefined;
  }

  const value = readJsonSettingValue({ value: payload.suggestedPermissions });
  return Array.isArray(value) ? value.map(String) : [];
}

function readOptionalRoleId(payload: Record<string, unknown>) {
  return readOptionalStringValue(payload, "suggestedAletaRoleId", { maxLength: 80 }) as RoleId | undefined;
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const items = await listMappings(db, actor);

    return ok({ items });
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
    const mapping = await createMapping(db, actor, {
      sippGroupId: readStringValue(payload, "sippGroupId", { required: true, maxLength: 120 }),
      sippGroupName: readStringValue(payload, "sippGroupName", { required: true, maxLength: 180 }),
      suggestedAletaRoleId: readOptionalRoleId(payload),
      suggestedPermissions: readSuggestedPermissions(payload) ?? [],
      isAutoApply: readBooleanValue(payload, "isAutoApply", false),
      requiresAdminApproval: readBooleanValue(payload, "requiresAdminApproval", true),
      description: readOptionalStringValue(payload, "description", { maxLength: 500 }),
    });

    return created(mapping);
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
    const id = normalizeId(String(payload.id ?? ""), "ID mapping role SIPP");

    if (payload.action === "disable") {
      return ok(await disableMapping(db, actor, id));
    }

    const mapping = await updateMapping(db, actor, {
      id,
      sippGroupName: readOptionalStringValue(payload, "sippGroupName", { maxLength: 180 }),
      suggestedAletaRoleId: readOptionalRoleId(payload),
      suggestedPermissions: readSuggestedPermissions(payload),
      isAutoApply: Object.prototype.hasOwnProperty.call(payload, "isAutoApply")
        ? readBooleanValue(payload, "isAutoApply", false)
        : undefined,
      requiresAdminApproval: Object.prototype.hasOwnProperty.call(payload, "requiresAdminApproval")
        ? readBooleanValue(payload, "requiresAdminApproval", true)
        : undefined,
      description: readOptionalStringValue(payload, "description", { maxLength: 500 }),
      isActive: Object.prototype.hasOwnProperty.call(payload, "isActive")
        ? readBooleanValue(payload, "isActive", true)
        : undefined,
    });

    return ok(mapping);
  } catch (error) {
    return handleRouteError(error);
  }
}
