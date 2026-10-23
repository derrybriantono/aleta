// @vitest-environment node
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * PEMBATAS LAJU MASUK MEMAKAI IP UJUNG X-FORWARDED-FOR (23 Okt 2026)
 * ============================================================================
 *
 * Keputusan Derry: entri pertama X-Forwarded-For dikarang peramban, jadi
 * pembatas yang membacanya dapat dielakkan dengan mengganti entri itu tiap
 * percobaan. Kini pembatas ALETA (rate-limit.ts, dipakai /sign-in/email dan
 * /sign-in/sipp) dan pembatas bawaan Better Auth (lewat header
 * x-aleta-ip-klien yang selalu ditulis route.ts) membaca entri UJUNG.
 */

const k = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db/client", async (asli) => {
  const m = await asli<typeof import("@/server/db/client")>();
  return { ...m, getDatabase: async () => k.db };
});

type Db = import("@/server/db/client").AletaDatabase;
let db: Db;
let POST: (r: NextRequest) => Promise<Response>;
const ASAL = "http://localhost:3000";

beforeAll(async () => {
  const { createAletaDatabase } = await import("@/server/db/client");
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  k.db = db;
  ({ POST } = await import("@/app/api/auth/[...all]/route"));
  const { __pasangPembacaArpUntukUji } = await import("@/server/modules/perangkat/mac");
  __pasangPembacaArpUntukUji(async () => ({ ok: true, mac: "", sebab: "uji" }));
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const masuk = (password: string, xff: string) =>
  POST(
    new NextRequest(`${ASAL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ASAL, "x-forwarded-for": xff, "x-aleta-ip-klien": "10.9.9.9" },
      body: JSON.stringify({ email: "panitera@pa.go.id", password }),
    })
  );

describe("pembatas ALETA (rate-limit.ts) di jalur masuk", () => {
  it("XFF palsu di depan yang berganti tiap percobaan TIDAK mengelakkan batas; IP ujung yang lain terhitung terpisah", async () => {
    for (let i = 1; i <= 5; i++) {
      const r = await masuk("Salah-Rekaan-0", `203.0.113.${i}, 192.168.9.201`);
      expect(r.status, `percobaan ${i}`).toBe(401);
    }
    // Percobaan keenam - password BENAR, entri depan karangan baru - tetap ditahan.
    const ditahan = await masuk("panitera123", "198.51.100.77, 192.168.9.201");
    expect(ditahan.status).toBe(429);
    const gagal = await db.queryAll<{ alasan: string; ip: string }>(
      "SELECT alasan, ip FROM aleta_jejak_masuk WHERE peristiwa = 'MASUK_GAGAL' ORDER BY waktu",
      []
    );
    expect(gagal.map((g) => g.ip)).toEqual(Array(6).fill("192.168.9.201"));
    expect(gagal[5].alasan).toBe("batas percobaan");
    // Komputer lain (IP ujung berbeda) tidak ikut tertahan.
    expect((await masuk("panitera123", "203.0.113.1, 192.168.9.202")).status).toBe(200);
  });

  it("modul pembatas: kunci = IP ujung; tanpa XFF jatuh ke X-Real-IP", async () => {
    const { assertRateLimit, recordRateLimitFailure, clearRateLimit } = await import("@/server/shared/rate-limit");
    const minta = (h: Record<string, string>) => ({ headers: new Headers(h) }) as unknown as NextRequest;
    for (let i = 0; i < 20; i++) recordRateLimitFailure("recovery-request", minta({ "x-forwarded-for": `1.1.1.${i}, 192.168.10.77` }), "x");
    expect(() => assertRateLimit("recovery-request", minta({ "x-forwarded-for": "9.9.9.9, 192.168.10.77" }), "x")).toThrow();
    expect(() => assertRateLimit("recovery-request", minta({ "x-real-ip": "192.168.10.77" }), "x")).toThrow();
    expect(() => assertRateLimit("recovery-request", minta({ "x-forwarded-for": "192.168.10.77, 192.168.10.78" }), "x")).not.toThrow();
    clearRateLimit("recovery-request", minta({ "x-real-ip": "192.168.10.77" }), "x");
  });
});

describe("pembatas bawaan Better Auth membaca x-aleta-ip-klien dari route.ts", () => {
  it("denganIpKlien menimpa header karangan peramban dengan IP ujung", async () => {
    const { denganIpKlien, HEADER_IP_KLIEN } = await import("@/server/modules/perangkat/jaringan");
    const r = denganIpKlien(new Request(`${ASAL}/x`, { headers: { "x-forwarded-for": "1.2.3.4, 192.168.9.5", [HEADER_IP_KLIEN]: "8.8.8.8" } }));
    expect(r.headers.get(HEADER_IP_KLIEN)).toBe("192.168.9.5");
    const tanpa = denganIpKlien(new Request(`${ASAL}/x`, { headers: { [HEADER_IP_KLIEN]: "8.8.8.8" } }));
    expect(tanpa.headers.get(HEADER_IP_KLIEN)).toBeNull();
  });

  it("pembatas Better Auth yang DINYALAKAN: XFF palsu berganti tetap tertahan; IP ujung lain tidak", async () => {
    const { denganIpKlien, HEADER_IP_KLIEN } = await import("@/server/modules/perangkat/jaringan");
    const auth = betterAuth({
      secret: "rahasia-uji-yang-cukup-panjang-untuk-better-auth-0123456789",
      baseURL: ASAL,
      basePath: "/api/auth",
      database: memoryAdapter({ user: [], account: [], session: [], verification: [] }),
      emailAndPassword: { enabled: true },
      rateLimit: { enabled: true, window: 60, max: 100, customRules: { "/sign-in/email": { window: 60, max: 3 } } },
      advanced: { ipAddress: { ipAddressHeaders: [HEADER_IP_KLIEN] } },
    });
    const coba = (xff: string) =>
      auth.handler(
        denganIpKlien(
          new Request(`${ASAL}/api/auth/sign-in/email`, {
            method: "POST",
            headers: { "content-type": "application/json", origin: ASAL, "x-forwarded-for": xff },
            body: JSON.stringify({ email: "tidak.ada@uji.local", password: "Salah-Rekaan-1" }),
          })
        )
      );
    const status: number[] = [];
    for (let i = 1; i <= 4; i++) status.push((await coba(`203.0.113.${i}, 192.168.9.31`)).status);
    expect(status.slice(0, 3).every((s) => s !== 429)).toBe(true);
    expect(status[3]).toBe(429);
    expect((await coba("203.0.113.1, 192.168.9.32")).status).not.toBe(429);
  });
});
