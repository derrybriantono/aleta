import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getDatabase } from "@/server/db/client";
import { schema } from "@/server/db/drizzle-schema";
import { hashSecret } from "@/server/shared/security";

let cachedAuth: ReturnType<typeof createAuthInstance> | undefined;
let cachedOrm: unknown;
let cachedLocalAuthSecret: string | undefined;

export const AUTH_SESSION_EXPIRES_IN_SECONDS = 60 * 60;
export const AUTH_SESSION_UPDATE_AGE_SECONDS = 60 * 10;

function normalizeOrigin(input: string) {
  try {
    return new URL(input).origin;
  } catch {
    return input.trim();
  }
}

function isLoopbackHostname(hostname: string) {
  return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
}

function urlPort(url: URL) {
  if (url.port) return url.port;
  if (url.protocol === "http:") return "80";
  if (url.protocol === "https:") return "443";
  return "";
}

export function buildTrustedOrigins(baseURL: string) {
  const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const trustedOrigins = new Set<string>([normalizeOrigin(baseURL), ...configuredOrigins.map(normalizeOrigin)]);
  const loopbackPorts = new Set<string>();
  const loopbackProtocols = new Set<string>();
  const originCandidates = [baseURL, ...configuredOrigins];

  for (const candidate of originCandidates) {
    try {
      const url = new URL(candidate);
      if (!isLoopbackHostname(url.hostname)) continue;
      loopbackPorts.add(urlPort(url));
      loopbackProtocols.add(url.protocol);
      if (url.hostname === "localhost") {
        trustedOrigins.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ""}`);
      }
      if (url.hostname === "127.0.0.1") {
        trustedOrigins.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ""}`);
      }
    } catch {
      // Ignore invalid URL parsing and rely on the configured values as-is.
    }
  }

  if (loopbackPorts.size > 0) {
    for (const port of [process.env.PORT, process.env.NEXT_PUBLIC_PORT, "3000", "3001"].filter(Boolean)) {
      loopbackPorts.add(String(port));
    }
    if (loopbackProtocols.size === 0) loopbackProtocols.add("http:");
    for (const protocol of loopbackProtocols) {
      for (const port of loopbackPorts) {
        const suffix = port && !["80", "443"].includes(port) ? `:${port}` : "";
        trustedOrigins.add(`${protocol}//localhost${suffix}`);
        trustedOrigins.add(`${protocol}//127.0.0.1${suffix}`);
      }
    }
  }

  return Array.from(trustedOrigins);
}

export function getAuthBasePath() {
  return "/api/auth";
}

export function getAuthBaseURL() {
  const configured =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    "http://localhost:3000";

  try {
    return new URL(configured).origin;
  } catch {
    return configured.trim();
  }
}

function getLocalAuthSecret() {
  if (cachedLocalAuthSecret) {
    return cachedLocalAuthSecret;
  }

  const configuredSecret = process.env.BETTER_AUTH_SECRET?.trim();
  if (configuredSecret) {
    cachedLocalAuthSecret = configuredSecret;
    return configuredSecret;
  }

  const secretPath = path.join(process.cwd(), "data", ".better-auth-secret");
  if (fs.existsSync(secretPath)) {
    cachedLocalAuthSecret = fs.readFileSync(secretPath, "utf8").trim();
    return cachedLocalAuthSecret;
  }

  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  cachedLocalAuthSecret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(secretPath, `${cachedLocalAuthSecret}\n`, "utf8");
  return cachedLocalAuthSecret;
}

function createAuthInstance(database: Parameters<typeof drizzleAdapter>[0]) {
  const baseURL = getAuthBaseURL();

  return betterAuth({
    appName: "ALETA",
    secret: getLocalAuthSecret(),
    baseURL,
    basePath: getAuthBasePath(),
    trustedOrigins: buildTrustedOrigins(baseURL),
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 6,
      password: {
        hash: async (password) => hashSecret(password),
        verify: async ({ password, hash }) => hashSecret(password) === hash,
      },
    },
    session: {
      expiresIn: AUTH_SESSION_EXPIRES_IN_SECONDS,
      updateAge: AUTH_SESSION_UPDATE_AGE_SECONDS,
    },

  });
}

export async function getAuth() {
  const database = await getDatabase();
  const orm = database.getOrm();

  if (cachedAuth && cachedOrm === orm) {
    return cachedAuth;
  }

  cachedOrm = orm;
  cachedAuth = createAuthInstance(orm);
  return cachedAuth;
}
