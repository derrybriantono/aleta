import { createHash } from "node:crypto";

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function isLikelyConnectedApiKey(apiKey: string) {
  return apiKey.trim().length >= 12;
}

export function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();

  if (!trimmed) return "";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;

  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}
