import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  createActingAssignmentInDb,
  deactivateActingAssignmentInDb,
  listActingAssignmentsFromDb,
  requireActorUser,
} from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { getSearchParam, readJsonBody } from "@/server/shared/request";
import { created, handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    return ok({
      items: await listActingAssignmentsFromDb(db),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      userIdPengganti: string;
      jabatanIdTarget: string;
      tipe: "PLH" | "PLT";
      tanggalMulai?: string;
      tanggalSelesai?: string | null;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await createActingAssignmentInDb(db, {
      actorUserId,
      userIdPengganti: body.userIdPengganti,
      jabatanIdTarget: body.jabatanIdTarget,
      tipe: body.tipe,
      tanggalMulai: body.tanggalMulai,
      tanggalSelesai: body.tanggalSelesai,
    });

    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const hasJsonBody = request.headers.get("content-type")?.includes("application/json");
    const body = hasJsonBody ? await readJsonBody<{ actorUserId?: string; assignmentId?: string }>(request) : {};
    const assignmentId = body.assignmentId ?? getSearchParam(request, "assignmentId");

    if (!assignmentId) {
      throw new ApiError(400, "assignmentId wajib dikirim untuk menghapus penugasan jabatan.");
    }

    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await deactivateActingAssignmentInDb(db, assignmentId, actorUserId);

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
