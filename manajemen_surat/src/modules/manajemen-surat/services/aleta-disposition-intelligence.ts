import { type DispositionSuggestionPayload } from "@/lib/types";

export type DispositionSuggestionInsight = DispositionSuggestionPayload;

type BackendEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string };
};

export class DispositionSuggestionRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function fetchDispositionSuggestionInsight({
  letterId,
  actorUserId,
  currentInstruction,
  targetOptions,
  signal,
}: {
  letterId: string;
  actorUserId?: string;
  currentInstruction: string;
  targetOptions: { id: string; label: string }[];
  signal?: AbortSignal;
}): Promise<DispositionSuggestionPayload> {
  const response = await fetch("/api/ai/suggest-disposisi", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(actorUserId ? { "x-aleta-user-id": actorUserId } : {}),
    },
    body: JSON.stringify({ letterId, actorUserId, currentInstruction, targetOptions }),
    signal,
  });

  const envelope = (await response.json().catch(() => ({}))) as BackendEnvelope<DispositionSuggestionPayload>;

  if (!response.ok || !envelope.ok || !envelope.data) {
    const message =
      envelope.error?.message ??
      "ALETA tidak dapat mengambil saran disposisi AI saat ini. Coba lagi beberapa saat lagi.";
    throw new DispositionSuggestionRequestError(message, response.status);
  }

  return envelope.data;
}
