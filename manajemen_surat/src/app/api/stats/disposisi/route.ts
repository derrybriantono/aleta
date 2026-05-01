import { getDatabase } from "@/server/db/client";
import { getDispositionStatisticsInDb } from "@/server/modules/stats/service";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDatabase();
    const result = await getDispositionStatisticsInDb(db);

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
