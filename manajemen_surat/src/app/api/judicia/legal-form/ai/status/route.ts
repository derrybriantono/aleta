import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getSafeAiSettingsSummary } from "@/server/modules/judicia/legal-form/jlf-global-ai-settings-reader";
import { assertCanViewAi, getJlfAiRuntimeSettings } from "@/server/modules/judicia/legal-form/ai/jlf-ai-services";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    assertCanViewAi(actor);
    return ok({
      jlf: await getJlfAiRuntimeSettings(db),
      global: await getSafeAiSettingsSummary(db),
      policy: {
        createsSeparateProvider: false,
        exposesApiKey: false,
        outputIsDraft: true,
        humanInTheLoop: true,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
