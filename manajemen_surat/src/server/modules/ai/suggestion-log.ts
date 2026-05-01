import { type AletaDatabase } from "@/server/db/client";
import { nextPrefixedId } from "@/server/shared/ids";

export async function appendAiSuggestionLog(
  db: AletaDatabase,
  input: {
    userId?: string | null;
    feature: "letter_classification" | "letter_summary";
    status: "success" | "fallback" | "error";
    providerId?: string | null;
    modelId?: string | null;
    durationMs?: number;
    fallbackReason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await db
    .prepare(
      `INSERT INTO ai_suggestion_logs (
        id, user_id, feature, status, provider_id, model_id, duration_ms,
        fallback_reason, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      await nextPrefixedId(db, "ai_suggestion_logs", "aisl"),
      input.userId ?? null,
      input.feature,
      input.status,
      input.providerId ?? null,
      input.modelId ?? null,
      Math.max(0, Number(input.durationMs || 0)),
      String(input.fallbackReason || "").slice(0, 240),
      JSON.stringify(input.metadata ?? {}),
      new Date().toISOString()
    );
}
