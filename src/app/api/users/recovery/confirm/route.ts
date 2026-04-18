import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { confirmPasswordRecoveryInDb } from "@/server/modules/users/service";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      userId: string;
      otp: string;
      password: string;
    }>(request);
    const db = await getDatabase();
    const result = await confirmPasswordRecoveryInDb(db, body);

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

