import { getDatabase } from "@/server/db/client";
import { getInstitutionIdentityFromDb } from "@/server/modules/settings/service";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDatabase();
    const identity = await getInstitutionIdentityFromDb(db);

    return ok({
      courtName: identity.courtName,
      courtShortName: identity.courtShortName,
      logoUrl: identity.logoUrl,
      mobilePhone: identity.mobilePhone,
      csWhatsappNumber: identity.csWhatsappNumber,
      botWhatsappNumber: identity.botWhatsappNumber,
      email: identity.email,
      website: identity.website,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
