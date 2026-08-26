import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  getInstitutionIdentityFromDb,
  updateInstitutionIdentityInDb,
} from "@/server/modules/settings/service";
import { syncAletaBotRuntimeConfigFromDb } from "@/server/modules/aleta-bot/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    return ok(await getInstitutionIdentityFromDb(db));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "INSTITUTION_SETTINGS_ACCESS_FAILED",
      feature: "identitas_instansi",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      courtName?: string;
      courtShortName?: string;
      address?: string;
      phoneNumber?: string;
      mobilePhone?: string;
      csWhatsappNumber?: string;
      botWhatsappNumber?: string;
      email?: string;
      instagram?: string;
      facebook?: string;
      youtube?: string;
      website?: string;
      mapUrl?: string;
      logoUrl?: string;
    }>(request);
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const result = await updateInstitutionIdentityInDb(db, {
      actorUserId,
      payload: {
        courtName: body.courtName,
        courtShortName: body.courtShortName,
        address: body.address,
        phoneNumber: body.phoneNumber,
        mobilePhone: body.mobilePhone,
        csWhatsappNumber: body.csWhatsappNumber,
        botWhatsappNumber: body.botWhatsappNumber,
        email: body.email,
        instagram: body.instagram,
        facebook: body.facebook,
        youtube: body.youtube,
        website: body.website,
        mapUrl: body.mapUrl,
        logoUrl: body.logoUrl,
      },
    });
    await syncAletaBotRuntimeConfigFromDb(db).catch(() => null);

    return ok(result);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "INSTITUTION_SETTINGS_ACCESS_FAILED",
      feature: "identitas_instansi",
    });
  }
}
