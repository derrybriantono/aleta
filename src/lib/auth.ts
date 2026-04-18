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

function normalizeOrigin(input: string) {
  try {
    return new URL(input).origin;
  } catch {
    return input.trim();
  }
}

function buildTrustedOrigins(baseURL: string) {
  const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const trustedOrigins = new Set<string>([normalizeOrigin(baseURL), ...configuredOrigins.map(normalizeOrigin)]);

  try {
    const url = new URL(baseURL);
    if (url.hostname === "localhost") {
      trustedOrigins.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ""}`);
    }
    if (url.hostname === "127.0.0.1") {
      trustedOrigins.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ""}`);
    }
  } catch {
    // Ignore invalid URL parsing and rely on the configured values as-is.
  }

  return Array.from(trustedOrigins);
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
  const baseURL =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    "http://localhost:3000";

  return betterAuth({
    appName: "ALETA",
    secret: getLocalAuthSecret(),
    baseURL,
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
      expiresIn: 60 * 10, // 10 menit
      updateAge: 60 * 5, // Update sesi setiap 5 menit jika ada aktivitas
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
