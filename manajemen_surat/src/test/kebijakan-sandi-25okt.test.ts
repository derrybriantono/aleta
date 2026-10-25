// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * KEBIJAKAN SANDI (Bagian 6a, 25 Okt 2026) - perilaku nyata, pg-mem + rute asli
 * ============================================================================
 *
 * Yang dijaga:
 *   1. migrasi 0107 = DDL_KEBIJAKAN_SANDI, terdaftar di jurnal dan cadangan;
 *   2. saklar MATI: aturan sandi persis seperti dulu (sandi lemah tetap diterima,
 *      tidak ada paksaan ganti, daftar akun kosong);
 *   3. saklar MENYALA: panjang, huruf-angka, sandi umum, identitas, pakai ulang N;
 *   4. sandi asli tidak pernah tersimpan; sandi sementara admin memaksa ganti;
 *   5. rute: Admin membaca, Super Admin mengubah, ganti sandi sendiri memeriksa sandi lama.
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

const ASAL = "http://localhost:3000";

beforeAll(async () => {
  const { createAletaDatabase } = await import("@/server/db/client");
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  k.db = db;
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  for (const t of ["aleta_setelan_keamanan", "aleta_riwayat_sandi", "aleta_status_sandi"]) await db.run(`DELETE FROM ${t}`, []);
  const { hashSecret } = await import("@/server/shared/security");
  await db.run("UPDATE users SET password_hash = ? WHERE id = 'usr-hakim'", [hashSecret("hakim123")]);
});

function minta(url: string, o: { method?: string; aktor?: string; badan?: unknown } = {}) {
  return new NextRequest(`${ASAL}${url}`, {
    method: o.method ?? "GET",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.168.10.31", ...(o.aktor ? { "x-aleta-user-id": o.aktor } : {}) },
    ...(o.badan !== undefined ? { body: JSON.stringify(o.badan) } : {}),
  });
}

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

async function nyalakan(ubah: Record<string, unknown> = {}) {
  const { simpanKebijakanSandi } = await import("@/server/modules/keamanan/kebijakan-sandi");
  return simpanKebijakanSandi(db, { aktif: true, ...ubah }, "usr-super");
}

async function gantiHakim(sandi: string, aktor = "usr-hakim") {
  const { updateManagedUserInDb } = await import("@/server/modules/users/service");
  return updateManagedUserInDb(db, { actorUserId: aktor, userId: "usr-hakim", payload: { password: sandi } });
}

// ─── 1. migrasi ─────────────────────────────────────────────────────────────

describe("migrasi 0107", () => {
  it("jurnal tanpa lubang; berkas = DDL_KEBIJAKAN_SANDI; jalan di pg-mem; terdaftar di cadangan; tanpa FK/CHECK", async () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    expect(j.entries.map((e) => e.idx)).toEqual(j.entries.map((_, i) => i));
    const ini = j.entries.filter((e) => e.tag === "0107_aleta_kebijakan_sandi");
    expect(ini).toHaveLength(1);
    expect(ini[0].when).toBeGreaterThan(j.entries[ini[0].idx - 1].when);

    const { DDL_KEBIJAKAN_SANDI } = await import("@/server/db/schema");
    const { IN_MEMORY_TABLE_PERSISTENCE_ORDER } = await import("@/server/db/client");
    const teks = readFileSync(path.join(process.cwd(), "drizzle/0107_aleta_kebijakan_sandi.sql"), "utf8");
    expect(pernyataan(teks)).toEqual([...DDL_KEBIJAKAN_SANDI.tabel, ...DDL_KEBIJAKAN_SANDI.indeks].map((s) => pernyataan(s)[0]));
    const { newDb } = await import("pg-mem");
    const kosong = newDb();
    kosong.public.none(teks);
    for (const t of ["aleta_setelan_keamanan", "aleta_riwayat_sandi", "aleta_status_sandi"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(teks.replace(/--.*$/gm, ""))).toBe(false);
  });
});

// ─── 2. saklar mati = perilaku lama ─────────────────────────────────────────

describe("saklar MATI (bawaan): aturan sandi persis seperti dulu", () => {
  it("bawaan mati dengan panjang 8; sandi lemah tetap diterima lewat jalur admin; tidak ada paksaan; daftar kosong", async () => {
    const { bacaKebijakanSandi, wajibGantiSandi, daftarAkunBelumMemenuhi, KEBIJAKAN_SANDI_BAWAAN } = await import("@/server/modules/keamanan/kebijakan-sandi");
    expect(await bacaKebijakanSandi(db)).toEqual(KEBIJAKAN_SANDI_BAWAAN);
    expect(KEBIJAKAN_SANDI_BAWAAN).toMatchObject({ aktif: false, panjangMin: 8, riwayatN: 5, masaBerlakuHari: 0 });

    await gantiHakim("abc"); // dulu juga diterima: jalur ubah akun tidak memeriksa kekuatan
    const { hashSecret } = await import("@/server/shared/security");
    expect((await db.queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = 'usr-hakim'", []))?.password_hash).toBe(hashSecret("abc"));

    expect(await wajibGantiSandi(db, "usr-hakim")).toEqual({ wajib: false, alasan: "" });
    expect(await daftarAkunBelumMemenuhi(db)).toEqual([]);
    // sandi sementara admin: 8 karakter, tanpa tanda paksa selama mati
    const { adminManualResetPasswordInDb } = await import("@/server/modules/users/service");
    const r = await adminManualResetPasswordInDb(db, { actorUserId: "usr-admin", targetUserId: "usr-hakim" });
    expect(r.tempPassword).toHaveLength(8);
    expect(await wajibGantiSandi(db, "usr-hakim")).toEqual({ wajib: false, alasan: "" });
    const st = await db.queryOne<{ paksa_ganti: number; versi_kebijakan: number }>("SELECT paksa_ganti, versi_kebijakan FROM aleta_status_sandi WHERE user_id = 'usr-hakim'", []);
    expect(st).toMatchObject({ paksa_ganti: 0, versi_kebijakan: 0 });
  });

  it("tabel belum ada (migrasi belum jalan): penggantian sandi tetap berhasil dan kebijakan terbaca mati", async () => {
    await db.run("ALTER TABLE aleta_riwayat_sandi RENAME TO aleta_riwayat_sandi_x", []);
    try {
      await gantiHakim("sandibaru1");
      const { bacaKebijakanSandi } = await import("@/server/modules/keamanan/kebijakan-sandi");
      expect((await bacaKebijakanSandi(db)).aktif).toBe(false);
    } finally {
      await db.run("ALTER TABLE aleta_riwayat_sandi_x RENAME TO aleta_riwayat_sandi", []);
    }
  });
});

// ─── 3. aturan saat menyala ─────────────────────────────────────────────────

describe("saklar MENYALA: aturan atas sandi baru", () => {
  it("menolak pendek, tanpa angka, tanpa huruf, dan menyebut semua pelanggaran sekaligus", async () => {
    await nyalakan();
    await expect(gantiHakim("abc")).rejects.toMatchObject({ status: 400, message: expect.stringContaining("minimal 8 karakter") });
    await expect(gantiHakim("abcdefghij")).rejects.toMatchObject({ message: expect.stringContaining("satu angka") });
    await expect(gantiHakim("48291736")).rejects.toMatchObject({ message: expect.stringContaining("satu huruf") });
    const galat = (await gantiHakim("ab1").catch((e) => e)) as Error;
    expect(galat.message).toContain("minimal 8 karakter");
    // sandi yang ditolak tidak mengubah apa pun
    const { hashSecret } = await import("@/server/shared/security");
    expect((await db.queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = 'usr-hakim'", []))?.password_hash).toBe(hashSecret("hakim123"));
  });

  it("menolak sandi umum (termasuk samaran dan akhiran angka) dan identitas pemilik", async () => {
    await nyalakan();
    for (const umum of ["password123", "Qwerty123", "p@ssw0rd99", "Indonesia2026", "admin12345"]) {
      await expect(gantiHakim(umum), umum).rejects.toMatchObject({ message: expect.stringMatching(/terlalu umum/) });
    }
    // identitas usr-hakim: username "hakim", nama "Hj. Nur Aisyah", NIP 197912142006042001, email hakim@pa.go.id
    for (const identitas of ["Hakim9xk2Q!", "ZnurAisyah77#", "x197912142006042001y", "Aisyah-4821-zz"]) {
      await expect(gantiHakim(identitas), identitas).rejects.toMatchObject({ message: expect.stringMatching(/nama, username, NIP, atau email/) });
    }
    await gantiHakim("Tm9#Rkw41pZ"); // kuat dan tidak memuat identitas
  });

  it("dapat diatur: panjang 12, campuran dimatikan, sandi umum dimatikan", async () => {
    await nyalakan({ panjangMin: 12 });
    await expect(gantiHakim("Tm9#Rkw41pZ")).rejects.toMatchObject({ message: expect.stringContaining("minimal 12 karakter") });
    await gantiHakim("Tm9#Rkw41pZxy");
    await nyalakan({ panjangMin: 6, wajibCampuran: false, tolakUmum: false, tolakIdentitas: false });
    await gantiHakim("password");
  });

  it("larang pakai ulang N sandi terakhir (termasuk sandi yang sedang dipakai); sandi lebih tua boleh kembali", async () => {
    await nyalakan({ riwayatN: 2, tolakUmum: false });
    await gantiHakim("Kuda4biru");
    await gantiHakim("Lumba2lumba");
    await gantiHakim("Rumput7hijau");
    // dua sandi terakhir: Rumput7hijau (sedang dipakai) dan Lumba2lumba
    await expect(gantiHakim("Rumput7hijau")).rejects.toMatchObject({ message: expect.stringContaining("sudah pernah dipakai") });
    await expect(gantiHakim("Lumba2lumba")).rejects.toMatchObject({ message: expect.stringContaining("sudah pernah dipakai") });
    await gantiHakim("Kuda4biru"); // tiga sandi lalu: di luar jendela 2
    await nyalakan({ riwayatN: 0 });
    await gantiHakim("Rumput7hijau");
  });

  it("sandi asli tidak pernah tersimpan: riwayat hanya sidik berkunci akun; audit tidak memuat sandi", async () => {
    await nyalakan({ tolakUmum: false });
    await gantiHakim("Rahasia4kuat9");
    const baris = await db.queryAll<Record<string, string>>("SELECT * FROM aleta_riwayat_sandi WHERE user_id = 'usr-hakim'", []);
    expect(baris).toHaveLength(1);
    expect(JSON.stringify(baris)).not.toContain("Rahasia4kuat9");
    const { hashSecret } = await import("@/server/shared/security");
    const { sidikRiwayat } = await import("@/server/modules/keamanan/kebijakan-sandi");
    expect(baris[0].sidik).toBe(sidikRiwayat("usr-hakim", "Rahasia4kuat9"));
    expect(baris[0].sidik).not.toBe(hashSecret("Rahasia4kuat9"));
    expect(sidikRiwayat("usr-admin", "Rahasia4kuat9")).not.toBe(baris[0].sidik); // berkunci akun
    const audit = await db.queryAll<{ payload: string }>("SELECT payload_json AS payload FROM audit_logs WHERE entity_id = 'usr-hakim'", []).catch(() => []);
    expect(JSON.stringify(audit)).not.toContain("Rahasia4kuat9");
  });

  it("pemulihan sandi lewat OTP juga ditegakkan", async () => {
    await nyalakan();
    const { createPasswordRecoveryDraftInDb, confirmPasswordRecoveryInDb } = await import("@/server/modules/users/service");
    const draf = await createPasswordRecoveryDraftInDb(db, { identifier: "hakim" });
    // lolos aturan lama (8 karakter, huruf, angka) tetapi memuat username -> ditolak kebijakan baru
    await expect(confirmPasswordRecoveryInDb(db, { userId: "usr-hakim", otp: draf.otp, password: "hakim12345" })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/nama, username, NIP, atau email/),
    });
    await confirmPasswordRecoveryInDb(db, { userId: "usr-hakim", otp: draf.otp, password: "Pulih7kembali" });
    const { wajibGantiSandi } = await import("@/server/modules/keamanan/kebijakan-sandi");
    expect((await wajibGantiSandi(db, "usr-hakim")).wajib).toBe(false);
  });
});

// ─── 4. paksa ganti, kedaluwarsa, sandi sementara ───────────────────────────

describe("paksa ganti, masa berlaku, sandi sementara", () => {
  it("admin mengatur sandi akun lain = sementara: dipaksa ganti; pemilik mengganti sendiri = bebas lagi", async () => {
    const { wajibGantiSandi, daftarAkunBelumMemenuhi } = await import("@/server/modules/keamanan/kebijakan-sandi");
    await nyalakan({ tolakUmum: false });
    await gantiHakim("Admin3tetapkan", "usr-admin");
    expect(await wajibGantiSandi(db, "usr-hakim")).toEqual({ wajib: true, alasan: "dipaksa" });
    expect((await daftarAkunBelumMemenuhi(db)).find((a) => a.userId === "usr-hakim")?.alasan).toBe("dipaksa");
    await gantiHakim("Pemilik6mengganti", "usr-hakim");
    expect(await wajibGantiSandi(db, "usr-hakim")).toEqual({ wajib: false, alasan: "" });
  });

  it("reset manual admin: sandi sementara mengikuti panjang minimal, akun dipaksa ganti", async () => {
    const { wajibGantiSandi } = await import("@/server/modules/keamanan/kebijakan-sandi");
    const { adminManualResetPasswordInDb } = await import("@/server/modules/users/service");
    await nyalakan({ panjangMin: 14 });
    const r = await adminManualResetPasswordInDb(db, { actorUserId: "usr-admin", targetUserId: "usr-hakim" });
    expect(r.tempPassword).toHaveLength(14);
    expect(await wajibGantiSandi(db, "usr-hakim")).toEqual({ wajib: true, alasan: "dipaksa" });
  });

  it("masa berlaku: dihitung dari penggantian terakhir; akun tanpa catatan dihitung dari saat saklar menyala", async () => {
    const { wajibGantiSandi, daftarAkunBelumMemenuhi } = await import("@/server/modules/keamanan/kebijakan-sandi");
    const k0 = await nyalakan({ masaBerlakuHari: 30 });
    const nyala = Date.parse(k0.aktifSejak);
    expect(Number.isFinite(nyala)).toBe(true);
    expect((await wajibGantiSandi(db, "usr-hakim", new Date(nyala + 29 * 86_400_000))).wajib).toBe(false);
    expect(await wajibGantiSandi(db, "usr-hakim", new Date(nyala + 31 * 86_400_000))).toEqual({ wajib: true, alasan: "kedaluwarsa" });
    expect((await daftarAkunBelumMemenuhi(db, new Date(nyala + 31 * 86_400_000))).find((a) => a.userId === "usr-hakim")?.alasan).toBe("kedaluwarsa");
    await gantiHakim("Baru8berlaku");
    expect((await wajibGantiSandi(db, "usr-hakim", new Date(Date.now() + 29 * 86_400_000))).wajib).toBe(false);
    expect((await wajibGantiSandi(db, "usr-hakim", new Date(Date.now() + 31 * 86_400_000))).wajib).toBe(true);
  });

  it("aturan diubah = versi naik; akun yang sandinya dibuat sebelumnya tampil 'belum diganti' tanpa dipaksa", async () => {
    const { daftarAkunBelumMemenuhi, bacaKebijakanSandi } = await import("@/server/modules/keamanan/kebijakan-sandi");
    await nyalakan({ tolakUmum: false });
    await gantiHakim("Versi5pertama");
    expect((await daftarAkunBelumMemenuhi(db)).find((a) => a.userId === "usr-hakim")).toBeUndefined();
    const sebelum = (await bacaKebijakanSandi(db)).versi;
    await nyalakan({ panjangMin: 16 });
    expect((await bacaKebijakanSandi(db)).versi).toBe(sebelum + 1);
    expect((await daftarAkunBelumMemenuhi(db)).find((a) => a.userId === "usr-hakim")?.alasan).toBe("belum-diganti");
    await nyalakan({ panjangMin: 16 }); // tanpa perubahan: versi tetap
    expect((await bacaKebijakanSandi(db)).versi).toBe(sebelum + 1);
  });

  it("nilai di luar batas ditolak dengan kalimat Indonesia", async () => {
    const { simpanKebijakanSandi } = await import("@/server/modules/keamanan/kebijakan-sandi");
    await expect(simpanKebijakanSandi(db, { panjangMin: 3 }, "usr-super")).rejects.toThrow(/Panjang minimal sandi harus bilangan bulat 6-64/);
    await expect(simpanKebijakanSandi(db, { riwayatN: 99 }, "usr-super")).rejects.toThrow(/0-24/);
    await expect(simpanKebijakanSandi(db, { masaBerlakuHari: -1 }, "usr-super")).rejects.toThrow(/0-730/);
  });
});

// ─── 5. rute ────────────────────────────────────────────────────────────────

describe("rute kebijakan sandi", () => {
  it("Admin membaca (403 untuk peran lain), hanya Super Admin mengubah, perubahan tercatat di audit", async () => {
    const { GET, POST } = await import("@/app/api/admin/keamanan/sandi/route");
    expect((await GET(minta("/api/admin/keamanan/sandi", { aktor: "usr-hakim" }))).status).toBe(403);
    const baca = await GET(minta("/api/admin/keamanan/sandi", { aktor: "usr-admin" }));
    expect(baca.status).toBe(200);
    expect((await baca.json()).data.kebijakan).toMatchObject({ aktif: false, panjangMin: 8 });

    expect((await POST(minta("/api/admin/keamanan/sandi", { method: "POST", aktor: "usr-admin", badan: { aktif: true } }))).status).toBe(403);
    expect((await POST(minta("/api/admin/keamanan/sandi", { method: "POST", aktor: "usr-hakim", badan: { aktif: true } }))).status).toBe(403);
    const buruk = await POST(minta("/api/admin/keamanan/sandi", { method: "POST", aktor: "usr-super", badan: { panjangMin: 2 } }));
    expect(buruk.status).toBe(400);
    const baik = await POST(minta("/api/admin/keamanan/sandi", { method: "POST", aktor: "usr-super", badan: { aktif: true, panjangMin: 10 } }));
    expect(baik.status).toBe(200);
    expect((await baik.json()).data.kebijakan).toMatchObject({ aktif: true, panjangMin: 10 });
    const audit = await db.queryOne<{ action: string }>("SELECT action FROM audit_logs WHERE action = 'SECURITY_PASSWORD_POLICY_UPDATE'", []);
    expect(audit?.action).toBe("SECURITY_PASSWORD_POLICY_UPDATE");
  });

  it("paksa ganti: hanya Super Admin; akun muncul di daftar; dapat dibatalkan", async () => {
    await nyalakan({ tolakUmum: false });
    const { POST } = await import("@/app/api/admin/keamanan/sandi/paksa-ganti/route");
    const { wajibGantiSandi } = await import("@/server/modules/keamanan/kebijakan-sandi");
    expect((await POST(minta("/api/admin/keamanan/sandi/paksa-ganti", { method: "POST", aktor: "usr-admin", badan: { userId: "usr-hakim" } }))).status).toBe(403);
    const r = await POST(minta("/api/admin/keamanan/sandi/paksa-ganti", { method: "POST", aktor: "usr-super", badan: { userId: "usr-hakim" } }));
    expect(r.status).toBe(200);
    expect((await r.json()).data.belumMemenuhi.find((a: { userId: string }) => a.userId === "usr-hakim")?.alasan).toBe("dipaksa");
    expect((await wajibGantiSandi(db, "usr-hakim")).wajib).toBe(true);
    await POST(minta("/api/admin/keamanan/sandi/paksa-ganti", { method: "POST", aktor: "usr-super", badan: { userId: "usr-hakim", paksa: false } }));
    expect((await wajibGantiSandi(db, "usr-hakim")).wajib).toBe(false);
    expect((await POST(minta("/api/admin/keamanan/sandi/paksa-ganti", { method: "POST", aktor: "usr-super", badan: { userId: "usr-tidak-ada" } }))).status).toBe(404);
  });

  it("ganti sandi sendiri: tanpa sesi 401; sandi lama keliru 400; aturan ditegakkan; berhasil menghapus paksaan", async () => {
    await nyalakan({ tolakUmum: false });
    const { setPaksaGanti, wajibGantiSandi } = await import("@/server/modules/keamanan/kebijakan-sandi");
    await setPaksaGanti(db, "usr-hakim", true, "usr-super");
    const { POST } = await import("@/app/api/keamanan/ganti-sandi/route");
    const kirim = (badan: unknown, aktor = "usr-hakim") => POST(minta("/api/keamanan/ganti-sandi", { method: "POST", aktor, badan }));
    expect((await POST(minta("/api/keamanan/ganti-sandi", { method: "POST", badan: { sandiLama: "hakim123", sandiBaru: "Baru6segar" } }))).status).toBe(401);
    expect((await kirim({ sandiLama: "salah", sandiBaru: "Baru6segar" })).status).toBe(400);
    expect((await kirim({ sandiLama: "hakim123", sandiBaru: "lemah" })).status).toBe(400);
    expect((await kirim({ sandiLama: "hakim123", sandiBaru: "hakim123" })).status).toBe(400);
    expect((await wajibGantiSandi(db, "usr-hakim")).wajib).toBe(true);
    const ok = await kirim({ sandiLama: "hakim123", sandiBaru: "Baru6segar" });
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toMatchObject({ diganti: true, masihWajib: false });
    const { hashSecret } = await import("@/server/shared/security");
    expect((await db.queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = 'usr-hakim'", []))?.password_hash).toBe(hashSecret("Baru6segar"));
  });
});

// ─── 6. daftar sandi umum ───────────────────────────────────────────────────

describe("pendeteksi sandi umum", () => {
  it("menangkap yang lazim tanpa menolak sandi acak", async () => {
    const { sandiTerlaluUmum } = await import("@/server/modules/keamanan/sandi-umum");
    for (const s of ["123456", "Password1", "qwerty", "aaaaaaaa", "abcdefgh", "87654321", "Admin@123", "Donggala2026", "Bismillah123"]) expect(sandiTerlaluUmum(s), s).toBe(true);
    for (const s of ["Tm9#Rkw41pZ", "kuda-biru-7-melompat", "R7vL2xQe9a"]) expect(sandiTerlaluUmum(s), s).toBe(false);
  });
});
