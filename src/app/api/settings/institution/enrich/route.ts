import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { type InstitutionIdentity } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveInstitutionIdentityEnrichment } from "@/server/modules/settings/institution-enrichment";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSafeString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function toSafeRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      courtId?: unknown;
      query?: unknown;
      localIdentity?: unknown;
      refresh?: unknown;
    }>(request);
    const localIdentity = toSafeRecord(body.localIdentity) as Partial<Record<keyof InstitutionIdentity, unknown>>;
    const courtId = toSafeString(body.courtId);
    const query = toSafeString(body.query) || toSafeString(localIdentity.courtName);
    if (!courtId && query.length < 3) {
      throw new ApiError(400, "Nama pengadilan minimal 3 karakter sebelum menerapkan saran AI.");
    }

    const actorUserId = await resolveActorUserId(request);
    const db = await getDatabase();
    const actor = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat memproses enrichment identitas instansi.");
    }

    return ok(
      await resolveInstitutionIdentityEnrichment(db, {
        actorUserId: actor.id,
        courtId,
        query,
        localIdentity,
        refresh: Boolean(body.refresh),
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
