import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createPasswordRecoveryDraftInDb } from "@/server/modules/users/service";
import { created, handleRouteError } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      nip: string;
    }>(request);
    const db = await getDatabase();
    const recovery = await createPasswordRecoveryDraftInDb(db, body.nip);

    return created({
      recovery,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

