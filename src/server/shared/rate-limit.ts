import { type NextRequest } from "next/server";

import { ApiError } from "@/server/shared/errors";

type RateLimitScope = "login" | "login-lookup" | "recovery-request" | "recovery-confirm";

type RateLimitBucket = {
  attempts: number;
  windowStartedAt: number;
  blockedUntil: number;
};

type RateLimitConfig = {
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
  message: string;
};

const rateLimitStore = new Map<string, RateLimitBucket>();

const RATE_LIMIT_CONFIG: Record<RateLimitScope, RateLimitConfig> = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
    message: "Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.",
  },
  "login-lookup": {
    maxAttempts: 20,
    windowMs: 10 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
    message: "Terlalu banyak percobaan pencarian akun login. Coba lagi sebentar.",
  },
  "recovery-request": {
    maxAttempts: 5,
    windowMs: 30 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
    message: "Permintaan OTP terlalu sering. Coba lagi nanti.",
  },
  "recovery-confirm": {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
    message: "Terlalu banyak percobaan verifikasi OTP. Coba lagi beberapa menit lagi.",
  },
};

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "local";
}

function normalizeIdentifier(identifier: string | null | undefined) {
  return identifier?.trim().toLowerCase() || "anonymous";
}

function buildBucketKey(scope: RateLimitScope, request: NextRequest, identifier?: string | null) {
  return `${scope}:${getClientIp(request)}:${normalizeIdentifier(identifier)}`;
}

function getOrCreateBucket(key: string) {
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket) {
    const nextBucket = {
      attempts: 0,
      windowStartedAt: now,
      blockedUntil: 0,
    };
    rateLimitStore.set(key, nextBucket);
    return nextBucket;
  }

  return bucket;
}

function normalizeBucket(bucket: RateLimitBucket, config: RateLimitConfig) {
  const now = Date.now();

  if (bucket.blockedUntil > 0 && bucket.blockedUntil <= now) {
    bucket.blockedUntil = 0;
    bucket.attempts = 0;
    bucket.windowStartedAt = now;
  }

  if (now - bucket.windowStartedAt > config.windowMs) {
    bucket.attempts = 0;
    bucket.windowStartedAt = now;
  }
}

export function assertRateLimit(scope: RateLimitScope, request: NextRequest, identifier?: string | null) {
  const config = RATE_LIMIT_CONFIG[scope];
  const key = buildBucketKey(scope, request, identifier);
  const bucket = getOrCreateBucket(key);
  normalizeBucket(bucket, config);

  if (bucket.blockedUntil > Date.now()) {
    throw new ApiError(429, config.message);
  }
}

export function recordRateLimitFailure(scope: RateLimitScope, request: NextRequest, identifier?: string | null) {
  const config = RATE_LIMIT_CONFIG[scope];
  const key = buildBucketKey(scope, request, identifier);
  const bucket = getOrCreateBucket(key);
  normalizeBucket(bucket, config);

  bucket.attempts += 1;

  if (bucket.attempts >= config.maxAttempts) {
    bucket.blockedUntil = Date.now() + config.blockMs;
  }
}

export function clearRateLimit(scope: RateLimitScope, request: NextRequest, identifier?: string | null) {
  rateLimitStore.delete(buildBucketKey(scope, request, identifier));
}
