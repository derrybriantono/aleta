import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getDatabase } from "@/server/db/client";
import { schema } from "@/server/db/drizzle-schema";
import { kaitSesiPerangkat } from "@/server/modules/perangkat/kait-auth";
import { masukSippPlugin } from "@/server/modules/portal/masuk-sipp-plugin";
import { hashSecret } from "@/server/shared/security";

let cachedAuth: ReturnType<typeof createAuthInstance> | undefined;
let cachedOrm: unknown;
let cachedLocalAuthSecret: string | undefined;

/**
 * ============================================================================
 * MASA BERLAKU BETTER AUTH ADALAH BATAS TERAKHIR, BUKAN ATURANNYA
 * ============================================================================
 *
 * Aturan yang sesungguhnya ada di server/modules/portal/sesi-portal.ts: yang
 * mencentang "Simpan login akun" bertahan sampai aplikasinya diperbarui, yang
 * tidak mencentangnya dua jam.
 *
 * Better Auth memberi SATU masa berlaku bagi seluruh sesi - rememberMe hanya
 * menentukan kukinya bertahan setelah peramban ditutup atau tidak. Karena itu
 * angka di sini disetel panjang, sebagai pagar terakhir bila penandanya hilang
 * atau basis datanya tidak dapat dibaca; yang memutus sesi lebih awal adalah
 * pemeriksaan di resolveActorUserId.
 *
 * Dulu satu jam, dan itu memutus panitera pengganti di tengah menulis berita
 * acara.
 */
export const AUTH_SESSION_EXPIRES_IN_SECONDS = 180 * 24 * 60 * 60;
export const AUTH_SESSION_UPDATE_AGE_SECONDS = 60 * 60;

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

/** Port tambahan ALETA di Apache (bawaan "8008"); kosong = tidak ada. */
export function portPortalTambahan(): string[] {
  const mentah = process.env.ALETA_PORT_PORTAL_TAMBAHAN;
  const teks = mentah === undefined ? "8008" : mentah;
  return teks
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^\d{2,5}$/.test(x) && x !== "80" && x !== "443");
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

  // ==========================================================================
  // PORT SENDIRI UNTUK ALETA (K1, 19 Okt 2026)
  // ==========================================================================
  //
  // ALETA juga dilayani Apache di port tersendiri (bawaan 8008, lihat
  // deploy/apache/aleta-8008.conf) supaya peramban memberinya sambungan
  // sendiri, terpisah dari SIPP/ABT di port 80. Asal yang SAMA hostnya dengan
  // asal tepercaya (bukan loopback) ikut dipercaya pada port itu. Kuki sesi
  // tidak membedakan port, jadi sesi yang sama berlaku di keduanya.
  // ALETA_PORT_PORTAL_TAMBAHAN="" mematikannya; boleh beberapa, dipisah koma.
  for (const port of portPortalTambahan()) {
    for (const candidate of originCandidates) {
      try {
        const url = new URL(candidate);
        if (isLoopbackHostname(url.hostname) || url.protocol !== "http:") continue;
        trustedOrigins.add(`${url.protocol}//${url.hostname}:${port}`);
      } catch {
        // bukan URL: dilewati
      }
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
    // Masuk ALETA dengan akun SIPP (POST /api/auth/sign-in/sipp, 7 Okt 2026).
    // Jalur /sign-in/email tetap utuh untuk akun tanpa tautan SIPP.
    plugins: [masukSippPlugin()],
    // Jejak masuk & batas perangkat (23 Okt 2026): SATU titik untuk email,
    // sipp, dan sipp-sesi - semuanya membuat sesi lewat createWithHooks. Kait
    // ini juga menulis IP klien yang benar (ujung X-Forwarded-For) ke
    // sessions.ip_address. Pembatas laju Better Auth tidak diubah.
    databaseHooks: kaitSesiPerangkat(getDatabase),

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
