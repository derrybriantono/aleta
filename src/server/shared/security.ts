import { createHash } from "node:crypto";

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function isLikelyConnectedApiKey(apiKey: string) {
  return apiKey.trim().length >= 12;
}
