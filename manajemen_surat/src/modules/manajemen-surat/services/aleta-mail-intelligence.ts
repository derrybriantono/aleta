import { type MailIntelligencePayload } from "@/lib/types";

export type MailIntelligenceInsight = MailIntelligencePayload;

type BackendEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string };
};

export class MailIntelligenceRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function fetchMailIntelligenceInsight({
  letterId,
  actorUserId,
  signal,
}: {
  letterId: string;
  actorUserId?: string;
  signal?: AbortSignal;
}): Promise<MailIntelligencePayload> {
  const response = await fetch("/api/ai/intelligence/mail", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(actorUserId ? { "x-aleta-user-id": actorUserId } : {}),
    },
    body: JSON.stringify({ letterId, actorUserId }),
    signal,
  });

  const envelope = (await response.json().catch(() => ({}))) as BackendEnvelope<MailIntelligencePayload>;

  if (!response.ok || !envelope.ok || !envelope.data) {
    const message =
      envelope.error?.message ??
      "ALETA tidak dapat mengambil hasil analisis AI saat ini. Coba lagi beberapa saat lagi.";
    throw new MailIntelligenceRequestError(message, response.status);
  }

  return envelope.data;
}
