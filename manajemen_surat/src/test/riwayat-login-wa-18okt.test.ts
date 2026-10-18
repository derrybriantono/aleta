// @vitest-environment node
/**
 * Riwayat login e-Court lewat WhatsApp di riwayat e-Court portal (18 Okt 2026, butir 4):
 * HANYA Super Admin dan Admin. Peristiwa dibaca bot dari jejak keamanannya, disinkronkan
 * idempoten ke aleta_ecourt_aksi_jejak (aksi "login_wa"), migrasi 0074 memperluas CHECK.
 * Sisi bot: aleta_bot/scripts/verify-riwayat-login-wa.js.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ECOURT_AKSI_JEJAK } from "@/server/db/schema";
import {
  PENGGUNA_LOGIN_WA,
  bacaJejakLoginWa,
  bacaJejakPengguna,
  jejakDariPeristiwaLoginWa,
  sinkronLoginWa,
} from "@/server/modules/aleta-ecourt/ecourt-aksi";

const AKAR = process.cwd();
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");
const bacaBot = (jalur: string) => readFileSync(path.join(AKAR, "..", jalur), "utf8").replace(/\r\n/g, "\n");

describe("migrasi 0074 - berkas, DDL schema.ts, jurnal", () => {
  const TAG = "0074_aleta_ecourt_aksi_login_wa";
  const SQL = path.join(AKAR, "drizzle", `${TAG}.sql`);

  it("idx 69 bertag 0074 tepat sekali; jurnal tanpa lubang dan when naik", () => {
    const j = JSON.parse(baca("drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0074_"))).toEqual([expect.objectContaining({ idx: 69, tag: TAG })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("daftar nilai CHECK di berkas = di DDL schema.ts (basis data baru dan lama sama)", () => {
    const daftar = (teks: string) => (/aksi IN \(([^)]*)\)/.exec(teks) || [])[1];
    const dariBerkas = daftar(baca(`drizzle/${TAG}.sql`).split("ADD CONSTRAINT")[1]);
    const dariSkema = daftar(DDL_ECOURT_AKSI_JEJAK.tabel[0]);
    expect(dariBerkas).toBeTruthy();
    expect(dariBerkas).toBe(dariSkema);
    expect(dariSkema).toContain("'login_wa'");
    expect(baca(`drizzle/${TAG}.sql`)).toContain("DROP CONSTRAINT IF EXISTS aleta_ecourt_aksi_jejak_aksi_check");
  });
});

describe("peristiwa jejak keamanan bot -> baris jejak", () => {
  const p = (eventType: string, metadata: Record<string, unknown> = {}) => ({ id: "sec_1", eventType, createdAt: "2026-10-18T01:00:00.000Z", metadata });

  it("login berjalur whatsapp dan semua captcha WhatsApp dikenali", () => {
    expect(jejakDariPeristiwaLoginWa(p("ecourt_login_berhasil", { jalur: "whatsapp" }))).toMatchObject({ hasil: "berhasil" });
    expect(jejakDariPeristiwaLoginWa(p("ecourt_login_gagal", { jalur: "whatsapp" }))).toMatchObject({ hasil: "gagal", alasan: "login_ditolak_ecourt" });
    expect(jejakDariPeristiwaLoginWa(p("ecourt_wa_captcha_dikirim"))).toMatchObject({ hasil: "berhasil" });
    expect(jejakDariPeristiwaLoginWa(p("ecourt_wa_captcha_kedaluwarsa"))).toMatchObject({ hasil: "gagal" });
    expect(jejakDariPeristiwaLoginWa(p("ecourt_wa_captcha_dibatalkan"))).toMatchObject({ hasil: "ditolak" });
  });

  it("login lewat portal (sudah punya jejak per pengguna) dan peristiwa lain tidak disalin", () => {
    expect(jejakDariPeristiwaLoginWa(p("ecourt_login_berhasil", { jalur: "portal" }))).toBeNull();
    expect(jejakDariPeristiwaLoginWa(p("ecourt_wa_susulan_dimulai"))).toBeNull();
  });
});

// ============================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
const d = () => db as AletaDatabase;

const PERISTIWA = [
  { id: "sec_c", eventType: "ecourt_login_berhasil", severity: "warning", message: "Sesi e-Court dibuka lewat WhatsApp (jawaban captcha).", createdAt: "2026-10-18T01:05:00.000Z", metadata: { jalur: "whatsapp", berhasil: true } },
  { id: "sec_b", eventType: "ecourt_wa_captcha_dikirim", severity: "info", message: "Captcha login e-Court dikirim ke super admin lewat WhatsApp.", createdAt: "2026-10-18T01:00:00.000Z", metadata: { manual: false } },
  { id: "sec_a", eventType: "ecourt_wa_captcha_kedaluwarsa", severity: "warning", message: "Captcha kedaluwarsa.", createdAt: "2026-10-17T23:00:00.000Z", metadata: {} },
  { id: "sec_x", eventType: "ecourt_login_berhasil", severity: "warning", message: "Sesi e-Court dibuka lewat portal.", createdAt: "2026-10-18T00:30:00.000Z", metadata: { jalur: "portal" } },
];

let kiriman: string[] = [];
function tiruBot(peristiwa: unknown[] = PERISTIWA) {
  kiriman = [];
  vi.stubGlobal("fetch", async (url: string) => {
    kiriman.push(String(url));
    if (String(url).includes("/ecourt-wa/riwayat-login")) return new Response(JSON.stringify({ ok: true, peristiwa }), { status: 200, headers: { "content-type": "application/json" } });
    if (String(url).includes("/ecourt-pengguna/sesi")) return new Response(JSON.stringify({ ok: true, peranTersedia: [], sesi: [], akun: [] }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response("{}", { status: 404 });
  });
}

async function rute() {
  const r = (await import("@/app/api/aleta-ecourt/ecourt-sesi/route")) as { GET: (q: NextRequest) => Promise<Response> };
  const j = await r.GET(new NextRequest("http://localhost/api/aleta-ecourt/ecourt-sesi"));
  return { status: j.status, isi: (await j.json()) as any };
}

describe("sinkron idempoten ke aleta_ecourt_aksi_jejak", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    tiruBot();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });

  it("tiga peristiwa WhatsApp tersalin sekali; panggilan kedua tidak menggandakan", async () => {
    const a = await sinkronLoginWa(d(), { paksa: true });
    expect(a).toMatchObject({ ok: true, dibaca: 4, baru: 3 });
    const b = await sinkronLoginWa(d(), { paksa: true });
    expect(b).toMatchObject({ ok: true, baru: 0 });
    const baris = await d().queryAll<Record<string, unknown>>("SELECT * FROM aleta_ecourt_aksi_jejak WHERE aksi = 'login_wa' ORDER BY dibuat_pada");
    expect(baris).toHaveLength(3);
    expect(baris.map((x) => x.id)).toEqual(["eaj-wa-sec_a", "eaj-wa-sec_b", "eaj-wa-sec_c"]);
    expect(baris.every((x) => x.pengguna_id === PENGGUNA_LOGIN_WA && x.lewat === "ALETA")).toBe(true);
    // waktu baris = waktu peristiwa (bukan waktu sinkron)
    expect(String(baris[0].dibuat_pada)).toBe("2026-10-17T23:00:00.000Z");
  });

  it("bot lama (rute belum ada) tidak menggagalkan: ok:false, tanpa baris", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>Cannot GET</html>", { status: 404, headers: { "content-type": "text/html" } }));
    const h = await sinkronLoginWa(d(), { paksa: true });
    expect(h.ok).toBe(false);
    expect(await bacaJejakLoginWa(d())).toEqual([]);
  });

  it("riwayat per pengguna tidak pernah memuat baris WhatsApp", async () => {
    await sinkronLoginWa(d(), { paksa: true });
    expect(await bacaJejakPengguna(d(), "usr-super", 50)).toEqual([]);
    expect(await bacaJejakPengguna(d(), "usr-panitera", 50)).toEqual([]);
    expect((await bacaJejakLoginWa(d(), 10)).map((x) => x.sasaran).join("|")).toContain("Captcha");
  });

  it("peristiwa tanpa id atau waktu tidak sah dilewati", async () => {
    tiruBot([{ id: "", eventType: "ecourt_wa_captcha_dikirim", createdAt: "2026-10-18T01:00:00.000Z" }, { id: "s1", eventType: "ecourt_wa_captcha_dikirim", createdAt: "bukan-waktu" }]);
    expect(await sinkronLoginWa(d(), { paksa: true })).toMatchObject({ ok: true, baru: 0 });
  });
});

describe("rute ecourt-sesi: riwayat login WhatsApp HANYA untuk Super Admin dan Admin", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    tiruBot();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });

  it("Super Admin: jejakWa terisi (disinkronkan saat dibuka)", async () => {
    aktor = "usr-super";
    const h = await rute();
    expect(h.status).toBe(200);
    const wa = h.isi.data.jejakWa as Array<{ sasaran: string; hasil: string }>;
    expect(kiriman.some((u) => u.includes("riwayat-login"))).toBe(true);
    expect(wa).toHaveLength(3);
    expect(wa[0].sasaran).toContain("Login e-Court lewat WhatsApp");
    // dibuka lagi segera: jeda 30 detik, tidak menanyai bot lagi
    tiruBot();
    const lagi = await rute();
    expect(kiriman.some((u) => u.includes("riwayat-login"))).toBe(false);
    expect(lagi.isi.data.jejakWa).toHaveLength(3);
  });

  it("peran lain (panitera, hakim): kunci jejakWa tidak dikirim dan bot tidak ditanya riwayat WhatsApp", async () => {
    await sinkronLoginWa(d(), { paksa: true }); // baris WhatsApp ada di tabel
    for (const u of ["usr-panitera", "usr-hakim"]) {
      aktor = u;
      tiruBot();
      const h = await rute();
      expect(h.status).toBe(200);
      expect("jejakWa" in h.isi.data).toBe(false);
      expect(JSON.stringify(h.isi.data.jejak)).not.toContain("WhatsApp");
      expect(kiriman.some((x) => x.includes("riwayat-login"))).toBe(false);
    }
  });
});

describe("kabel bot, tampilan, dan peta aksi", () => {
  it("bot: rute GET /ecourt-wa/riwayat-login membaca saja lewat layanan; sumber event dikunci", () => {
    const rutebot = bacaBot("aleta_bot/routes/ecourtAksiRoutes.js");
    expect(rutebot).toContain('router.get("/ecourt-wa/riwayat-login", wajibToken');
    const layanan = bacaBot("aleta_bot/services/ecourtRiwayatLoginWaService.js");
    expect(layanan).toContain("ecourt\\\\_login\\\\_%");
    expect(layanan).toContain("ecourt\\\\_wa\\\\_captcha\\\\_%");
    expect(layanan).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  });

  it("tampilan ecourt-sesi menyebut aksi login_wa dan memuat riwayat hanya bila server mengirimnya", () => {
    const tsx = baca("src/components/portal/ecourt-sesi-pribadi.tsx");
    expect(tsx).toContain('login_wa: "Login e-Court lewat WhatsApp"');
    expect(tsx).toContain("data?.jejakWa ?");
  });

  it("rute portal memeriksa peran lewat isPrivilegedAdmin sebelum menyinkronkan", () => {
    const rute = baca("src/app/api/aleta-ecourt/ecourt-sesi/route.ts");
    const awal = rute.indexOf("isPrivilegedAdmin(actor)");
    expect(awal).toBeGreaterThan(0);
    expect(rute.indexOf("sinkronLoginWa(db)")).toBeGreaterThan(awal);
  });
});
