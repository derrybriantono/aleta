import { describe, expect, it } from "vitest";

import {
  AUTH_SESSION_EXPIRES_IN_SECONDS,
  AUTH_SESSION_UPDATE_AGE_SECONDS,
  buildTrustedOrigins,
  getAuthBasePath,
  getAuthBaseURL,
} from "@/lib/auth";

describe("auth session duration", () => {
  it("memakai masa berlaku panjang sebagai pagar terakhir, bukan sebagai aturannya", () => {
    // Aturan yang sesungguhnya ada di sesi-portal.ts: dua jam bagi yang tidak
    // mencentang "Simpan login akun", dan sampai pembaruan bagi yang
    // mencentangnya. Angka di sini hanya batas terakhir - lihat catatan pada
    // auth.ts. Dulu satu jam, dan itu memutus orang di tengah pekerjaan.
    expect(AUTH_SESSION_EXPIRES_IN_SECONDS).toBe(180 * 24 * 60 * 60);
    expect(AUTH_SESSION_UPDATE_AGE_SECONDS).toBe(60 * 60);
  });

  it("keeps Better Auth mounted under the internal API route when the app runs under /aleta", () => {
    const previousBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
    const previousAuthUrl = process.env.BETTER_AUTH_URL;

    process.env.NEXT_PUBLIC_BASE_PATH = "/aleta";
    process.env.BETTER_AUTH_URL = "http://192.168.10.10/aleta";

    try {
      expect(getAuthBasePath()).toBe("/api/auth");
      expect(getAuthBaseURL()).toBe("http://192.168.10.10");
    } finally {
      if (previousBasePath === undefined) {
        delete process.env.NEXT_PUBLIC_BASE_PATH;
      } else {
        process.env.NEXT_PUBLIC_BASE_PATH = previousBasePath;
      }

      if (previousAuthUrl === undefined) {
        delete process.env.BETTER_AUTH_URL;
      } else {
        process.env.BETTER_AUTH_URL = previousAuthUrl;
      }
    }
  });

  it("trusts localhost and 127.0.0.1 on local runtime ports", () => {
    const previousTrustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
    const previousPort = process.env.PORT;
    const previousNextPublicPort = process.env.NEXT_PUBLIC_PORT;

    delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
    process.env.PORT = "3001";
    delete process.env.NEXT_PUBLIC_PORT;

    try {
      const origins = buildTrustedOrigins("http://localhost:3000");

      expect(origins).toContain("http://localhost:3000");
      expect(origins).toContain("http://127.0.0.1:3000");
      expect(origins).toContain("http://localhost:3001");
      expect(origins).toContain("http://127.0.0.1:3001");
    } finally {
      if (previousTrustedOrigins === undefined) {
        delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
      } else {
        process.env.BETTER_AUTH_TRUSTED_ORIGINS = previousTrustedOrigins;
      }

      if (previousPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = previousPort;
      }

      if (previousNextPublicPort === undefined) {
        delete process.env.NEXT_PUBLIC_PORT;
      } else {
        process.env.NEXT_PUBLIC_PORT = previousNextPublicPort;
      }
    }
  });
});
