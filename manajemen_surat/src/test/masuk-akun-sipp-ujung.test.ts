// @vitest-environment node
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * UJUNG KE UJUNG: POST /api/auth/sign-in/sipp lewat Better Auth SUNGGUHAN
 * ============================================================================
 *
 * masuk-akun-sipp.test.ts menguji keputusannya. Berkas ini membuktikan
 * kabelnya: plugin terpasang pada betterAuth() yang sungguhan (adaptor memori),
 * sesi lahir dengan kuki yang sama seperti /sign-in/email, penolakan berstatus
 * benar, dan password tidak ada di jawaban maupun di tulisan basis data ALETA.
 * Bot, Manajemen Akun, dan pencarian akun ditiru - semuanya dimuat plugin saat
 * dipanggil (import dinamis), dan vi.mock menggantinya di sana juga.
 */

const SANDI_SIPP = "Sipp-Palsu-Ujung-1";
const SANDI_ALETA = "Aleta-Palsu-Ujung-2";

const keadaan = vi.hoisted(() => ({
  tulisan: [] as Array<{ sql: string; nilai: unknown[] }>,
  sipp: { diblokir: false },
  penggunaId: "",
  milik: ["pp.budi"] as string[],
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    prepare: (sql: string) => ({
      run: async (...nilai: unknown[]) => {
        keadaan.tulisan.push({ sql, nilai });
      },
    }),
  }),
}));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: async (_op: string, p: { username: string; sandi: string }) => ({
    ok: true,
    data: { ditemukan: true, cocok: p.sandi === SANDI_SIPP, diblokir: keadaan.sipp.diblokir, kedaluwarsa: false, sippUserId: "77" },
  }),
}));
vi.mock("@/server/modules/aleta-ecourt/checklist-milestone", () => ({ bacaKredensialSipp: async () => [] }));
vi.mock("@/server/modules/aleta-ecourt/court-calendar-akun", () => ({ akunSippMilik: () => keadaan.milik }));
vi.mock("@/server/modules/users/service", () => ({
  lookupUserForLoginInDb: async () => ({ id: keadaan.penggunaId, roleId: "panitera-pengganti", name: "Budi" }),
}));

const { masukSippPlugin } = await import("@/server/modules/portal/masuk-sipp-plugin");

const ASAL = "http://127.0.0.1:3000";

async function siapkanAuth() {
  const auth = betterAuth({
    secret: "rahasia-uji-yang-cukup-panjang-untuk-better-auth-0123456789",
    baseURL: ASAL,
    basePath: "/api/auth",
    database: memoryAdapter({ user: [], account: [], session: [], verification: [] }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [masukSippPlugin()],
  });
  const ctx = await auth.$context;
  const pengguna = await ctx.internalAdapter.createUser({ email: "budi@uji.local", name: "Budi", emailVerified: true });
  await ctx.internalAdapter.linkAccount({
    userId: pengguna.id,
    providerId: "credential",
    accountId: pengguna.id,
    password: await ctx.password.hash(SANDI_ALETA),
  });
  keadaan.penggunaId = pengguna.id;
  return auth;
}

let nomor = 0;
function masuk(auth: Awaited<ReturnType<typeof siapkanAuth>>, password: string) {
  nomor += 1;
  return auth.handler(
    new Request(`${ASAL}/api/auth/sign-in/sipp`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ASAL, "x-forwarded-for": `10.88.0.${nomor}` },
      body: JSON.stringify({ identifier: "pp.budi", password, rememberMe: false }),
    })
  );
}

describe("POST /api/auth/sign-in/sipp (Better Auth sungguhan)", () => {
  beforeEach(async () => {
    keadaan.tulisan = [];
    keadaan.sipp.diblokir = false;
    keadaan.milik = ["pp.budi"];
    const { kosongkanBatasMasukSipp } = await import("@/server/modules/portal/masuk-sipp");
    kosongkanBatasMasukSipp();
  });

  it("password SIPP: 200, kuki sesi terpasang, jawaban tanpa password", async () => {
    const auth = await siapkanAuth();
    const r = await masuk(auth, SANDI_SIPP);
    expect(r.status).toBe(200);
    const isi = await r.json();
    expect(isi).toEqual({ ok: true, jenis: "masuk", lewat: "sipp", usernameSipp: "pp.budi", catatan: "" });
    const kuki = r.headers.get("set-cookie") ?? "";
    expect(kuki).toContain("better-auth.session_token=");
    // Sesinya sungguh hidup: get-session dengan kuki itu mengenali penggunanya.
    const sesi = await auth.handler(
      new Request(`${ASAL}/api/auth/get-session`, { headers: { cookie: kuki.split(";")[0] } })
    );
    expect((await sesi.json())?.user?.email).toBe("budi@uji.local");
    const semua = JSON.stringify([isi, keadaan.tulisan]);
    expect(semua).not.toContain(SANDI_SIPP);
    expect(keadaan.tulisan.some((t) => t.sql.includes("INSERT INTO aleta_masuk_jejak"))).toBe(true);
  });

  it("password ALETA tetap berlaku untuk akun bertautan (lewat aleta, usernameSipp kosong = tidak dititipkan)", async () => {
    const auth = await siapkanAuth();
    const r = await masuk(auth, SANDI_ALETA);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ jenis: "masuk", lewat: "aleta", usernameSipp: "" });
    expect(JSON.stringify(keadaan.tulisan)).not.toContain(SANDI_ALETA);
  });

  it("password salah: 401 tanpa kuki sesi", async () => {
    const auth = await siapkanAuth();
    const r = await masuk(auth, "salah-sama-sekali");
    expect(r.status).toBe(401);
    expect(r.headers.get("set-cookie") ?? "").not.toContain("session_token=");
    expect((await r.json()).message).toContain("tidak cocok");
  });

  it("akun SIPP diblokir: 403", async () => {
    keadaan.sipp.diblokir = true;
    const auth = await siapkanAuth();
    const r = await masuk(auth, SANDI_SIPP);
    expect(r.status).toBe(403);
    expect(r.headers.get("set-cookie") ?? "").not.toContain("session_token=");
  });

  it("akun tanpa tautan SIPP: 200 bukan-sipp TANPA sesi - layar menempuh jalur lama", async () => {
    keadaan.milik = [];
    const auth = await siapkanAuth();
    const r = await masuk(auth, SANDI_ALETA);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, jenis: "bukan-sipp", sebab: "tanpa-tautan" });
    expect(r.headers.get("set-cookie") ?? "").not.toContain("session_token=");
  });
});
