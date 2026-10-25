// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * BATAS JARINGAN PER PERAN (Bagian 6b, 25 Okt 2026) - perilaku nyata
 * ============================================================================
 *
 * Better Auth sungguhan + pg-mem. Masuk lewat rute /api/auth asli dengan
 * X-Forwarded-For berbagai bentuk (termasuk karangan di pangkal daftar).
 *
 *   1. migrasi 0108 = DDL_BATAS_JARINGAN;
 *   2. CIDR (v4, v6, host, terlalu luas), aturan efektif, putusan murni;
 *   3. bawaan "mana pun": tidak ada yang berubah; ujung XFF menentukan;
 *   4. penolakan masuk dicatat di Riwayat Masuk, tanpa mengeluarkan perangkat lama
 *      dan tanpa menghitung percobaan gagal; sesi yang ada tidak dihapus;
 *   5. rute: hak, pengaman diri, daftar kosong, verifikasi hanya lewat kait.
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
const KANTOR = "192.168.10.30";
const LUAR = "8.8.8.8";

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
  for (const t of [
    "aleta_subnet_kantor",
    "aleta_aturan_jaringan_peran",
    "aleta_jejak_masuk",
    "aleta_perangkat",
    "aleta_sesi_perangkat",
    "aleta_batas_perangkat",
    "aleta_tiket_perangkat",
    "sesi_portal",
    "sessions",
  ]) {
    await db.run(`DELETE FROM ${t}`, []);
  }
  const { bersihkanSinggahanJaringan, __setelUlangCatatanJaringanUntukUji } = await import("@/server/modules/keamanan/jaringan");
  bersihkanSinggahanJaringan();
  __setelUlangCatatanJaringanUntukUji();
});

afterEach(async () => {
  delete process.env.ALETA_BATAS_JARINGAN;
  const { __setelUlangKaitUntukUji } = await import("@/server/modules/keamanan/kait");
  __setelUlangKaitUntukUji();
});

async function masukMentah(email: string, password: string, perangkat: string, xff: string) {
  return masukRute(
    new NextRequest(`${ASAL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ASAL, "user-agent": UA, "x-forwarded-for": xff, cookie: `aleta_perangkat=${perangkat}` },
      body: JSON.stringify({ email, password, rememberMe: true }),
    })
  );
}
async function masuk(email: string, password: string, perangkat: string, xff = KANTOR) {
  const r = await masukMentah(email, password, perangkat, xff);
  expect(r.status, `masuk ${email} dari ${xff}`).toBe(200);
  const m = (r.headers.get("set-cookie") ?? "").match(/better-auth\.session_token=([^;]+)/);
  return `better-auth.session_token=${m![1]}; aleta_perangkat=${perangkat}`;
}

function minta(url: string, o: { method?: string; aktor?: string; kuki?: string; badan?: unknown; ip?: string } = {}) {
  return new NextRequest(`${ASAL}${url}`, {
    method: o.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "user-agent": UA,
      "x-forwarded-for": o.ip ?? KANTOR,
      ...(o.aktor ? { "x-aleta-user-id": o.aktor } : {}),
      ...(o.kuki ? { cookie: o.kuki } : {}),
    },
    ...(o.badan !== undefined ? { body: JSON.stringify(o.badan) } : {}),
  });
}

async function pasangKantorSaja(...peran: string[]) {
  const j = await import("@/server/modules/keamanan/jaringan");
  await j.tambahSubnetKantor(db, { cidr: "192.168.10.0/24", label: "Kantor" }, "usr-super");
  await j.tambahSubnetKantor(db, { cidr: "192.168.9.0/24", label: "Kantor lt.2" }, "usr-super");
  for (const p of peran) await j.simpanAturanPeran(db, p, "kantor-saja", "usr-super");
}
const jumlahSesi = async (userId: string) =>
  Number((await db.queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = ?", [userId]))?.n ?? 0);
const ditolak = () => db.queryAll<Record<string, string>>("SELECT * FROM aleta_jejak_masuk WHERE peristiwa = 'MASUK_DITOLAK_JARINGAN' ORDER BY waktu", []);

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ─── 1. migrasi ─────────────────────────────────────────────────────────────

describe("migrasi 0108", () => {
  it("jurnal tanpa lubang; berkas = DDL_BATAS_JARINGAN; jalan di pg-mem; terdaftar di cadangan; tanpa FK/CHECK", async () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    expect(j.entries.map((e) => e.idx)).toEqual(j.entries.map((_, i) => i));
    const ini = j.entries.filter((e) => e.tag === "0108_aleta_batas_jaringan");
    expect(ini).toHaveLength(1);
    expect(ini[0].when).toBeGreaterThan(j.entries[ini[0].idx - 1].when);

    const { DDL_BATAS_JARINGAN } = await import("@/server/db/schema");
    const { IN_MEMORY_TABLE_PERSISTENCE_ORDER } = await import("@/server/db/client");
    const teks = readFileSync(path.join(process.cwd(), "drizzle/0108_aleta_batas_jaringan.sql"), "utf8");
    expect(pernyataan(teks)).toEqual([...DDL_BATAS_JARINGAN.tabel, ...DDL_BATAS_JARINGAN.indeks].map((s) => pernyataan(s)[0]));
    const { newDb } = await import("pg-mem");
    const kosong = newDb();
    kosong.public.none(teks);
    for (const t of ["aleta_subnet_kantor", "aleta_aturan_jaringan_peran"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(teks.replace(/--.*$/gm, ""))).toBe(false);
  });
});

// ─── 2. unit: CIDR, aturan efektif, putusan ─────────────────────────────────

describe("CIDR", () => {
  it("IPv4: jaringan, satu alamat, batas /24, bukan tetangganya", async () => {
    const { uraiCidr, ipDalamCidr, normalkanCidr } = await import("@/server/modules/keamanan/jaringan");
    const c = uraiCidr("192.168.10.0/24")!;
    expect(ipDalamCidr("192.168.10.1", c)).toBe(true);
    expect(ipDalamCidr("192.168.10.255", c)).toBe(true);
    expect(ipDalamCidr("192.168.11.1", c)).toBe(false);
    expect(ipDalamCidr("::ffff:192.168.10.7", c)).toBe(true);
    expect(ipDalamCidr("tidak-sah", c)).toBe(false);
    expect(ipDalamCidr("192.168.9.121", uraiCidr("192.168.9.121")!)).toBe(true);
    expect(ipDalamCidr("192.168.9.122", uraiCidr("192.168.9.121")!)).toBe(false);
    expect(ipDalamCidr("10.1.2.3", uraiCidr("10.0.0.0/8")!)).toBe(true);
    // bit sisa di sisi host dibuang saat dibakukan
    expect(normalkanCidr("192.168.10.77/24")).toBe("192.168.10.0/24");
    expect(normalkanCidr(" 192.168.9.121 ")).toBe("192.168.9.121/32");
  });

  it("IPv6 dan IPv4-dalam-IPv6; v4 tidak pernah cocok dengan jaringan v6", async () => {
    const { uraiCidr, ipDalamCidr } = await import("@/server/modules/keamanan/jaringan");
    const ula = uraiCidr("fd00:1234::/32")!;
    expect(ipDalamCidr("fd00:1234:abcd::1", ula)).toBe(true);
    expect(ipDalamCidr("fd00:1235::1", ula)).toBe(false);
    expect(ipDalamCidr("192.168.10.1", ula)).toBe(false);
    expect(ipDalamCidr("::1", uraiCidr("::1")!)).toBe(true);
  });

  it("menolak yang tidak sah dan yang terlalu luas dengan kalimat Indonesia", async () => {
    const { normalkanCidr } = await import("@/server/modules/keamanan/jaringan");
    for (const buruk of ["", "abc", "300.1.1.1", "192.168.10.0/33", "192.168.10.0/24/1", "1.2.3"]) {
      expect(() => normalkanCidr(buruk), buruk).toThrow(/bukan alamat jaringan yang sah/);
    }
    expect(() => normalkanCidr("0.0.0.0/0")).toThrow(/terlalu luas/);
    expect(() => normalkanCidr("10.0.0.0/7")).toThrow(/terlalu luas/);
    expect(() => normalkanCidr("fd00::/8")).toThrow(/terlalu luas/);
  });
});

describe("aturan efektif dan putusan murni", () => {
  const subnet = [{ id: "1", cidr: "192.168.10.0/24", label: "", aktif: true, dibuatOleh: "", dibuatPada: "" }];

  it("beberapa peran: yang paling longgar menang; peran tanpa baris = mana pun", async () => {
    const { aturanEfektif } = await import("@/server/modules/keamanan/jaringan");
    const a = [
      { roleId: "hakim", aturan: "kantor-saja" as const, diubahOleh: "", diubahPada: "" },
      { roleId: "kasir", aturan: "luar-kantor-verifikasi" as const, diubahOleh: "", diubahPada: "" },
    ];
    expect(aturanEfektif(["hakim"], a)).toBe("kantor-saja");
    expect(aturanEfektif(["hakim", "kasir"], a)).toBe("luar-kantor-verifikasi");
    expect(aturanEfektif(["hakim", "panitera"], a)).toBe("mana-pun");
    expect(aturanEfektif([], a)).toBe("mana-pun");
  });

  it("kantor-saja: dalam lolos, luar ditolak, alamat kosong ditolak; daftar kosong = longgar; subnet nonaktif tidak dihitung", async () => {
    const { putuskanJaringan } = await import("@/server/modules/keamanan/jaringan");
    expect((await putuskanJaringan({ aturan: "kantor-saja", ip: "192.168.10.5", subnet })).lolos).toBe(true);
    const tolak = await putuskanJaringan({ aturan: "kantor-saja", ip: "8.8.8.8", subnet });
    expect(tolak).toMatchObject({ lolos: false, kode: "JARINGAN_DITOLAK" });
    expect((await putuskanJaringan({ aturan: "kantor-saja", ip: "", subnet })).lolos).toBe(false);
    expect((await putuskanJaringan({ aturan: "kantor-saja", ip: "8.8.8.8", subnet: [] })).lolos).toBe(true);
    expect((await putuskanJaringan({ aturan: "kantor-saja", ip: "192.168.10.5", subnet: [{ ...subnet[0], aktif: false }] })).lolos).toBe(true); // semua nonaktif = longgar
    expect((await putuskanJaringan({ aturan: "mana-pun", ip: "8.8.8.8", subnet })).lolos).toBe(true);
  });

  it("luar-kantor-verifikasi: tanpa pemeriksa ditolak, dengan pemeriksa mengikuti jawabannya", async () => {
    const { putuskanJaringan } = await import("@/server/modules/keamanan/jaringan");
    expect(await putuskanJaringan({ aturan: "luar-kantor-verifikasi", ip: "8.8.8.8", subnet })).toMatchObject({ lolos: false, kode: "PERLU_VERIFIKASI_LUAR_KANTOR" });
    expect(await putuskanJaringan({ aturan: "luar-kantor-verifikasi", ip: "8.8.8.8", subnet, verifikasi: async () => false })).toMatchObject({ lolos: false });
    expect((await putuskanJaringan({ aturan: "luar-kantor-verifikasi", ip: "8.8.8.8", subnet, verifikasi: async () => true })).lolos).toBe(true);
    expect((await putuskanJaringan({ aturan: "luar-kantor-verifikasi", ip: "192.168.10.9", subnet })).lolos).toBe(true);
  });
});

// ─── 3. bawaan = perilaku lama ──────────────────────────────────────────────

describe("bawaan semua peran 'mana pun'", () => {
  it("tanpa pengaturan apa pun, masuk dan bekerja dari alamat mana pun; tidak ada peristiwa jaringan", async () => {
    const kuki = await masuk("hakim@pa.go.id", "hakim123", A, LUAR);
    const { GET } = await import("@/app/api/portal/perangkat/route");
    expect((await GET(minta("/api/portal/perangkat", { kuki, ip: LUAR }))).status).toBe(200);
    expect(await ditolak()).toEqual([]);
  });

  it("tabel belum ada: perilaku lama, tanpa galat", async () => {
    await db.run("ALTER TABLE aleta_aturan_jaringan_peran RENAME TO aleta_aturan_jaringan_peran_x", []);
    try {
      const { bersihkanSinggahanJaringan } = await import("@/server/modules/keamanan/jaringan");
      bersihkanSinggahanJaringan();
      await masuk("hakim@pa.go.id", "hakim123", A, LUAR);
    } finally {
      await db.run("ALTER TABLE aleta_aturan_jaringan_peran_x RENAME TO aleta_aturan_jaringan_peran", []);
    }
  });
});

// ─── 4. penegakan ───────────────────────────────────────────────────────────

describe("penegakan saat masuk", () => {
  it("peran 'kantor saja': dari kantor lolos; dari luar ditolak 403, tercatat di Riwayat Masuk, tanpa sesi baru", async () => {
    await pasangKantorSaja("hakim");
    await masuk("hakim@pa.go.id", "hakim123", A, KANTOR);
    expect(await jumlahSesi("usr-hakim")).toBe(1);

    const r = await masukMentah("hakim@pa.go.id", "hakim123", B, LUAR);
    expect(r.status).toBe(403);
    const isi = (await r.json()) as { code?: string; message?: string };
    expect(isi.code).toBe("JARINGAN_DITOLAK");
    expect(isi.message).toMatch(/hanya dapat masuk dari jaringan kantor/);
    expect(await jumlahSesi("usr-hakim")).toBe(1);

    const c = await ditolak();
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ user_id: "usr-hakim", ip: LUAR, jalur: "email", peran: "hakim" });
    expect(c[0].alasan).toMatch(/kantor saja/);
    // tidak dihitung sebagai percobaan gagal (sandi benar) dan tidak ada MASUK untuk percobaan itu
    expect(await db.queryAll("SELECT id FROM aleta_jejak_masuk WHERE peristiwa = 'MASUK_GAGAL'", [])).toEqual([]);
    expect(await db.queryAll("SELECT id FROM aleta_jejak_masuk WHERE peristiwa = 'MASUK' AND ip = ?", [LUAR])).toEqual([]);
  });

  it("alamat dibaca dari UJUNG X-Forwarded-For: karangan di pangkal tidak membuka pintu, dan sebaliknya", async () => {
    await pasangKantorSaja("hakim");
    expect((await masukMentah("hakim@pa.go.id", "hakim123", A, `192.168.10.5, ${LUAR}`)).status).toBe(403);
    expect((await masukMentah("hakim@pa.go.id", "hakim123", A, `${LUAR}, 192.168.9.20`)).status).toBe(200);
  });

  it("peran lain tidak terpengaruh; akun dengan peran tambahan longgar memakai yang paling longgar", async () => {
    await pasangKantorSaja("hakim");
    await masuk("panitera@pa.go.id", "panitera123", A, LUAR);
    // hakim + peran tambahan tanpa aturan -> mana pun menang
    await db.run("UPDATE users SET additional_role_ids_json = ? WHERE id = 'usr-hakim'", [JSON.stringify(["kasir"])]);
    try {
      await masuk("hakim@pa.go.id", "hakim123", B, LUAR);
    } finally {
      await db.run("UPDATE users SET additional_role_ids_json = '[]' WHERE id = 'usr-hakim'", []);
    }
  });

  it("masuk yang ditolak jaringan TIDAK mengeluarkan perangkat lama (batas perangkat belum ditegakkan)", async () => {
    await pasangKantorSaja("hakim");
    const { simpanKebijakan } = await import("@/server/modules/perangkat/batas");
    await simpanKebijakan(db, { cakupan: "peran", sasaran: "hakim", maks: 1, perilaku: "keluarkan-terlama" }, { id: "usr-super", nama: "Super" });
    await masuk("hakim@pa.go.id", "hakim123", A, KANTOR);
    expect((await masukMentah("hakim@pa.go.id", "hakim123", B, LUAR)).status).toBe(403);
    expect(await jumlahSesi("usr-hakim")).toBe(1);
    expect(await db.queryAll("SELECT id FROM aleta_jejak_masuk WHERE peristiwa = 'SESI_DICABUT'", [])).toEqual([]);
  });

  it("sesi yang sudah ada: dari luar kantor tidak dilayani (401) TANPA dihapus; kembali ke kantor pulih sendiri; dicatat sekali", async () => {
    const kuki = await masuk("hakim@pa.go.id", "hakim123", A, KANTOR);
    const { GET } = await import("@/app/api/portal/perangkat/route");
    expect((await GET(minta("/api/portal/perangkat", { kuki }))).status).toBe(200);
    await pasangKantorSaja("hakim");
    expect((await GET(minta("/api/portal/perangkat", { kuki, ip: KANTOR }))).status).toBe(200);
    expect((await GET(minta("/api/portal/perangkat", { kuki, ip: LUAR }))).status).toBe(401);
    expect((await GET(minta("/api/portal/perangkat", { kuki, ip: LUAR }))).status).toBe(401);
    expect(await jumlahSesi("usr-hakim")).toBe(1);
    expect((await GET(minta("/api/portal/perangkat", { kuki, ip: KANTOR }))).status).toBe(200);
    const c = await ditolak();
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ user_id: "usr-hakim", jalur: "sesi", ip: LUAR });
  });

  it("darurat: ALETA_BATAS_JARINGAN=0 mematikan penegakan; Riwayat Masuk memuat dan menyaring peristiwa baru", async () => {
    await pasangKantorSaja("hakim");
    await masukMentah("hakim@pa.go.id", "hakim123", A, LUAR);
    process.env.ALETA_BATAS_JARINGAN = "0";
    await masuk("hakim@pa.go.id", "hakim123", B, LUAR);
    const { cariJejak } = await import("@/server/modules/perangkat/laporan");
    const gagal = await cariJejak(db, { hanyaGagal: true });
    expect(gagal.baris.map((b) => b.peristiwa)).toEqual(["MASUK_DITOLAK_JARINGAN"]);
    const { labelPeristiwa, peristiwaGagal } = await import("@/lib/jejak-masuk-tampilan");
    expect(labelPeristiwa("MASUK_DITOLAK_JARINGAN")).toBe("Ditolak: jaringan");
    expect(peristiwaGagal("MASUK_DITOLAK_JARINGAN")).toBe(true);
  });
});

// ─── 5. verifikasi luar kantor lewat kait ───────────────────────────────────

describe("verifikasi luar kantor hanya lewat kait", () => {
  it("dengan pendaftar kait: ditolak sampai terverifikasi, lalu lolos; kait menerima alamat dan tahap", async () => {
    const kait = await import("@/server/modules/keamanan/kait");
    const j = await import("@/server/modules/keamanan/jaringan");
    const panggilan: Array<{ ip: string; tahap: string }> = [];
    let sudah = false;
    kait.daftarkanVerifikasiLuarKantor({
      nama: "uji",
      sudahTerverifikasi: async (_db, ctx) => {
        panggilan.push({ ip: ctx.ip, tahap: ctx.tahap });
        return sudah;
      },
    });
    await j.tambahSubnetKantor(db, { cidr: "192.168.10.0/24" }, "usr-super");
    await j.simpanAturanPeran(db, "hakim", "luar-kantor-verifikasi", "usr-super");
    const r = await masukMentah("hakim@pa.go.id", "hakim123", A, LUAR);
    expect(r.status).toBe(403);
    expect(((await r.json()) as { code?: string }).code).toBe("PERLU_VERIFIKASI_LUAR_KANTOR");
    sudah = true;
    await masuk("hakim@pa.go.id", "hakim123", A, LUAR);
    expect(panggilan.every((p) => p.ip === LUAR && p.tahap === "masuk")).toBe(true);
    // dari kantor kait tidak ditanya
    panggilan.length = 0;
    await masuk("hakim@pa.go.id", "hakim123", B, KANTOR);
    expect(panggilan).toEqual([]);
  });
});

// ─── 6. rute ────────────────────────────────────────────────────────────────

describe("rute /api/admin/keamanan/jaringan", () => {
  const POSTKU = async (aktor: string, badan: unknown, ip = KANTOR) => {
    const { POST } = await import("@/app/api/admin/keamanan/jaringan/route");
    return POST(minta("/api/admin/keamanan/jaringan", { method: "POST", aktor, badan, ip }));
  };

  it("Admin membaca, peran lain 403, hanya Super Admin mengubah; GET menyebut alamat Anda", async () => {
    const { GET } = await import("@/app/api/admin/keamanan/jaringan/route");
    expect((await GET(minta("/api/admin/keamanan/jaringan", { aktor: "usr-hakim" }))).status).toBe(403);
    const baca = await GET(minta("/api/admin/keamanan/jaringan", { aktor: "usr-admin", ip: "192.168.10.55" }));
    expect(baca.status).toBe(200);
    const d = (await baca.json()).data;
    expect(d).toMatchObject({ ipAnda: "192.168.10.55", andaDalamKantor: false });
    expect(d.aturanTersedia.map((a: { kode: string; tersedia: boolean }) => [a.kode, a.tersedia])).toEqual([
      ["mana-pun", true],
      ["kantor-saja", true],
      ["luar-kantor-verifikasi", false],
    ]);
    expect((await POSTKU("usr-admin", { aksi: "tambah-subnet", cidr: "192.168.10.0/24" })).status).toBe(403);
    expect((await POSTKU("usr-hakim", { aksi: "tambah-subnet", cidr: "192.168.10.0/24" })).status).toBe(403);
  });

  it("menambah, menolak duplikat dan alamat buruk, menghidupkan/mematikan, menghapus; semua tercatat di audit", async () => {
    expect((await POSTKU("usr-super", { aksi: "tambah-subnet", cidr: "192.168.10.77/24", label: "Kantor" })).status).toBe(200);
    expect((await POSTKU("usr-super", { aksi: "tambah-subnet", cidr: "192.168.10.0/24" })).status).toBe(400); // duplikat setelah dibakukan
    expect((await POSTKU("usr-super", { aksi: "tambah-subnet", cidr: "bukan-ip" })).status).toBe(400);
    expect((await POSTKU("usr-super", { aksi: "tambah-subnet", cidr: "0.0.0.0/0" })).status).toBe(400);
    expect((await POSTKU("usr-super", { aksi: "ngawur" })).status).toBe(400);
    const baris = await db.queryOne<{ id: string; cidr: string; label: string }>("SELECT id, cidr, label FROM aleta_subnet_kantor", []);
    expect(baris).toMatchObject({ cidr: "192.168.10.0/24", label: "Kantor" });
    expect((await POSTKU("usr-super", { aksi: "aktif-subnet", id: baris!.id, aktif: false })).status).toBe(200);
    expect((await db.queryOne<{ aktif: number }>("SELECT aktif FROM aleta_subnet_kantor", []))?.aktif).toBe(0);
    expect((await POSTKU("usr-super", { aksi: "hapus-subnet", id: "tidak-ada" })).status).toBe(404);
    expect((await POSTKU("usr-super", { aksi: "hapus-subnet", id: baris!.id })).status).toBe(200);
    const audit = await db.queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action = 'SECURITY_NETWORK_RULE_UPDATE'", []);
    expect(audit.length).toBeGreaterThanOrEqual(3);
  });

  it("membatasi peran dengan daftar kosong ditolak; Super Admin tidak dapat mengunci dirinya sendiri; peran lain boleh", async () => {
    expect((await POSTKU("usr-super", { aksi: "atur-peran", roleId: "hakim", aturan: "kantor-saja" })).status).toBe(400);
    await POSTKU("usr-super", { aksi: "tambah-subnet", cidr: "192.168.10.0/24" });
    // Super Admin sedang membuka dari luar kantor: aturan untuk perannya sendiri akan mengunci dirinya
    const kunciDiri = await POSTKU("usr-super", { aksi: "atur-peran", roleId: "super-admin", aturan: "kantor-saja" }, LUAR);
    expect(kunciDiri.status).toBe(400);
    expect((await kunciDiri.json()).error.message).toMatch(/mengunci akun Anda sendiri/);
    expect(await db.queryAll("SELECT role_id FROM aleta_aturan_jaringan_peran", [])).toEqual([]);
    // dari kantor boleh; untuk peran lain dari luar juga boleh
    expect((await POSTKU("usr-super", { aksi: "atur-peran", roleId: "super-admin", aturan: "kantor-saja" }, KANTOR)).status).toBe(200);
    expect((await POSTKU("usr-super", { aksi: "atur-peran", roleId: "hakim", aturan: "kantor-saja" }, KANTOR)).status).toBe(200);
    // menghapus satu-satunya jaringan saat masih ada aturan membatasi ditolak
    const sn = await db.queryOne<{ id: string }>("SELECT id FROM aleta_subnet_kantor", []);
    expect((await POSTKU("usr-super", { aksi: "hapus-subnet", id: sn!.id })).status).toBe(400);
    expect((await POSTKU("usr-super", { aksi: "aktif-subnet", id: sn!.id, aktif: false })).status).toBe(400);
    // 'mana-pun' menghapus baris aturan (kembali ke bawaan)
    expect((await POSTKU("usr-super", { aksi: "atur-peran", roleId: "hakim", aturan: "mana-pun" })).status).toBe(200);
    expect((await db.queryAll<{ role_id: string }>("SELECT role_id FROM aleta_aturan_jaringan_peran", [])).map((b) => b.role_id)).toEqual(["super-admin"]);
  });

  it("luar-kantor-verifikasi ditolak saat simpan bila kait belum terpasang; dapat dipilih sesudahnya", async () => {
    await POSTKU("usr-super", { aksi: "tambah-subnet", cidr: "192.168.10.0/24" });
    const tolak = await POSTKU("usr-super", { aksi: "atur-peran", roleId: "hakim", aturan: "luar-kantor-verifikasi" });
    expect(tolak.status).toBe(400);
    expect((await tolak.json()).error.message).toMatch(/Verifikasi luar kantor belum tersedia/);
    const kait = await import("@/server/modules/keamanan/kait");
    kait.daftarkanVerifikasiLuarKantor({ nama: "uji", sudahTerverifikasi: async () => true });
    expect((await POSTKU("usr-super", { aksi: "atur-peran", roleId: "hakim", aturan: "luar-kantor-verifikasi" })).status).toBe(200);
  });
});
