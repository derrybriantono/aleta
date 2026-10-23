// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * JEJAK MASUK & BATAS PERANGKAT - BETTER AUTH SUNGGUHAN DI ATAS PG-MEM
 * ============================================================================
 *
 * Masuk lewat rute /api/auth/[...all] yang sama dengan produksi (getAuth() +
 * drizzleAdapter + databaseHooks), basis data pg-mem dengan semaian akun
 * rekaan. Bot SIPP dan tautan akun ditiru; selebihnya kode asli.
 *
 *   1. migrasi 0085 = DDL_JEJAK_PERANGKAT, terdaftar di cadangan;
 *   2. parser UA dan IP ujung X-Forwarded-For;
 *   3. ketiga jalur (email, sipp, sipp-sesi) tercatat lengkap, gagal & keluar;
 *   4. batas: tolak, keluarkan-terlama, perangkat sama, akun > peran,
 *      beberapa peran = terbesar, Super Admin tidak terkunci;
 *   5. tiket pilih perangkat: daftar, cabut, sekali pakai, kedaluwarsa,
 *      perangkat lain;
 *   6. redaksi: token/id sesi mentah tidak pernah ada di jejak.
 */

const SANDI_SIPP = "Sipp-Rekaan-Uji-9";
const NIP_HAKIM = "197912142006042001";

const k = vi.hoisted(() => ({ db: null as unknown, milik: {} as Record<string, string[]> }));

vi.mock("@/server/db/client", async (asli) => {
  const m = await asli<typeof import("@/server/db/client")>();
  return { ...m, getDatabase: async () => k.db };
});
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: async (op: string, p: { sandi?: string }) => {
    if (op === "user.verifikasiSandi") {
      return { ok: true, data: { ditemukan: true, cocok: p.sandi === SANDI_SIPP, diblokir: false, kedaluwarsa: false, sippUserId: "77" } };
    }
    const identitas = {
      terbukti: true,
      ditemukan: true,
      sippUserId: "77",
      username: "pp.hakim",
      namaLengkap: "Hj. Nur Aisyah",
      pejabat: [{ jabatan: "Hakim", nama: "Hj. Nur Aisyah", nip: NIP_HAKIM }],
    };
    return { ok: true, data: identitas };
  },
}));
vi.mock("@/server/modules/aleta-ecourt/checklist-milestone", async (asli) => ({
  ...(await asli<Record<string, unknown>>()),
  bacaKredensialSipp: async () => [],
}));
vi.mock("@/server/modules/aleta-ecourt/court-calendar-akun", () => ({
  akunSippMilik: (_k: unknown, userId: string) => k.milik[userId] ?? [],
}));
vi.mock("@/server/modules/external-apps/service", async (asli) => ({
  ...(await asli<Record<string, unknown>>()),
  tulisTautanSippOtomatis: async () => true,
}));

type Db = import("@/server/db/client").AletaDatabase;
let db: Db;
let POST: (r: NextRequest) => Promise<Response>;

const ASAL = "http://localhost:3000";
const UA_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const PERANGKAT = {
  A: "11111111-1111-4111-8111-111111111111",
  B: "22222222-2222-4222-8222-222222222222",
  C: "33333333-3333-4333-8333-333333333333",
  D: "44444444-4444-4444-8444-444444444444",
};

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

let nomorIp = 10;
beforeEach(async () => {
  for (const t of ["aleta_jejak_masuk", "aleta_perangkat", "aleta_sesi_perangkat", "aleta_batas_perangkat", "aleta_tiket_perangkat", "sesi_portal", "sessions"]) {
    await db.run(`DELETE FROM ${t}`, []);
  }
  await db.run("UPDATE users SET additional_role_ids_json = '[]'", []);
  k.milik = {};
  const { kosongkanBatasMasukSipp } = await import("@/server/modules/portal/masuk-sipp");
  kosongkanBatasMasukSipp();
});

type Opsi = { perangkat?: string; ip?: string; xff?: string; ua?: string; kuki?: string; ingat?: boolean };

function permintaan(jalur: string, badan: unknown, o: Opsi = {}) {
  nomorIp += 1;
  const kuki = [o.perangkat ? `aleta_perangkat=${o.perangkat}` : "", o.kuki ?? ""].filter(Boolean).join("; ");
  return new NextRequest(`${ASAL}/api/auth${jalur}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ASAL,
      "user-agent": o.ua ?? UA_WIN,
      "x-forwarded-for": o.xff ?? `203.0.113.66, ${o.ip ?? `192.168.10.${nomorIp % 200}`}`,
      ...(kuki ? { cookie: kuki } : {}),
    },
    body: JSON.stringify(badan),
  });
}

const masukEmail = (email: string, password: string, o: Opsi = {}) =>
  POST(permintaan("/sign-in/email", { email, password, rememberMe: o.ingat ?? true }, o));
const masukSipp = (identifier: string, password: string, o: Opsi = {}) =>
  POST(permintaan("/sign-in/sipp", { identifier, password, rememberMe: o.ingat ?? false }, o));
const masukSesiSipp = (o: Opsi = {}) => POST(permintaan("/sign-in/sipp-sesi", { rememberMe: true }, { ...o, kuki: "ci_session=sesi-sipp-rekaan" }));

function kukiSesi(r: Response) {
  const sc = r.headers.get("set-cookie") ?? "";
  const m = sc.match(/better-auth\.session_token=([^;]+)/);
  return m ? `better-auth.session_token=${m[1]}` : "";
}

async function jejak(peristiwa?: string) {
  return db.queryAll<Record<string, string>>(
    `SELECT * FROM aleta_jejak_masuk ${peristiwa ? "WHERE peristiwa = ?" : ""} ORDER BY waktu, id`,
    peristiwa ? [peristiwa] : []
  );
}

async function setBatas(cakupan: "peran" | "akun", sasaran: string, maks: number, perilaku: "tolak" | "keluarkan-terlama", berlakuSampai = "") {
  await db.run(
    `INSERT INTO aleta_batas_perangkat (id, cakupan, sasaran, maks, perilaku, berlaku_sampai) VALUES (?, ?, ?, ?, ?, ?)`,
    [`bp-${cakupan}-${sasaran}`, cakupan, sasaran, maks, perilaku, berlakuSampai]
  );
}

const perangkatAktif = async (userId: string) => {
  const { daftarSesiAktif, kelompokkanPerPerangkat } = await import("@/server/modules/perangkat/sesi");
  return kelompokkanPerPerangkat(await daftarSesiAktif(db, userId)).map((p) => p.perangkatId).sort();
};

// ─── 1. migrasi ─────────────────────────────────────────────────────────────

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("migrasi 0085", () => {
  it("jurnal tanpa lubang; berkas = DDL_JEJAK_PERANGKAT; jalan di pg-mem; terdaftar di cadangan; tanpa FK/CHECK", async () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    expect(j.entries.map((e) => e.idx)).toEqual(j.entries.map((_, i) => i));
    const ini = j.entries.filter((e) => e.tag === "0085_aleta_jejak_masuk_perangkat");
    expect(ini).toHaveLength(1);
    expect(ini[0].when).toBeGreaterThan(j.entries[ini[0].idx - 1].when);

    const { DDL_JEJAK_PERANGKAT } = await import("@/server/db/schema");
    const { IN_MEMORY_TABLE_PERSISTENCE_ORDER } = await import("@/server/db/client");
    const teks = readFileSync(path.join(process.cwd(), "drizzle/0085_aleta_jejak_masuk_perangkat.sql"), "utf8");
    expect(pernyataan(teks)).toEqual([...DDL_JEJAK_PERANGKAT.tabel, ...DDL_JEJAK_PERANGKAT.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(teks);
    for (const t of ["aleta_jejak_masuk", "aleta_perangkat", "aleta_sesi_perangkat", "aleta_batas_perangkat", "aleta_tiket_perangkat", "aleta_setelan_jejak_masuk"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(teks.replace(/--.*$/gm, ""))).toBe(false);
  });
});

// ─── 2. UA & IP ─────────────────────────────────────────────────────────────

describe("parser user-agent", () => {
  it("Windows + Chrome, Edge, Firefox", async () => {
    const { bacaUa } = await import("@/server/modules/perangkat/ua");
    expect(bacaUa(UA_WIN)).toMatchObject({ jenis: "komputer", os: "Windows", osVersi: "10/11", peramban: "Chrome", perambanVersi: "130" });
    expect(bacaUa(`${UA_WIN} Edg/130.0.2849.68`)).toMatchObject({ os: "Windows", peramban: "Edge", perambanVersi: "130" });
    expect(bacaUa("Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0")).toMatchObject({ osVersi: "7", peramban: "Firefox" });
  });
  it("Android Chrome (model disembunyikan) dan Samsung Internet (model terbaca)", async () => {
    const { bacaUa, namaPerangkat } = await import("@/server/modules/perangkat/ua");
    expect(bacaUa("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36")).toMatchObject({
      jenis: "hp",
      os: "Android",
      osVersi: "10",
      peramban: "Chrome",
      model: "",
    });
    const samsung = bacaUa(
      "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36"
    );
    expect(samsung).toMatchObject({ jenis: "hp", os: "Android", osVersi: "14", peramban: "Samsung Internet", perambanVersi: "26", model: "SM-A546E" });
    expect(namaPerangkat(samsung)).toBe("Samsung Internet 26 · Android 14 (SM-A546E)");
  });
  it("iPhone Safari, iPad, Mac", async () => {
    const { bacaUa } = await import("@/server/modules/perangkat/ua");
    expect(
      bacaUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")
    ).toMatchObject({ jenis: "hp", os: "iOS", osVersi: "17.5", peramban: "Safari", perambanVersi: "17.5", model: "iPhone" });
    expect(bacaUa("Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1")).toMatchObject({
      jenis: "tablet",
      os: "iPadOS",
    });
    expect(
      bacaUa("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15")
    ).toMatchObject({ jenis: "komputer", os: "macOS", osVersi: "10.15.7", peramban: "Safari" });
    expect(bacaUa("")).toMatchObject({ jenis: "", os: "" });
  });
});

describe("IP klien", () => {
  it("diambil dari UJUNG X-Forwarded-For; entri karangan peramban di depan diabaikan; rantai disimpan", async () => {
    const { ipKlien, rantaiXff } = await import("@/server/modules/perangkat/jaringan");
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 192.168.9.121" });
    expect(ipKlien(h)).toBe("192.168.9.121");
    expect(rantaiXff(h)).toBe("1.2.3.4, 192.168.9.121");
    expect(ipKlien(new Headers({ "x-forwarded-for": "bukan-ip", "x-real-ip": "10.0.0.5" }))).toBe("10.0.0.5");
    expect(ipKlien(new Headers({ "x-forwarded-for": "::ffff:192.168.10.7" }))).toBe("192.168.10.7");
    expect(ipKlien(new Headers())).toBe("");
  });
});

// ─── 3. tiga jalur ──────────────────────────────────────────────────────────

describe("ketiga jalur masuk tercatat lewat satu kait", () => {
  it("email: MASUK lengkap + PERANGKAT_BARU; sessions.ip_address = IP ujung; masuk kedua dari perangkat sama bukan perangkat baru", async () => {
    const r = await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A, ip: "192.168.9.121" });
    expect(r.status).toBe(200);
    const masuk = await jejak("MASUK");
    expect(masuk).toHaveLength(1);
    expect(masuk[0]).toMatchObject({
      jalur: "email",
      user_id: "usr-hakim",
      username: "hakim",
      nama: "Hj. Nur Aisyah",
      peran: "hakim",
      perangkat_id: PERANGKAT.A,
      ip: "192.168.9.121",
      rantai_xff: "203.0.113.66, 192.168.9.121",
      jenis_perangkat: "komputer",
      os: "Windows 10/11",
      peramban: "Chrome 130",
      ingat: "ya",
    });
    expect(masuk[0].sesi_ref).toMatch(/^[0-9a-f]{24}$/);
    expect((await jejak("PERANGKAT_BARU")).map((b) => b.perangkat_id)).toEqual([PERANGKAT.A]);
    const sesi = await db.queryAll<{ id: string; ip_address: string }>("SELECT id, ip_address FROM sessions", []);
    expect(sesi.map((s) => s.ip_address)).toEqual(["192.168.9.121"]);

    await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A });
    expect(await jejak("PERANGKAT_BARU")).toHaveLength(1);
  });

  it("sipp (password SIPP): MASUK jalur sipp, ingat 'tidak'", async () => {
    k.milik["usr-hakim"] = ["pp.hakim"];
    const r = await masukSipp("hakim", SANDI_SIPP, { perangkat: PERANGKAT.B, ip: "192.168.10.44" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ jenis: "masuk", lewat: "sipp" });
    const masuk = await jejak("MASUK");
    expect(masuk).toHaveLength(1);
    expect(masuk[0]).toMatchObject({ jalur: "sipp", user_id: "usr-hakim", perangkat_id: PERANGKAT.B, ip: "192.168.10.44", ingat: "tidak" });
    // Jejak lama tetap ditulis (fitur lama tidak hilang).
    const lama = await db.queryAll("SELECT id FROM aleta_masuk_jejak WHERE aleta_user_id = 'usr-hakim' AND hasil = 'berhasil'", []);
    expect(lama.length).toBeGreaterThan(0);
  });

  it("sipp-sesi (ekstensi): MASUK jalur sipp-sesi; perangkat tanpa kuki mendapat kuki aleta_perangkat baru", async () => {
    const r = await masukSesiSipp({ ip: "192.168.10.45" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ jenis: "masuk" });
    const kuki = r.headers.get("set-cookie") ?? "";
    const id = kuki.match(/aleta_perangkat=([0-9a-f-]{36})/)?.[1];
    expect(id).toBeTruthy();
    expect(kuki).toMatch(/aleta_perangkat=[^;]+;[^,]*HttpOnly/i);
    const masuk = await jejak("MASUK");
    expect(masuk[0]).toMatchObject({ jalur: "sipp-sesi", user_id: "usr-hakim", perangkat_id: id, ip: "192.168.10.45" });
  });

  it("gagal: sandi salah, akun tak dikenal (tersamar), sandi SIPP salah - tanpa sandi di mana pun", async () => {
    k.milik["usr-hakim"] = ["pp.hakim"];
    expect((await masukEmail("hakim@pa.go.id", "Salah-Rekaan-1", { perangkat: PERANGKAT.A })).status).toBe(401);
    expect((await masukEmail("tidak.ada@pa.go.id", "Salah-Rekaan-2", { perangkat: PERANGKAT.A })).status).toBe(401);
    expect((await masukSipp("hakim", "Salah-Rekaan-3", { perangkat: PERANGKAT.A })).status).toBe(401);
    const gagal = await jejak("MASUK_GAGAL");
    expect(gagal.map((g) => [g.jalur, g.alasan, g.user_id, g.identitas_samar])).toEqual([
      ["email", "sandi salah", "usr-hakim", ""],
      ["email", "akun tak dikenal", "", "ti***"],
      ["sipp", "sandi salah", "usr-hakim", ""],
    ]);
    expect(JSON.stringify(await jejak())).not.toMatch(/Salah-Rekaan/);
  });

  it("keluar: KELUAR tercatat, peta sesi dibuang", async () => {
    const r = await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A });
    const kuki = kukiSesi(r);
    const keluar = await POST(
      new NextRequest(`${ASAL}/api/auth/sign-out`, {
        method: "POST",
        headers: { origin: ASAL, cookie: `${kuki}; aleta_perangkat=${PERANGKAT.A}`, "x-forwarded-for": "192.168.9.50", "user-agent": UA_WIN },
      })
    );
    expect(keluar.status).toBe(200);
    expect((await jejak("KELUAR")).map((b) => [b.user_id, b.perangkat_id, b.ip])).toEqual([["usr-hakim", PERANGKAT.A, "192.168.9.50"]]);
    expect(await db.queryAll("SELECT * FROM aleta_sesi_perangkat", [])).toEqual([]);
  });

  it("redaksi: token dan id sesi mentah tidak ada di jejak; sesi_ref bukan id sesi", async () => {
    const r = await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A });
    await r.json();
    const s = await db.queryOne<{ id: string; token: string }>("SELECT id, token FROM sessions", []);
    const semua = JSON.stringify(await jejak());
    expect(semua).not.toContain(s!.token);
    expect(semua).not.toContain(s!.id);
    expect(semua).not.toContain("hakim123");
  });
});

// ─── 4. batas ───────────────────────────────────────────────────────────────

describe("batas perangkat", () => {
  it("bawaan TANPA BATAS: empat perangkat semua masuk", async () => {
    for (const p of [PERANGKAT.A, PERANGKAT.B, PERANGKAT.C, PERANGKAT.D]) {
      expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: p })).status).toBe(200);
    }
    expect(await perangkatAktif("usr-hakim")).toHaveLength(4);
  });

  it("tolak: perangkat ketiga ditolak 403 BATAS_PERANGKAT + tiket + daftar; tidak ada yang dicabut; perangkat sama tidak menambah hitungan", async () => {
    await setBatas("peran", "hakim", 2, "tolak");
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A })).status).toBe(200);
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.B })).status).toBe(200);
    const r = await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.C });
    expect(r.status).toBe(403);
    expect(r.headers.get("set-cookie") ?? "").not.toContain("session_token=");
    const isi = await r.json();
    expect(isi.code).toBe("BATAS_PERANGKAT");
    expect(isi.tiket).toMatch(/^[\w-]{20,}$/);
    expect(isi.perangkat.map((p: { perangkatId: string }) => p.perangkatId).sort()).toEqual([PERANGKAT.A, PERANGKAT.B]);
    expect(await perangkatAktif("usr-hakim")).toEqual([PERANGKAT.A, PERANGKAT.B]);
    expect((await jejak("MASUK_DITOLAK_BATAS_PERANGKAT")).map((b) => b.perangkat_id)).toEqual([PERANGKAT.C]);
    // Bukan percobaan gagal (password benar).
    expect(await jejak("MASUK_GAGAL")).toEqual([]);
    // Tiket disimpan sebagai hash, bukan tiket mentah.
    expect(JSON.stringify(await db.queryAll("SELECT * FROM aleta_tiket_perangkat", []))).not.toContain(isi.tiket);

    // Masuk ulang dari A: lolos, sesi lama A dicabut, hitungan tetap 2.
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A })).status).toBe(200);
    expect(await perangkatAktif("usr-hakim")).toEqual([PERANGKAT.A, PERANGKAT.B]);
    const sesiA = await db.queryAll("SELECT session_id FROM aleta_sesi_perangkat WHERE perangkat_id = ?", [PERANGKAT.A]);
    expect(sesiA).toHaveLength(1);
    expect((await jejak("SESI_DICABUT")).map((b) => b.alasan)).toEqual(["masuk ulang dari perangkat yang sama"]);
  });

  it("tolak berlaku juga di jalur sipp dan sipp-sesi (satu titik penegakan)", async () => {
    k.milik["usr-hakim"] = ["pp.hakim"];
    await setBatas("peran", "hakim", 1, "tolak");
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A })).status).toBe(200);
    const s = await masukSipp("hakim", SANDI_SIPP, { perangkat: PERANGKAT.B });
    expect(s.status).toBe(403);
    expect((await s.json()).code).toBe("BATAS_PERANGKAT");
    const e = await masukSesiSipp({ perangkat: PERANGKAT.C });
    expect(e.status).toBe(403);
    expect((await e.json()).code).toBe("BATAS_PERANGKAT");
    expect((await jejak("MASUK_DITOLAK_BATAS_PERANGKAT")).map((b) => b.jalur)).toEqual(["sipp", "sipp-sesi"]);
  });

  it("keluarkan-terlama: perangkat yang paling lama diam dicabut otomatis dan dicatat", async () => {
    await setBatas("peran", "hakim", 2, "keluarkan-terlama");
    await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A });
    await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.B });
    // A terakhir aktif lebih dulu daripada B.
    await db.run("UPDATE aleta_sesi_perangkat SET terakhir_aktif = '2026-10-23T00:00:00.000Z' WHERE perangkat_id = ?", [PERANGKAT.A]);
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.C })).status).toBe(200);
    expect(await perangkatAktif("usr-hakim")).toEqual([PERANGKAT.B, PERANGKAT.C]);
    const cabut = await jejak("SESI_DICABUT");
    expect(cabut.map((b) => [b.perangkat_id, b.pelaku_nama])).toEqual([[PERANGKAT.A, "Sistem (batas perangkat)"]]);
  });

  it("akun menang atas peran (dan pengecualian kedaluwarsa tidak berlaku)", async () => {
    await setBatas("peran", "hakim", 1, "tolak");
    await setBatas("akun", "usr-hakim", 3, "tolak");
    for (const p of [PERANGKAT.A, PERANGKAT.B, PERANGKAT.C]) {
      expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: p })).status).toBe(200);
    }
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.D })).status).toBe(403);
    await db.run("UPDATE aleta_batas_perangkat SET berlaku_sampai = '2020-01-01T00:00:00.000Z' WHERE cakupan = 'akun'", []);
    const { kebijakanUntuk } = await import("@/server/modules/perangkat/batas");
    expect(await kebijakanUntuk(db, "usr-hakim")).toMatchObject({ maks: 1, sumber: "peran" });
  });

  it("beberapa peran = batas TERBESAR; 0 = tanpa batas menang; peran tanpa kebijakan tidak menimbang", async () => {
    const { pilihKebijakan } = await import("@/server/modules/perangkat/batas");
    const b = (sasaran: string, maks: number, perilaku: "tolak" | "keluarkan-terlama" = "tolak") =>
      ({ id: sasaran, cakupan: "peran", sasaran, maks, perilaku, berlaku_sampai: "", alasan: "", diubah_oleh: "", diubah_nama: "", diubah_pada: "" }) as const;
    expect(pilihKebijakan({ id: "u", peran: ["hakim", "kasir"] }, [b("hakim", 1), b("kasir", 3)])).toMatchObject({ maks: 3, sasaran: "kasir" });
    expect(pilihKebijakan({ id: "u", peran: ["hakim", "kasir"] }, [b("hakim", 2), b("kasir", 0)])).toMatchObject({ maks: 0 });
    expect(pilihKebijakan({ id: "u", peran: ["hakim", "mediator"] }, [b("hakim", 2)])).toMatchObject({ maks: 2 });
    expect(pilihKebijakan({ id: "u", peran: ["hakim"] }, [])).toMatchObject({ maks: 0, sumber: "bawaan" });

    // Lewat basis data: peran tambahan dari users.additional_role_ids_json.
    await setBatas("peran", "hakim", 1, "tolak");
    await setBatas("peran", "mediator", 2, "tolak");
    await db.run(`UPDATE users SET additional_role_ids_json = '["mediator"]' WHERE id = 'usr-hakim'`, []);
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A })).status).toBe(200);
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.B })).status).toBe(200);
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.C })).status).toBe(403);
  });

  it("Super Admin tidak pernah terkunci: 'tolak' ditolak saat disimpan, dan dipaksa keluarkan-terlama saat ditegakkan", async () => {
    const { simpanKebijakan } = await import("@/server/modules/perangkat/batas");
    await expect(
      simpanKebijakan(db, { cakupan: "peran", sasaran: "super-admin", maks: 1, perilaku: "tolak" }, { id: "usr-super", nama: "uji" })
    ).rejects.toThrow(/Super Admin/);
    await expect(
      simpanKebijakan(db, { cakupan: "akun", sasaran: "usr-super", maks: 1, perilaku: "tolak" }, { id: "usr-super", nama: "uji" })
    ).rejects.toThrow(/Super Admin/);
    // Baris "tolak" yang masuk lewat jalan lain pun tidak mengunci.
    await setBatas("peran", "super-admin", 1, "tolak");
    expect((await masukEmail("superderry@gmail.com", "super123", { perangkat: PERANGKAT.A })).status).toBe(200);
    expect((await masukEmail("superderry@gmail.com", "super123", { perangkat: PERANGKAT.B })).status).toBe(200);
    expect(await perangkatAktif("usr-super")).toEqual([PERANGKAT.B]);
  });
});

// ─── 5. tiket ───────────────────────────────────────────────────────────────

describe("tiket pilih perangkat yang dikeluarkan", () => {
  async function tiketDitolak() {
    await setBatas("peran", "hakim", 1, "tolak");
    await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.A });
    const r = await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.B });
    expect(r.status).toBe(403);
    return String((await r.json()).tiket);
  }
  const rutePromise = import("@/app/api/portal/perangkat/tiket/route");
  const kirim = async (badan: unknown, perangkat: string) =>
    (await rutePromise).POST(
      new NextRequest(`${ASAL}/api/portal/perangkat/tiket`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `aleta_perangkat=${perangkat}`, "x-forwarded-for": "192.168.9.9" },
        body: JSON.stringify(badan),
      })
    );

  it("daftar -> cabut satu -> masuk dilanjutkan; tiket sekali pakai", async () => {
    const tiket = await tiketDitolak();
    const daftar = await kirim({ tiket }, PERANGKAT.B);
    expect(daftar.status).toBe(200);
    const isi = await daftar.json();
    expect(isi.data.perangkat.map((p: { perangkatId: string }) => p.perangkatId)).toEqual([PERANGKAT.A]);
    expect(isi.data.perangkat[0].nama).toContain("Chrome 130");

    const cabut = await kirim({ tiket, perangkatId: PERANGKAT.A }, PERANGKAT.B);
    expect(cabut.status).toBe(200);
    expect((await cabut.json()).data).toMatchObject({ dicabut: 1, lanjutkanMasuk: true });
    expect((await jejak("SESI_DICABUT")).map((b) => [b.perangkat_id, b.alasan])).toEqual([
      [PERANGKAT.A, "batas perangkat: dipilih pemilik akun saat masuk"],
    ]);
    expect((await masukEmail("hakim@pa.go.id", "hakim123", { perangkat: PERANGKAT.B })).status).toBe(200);

    const ulang = await kirim({ tiket, perangkatId: PERANGKAT.A }, PERANGKAT.B);
    expect(ulang.status).toBe(400);
    expect((await ulang.json()).error.message).toMatch(/sudah dipakai/);
  });

  it("tiket dari perangkat lain dan tiket karangan ditolak", async () => {
    const tiket = await tiketDitolak();
    expect((await (await kirim({ tiket }, PERANGKAT.C)).json()).error.message).toMatch(/perangkat lain/);
    expect((await kirim({ tiket: "karangan-tiket-rekaan-0000000" }, PERANGKAT.B)).status).toBe(400);
  });

  it("tiket kedaluwarsa sesudah 5 menit", async () => {
    const { buatTiket, periksaTiket } = await import("@/server/modules/perangkat/batas");
    const lalu = new Date(Date.now() - 6 * 60_000);
    const tiket = await buatTiket(db, { userId: "usr-hakim", perangkatId: PERANGKAT.B, jalur: "email", sekarang: lalu });
    expect(await periksaTiket(db, tiket, PERANGKAT.B)).toEqual({ sah: false, sebab: "kedaluwarsa" });
    expect((await (await kirim({ tiket }, PERANGKAT.B)).json()).error.message).toMatch(/5 menit/);
    const segar = await buatTiket(db, { userId: "usr-hakim", perangkatId: PERANGKAT.B, jalur: "email" });
    expect(await periksaTiket(db, segar, PERANGKAT.B)).toMatchObject({ sah: true, userId: "usr-hakim" });
  });
});
