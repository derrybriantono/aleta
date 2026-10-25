// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import { BATAS_NILAI_SIDANG, BATAS_SIDANG, KODE_FITUR_ISIAN_SIDANG, bersihkanMasukanSidang, kodeSidang } from "@/lib/isian-sidang";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ISIAN_SIDANG } from "@/server/db/schema";
import { bacaIsianSidang, isianSidangAktif, simpanIsianSidang } from "@/server/modules/aleta-ecourt/isian-sidang";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI D, BUTIR D6: ISIAN BAS PER SIDANG (U12)
 * ============================================================================
 *
 * pg-mem + rute HTTP sungguhan; data rekaan. Yang dijaga:
 *   1. migrasi 0103 = DDL schema.ts, jurnal idx 92 (tanpa lubang), ikut cadangan; saklar bawaan MATI
 *   2. pembersih masukan: sidang 1..99, nomor isian, kata ALETA, panjang
 *   3. saklar mati: tidak menulis, tidak membaca
 *   4. satu baris per (perkara, sidang, nomor variabel); sidang dan perkara terpisah; kosong ikut disimpan; aleta_isian_perkara tidak tersentuh
 *   5. hak per peran di rute
 * Perilaku ekstensi (menulis sementara ke ABT lalu memulihkan) diuji di isian-per-sidang-ekstensi-25okt.test.ts.
 */

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-panitera";

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

async function nyalakan(d: AletaDatabase, menyala = true) {
  await tulisSetelanSistem(d, KUNCI_FITUR_SATKER, { fitur: menyala ? { [KODE_FITUR_ISIAN_SIDANG]: "stabil" } : {}, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());
}

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };
async function panggil(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul = await import("@/app/api/aleta-ecourt/isian-sidang/route");
  const req = new NextRequest("http://localhost/api/aleta-ecourt/isian-sidang" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const jawaban = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

const masukan = (tambah: Record<string, unknown> = {}) => ({ perkaraId: "10018", nomorPerkara: "533/Pdt.G/2026/PA.Dgl", sidang: 2, kode: "0007", nilai: "dikaruniai 2 orang anak", ...tambah });

describe("migrasi 0103 - berkas = DDL schema.ts, jurnal idx 92, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0103_aleta_isian_sidang.sql");

  it("jurnal: 0103 sekali di idx 92 tepat sesudah 0102, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0103_"))).toEqual([expect.objectContaining({ idx: 92, tag: "0103_aleta_isian_sidang" })]);
    expect(j.entries[83]?.tag).toBe("0102_aleta_blangko_lapor");
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_ISIAN_SIDANG, berjalan di pg-mem, kolom bawaan benar, kunci unik; tabel ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_ISIAN_SIDANG.tabel, ...DDL_ISIAN_SIDANG.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(isiSql);
    kosong.public.none(`INSERT INTO aleta_isian_sidang (id, perkara_id, sidang, no_var, diisi_at, diubah_at) VALUES ('a', 'p', 2, '0007', 'x', 'x')`);
    expect(kosong.public.one(`SELECT nilai, diisi_oleh FROM aleta_isian_sidang`)).toEqual({ nilai: "", diisi_oleh: "" });
    expect(() => kosong.public.none(`INSERT INTO aleta_isian_sidang (id, perkara_id, sidang, no_var, diisi_at, diubah_at) VALUES ('b', 'p', 2, '0007', 'x', 'x')`)).toThrow();
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_isian_sidang");
  });

  it("saklar katalog Fitur Satker: kode isian-per-sidang, bawaan MATI", () => {
    expect(KATALOG_FITUR_SATKER.find((f) => f.kode === KODE_FITUR_ISIAN_SIDANG)).toMatchObject({ bawaan: "mati", bagian: "portal" });
    expect(keadaanFitur(KODE_FITUR_ISIAN_SIDANG, {})).toMatchObject({ menyala: false, status: "mati" });
  });
});

describe("pembersih masukan", () => {
  it("nomor isian dirapikan; sidang 1..99; perkara wajib; kata ALETA dan nilai terlalu panjang ditolak", () => {
    expect(kodeSidang("7")).toBe("0007");
    expect(kodeSidang("9134")).toBe("9134");
    expect(kodeSidang("12345")).toBe("12345");
    expect(kodeSidang("a1")).toBe("0001");
    expect(bersihkanMasukanSidang(masukan({ kode: "7" }))).toEqual({ perkaraId: "10018", nomorPerkara: "533/Pdt.G/2026/PA.Dgl", sidang: 2, kode: "0007", nilai: "dikaruniai 2 orang anak" });
    expect(bersihkanMasukanSidang(masukan({ sidang: 0 }))).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSidang(masukan({ sidang: BATAS_SIDANG + 1 }))).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSidang(masukan({ sidang: "3" }))).toMatchObject({ sidang: 3 });
    expect(bersihkanMasukanSidang(masukan({ perkaraId: "" }))).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSidang(masukan({ kode: "" }))).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSidang(masukan({ nilai: "x".repeat(BATAS_NILAI_SIDANG + 1) }))).toMatchObject({ ditolak: true });
    for (const kata of ["ditulis ALETA", "A L E T A"]) expect(bersihkanMasukanSidang(masukan({ nilai: kata })), kata).toMatchObject({ ditolak: true });
    expect(bersihkanMasukanSidang(masukan({ nilai: "  " }))).toMatchObject({ nilai: "" });
    expect(bersihkanMasukanSidang(null)).toMatchObject({ ditolak: true });
  });
});

describe("penyimpanan isian per sidang (pg-mem)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-panitera";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati (bawaan): tidak menulis dan tidak membaca", async () => {
    expect(await isianSidangAktif(db!)).toBe(false);
    expect(await simpanIsianSidang(db!, { id: "usr-panitera", nama: "PP" }, masukan())).toEqual({ aktif: false, disimpan: false, sebab: "" });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_sidang`)).toEqual([]);
    await nyalakan(db!);
    await simpanIsianSidang(db!, { id: "usr-panitera", nama: "PP" }, masukan());
    await nyalakan(db!, false);
    expect(await bacaIsianSidang(db!, "10018", 2)).toEqual([]);
  });

  it("satu baris per (perkara, sidang, nomor variabel): sidang berbeda tidak saling menimpa; nilai terakhir menang; sama = tanpa tulis", async () => {
    await nyalakan(db!);
    const pp = { id: "usr-panitera", nama: "PP Satu" };
    expect(await simpanIsianSidang(db!, pp, masukan({ sidang: 1, nilai: "satu anak" }))).toEqual({ aktif: true, disimpan: true, sebab: "" });
    expect(await simpanIsianSidang(db!, pp, masukan({ sidang: 2, nilai: "dua anak" }))).toMatchObject({ disimpan: true });
    expect((await bacaIsianSidang(db!, "10018", 1))[0]).toMatchObject({ kode: "0007", nilai: "satu anak" });
    expect((await bacaIsianSidang(db!, "10018", 2))[0]).toMatchObject({ kode: "0007", nilai: "dua anak" });
    expect(await bacaIsianSidang(db!, "10018", 3)).toEqual([]);
    expect(await bacaIsianSidang(db!, "10019", 2)).toEqual([]);

    expect(await simpanIsianSidang(db!, pp, masukan({ sidang: 2, nilai: "dua anak" }))).toMatchObject({ disimpan: false, sebab: "Sudah sama." });
    expect(await simpanIsianSidang(db!, { id: "usr-hakim", nama: "Hakim" }, masukan({ sidang: 2, nilai: "tiga anak" }))).toMatchObject({ disimpan: true });
    const baris = await db!.queryAll<Record<string, unknown>>(`SELECT sidang, nilai, diisi_oleh, diubah_oleh FROM aleta_isian_sidang WHERE sidang = 2`);
    expect(baris).toEqual([{ sidang: 2, nilai: "tiga anak", diisi_oleh: "PP Satu", diubah_oleh: "Hakim" }]);
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_sidang`)).toHaveLength(2);
  });

  it("nilai kosong ikut disimpan bila sebelumnya berisi (dikosongkan sengaja), tetapi tidak membuat baris baru", async () => {
    await nyalakan(db!);
    const pp = { id: "usr-panitera", nama: "PP" };
    expect(await simpanIsianSidang(db!, pp, masukan({ nilai: "" }))).toMatchObject({ disimpan: false, sebab: "Kosong dan belum pernah diingat." });
    await simpanIsianSidang(db!, pp, masukan());
    expect(await simpanIsianSidang(db!, pp, masukan({ nilai: "" }))).toMatchObject({ disimpan: true });
    expect(await bacaIsianSidang(db!, "10018", 2)).toEqual([expect.objectContaining({ kode: "0007", nilai: "" })]);
  });

  it("aleta_isian_perkara (isian Kelas B blangko ALETA) tidak tersentuh", async () => {
    await nyalakan(db!);
    await simpanIsianSidang(db!, { id: "usr-panitera", nama: "PP" }, masukan());
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_perkara`)).toEqual([]);
  });

  it("aktor tanpa nama dan tanpa id ditolak; kata ALETA tidak disimpan", async () => {
    await nyalakan(db!);
    expect(await simpanIsianSidang(db!, { id: "", nama: "" }, masukan())).toMatchObject({ aktif: true, disimpan: false });
    expect(await simpanIsianSidang(db!, { id: "usr-panitera", nama: "PP" }, masukan({ nilai: "ditulis Aleta" }))).toMatchObject({ disimpan: false });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_sidang`)).toEqual([]);
  });
});

describe("rute isian-sidang", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-panitera";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati: saklar -> aktif:false; POST tidak menulis; GET kosong", async () => {
    expect((await panggil("GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: false });
    expect((await panggil("POST", { badan: masukan() })).isi.data).toMatchObject({ aktif: false, disimpan: false });
    expect((await panggil("GET", { query: "perkaraId=10018&sidang=2" })).isi.data).toEqual({ aktif: false, isian: [] });
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_sidang`)).toEqual([]);
  });

  it("saklar menyala: POST menyimpan; GET mengembalikan per sidang; sidang/perkara tak disebut -> kosong", async () => {
    await nyalakan(db!);
    expect((await panggil("GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: true });
    expect((await panggil("POST", { badan: masukan() })).isi.data).toMatchObject({ aktif: true, disimpan: true });
    const g = await panggil("GET", { query: "perkaraId=10018&sidang=2" });
    expect(g.isi.data).toMatchObject({ aktif: true, isian: [expect.objectContaining({ kode: "0007", nilai: "dikaruniai 2 orang anak" })] });
    expect((await panggil("GET", { query: "perkaraId=10018&sidang=1" })).isi.data.isian).toEqual([]);
    expect((await panggil("GET", { query: "perkaraId=10018" })).isi.data.isian).toEqual([]);
    expect((await panggil("POST", { badan: masukan({ sidang: 0 }) })).isi.data).toMatchObject({ disimpan: false, sebab: "Sidang tidak sah." });
  });

  it("hak per peran: tanpa 'blangko-abt' ditolak 403; saklar boleh ditanya siapa pun yang masuk; tanpa masuk 401", async () => {
    await nyalakan(db!);
    aktor = "usr-bendahara";
    expect((await panggil("POST", { badan: masukan() })).status).toBe(403);
    expect((await panggil("GET", { query: "perkaraId=10018&sidang=2" })).status).toBe(403);
    expect((await panggil("GET", { query: "bagian=saklar" })).status).toBe(200);
    aktor = "usr-panitera";
    expect((await panggil("POST", { badan: masukan() })).status).toBe(200);
    expect((await panggil("GET", { query: "perkaraId=10018&sidang=2" })).status).toBe(200);
    aktor = null;
    expect((await panggil("POST", { badan: masukan() })).status).toBe(401);
    expect(await db!.queryAll(`SELECT id FROM aleta_isian_sidang`)).toHaveLength(1);
  });
});
