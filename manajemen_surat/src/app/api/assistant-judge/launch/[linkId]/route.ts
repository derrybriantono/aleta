import { NextRequest, NextResponse } from "next/server";

import {
  canAccessAssistantJudgeLink,
  findAssistantJudgeLinkByIdentifier,
  validateAssistantJudgeUrl,
} from "@/lib/assistant-judge";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { getAssistantJudgeSettingsFromDb } from "@/server/modules/settings/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { forbidden, handleRouteError, notFound } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    linkId: string;
  }>;
};

function readRouteLinkId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { linkId: rawLinkId } = await context.params;
    const linkId = readRouteLinkId(rawLinkId);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const config = await getAssistantJudgeSettingsFromDb(db);

    if (!config.enabled) {
      forbidden("Fitur Asisten Hakim sedang dinonaktifkan.");
    }

    const link = findAssistantJudgeLinkByIdentifier(config, linkId);
    if (!link || !link.enabled) {
      notFound("Menu Asisten Hakim tidak ditemukan.");
    }
    const selectedLink = link!;

    if (!canAccessAssistantJudgeLink(selectedLink, actor.roleId, actor.id)) {
      forbidden("Anda tidak memiliki akses ke menu Asisten Hakim ini.");
    }

    const validation = validateAssistantJudgeUrl(selectedLink.url);
    if (!validation.ok) {
      notFound("URL Asisten Hakim belum valid.");
    }

    const response = NextResponse.redirect(new URL(selectedLink.url), { status: 302 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
