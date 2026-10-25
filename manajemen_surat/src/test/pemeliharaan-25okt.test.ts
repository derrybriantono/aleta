// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  KABAR_WA_MENIT,
  PESAN_BAWAAN,
  bacaPengaturanPemeliharaan,
  bersihkanPengaturanPemeliharaan,
  bolehLewatPemeliharaan,
  detakKabarPemeliharaan,
  hitungKeadaan,
  jalurTetapBekerja,
  keadaanPemeliharaan,
  kosongkanSinggahPemeliharaan,
  periksaMasukanPemeliharaan,
  simpanPengaturanPemeliharaan,
  type PengaturanPemeliharaan,
} from "@/server/modules/pemeliharaan/layanan";
import { kosongkanIngatanPenjaga, terapkanPenjagaPermintaan } from "@/server/shared/penjaga-permintaan";

/**
 * ============================================================================
 * MODE PEMELIHARAAN PORTAL (E3, 25 Okt 2026)
 * ============================================================================
 *
 *   1. mati bawaan = perilaku lama persis (tidak ada yang ditolak)
 *   2. pengaturan: validasi, jadwal utuh, kabarUntuk direset jadwal baru
 *   3. keadaan: manual, jadwal (batas tepat), pita 60 menit
 *   4. penjaga di resolveActorUserId: menulis ditolak 503, membaca lewat,
 *      Super Admin (dan Admin bila dicentang) lewat, jalur tetap bekerja,
 *      gagal baca = terbuka, penolakan tidak ditelan
 *   5. kabar WhatsApp 15 menit sebelum jadwal: sekali, tepat jendelanya
 *   6. rute: hak per peran, keadaan publik tanpa sesi
 */

const ctx = vi.hoisted(() => ({ db: null as unknown, galatDb: false }));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => {
    if (ctx.galatDb) throw new Error("basis data mati");
    return ctx.db;
  },
}));
// Better Auth tidak tersedia di uji: resolveActorUserId jatuh ke header uji x-aleta-user-id.
vi.mock("@/lib/auth", () => ({
  getAuth: async () => {
    throw new Error("tanpa Better Auth di uji");
  },
}));

const KINI = new Date("2026-10-26T01:00:00.000Z");
const dariKini = (menit: number) => new Date(KINI.getTime() + menit * 60_000).toISOString();

const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);

async function dbBaru() {
  const db = await createAletaDatabase({ useInMemory: true, seed: false });
  const kini = KINI.toISOString();
  for (const r of ["hakim", "admin", "super-admin"]) await db.run(`INSERT INTO roles (id, name, description) VALUES (?, ?, '')`, [r, r]);
  await db.run(`INSERT INTO positions (id, name, unit_kerja, level_hierarchy, created_at, updated_at) VALUES ('pos-uji', 'Uji', 'Uji', 1, ?, ?)`, [kini, kini]);
  for (const [id, peran, wa] of [
    ["u-hakim", "hakim", "081200000001"],
    ["u-admin", "admin", "081200000002"],
    ["u-sa", "super-admin", "081200000003"],
  ]) {
    await db.run(
      `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, ?, ?, 'pos-uji', ?, ?)`,
      [id, id, `Nama ${id}`, `${id}@rekaan.test`, wa, peran, kini, kini]
    );
  }
  return db;
}

const PENGATURAN = (ubah: Partial<PengaturanPemeliharaan> = {}): PengaturanPemeliharaan => ({
  ...bersihkanPengaturanPemeliharaan({}),
  ...ubah,
});

describe("pengaturan dan keadaan", () => {
  it("MATI bawaan: tanpa pengaturan tidak ada pemeliharaan, tidak ada pita, tidak ada jadwal", () => {
    const k = hitungKeadaan(PENGATURAN(), KINI);
    expect(k).toMatchObject({ aktif: false, sebab: null, mulaiDijadwalkan: "", menitSampaiMulai: null, adminBoleh: false });
    expect(PENGATURAN()).toMatchObject({ aktif: false, kabarWa: false, adminBoleh: false });
  });

  it("dinyalakan tangan: aktif sampai dimatikan tangan, jadwal diabaikan; pesan kosong memakai pesan bawaan", () => {
    const k = hitungKeadaan(PENGATURAN({ aktif: true }), KINI);
    expect(k).toMatchObject({ aktif: true, sebab: "manual", pesan: PESAN_BAWAAN });
    expect(hitungKeadaan(PENGATURAN({ aktif: true, pesan: "Pasang versi baru" }), KINI).pesan).toBe("Pasang versi baru");
  });

  it("jadwal: aktif tepat dari mulai (termasuk) sampai selesai (tidak termasuk); sebelum dan sesudahnya tidak", () => {
    const p = PENGATURAN({ mulai: dariKini(60), selesai: dariKini(120) });
    expect(hitungKeadaan(p, new Date(KINI.getTime() + 59 * 60_000)).aktif).toBe(false);
    expect(hitungKeadaan(p, new Date(KINI.getTime() + 60 * 60_000))).toMatchObject({ aktif: true, sebab: "jadwal", selesaiPerkiraan: dariKini(120) });
    expect(hitungKeadaan(p, new Date(KINI.getTime() + 119 * 60_000)).aktif).toBe(true);
    expect(hitungKeadaan(p, new Date(KINI.getTime() + 120 * 60_000)).aktif).toBe(false);
  });

  it("pita: menit sampai mulai hanya dalam 60 menit terakhir sebelum jadwal", () => {
    const p = PENGATURAN({ mulai: dariKini(90), selesai: dariKini(150) });
    expect(hitungKeadaan(p, KINI).menitSampaiMulai).toBeNull();
    expect(hitungKeadaan(p, new Date(KINI.getTime() + 30 * 60_000))).toMatchObject({ aktif: false, menitSampaiMulai: 60, mulaiDijadwalkan: dariKini(90) });
    expect(hitungKeadaan(p, new Date(KINI.getTime() + 89 * 60_000)).menitSampaiMulai).toBe(1);
    expect(hitungKeadaan(p, new Date(KINI.getTime() + 91 * 60_000)).menitSampaiMulai).toBeNull();
  });

  it("jadwal setengah isi, terbalik, atau lebih dari 72 jam dibuang oleh pembersih dan DITOLAK oleh validasi simpan", () => {
    expect(bersihkanPengaturanPemeliharaan({ mulai: dariKini(10) })).toMatchObject({ mulai: "", selesai: "" });
    expect(bersihkanPengaturanPemeliharaan({ mulai: dariKini(10), selesai: dariKini(5) })).toMatchObject({ mulai: "", selesai: "" });
    expect(bersihkanPengaturanPemeliharaan({ mulai: dariKini(0), selesai: dariKini(73 * 60) }).mulai).toBe("");
    expect(() => periksaMasukanPemeliharaan({ mulai: dariKini(10) })).toThrow(/mulai DAN selesai/);
    expect(() => periksaMasukanPemeliharaan({ mulai: dariKini(10), selesai: dariKini(5) })).toThrow(/sesudah waktu mulai/);
    expect(() => periksaMasukanPemeliharaan({ mulai: dariKini(0), selesai: dariKini(73 * 60) })).toThrow(/72 jam/);
    expect(() => periksaMasukanPemeliharaan({ pesan: "x".repeat(401) })).toThrow(/400 huruf/);
    expect(() => periksaMasukanPemeliharaan("bukan objek")).toThrow();
    expect(() => periksaMasukanPemeliharaan({ aktif: true, pesan: "ok" })).not.toThrow();
  });

  it("pesan dibersihkan dari tanda kurung sudut dan dipotong", () => {
    expect(bersihkanPengaturanPemeliharaan({ pesan: "<b>Halo</b>" }).pesan).toBe("bHalo/b");
  });

  it("pengecualian: Super Admin selalu; Admin hanya bila dicentang; peran lain tidak", () => {
    expect(bolehLewatPemeliharaan("super-admin", { adminBoleh: false })).toBe(true);
    expect(bolehLewatPemeliharaan("admin", { adminBoleh: false })).toBe(false);
    expect(bolehLewatPemeliharaan("admin", { adminBoleh: true })).toBe(true);
    expect(bolehLewatPemeliharaan("hakim", { adminBoleh: true })).toBe(false);
    expect(bolehLewatPemeliharaan("", { adminBoleh: true })).toBe(false);
  });

  it("jalur yang tetap bekerja dikenali dengan dan tanpa awalan /aleta, tanpa mencocokkan awalan kata", () => {
    for (const j of ["/api/auth/sign-in/email", "/aleta/api/auth/sign-out", "/api/public/institution/logo", "/api/admin/pemeliharaan", "/aleta/api/antrian/ambil", "/api/sidang-ruang/x", "/api/portal/galat"]) {
      expect(jalurTetapBekerja(j), j).toBe(true);
    }
    for (const j of ["/api/aleta-ecourt/sidang-tunda", "/api/antrianx", "/api/admin/pemeliharaanx", "/api/letters", "/aleta/api/aleta-ecourt/putusan"]) {
      expect(jalurTetapBekerja(j), j).toBe(false);
    }
  });
});

describe("tersimpan di basis data", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await dbBaru();
    ctx.db = db;
  }, 180000);
  afterAll(async () => {
    ctx.db = null;
    await db?.close();
  });
  beforeEach(async () => {
    await db.run("DELETE FROM aleta_ekstensi_setelan");
    kosongkanSinggahPemeliharaan();
    kosongkanIngatanPenjaga();
    ctx.galatDb = false;
  });

  it("bawaan: mati; simpan mencatat pengubah; menyimpan membuang singgahan seketika", async () => {
    expect((await keadaanPemeliharaan(db, KINI)).aktif).toBe(false);
    const p = await simpanPengaturanPemeliharaan(db, { aktif: true, pesan: "Pasang 1.205.40" }, { id: "u-sa", nama: "Super Rekaan" }, KINI);
    expect(p).toMatchObject({ aktif: true, pesan: "Pasang 1.205.40", diubahOleh: "Super Rekaan", diubahPada: KINI.toISOString() });
    expect((await keadaanPemeliharaan(db, KINI)).aktif).toBe(true);
    await simpanPengaturanPemeliharaan(db, { aktif: false }, { id: "u-sa", nama: "Super Rekaan" }, KINI);
    expect((await keadaanPemeliharaan(db, KINI)).aktif).toBe(false);
  });

  it("jadwal baru mengosongkan kabarUntuk; jadwal yang sama dipertahankan", async () => {
    const SA = { id: "u-sa", nama: "Super Rekaan" };
    await simpanPengaturanPemeliharaan(db, { mulai: dariKini(60), selesai: dariKini(120), kabarWa: true }, SA, KINI);
    await db.run("UPDATE aleta_ekstensi_setelan SET nilai = ? WHERE kunci = 'pemeliharaan:pengaturan'", [JSON.stringify({ ...(await bacaPengaturanPemeliharaan(db, { tanpaSinggah: true })), kabarUntuk: dariKini(60) })]);
    kosongkanSinggahPemeliharaan();
    const sama = await simpanPengaturanPemeliharaan(db, { mulai: dariKini(60), selesai: dariKini(130) }, SA, KINI);
    expect(sama.kabarUntuk).toBe(dariKini(60));
    const baru = await simpanPengaturanPemeliharaan(db, { mulai: dariKini(200), selesai: dariKini(260) }, SA, KINI);
    expect(baru.kabarUntuk).toBe("");
  });

  // ─── 4. Penjaga ───────────────────────────────────────────────────────────
  const tulis = (url: string, userId = "u-hakim") => req(url, { method: "POST", headers: { "x-aleta-user-id": userId }, body: "{}" });

  it("MATI: menulis oleh siapa pun lewat tanpa penolakan (perilaku lama persis)", async () => {
    for (const u of ["u-hakim", "u-admin", "u-sa"]) {
      expect(await terapkanPenjagaPermintaan(tulis("/api/aleta-ecourt/sidang-tunda", u), u)).toBe(u);
    }
  });

  it("AKTIF: hakim menulis ditolak 503 berisi pesan Super Admin; membaca tetap lewat", async () => {
    await simpanPengaturanPemeliharaan(db, { aktif: true, pesan: "Pasang versi baru, kembali 20 menit lagi." }, { id: "u-sa", nama: "S" }, KINI);
    const tolak = await terapkanPenjagaPermintaan(tulis("/api/aleta-ecourt/sidang-tunda"), "u-hakim").catch((e) => e);
    expect(tolak).toMatchObject({ name: "ApiError", status: 503 });
    expect(tolak.message).toContain("Pasang versi baru, kembali 20 menit lagi.");
    expect(tolak.details).toMatchObject({ alasan: "pemeliharaan" });
    for (const metode of ["PUT", "PATCH", "DELETE"]) {
      await expect(terapkanPenjagaPermintaan(req("/api/letters/1", { method: metode, headers: { "x-aleta-user-id": "u-hakim" } }), "u-hakim")).rejects.toMatchObject({ status: 503 });
    }
    for (const metode of ["GET", "HEAD", "OPTIONS"]) {
      expect(await terapkanPenjagaPermintaan(req("/api/letters", { method: metode, headers: { "x-aleta-user-id": "u-hakim" } }), "u-hakim")).toBe("u-hakim");
    }
  });

  it("AKTIF: Super Admin lewat; Admin ditolak sampai dicentang; jalur tetap bekerja (dengan awalan) lewat untuk siapa pun", async () => {
    const SA = { id: "u-sa", nama: "S" };
    await simpanPengaturanPemeliharaan(db, { aktif: true }, SA, KINI);
    expect(await terapkanPenjagaPermintaan(tulis("/api/aleta-ecourt/sidang-tunda", "u-sa"), "u-sa")).toBe("u-sa");
    await expect(terapkanPenjagaPermintaan(tulis("/api/aleta-ecourt/sidang-tunda", "u-admin"), "u-admin")).rejects.toMatchObject({ status: 503 });
    expect(await terapkanPenjagaPermintaan(tulis("/aleta/api/antrian/ambil"), "u-hakim")).toBe("u-hakim");
    expect(await terapkanPenjagaPermintaan(tulis("/aleta/api/portal/galat"), "u-hakim")).toBe("u-hakim");

    await simpanPengaturanPemeliharaan(db, { aktif: true, adminBoleh: true }, SA, KINI);
    expect(await terapkanPenjagaPermintaan(tulis("/api/aleta-ecourt/sidang-tunda", "u-admin"), "u-admin")).toBe("u-admin");
    await expect(terapkanPenjagaPermintaan(tulis("/api/aleta-ecourt/sidang-tunda", "u-hakim"), "u-hakim")).rejects.toMatchObject({ status: 503 });
  });

  it("jadwal yang sedang berjalan menolak menulis; sesudah selesai tidak lagi", async () => {
    const SA = { id: "u-sa", nama: "S" };
    const sekarang = new Date();
    await simpanPengaturanPemeliharaan(db, { mulai: new Date(sekarang.getTime() - 60_000).toISOString(), selesai: new Date(sekarang.getTime() + 3_600_000).toISOString() }, SA, sekarang);
    await expect(terapkanPenjagaPermintaan(tulis("/api/aleta-ecourt/sidang-tunda"), "u-hakim")).rejects.toMatchObject({ status: 503 });
    await simpanPengaturanPemeliharaan(db, { mulai: new Date(sekarang.getTime() - 7_200_000).toISOString(), selesai: new Date(sekarang.getTime() - 3_600_000).toISOString() }, SA, sekarang);
    expect(await terapkanPenjagaPermintaan(tulis("/api/aleta-ecourt/sidang-tunda"), "u-hakim")).toBe("u-hakim");
  });

  it("tautan Jadwal Sidang tanpa akun tidak disentuh penjaga ini", async () => {
    await simpanPengaturanPemeliharaan(db, { aktif: true }, { id: "u-sa", nama: "S" }, KINI);
    const r = req("/api/aleta-ecourt/sidang-tunda", { method: "POST", headers: { "x-tautan-jadwal": "rahasia-rekaan" } });
    expect(await terapkanPenjagaPermintaan(r, "u-hakim")).toBe("u-hakim");
  });

  it("gagal baca basis data = terbuka (tidak memutus pegawai karena satu gangguan)", async () => {
    await simpanPengaturanPemeliharaan(db, { aktif: true }, { id: "u-sa", nama: "S" }, KINI);
    kosongkanSinggahPemeliharaan();
    ctx.galatDb = true;
    expect(await terapkanPenjagaPermintaan(tulis("/api/aleta-ecourt/sidang-tunda"), "u-hakim")).toBe("u-hakim");
  });

  it("lewat resolveActorUserId sungguhan: penolakan sampai ke pemanggil (tidak ditelan jadi 'tanpa pengguna'); mati = id biasa", async () => {
    const { resolveActorUserId } = await import("@/server/shared/auth");
    expect(await resolveActorUserId(tulis("/api/aleta-ecourt/sidang-tunda"))).toBe("u-hakim");
    await simpanPengaturanPemeliharaan(db, { aktif: true }, { id: "u-sa", nama: "S" }, KINI);
    await expect(resolveActorUserId(tulis("/api/aleta-ecourt/sidang-tunda"))).rejects.toMatchObject({ status: 503 });
    expect(await resolveActorUserId(tulis("/api/aleta-ecourt/sidang-tunda", "u-sa"))).toBe("u-sa");
    // tanpa pengguna: tetap kosong, tidak 503
    expect(await resolveActorUserId(req("/api/aleta-ecourt/sidang-tunda", { method: "POST", body: "{}" }))).toBe("");
  });

  // ─── 5. Kabar WhatsApp ────────────────────────────────────────────────────
  it("kabar WhatsApp: hanya di jendela 15 menit sebelum mulai, sekali per jadwal, ke admin ber-nomor; mati = tidak pernah", async () => {
    const SA = { id: "u-sa", nama: "S" };
    const kirim = vi.fn(async (penerima: unknown[]) => ({ terkirim: penerima.length, gagal: 0 }));
    const jadwal = { mulai: dariKini(120), selesai: dariKini(180), pesan: "Pasang 1.205.40" };

    await simpanPengaturanPemeliharaan(db, { ...jadwal, kabarWa: false }, SA, KINI);
    expect(await detakKabarPemeliharaan(db, { kini: new Date(KINI.getTime() + 110 * 60_000), kirim })).toBeNull();

    await simpanPengaturanPemeliharaan(db, { ...jadwal, kabarWa: true }, SA, KINI);
    expect(await detakKabarPemeliharaan(db, { kini: new Date(KINI.getTime() + 100 * 60_000), kirim })).toBeNull(); // 20 menit lagi
    expect(kirim).not.toHaveBeenCalled();
    const hasil = await detakKabarPemeliharaan(db, { kini: new Date(KINI.getTime() + (120 - KABAR_WA_MENIT + 1) * 60_000), kirim });
    expect(hasil).toEqual({ terkirim: 2, gagal: 0 });
    const [penerima, pesan] = kirim.mock.calls[0] as unknown as [Array<{ id: string }>, string];
    expect(penerima.map((p) => p.id).sort()).toEqual(["u-admin", "u-sa"]);
    expect(pesan).toContain("Pasang 1.205.40");
    expect(pesan).toMatch(/pukul \d{2}:\d{2} WITA/);
    expect(pesan).toContain("Hanya Super Admin");
    // tidak berulang di detak berikutnya
    expect(await detakKabarPemeliharaan(db, { kini: new Date(KINI.getTime() + 112 * 60_000), kirim })).toBeNull();
    expect(kirim).toHaveBeenCalledTimes(1);
    // sudah lewat mulai: tidak dikirim walau belum pernah
    await simpanPengaturanPemeliharaan(db, { mulai: dariKini(200), selesai: dariKini(260), kabarWa: true }, SA, KINI);
    expect(await detakKabarPemeliharaan(db, { kini: new Date(KINI.getTime() + 201 * 60_000), kirim })).toBeNull();
    // jadwal baru dikabari lagi
    expect(await detakKabarPemeliharaan(db, { kini: new Date(KINI.getTime() + 190 * 60_000), kirim })).toEqual({ terkirim: 2, gagal: 0 });
    expect(kirim).toHaveBeenCalledTimes(2);
  });

  // ─── 6. Rute ──────────────────────────────────────────────────────────────
  it("rute admin: Super Admin saja; keadaan publik tanpa sesi tidak membocorkan adminBoleh; semuanya diaudit", async () => {
    const { GET, POST } = await import("@/app/api/admin/pemeliharaan/route");
    const { GET: publik } = await import("@/app/api/public/pemeliharaan/route");
    const bentuk = async (r: Response) => ({ status: r.status, isi: (await r.json()) as { ok?: boolean; data?: Record<string, unknown> } });
    const dengan = (userId: string | null, url: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) =>
      req(url, { ...init, headers: { ...(userId ? { "x-aleta-user-id": userId } : {}) } });

    expect((await GET(dengan(null, "/api/admin/pemeliharaan"))).status).toBe(401);
    expect((await GET(dengan("u-hakim", "/api/admin/pemeliharaan"))).status).toBe(403);
    expect((await GET(dengan("u-admin", "/api/admin/pemeliharaan"))).status).toBe(403);
    expect((await POST(dengan("u-admin", "/api/admin/pemeliharaan", { method: "POST", body: JSON.stringify({ aktif: true }) }))).status).toBe(403);
    expect((await publik()).status).toBe(200);
    expect((await bentuk(await publik())).isi.data).toMatchObject({ aktif: false });

    const simpan = await bentuk(await POST(dengan("u-sa", "/api/admin/pemeliharaan", { method: "POST", body: JSON.stringify({ aktif: true, pesan: "Sebentar ya", adminBoleh: true }) })));
    expect(simpan.status).toBe(200);
    expect(simpan.isi.data?.keadaan).toMatchObject({ aktif: true, sebab: "manual" });
    const terbuka = (await bentuk(await publik())).isi.data!;
    expect(terbuka).toMatchObject({ aktif: true, pesan: "Sebentar ya" });
    expect(terbuka).not.toHaveProperty("adminBoleh");
    // mode aktif TIDAK mengunci Super Admin keluar dari rutenya sendiri (jalur tetap bekerja)
    const matikan = await bentuk(await POST(dengan("u-sa", "/api/admin/pemeliharaan", { method: "POST", body: JSON.stringify({ aktif: false }) })));
    expect(matikan.status).toBe(200);
    expect((await bentuk(await publik())).isi.data).toMatchObject({ aktif: false });
    expect((await POST(dengan("u-sa", "/api/admin/pemeliharaan", { method: "POST", body: JSON.stringify({ mulai: dariKini(5) }) }))).status).toBe(400);
    const audit = await db.queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action = 'UPDATE_PEMELIHARAAN'");
    expect(audit).toHaveLength(2);
  });
});
