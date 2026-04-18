import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  getInstitutionIdentityFromDb,
  updateInstitutionIdentityInDb,
} from "@/server/modules/settings/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    return ok(await getInstitutionIdentityFromDb(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      courtName?: string;
      courtShortName?: string;
      address?: string;
      phoneNumber?: string;
      mobilePhone?: string;
      email?: string;
      instagram?: string;
      facebook?: string;
      youtube?: string;
      website?: string;
      mapUrl?: string;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await updateInstitutionIdentityInDb(db, {
      actorUserId,
      payload: {
        courtName: body.courtName,
        courtShortName: body.courtShortName,
        address: body.address,
        phoneNumber: body.phoneNumber,
        mobilePhone: body.mobilePhone,
        email: body.email,
        instagram: body.instagram,
        facebook: body.facebook,
        youtube: body.youtube,
        website: body.website,
        mapUrl: body.mapUrl,
      },
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
