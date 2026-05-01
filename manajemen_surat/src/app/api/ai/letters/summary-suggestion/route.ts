import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getAISettingsFromDb } from "@/server/modules/ai/service";
import { appendAiSuggestionLog } from "@/server/modules/ai/suggestion-log";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeLocalSummary(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  return (sentences.slice(0, 2).join(" ") || normalized.slice(0, 360)).slice(0, 600);
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) throw new ApiError(401, "Silakan login untuk meminta ringkasan.");
    const body = await readJsonBody<{
      perihal?: string;
      documentTextExtract?: string;
      isiRingkas?: string;
    }>(request);
    const db = await getDatabase();
    const aiSettings = await getAISettingsFromDb(db);
    const activeProvider =
      aiSettings.providers.find((provider) => provider.id === aiSettings.activeConnectionId) ??
      aiSettings.providers.find((provider) => provider.isActive);
    const providerNeedsSync = Boolean(aiSettings.enabled && activeProvider?.connectionStatus === "failed");
    const sourceText = [
      body.perihal,
      body.isiRingkas,
      String(body.documentTextExtract || "").slice(0, 8000),
    ].filter(Boolean).join(". ");
    const summary = makeLocalSummary(sourceText);
    const aiReady = Boolean(aiSettings.enabled && !providerNeedsSync);
    const fallbackReason = !aiSettings.enabled
      ? "disabled"
      : providerNeedsSync
        ? "needs_sync"
        : summary
          ? ""
          : "empty_input";
    const suggestionStatus = aiReady && summary ? "success" : "fallback";
    await appendAiSuggestionLog(db, {
      userId: actorUserId,
      feature: "letter_summary",
      status: suggestionStatus,
      providerId: activeProvider?.providerId ?? aiSettings.providerId,
      modelId: activeProvider?.modelId ?? aiSettings.modelId,
      durationMs: Date.now() - startedAt,
      fallbackReason,
      metadata: {
        inputLength: sourceText.length,
        hasDocumentExtract: Boolean(body.documentTextExtract),
        summaryLength: summary.length,
      },
    });
    return ok({
      aiReady,
      source: aiReady ? "ai_assisted_summary" : "manual_fallback",
      fallbackReason,
      message: !aiSettings.enabled
        ? "Fitur saran AI sedang dinonaktifkan."
        : providerNeedsSync
          ? "AI perlu disinkronkan oleh admin sebelum fitur saran dapat digunakan."
          : suggestionStatus === "success"
            ? "Ringkasan dibuat sebagai saran administrasi dan belum otomatis disimpan."
            : "Saran AI belum tersedia. Silakan isi manual.",
      summary: summary || "Belum ada teks dokumen yang bisa diringkas.",
      importantPoints: summary
        ? summary.split(/[,.;]\s+/).filter(Boolean).slice(0, 5)
        : [],
      dispositionSuggestion: "Gunakan ringkasan ini hanya sebagai bahan bantu administrasi. Keputusan disposisi tetap oleh pejabat berwenang.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
