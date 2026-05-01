import { NextRequest } from "next/server";

import { inferLetterClassificationFromText } from "@/lib/letter-taxonomy";
import { getDatabase } from "@/server/db/client";
import { getAISettingsFromDb } from "@/server/modules/ai/service";
import { appendAiSuggestionLog } from "@/server/modules/ai/suggestion-log";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) throw new ApiError(401, "Silakan login untuk meminta saran AI.");
    const body = await readJsonBody<{
      perihal?: string;
      asalTujuan?: string;
      ringkasanIsi?: string;
      documentTextExtract?: string;
      type?: string;
    }>(request);
    const db = await getDatabase();
    const aiSettings = await getAISettingsFromDb(db);
    const activeProvider =
      aiSettings.providers.find((provider) => provider.id === aiSettings.activeConnectionId) ??
      aiSettings.providers.find((provider) => provider.isActive);
    const providerNeedsSync = Boolean(aiSettings.enabled && activeProvider?.connectionStatus === "failed");
    const text = [
      body.type,
      body.perihal,
      body.asalTujuan,
      body.ringkasanIsi,
      String(body.documentTextExtract || "").slice(0, 5000),
    ].filter(Boolean).join("\n");
    const match = inferLetterClassificationFromText(text);
    const aiReady = Boolean(aiSettings.enabled && !providerNeedsSync);
    const fallbackReason = !aiSettings.enabled
      ? "disabled"
      : providerNeedsSync
        ? "needs_sync"
        : match
          ? ""
          : "low_confidence";
    const suggestionStatus = aiReady && match ? "success" : "fallback";
    await appendAiSuggestionLog(db, {
      userId: actorUserId,
      feature: "letter_classification",
      status: suggestionStatus,
      providerId: activeProvider?.providerId ?? aiSettings.providerId,
      modelId: activeProvider?.modelId ?? aiSettings.modelId,
      durationMs: Date.now() - startedAt,
      fallbackReason,
      metadata: {
        inputLength: text.length,
        hasDocumentExtract: Boolean(body.documentTextExtract),
        matchedCode: match?.code ?? "",
      },
    });
    return ok({
      aiReady,
      source: aiReady ? "ai_assisted_heuristic" : "manual_fallback",
      fallbackReason,
      message: !aiSettings.enabled
        ? "Fitur saran AI sedang dinonaktifkan."
        : providerNeedsSync
          ? "AI perlu disinkronkan oleh admin sebelum fitur saran dapat digunakan."
          : suggestionStatus === "success"
            ? "Saran dibuat sebagai bantuan pengisian. Tetap verifikasi sebelum dipakai."
            : "Saran AI belum tersedia. Silakan isi manual.",
      suggestedClassificationCode: match?.code ?? "",
      suggestedClassificationLabel: match?.label ?? "Belum ada klasifikasi yang cukup kuat.",
      confidence: match ? Math.min(0.95, 0.55 + match.score / 20) : 0,
      reason: match
        ? `Cocok dengan ${match.category}${match.keywordHits.length ? ` melalui kata kunci: ${match.keywordHits.join(", ")}` : ""}.`
        : "Data input belum cukup untuk memberi saran klasifikasi yang meyakinkan.",
      suggestedTags: match ? [match.category, ...match.keywordHits].slice(0, 6) : [],
      suggestedSummary: body.ringkasanIsi || body.perihal || "",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
