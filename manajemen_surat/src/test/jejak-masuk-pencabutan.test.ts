// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * PENCABUTAN SESI, HAK RUTE, MAC, DAN LAPORAN RIWAYAT MASUK (23 Okt 2026)
 * ============================================================================
 *
 * Better Auth sungguhan + pg-mem (semaian akun rekaan). Sesi dibuat lewat
 * rute masuk yang asli; aktor rute admin lewat x-aleta-user-id (NODE_ENV=test).
 */

const k = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db/client", async (asli) => {
  const m = await asli<typeof import("@/server/db/client")>();
  return { ...m, getDatabase: async () => k.db };
});
vi.mock("@/server/modules/aleta-bot/service", async (asli) => ({
  ...(await asli<Record<string, unknown>>()),
  syncAletaBotRuntimeConfigFromDb: async () => undefined,
}));

type Db = import("@/server/db/client").AletaDatabase;
let db: Db;
let masukRute: (r: NextRequest) => Promise<Response>;

const ASAL = "http://localhost:3000";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const A = "aaaaaaaa-1111-4111-8111-111111111111";
const B = "bbbbbbbb-2222-4222-8222-222222222222";

beforeAll(async () => {
  const { createAletaDatabase } = await import("@/server/db/client");
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  k.db = db;
  ({ POST: masukRute } = await import("@/app/api/auth/[...all]/route"));
  const { __pasangPembacaArpUntukUji } = await import("@/server/modules/perangkat/mac");
  __pasangPembacaArpUntukUji(async () => ({ ok: true, mac: "", sebab: "uji" }));
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  for (const t of ["aleta_jejak_masuk", "aleta_perangkat", "aleta_sesi_perangkat", "aleta_batas_perangkat", "aleta_tiket_perangkat", "aleta_setelan_jejak_masuk", "sesi_portal", "sessions"]) {
    await db.run(`DELETE FROM ${t}`, []);
  }
});

let n = 0;
async function masuk(email: string, password: string, perangkat: string, ip = "192.168.10.30") {
  n += 1;
  const r = await masukRute(
    new NextRequest(`${ASAL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ASAL, "user-agent": UA, "x-forwarded-for": ip, cookie: `aleta_perangkat=${perangkat}` },
      body: JSON.stringify({ email, password, rememberMe: true }),
    })
  );
  expect(r.status, `masuk ${email} ${n}`).toBe(200);
  const m = (r.headers.get("set-cookie") ?? "").match(/better-auth\.session_token=([^;]+)/);
  return `better-auth.session_token=${m![1]}; aleta_perangkat=${perangkat}`;
}

function minta(url: string, o: { method?: string; aktor?: string; kuki?: string; badan?: unknown; ip?: string } = {}) {
  return new NextRequest(`${ASAL}${url}`, {
    method: o.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "user-agent": UA,
      "x-forwarded-for": o.ip ?? "192.168.10.31",
      ...(o.aktor ? { "x-aleta-user-id": o.aktor } : {}),
      ...(o.kuki ? { cookie: o.kuki } : {}),
    },
    ...(o.badan !== undefined ? { body: JSON.stringify(o.badan) } : {}),
  });
}

const jumlahSesi = async (userId: string) =>
  Number((await db.queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = ?", [userId]))?.n ?? 0);
const dicabut = async () => db.queryAll<Record<string, string>>("SELECT * FROM aleta_jejak_masuk WHERE peristiwa = 'SESI_DICABUT' ORDER BY waktu", []);

// ─── pencabutan saat perubahan akun ─────────────────────────────────────────

describe("celah lama ditutup: perubahan akun mencabut sesi", () => {
  it("akun diblokir admin: semua sesinya dicabut dan dicatat dengan pelaku", async () => {
    await masuk("hakim@pa.go.id", "hakim123", A);
    await masuk("hakim@pa.go.id", "hakim123", B);
    expect(await jumlahSesi("usr-hakim")).toBe(2);
    const { updateManagedUserInDb } = await import("@/server/modules/users/service");
    await updateManagedUserInDb(db, { actorUserId: "usr-admin", userId: "usr-hakim", payload: { isActive: false } });
    expect(await jumlahSesi("usr-hakim")).toBe(0);
    const c = await dicabut();
    expect(c.map((b) => [b.alasan, b.pelaku_id])).toEqual([
      ["akun diblokir", "usr-admin"],
      ["akun diblokir", "usr-admin"],
    ]);
    await updateManagedUserInDb(db, { actorUserId: "usr-admin", userId: "usr-hakim", payload: { isActive: true } });
  });

  it("reset password manual oleh admin mencabut sesi; penggantian oleh pemilik sendiri mempertahankan sesi pemanggil", async () => {
    await masuk("panitera@pa.go.id", "panitera123", A);
    const { adminManualResetPasswordInDb, updateManagedUserInDb } = await import("@/server/modules/users/service");
    await adminManualResetPasswordInDb(db, { actorUserId: "usr-admin", targetUserId: "usr-panitera" });
    expect(await jumlahSesi("usr-panitera")).toBe(0);
    expect((await dicabut()).map((b) => b.alasan)).toEqual(["password direset"]);

    await db.run("DELETE FROM aleta_jejak_masuk", []);
    // Pasang kembali password lama lewat jalan admin supaya dapat masuk lagi.
    await updateManagedUserInDb(db, { actorUserId: "usr-super", userId: "usr-panitera", payload: { password: "panitera123" } });
    await masuk("panitera@pa.go.id", "panitera123", A);
    await masuk("panitera@pa.go.id", "panitera123", B);
    const sesiA = await db.queryOne<{ session_id: string }>("SELECT session_id FROM aleta_sesi_perangkat WHERE perangkat_id = ?", [A]);
    await updateManagedUserInDb(db, {
      actorUserId: "usr-panitera",
      userId: "usr-panitera",
      payload: { password: "panitera456" },
      sesiPemanggilId: sesiA!.session_id,
    });
    const sisa = await db.queryAll<{ id: string }>("SELECT id FROM sessions WHERE user_id = 'usr-panitera'", []);
    expect(sisa.map((s) => s.id)).toEqual([sesiA!.session_id]);
    await updateManagedUserInDb(db, { actorUserId: "usr-super", userId: "usr-panitera", payload: { password: "panitera123" } });
  });

  it("peran diganti: sesi dicabut", async () => {
    await masuk("ahmad@pa.go.id", "ahmad123", A);
    const { updateManagedUserInDb } = await import("@/server/modules/users/service");
    await updateManagedUserInDb(db, { actorUserId: "usr-super", userId: "usr-ahmad", payload: { roleOverride: "admin" } });
    expect(await jumlahSesi("usr-ahmad")).toBe(0);
    expect((await dicabut()).map((b) => b.alasan)).toEqual(["peran diganti"]);
  });
});

// ─── perangkat sendiri ──────────────────────────────────────────────────────

describe("halaman Akun: perangkat sendiri", () => {
  it("melihat perangkat sendiri (ini ditandai); 'keluarkan semua kecuali ini' mempertahankan sesi pemanggil", async () => {
    const kukiA = await masuk("hakim@pa.go.id", "hakim123", A);
    await masuk("hakim@pa.go.id", "hakim123", B);
    const { GET } = await import("@/app/api/portal/perangkat/route");
    const lihat = await (await GET(minta("/api/portal/perangkat", { kuki: kukiA }))).json();
    expect(lihat.ok).toBe(true);
    expect(lihat.data.sesiAktif.map((s: { perangkatId: string; ini: boolean }) => [s.perangkatId, s.ini]).sort()).toEqual([
      [A, true],
      [B, false],
    ]);
    expect(lihat.data.riwayat.every((b: { user_id: string }) => b.user_id === "usr-hakim")).toBe(true);
    expect(JSON.stringify(lihat)).not.toMatch(/session_token|"token"/);

    const { POST } = await import("@/app/api/portal/perangkat/cabut/route");
    const r = await POST(minta("/api/portal/perangkat/cabut", { method: "POST", kuki: kukiA, badan: { semuaKecualiIni: true } }));
    expect((await r.json()).data.dicabut).toBe(1);
    const sisa = await db.queryAll<{ perangkat_id: string }>("SELECT perangkat_id FROM aleta_sesi_perangkat", []);
    expect(sisa.map((s) => s.perangkat_id)).toEqual([A]);
    expect((await dicabut()).map((b) => [b.perangkat_id, b.alasan])).toEqual([[B, "dikeluarkan pemilik akun"]]);
  });

  it("pengguna biasa tidak dapat mencabut perangkat akun lain lewat rute miliknya", async () => {
    await masuk("ketua@pa.go.id", "ketua123", B);
    const { POST } = await import("@/app/api/portal/perangkat/cabut/route");
    const r = await POST(minta("/api/portal/perangkat/cabut", { method: "POST", aktor: "usr-hakim", badan: { perangkatId: B } }));
    expect((await r.json()).data.dicabut).toBe(0);
    expect(await jumlahSesi("usr-ketua")).toBe(1);
  });

  it("data ekstensi: MAC dinormalkan, sumber 'ekstensi'; akun Windows dicatat (bawaan menyala) dan dibuang bila saklar dimatikan", async () => {
    const kuki = await masuk("hakim@pa.go.id", "hakim123", A);
    const { POST } = await import("@/app/api/portal/perangkat/route");
    const kirim = (badan: unknown) => POST(minta("/api/portal/perangkat", { method: "POST", kuki, badan }));
    const r = await kirim({ namaKomputer: "PC-HAKIM-02", mac: ["aa-bb-cc-00-11-22"], osRinci: "Windows 11 Pro 23H2 (22631)", akunWindows: "nur.aisyah" });
    expect((await r.json()).data).toMatchObject({ diterima: true, mac: "AA:BB:CC:00:11:22", akunWindowsDicatat: true });
    const p = await db.queryOne<Record<string, string>>("SELECT * FROM aleta_perangkat WHERE perangkat_id = ?", [A]);
    expect(p).toMatchObject({ nama_komputer: "PC-HAKIM-02", mac: "AA:BB:CC:00:11:22", mac_sumber: "ekstensi", os_rinci: "Windows 11 Pro 23H2 (22631)", akun_windows: "nur.aisyah" });
    const masukBaris = await db.queryOne<Record<string, string>>("SELECT * FROM aleta_jejak_masuk WHERE peristiwa = 'MASUK'", []);
    expect(masukBaris).toMatchObject({ nama_komputer: "PC-HAKIM-02", mac: "AA:BB:CC:00:11:22", mac_sumber: "ekstensi" });

    const { simpanSetelanJejak } = await import("@/server/modules/perangkat/jejak");
    await simpanSetelanJejak(db, { catatAkunWindows: false }, "usr-super");
    await kirim({ akunWindows: "nur.aisyah", petunjuk: { platform: "Windows", platformVersion: "15.0.0" } });
    expect((await db.queryOne<Record<string, string>>("SELECT akun_windows FROM aleta_perangkat WHERE perangkat_id = ?", [A]))?.akun_windows).toBe("");
    // Tanpa sesi = 401.
    expect((await POST(minta("/api/portal/perangkat", { method: "POST", badan: {} }))).status).toBe(401);
  });
});

// ─── hak rute ───────────────────────────────────────────────────────────────

describe("hak rute riwayat masuk & batas perangkat", () => {
  it("pengguna biasa TIDAK dapat melihat riwayat orang lain; Admin dan Super Admin dapat", async () => {
    await masuk("ketua@pa.go.id", "ketua123", A);
    const { GET } = await import("@/app/api/admin/jejak-masuk/route");
    for (const aktor of ["usr-hakim", "usr-panitera", "usr-ketua"]) {
      expect((await GET(minta("/api/admin/jejak-masuk?userId=usr-ketua", { aktor }))).status, aktor).toBe(403);
      expect((await GET(minta("/api/admin/jejak-masuk?tab=sesi", { aktor }))).status, aktor).toBe(403);
    }
    expect((await GET(minta("/api/admin/jejak-masuk", {}))).status).toBe(401);
    for (const aktor of ["usr-admin", "usr-super"]) {
      const r = await GET(minta("/api/admin/jejak-masuk?userId=usr-ketua", { aktor }));
      expect(r.status).toBe(200);
      expect((await r.json()).data.baris.map((b: { peristiwa: string }) => b.peristiwa)).toContain("MASUK");
    }
  });

  it("batas per peran: Super Admin saja; pengecualian akun: Admin juga; admin mencabut sesi akun lain", async () => {
    const { POST } = await import("@/app/api/admin/batas-perangkat/route");
    const simpan = (aktor: string, badan: unknown) => POST(minta("/api/admin/batas-perangkat", { method: "POST", aktor, badan }));
    expect((await simpan("usr-admin", { cakupan: "peran", sasaran: "hakim", maks: 2, perilaku: "tolak" })).status).toBe(403);
    expect((await simpan("usr-hakim", { cakupan: "akun", sasaran: "usr-hakim", maks: 9, perilaku: "tolak" })).status).toBe(403);
    expect((await simpan("usr-super", { cakupan: "peran", sasaran: "hakim", maks: 2, perilaku: "tolak" })).status).toBe(200);
    expect((await simpan("usr-admin", { cakupan: "akun", sasaran: "usr-hakim", maks: 3, perilaku: "keluarkan-terlama", alasan: "dua komputer" })).status).toBe(200);
    const tolakSa = await simpan("usr-super", { cakupan: "peran", sasaran: "super-admin", maks: 1, perilaku: "tolak" });
    expect(tolakSa.status).toBe(400);
    const { POST: setelan } = await import("@/app/api/admin/jejak-masuk/setelan/route");
    expect((await setelan(minta("/api/admin/jejak-masuk/setelan", { method: "POST", aktor: "usr-admin", badan: { retensiHari: 90 } }))).status).toBe(403);
    expect((await setelan(minta("/api/admin/jejak-masuk/setelan", { method: "POST", aktor: "usr-super", badan: { retensiHari: 90 } }))).status).toBe(200);

    await masuk("ketua@pa.go.id", "ketua123", A);
    const { POST: cabut } = await import("@/app/api/admin/jejak-masuk/cabut/route");
    expect((await cabut(minta("/api/admin/jejak-masuk/cabut", { method: "POST", aktor: "usr-hakim", badan: { userId: "usr-ketua", semua: true } }))).status).toBe(403);
    const r = await cabut(minta("/api/admin/jejak-masuk/cabut", { method: "POST", aktor: "usr-admin", badan: { userId: "usr-ketua", semua: true } }));
    expect((await r.json()).data.dicabut).toBe(1);
    expect((await dicabut()).map((b) => [b.alasan, b.pelaku_id])).toEqual([["dikeluarkan admin", "usr-admin"]]);
  });
});

// ─── MAC / ARP ──────────────────────────────────────────────────────────────

describe("ARP server (bot): hanya klien se-subnet, MAC router ditolak", () => {
  const minta2 = createRequire(import.meta.url);
  const arp = minta2(path.resolve(__dirname, "../../../aleta_bot/services/arpPerangkatService.js")) as {
    putuskanArp: (m: unknown) => { mac: string; sebab: string };
  };
  const ARP = [
    "IP address       HW type     Flags       HW address            Mask     Device",
    "192.168.10.20    0x1         0x2         aa:bb:cc:dd:ee:01     *        eno1",
    "192.168.10.1     0x1         0x2         aa:bb:cc:dd:ee:99     *        eno1",
    "192.168.10.21    0x1         0x2         aa:bb:cc:dd:ee:99     *        eno1",
    "192.168.10.22    0x1         0x0         00:00:00:00:00:00     *        eno1",
  ].join("\n");
  const ROUTE = ["Iface Destination Gateway Flags", "eno1 00000000 010AA8C0 0003 0 0 0 00000000", "eno1 000AA8C0 00000000 0001"].join("\n");
  const ANTARMUKA = [{ nama: "eno1", alamat: "192.168.10.10", netmask: "255.255.255.0" }];
  const tanya = (ip: string) => arp.putuskanArp({ ip, arpTeks: ARP, routeTeks: ROUTE, antarmuka: ANTARMUKA });

  it("klien se-subnet terbaca", () => expect(tanya("192.168.10.20")).toMatchObject({ mac: "AA:BB:CC:DD:EE:01", sebab: "" }));
  it("IP di luar subnet server (192.168.9.x lewat router) ditolak", () => expect(tanya("192.168.9.121")).toMatchObject({ mac: "", sebab: expect.stringMatching(/luar subnet/) }));
  it("MAC sama dengan router ditolak; alamat router sendiri ditolak", () => {
    expect(tanya("192.168.10.21")).toMatchObject({ mac: "", sebab: expect.stringMatching(/router/) });
    expect(tanya("192.168.10.1")).toMatchObject({ mac: "", sebab: expect.stringMatching(/router/) });
  });
  it("entri belum lengkap dan IP tak ada di tabel: tidak terbaca, tidak ditebak", () => {
    expect(tanya("192.168.10.22").mac).toBe("");
    expect(tanya("192.168.10.77")).toMatchObject({ mac: "", sebab: expect.stringMatching(/tidak ada/) });
  });

  it("portal: hasil ARP ditempel dengan sumber arp-server; tidak menimpa data ekstensi; IP luar kantor = catatan", async () => {
    await masuk("hakim@pa.go.id", "hakim123", A, "192.168.10.20");
    const { tempelArp, __pasangPembacaArpUntukUji } = await import("@/server/modules/perangkat/mac");
    __pasangPembacaArpUntukUji(async () => ({ ok: true, mac: "aa:bb:cc:dd:ee:01", sebab: "" }));
    expect(await tempelArp(db, { perangkatId: A, userId: "usr-hakim", ip: "192.168.10.20" })).toMatchObject({ dibaca: true });
    expect(await db.queryOne("SELECT mac, mac_sumber FROM aleta_perangkat WHERE perangkat_id = ?", [A])).toEqual({ mac: "AA:BB:CC:DD:EE:01", mac_sumber: "arp-server" });
    await db.run("UPDATE aleta_perangkat SET mac_sumber = 'ekstensi', mac = 'AA:BB:CC:00:11:22'", []);
    expect(await tempelArp(db, { perangkatId: A, userId: "usr-hakim", ip: "192.168.10.20" })).toMatchObject({ dibaca: false });
    await db.run("UPDATE aleta_perangkat SET mac_sumber = '', mac = ''", []);
    await tempelArp(db, { perangkatId: A, userId: "usr-hakim", ip: "8.8.8.8" });
    expect((await db.queryOne<{ mac_catatan: string }>("SELECT mac_catatan FROM aleta_perangkat WHERE perangkat_id = ?", [A]))?.mac_catatan).toMatch(/luar jaringan kantor/);
    __pasangPembacaArpUntukUji(async () => ({ ok: true, mac: "", sebab: "uji" }));
  });
});

// ─── laporan ────────────────────────────────────────────────────────────────

describe("laporan riwayat masuk", () => {
  it("saringan subnet, hanya gagal, halaman; CSV menetralkan formula", async () => {
    const { catatPeristiwa } = await import("@/server/modules/perangkat/jejak");
    const { cariJejak, jejakKeCsv } = await import("@/server/modules/perangkat/laporan");
    const h = (ip: string) => new Headers({ "x-forwarded-for": ip, "user-agent": UA });
    await catatPeristiwa(db, { peristiwa: "MASUK", jalur: "email", userId: "usr-hakim", headers: h("192.168.9.5") });
    await catatPeristiwa(db, { peristiwa: "MASUK_GAGAL", alasan: "sandi salah", jalur: "email", userId: "usr-hakim", headers: h("192.168.10.6") });
    await catatPeristiwa(db, { peristiwa: "MASUK_GAGAL", alasan: "=HYPERLINK(1)", jalur: "sipp", identitas: "=cmd", headers: h("192.168.9.7") });
    expect((await cariJejak(db, { ip: "192.168.9" })).total).toBe(2);
    expect((await cariJejak(db, { hanyaGagal: true })).total).toBe(2);
    expect((await cariJejak(db, { jalur: "sipp" })).baris[0].identitas_samar).toBe("=c***");
    const hal = await cariJejak(db, { perHalaman: 2, halaman: 2 });
    expect([hal.total, hal.baris.length]).toEqual([3, 1]);
    const csv = jejakKeCsv((await cariJejak(db, {})).baris);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("'=c***");
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });

  it("peringatan: banyak gagal dari satu IP, luar kantor, dua jaringan berdekatan, luar jam kerja, perangkat baru pimpinan", async () => {
    const { susunPeringatan } = await import("@/server/modules/perangkat/laporan");
    const { SETELAN_BAWAAN } = await import("@/server/modules/perangkat/jejak");
    const dasar = { id: "", alasan: "", jalur: "email", username: "u", identitas_samar: "", sesi_ref: "", perangkat_id: "", rantai_xff: "", agen: "", jenis_perangkat: "", os: "", peramban: "", model: "", ingat: "", nama_komputer: "", mac: "", mac_sumber: "", pelaku_id: "", pelaku_nama: "", rincian: "{}" };
    const b = (waktu: string, peristiwa: string, ip: string, user_id = "usr-x", peran = "hakim", nama = "Rekaan") => ({ ...dasar, waktu, peristiwa, ip, user_id, peran, nama });
    const baris = [
      ...[0, 1, 2, 3, 4].map((i) => b(`2026-10-22T02:0${i}:00.000Z`, "MASUK_GAGAL", "192.168.9.66", "")),
      b("2026-10-22T03:00:00.000Z", "MASUK", "36.80.1.2"),
      b("2026-10-22T03:05:00.000Z", "MASUK", "192.168.10.40"),
      b("2026-10-22T14:00:00.000Z", "MASUK", "192.168.10.40", "usr-y"),
      b("2026-10-22T03:00:00.000Z", "PERANGKAT_BARU", "192.168.10.41", "usr-k", "ketua"),
    ];
    const jenis = susunPeringatan(baris, SETELAN_BAWAAN).map((p) => p.jenis);
    expect(jenis).toEqual(expect.arrayContaining(["gagal-ip", "luar-kantor", "dua-tempat", "luar-jam", "perangkat-baru"]));
    // 22.00 WITA = luar jam; 11.00 WITA (03.00Z) = jam kerja.
    expect(susunPeringatan(baris, SETELAN_BAWAAN).filter((p) => p.jenis === "luar-jam").map((p) => p.userId)).toEqual(["usr-y"]);
  });
});
