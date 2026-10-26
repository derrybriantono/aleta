// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FITUR_KATALOG_SAKSI_DB, KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_SAKSI_KATALOG } from "@/server/db/schema";
import {
  aktifkanVersi,
  bacaBawaan,
  bacaPenyunting,
  bolehMenyuntingKatalog,
  daftarKatalog,
  indeksEfektif,
  isiEfektif,
  kembaliKeBawaan,
  kunciBawaan,
  periksaIsi,
  pratinjauKatalog,
  riwayatKatalog,
  simpanPenyunting,
  simpanVersi,
} from "@/server/modules/aleta-ecourt/saksi-katalog-db";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI C, C4 (U8): KATALOG SAKSI DI BASIS DATA DENGAN VERSI
 * ============================================================================
 *
 * pg-mem + rute HTTP sungguhan + pemuat ekstensi di jsdom; data rekaan. Yang dijaga:
 *   1. migrasi 0093 = DDL schema.ts, jurnal idx 84 tanpa lubang, ikut cadangan, saklar bawaan MATI
 *   2. saklar mati: portal menjawab aktif:false (ekstensi memakai JSON tertanam), tidak menyajikan penimpa
 *   3. hak menyunting: Super Admin atau akun terdaftar; admin biasa dan hakim ditolak; hanya Super Admin mengatur daftar
 *   4. pemeriksaan: katalog rusak / memuat kata "Aleta" / kunci tidak cocok ditolak; yang sah lolos; pratinjau menyusun
 *   5. versi: simpan -> versi naik, aktifkan, riwayat tidak pernah hilang, kembali ke bawaan, draf tidak berlaku
 *   6. penyajian: indeks efektif tanpa penimpa = indeks tertanam; dengan penimpa hanya kunci itu berganti
 *   7. ekstensi: pemuat memakai portal bila saklar menyala (versiKatalog "dbN"), jatuh ke JSON tertanam bila portal
 *      mati / galat / isi aneh; saklar mati = persis seperti sebelumnya
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
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

async function nyalakan(d: AletaDatabase) {
  await tulisSetelanSistem(d, KUNCI_FITUR_SATKER, { fitur: { [FITUR_KATALOG_SAKSI_DB]: "stabil" }, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());
}

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };
async function panggil(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul = await import("@/app/api/aleta-ecourt/saksi-katalog/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const jawaban = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

const SUPER = { id: "usr-super", name: "Super Admin", roleId: "super-admin" };
const ADMIN = { id: "usr-admin", name: "Admin", roleId: "admin" };
const HAKIM = { id: "usr-hakim", name: "Hakim", roleId: "hakim" };

const sunting = (kunci: string, judul: string) => {
  const dasar = JSON.parse(JSON.stringify(bacaBawaan(kunci))) as Record<string, unknown>;
  return { ...dasar, judul };
};

// ─── 1. Migrasi, jurnal, saklar ──────────────────────────────────────────────

describe("migrasi 0093 - berkas = DDL schema.ts, jurnal idx 84, ikut cadangan, saklar mati", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0093_aleta_saksi_katalog.sql");

  it("jurnal: 0093 sekali di idx 84 (sesudah 0092), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0093_"))).toEqual([expect.objectContaining({ idx: 84, tag: "0093_aleta_saksi_katalog" })]);
    expect(j.entries[83]?.tag.startsWith("0092_")).toBe(true);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_SAKSI_KATALOG, berjalan di pg-mem; kedua tabel ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_SAKSI_KATALOG.tabel, ...DDL_SAKSI_KATALOG.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(isiSql);
    expect(kosong.public.many(`SELECT * FROM aleta_saksi_katalog`)).toEqual([]);
    kosong.public.none(`INSERT INTO aleta_saksi_katalog_versi (id, kunci, versi, isi_json, dibuat_at) VALUES ('a', 'k', 1, '{}', 'x')`);
    expect(() => kosong.public.none(`INSERT INTO aleta_saksi_katalog_versi (id, kunci, versi, isi_json, dibuat_at) VALUES ('b', 'k', 1, '{}', 'x')`)).toThrow();
    for (const t of ["aleta_saksi_katalog", "aleta_saksi_katalog_versi"]) expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
  });

  it("saklar katalog-saksi-basis-data: bawaan MATI, bagian portal", () => {
    expect(KATALOG_FITUR_SATKER.find((f) => f.kode === FITUR_KATALOG_SAKSI_DB)).toMatchObject({ bawaan: "mati", bagian: "portal" });
    expect(keadaanFitur(FITUR_KATALOG_SAKSI_DB, {})).toMatchObject({ menyala: false });
  });
});

// ─── 2 sampai 6. Server ──────────────────────────────────────────────────────

describe("katalog saksi di basis data - modul dan rute", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati: indeks dan isi menjawab aktif:false, tanpa penimpa, walau versi tersimpan", async () => {
    await simpanVersi(db!, SUPER, { kunci: "cerai-gugat", isi: sunting("cerai-gugat", "Cerai Gugat (suntingan uji)") });
    const i = await panggil("GET", { query: "bagian=indeks" });
    expect(i.status).toBe(200);
    expect(i.isi.data).toEqual({ aktif: false, indeks: [] });
    expect((await panggil("GET", { query: "kunci=cerai-gugat" })).isi.data).toEqual({ aktif: false, kunci: "cerai-gugat" });
  });

  it("hak: peran tanpa kemampuan ekstensi ditolak; hakim boleh membaca tetapi tidak menyunting; admin biasa tidak menyunting", async () => {
    await nyalakan(db!);
    aktor = "usr-bendahara";
    expect((await panggil("GET", { query: "bagian=indeks" })).status).toBe(403);
    aktor = "usr-hakim";
    expect((await panggil("GET", { query: "bagian=indeks" })).status).toBe(200);
    expect((await panggil("GET", { query: "bagian=daftar" })).status).toBe(403);
    expect((await panggil("POST", { badan: { aksi: "simpan", kunci: "cerai-gugat", isi: sunting("cerai-gugat", "x") } })).status).toBe(403);
    aktor = "usr-admin";
    expect((await panggil("GET", { query: "bagian=daftar" })).status).toBe(403);
    expect((await panggil("POST", { badan: { aksi: "penyunting", akun: ["usr-admin"] } })).status).toBe(403);
    aktor = null;
    expect((await panggil("GET", { query: "bagian=indeks" })).status).toBe(401);
  });

  it("penyunting terdaftar: hanya Super Admin yang mengatur daftar; akun terdaftar lalu boleh menyunting", async () => {
    await expect(simpanPenyunting(db!, ADMIN, ["usr-admin"])).rejects.toMatchObject({ status: 403 });
    expect(await simpanPenyunting(db!, SUPER, ["usr-hakim", "usr-hakim", "  "])).toEqual(["usr-hakim"]);
    expect(await bacaPenyunting(db!)).toEqual(["usr-hakim"]);
    expect(await bolehMenyuntingKatalog(db!, HAKIM)).toBe(true);
    expect(await bolehMenyuntingKatalog(db!, ADMIN)).toBe(false);
    expect(await bolehMenyuntingKatalog(db!, SUPER)).toBe(true);
    await expect(simpanPenyunting(db!, SUPER, "bukan larik")).rejects.toMatchObject({ status: 400 });
    aktor = "usr-hakim";
    const r = await panggil("POST", { badan: { aksi: "simpan", kunci: "cerai-gugat", isi: sunting("cerai-gugat", "Disunting hakim") } });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ kunci: "cerai-gugat", versi: 1, aktif: true });
    const log = await db!.queryAll<Record<string, unknown>>(`SELECT action FROM audit_logs WHERE action LIKE '%KATALOG_SAKSI%' ORDER BY action`);
    expect(log.map((l) => l.action)).toEqual(["SIMPAN_VERSI_KATALOG_SAKSI", "UPDATE_PENYUNTING_KATALOG_SAKSI"]);
  });

  it("pemeriksaan: JSON rusak, bukan objek, kunci tidak cocok, kata Aleta, dan katalog yang gagal periksaKatalog ditolak; yang sah lolos dan bisa dipratinjau", () => {
    expect(periksaIsi("{bukan json").ok).toBe(false);
    expect(periksaIsi([1, 2]).ok).toBe(false);
    expect(periksaIsi(sunting("cerai-gugat", "x"), "wakaf").galat.join(" ")).toContain("harus sama");
    const aleta = periksaIsi(sunting("cerai-gugat", "Disusun oleh Aleta"), "cerai-gugat");
    expect(aleta.ok).toBe(false);
    expect(aleta.galat.join(" ")).toContain("Aleta");
    const rusak = { ...(bacaBawaan("cerai-gugat") as Record<string, unknown>), pertanyaan: "bukan larik" };
    expect(periksaIsi(rusak, "cerai-gugat").ok).toBe(false);
    const sah = periksaIsi(JSON.stringify(sunting("cerai-gugat", "Cerai Gugat uji")), "cerai-gugat");
    expect(sah.ok).toBe(true);
    expect(sah.sidik).toMatch(/^[0-9a-f]{16}$/);
    const p = pratinjauKatalog(sah.katalog!);
    expect(p.saksi).toHaveLength(2);
    expect(p.saksi[0]!.baris.length).toBeGreaterThan(0);
    expect(periksaIsi("x".repeat(3_100_000)).ok).toBe(false);
  });

  it("simpan menolak katalog tidak sah dan tidak menulis apa pun", async () => {
    await expect(simpanVersi(db!, SUPER, { kunci: "cerai-gugat", isi: sunting("cerai-gugat", "Aleta") })).rejects.toMatchObject({ status: 400 });
    await expect(simpanVersi(db!, SUPER, { kunci: "Tidak Sah", isi: sunting("cerai-gugat", "x") })).rejects.toMatchObject({ status: 400 });
    await expect(simpanVersi(db!, ADMIN, { kunci: "cerai-gugat", isi: sunting("cerai-gugat", "x") })).rejects.toMatchObject({ status: 403 });
    expect(await db!.queryAll(`SELECT id FROM aleta_saksi_katalog_versi`)).toEqual([]);
    expect(await db!.queryAll(`SELECT kunci FROM aleta_saksi_katalog`)).toEqual([]);
  });

  it("versi: simpan menaikkan versi, draf tidak berlaku, aktifkan memulihkan, kembali ke bawaan, riwayat tidak pernah hilang", async () => {
    const v1 = await simpanVersi(db!, SUPER, { kunci: "cerai-gugat", isi: sunting("cerai-gugat", "Versi satu"), catatan: "perbaikan q-kenal" });
    const v2 = await simpanVersi(db!, SUPER, { kunci: "cerai-gugat", isi: sunting("cerai-gugat", "Versi dua"), dasarVersi: 1 });
    const draf = await simpanVersi(db!, SUPER, { kunci: "cerai-gugat", isi: sunting("cerai-gugat", "Versi tiga draf"), aktifkan: false });
    expect([v1.versi, v2.versi, draf.versi]).toEqual([1, 2, 3]);
    expect([v1.aktif, v2.aktif, draf.aktif]).toEqual([true, true, false]);
    expect((await isiEfektif(db!, "cerai-gugat"))?.isi.judul).toBe("Versi dua");
    expect(await isiEfektif(db!, "cerai-gugat")).toMatchObject({ sumber: "basis-data", versiDb: 2 });

    await aktifkanVersi(db!, SUPER, "cerai-gugat", 1);
    expect((await isiEfektif(db!, "cerai-gugat"))?.isi.judul).toBe("Versi satu");
    await expect(aktifkanVersi(db!, SUPER, "cerai-gugat", 9)).rejects.toMatchObject({ status: 404 });

    await kembaliKeBawaan(db!, SUPER, "cerai-gugat");
    expect(await isiEfektif(db!, "cerai-gugat")).toMatchObject({ sumber: "bawaan", versiDb: 0 });
    expect((await isiEfektif(db!, "cerai-gugat"))?.isi).toEqual(bacaBawaan("cerai-gugat"));
    expect(await kembaliKeBawaan(db!, SUPER, "wakaf")).toEqual({ kunci: "wakaf", versi: 0 });

    const r = await riwayatKatalog(db!, "cerai-gugat");
    expect(r.map((x) => x.versi).sort()).toEqual([1, 2, 3]);
    expect(r.every((x) => !x.aktif)).toBe(true);
    expect(r.find((x) => x.versi === 1)?.catatan).toBe("perbaikan q-kenal");
    expect(r.find((x) => x.versi === 2)?.dasarVersi).toBe(1);
    const d = (await daftarKatalog(db!)).find((x) => x.kunci === "cerai-gugat");
    expect(d).toMatchObject({ sumber: "bawaan", versiDb: 0, jumlahVersi: 3, adaBawaan: true });
    expect((await daftarKatalog(db!)).map((x) => x.kunci)).toEqual(kunciBawaan());
  });

  it("indeks efektif: tanpa penimpa = indeks tertanam; dengan penimpa hanya kunci itu berganti (sumber basis-data)", async () => {
    await nyalakan(db!);
    const dasar = (await panggil("GET", { query: "bagian=indeks" })).isi.data;
    expect(dasar.aktif).toBe(true);
    const tertanam = new Function("globalThis", `${readFileSync(path.resolve(__dirname, "../../../ekstensi-sipp/saksi-katalog-indeks.js"), "utf8")}; return globalThis.ALETA_SAKSI_KATALOG_INDEKS;`)({}) as Array<Record<string, any>>;
    const efektif = dasar.indeks as Array<Record<string, any>>;
    expect(efektif.map((k) => k.kunci)).toEqual(tertanam.filter((k) => k.contoh !== true).map((k) => k.kunci));
    expect(efektif.every((k) => k.sumber === "bawaan" && k.versiDb === 0)).toBe(true);
    for (const k of efektif) {
      const asli = tertanam.find((t) => t.kunci === k.kunci)!;
      expect(k.syarat).toEqual(asli.syarat);
      expect(k.kodeVariabel).toEqual(asli.kodeVariabel);
    }

    await simpanVersi(db!, SUPER, { kunci: "cerai-gugat", isi: sunting("cerai-gugat", "Cerai Gugat versi basis data") });
    const lalu = await indeksEfektif(db!);
    expect(lalu.find((k) => k.kunci === "cerai-gugat")).toMatchObject({ sumber: "basis-data", versiDb: 1, judul: "Cerai Gugat versi basis data" });
    expect(lalu.filter((k) => k.sumber === "basis-data").map((k) => k.kunci)).toEqual(["cerai-gugat"]);

    const isi = await panggil("GET", { query: "kunci=cerai-gugat" });
    expect(isi.isi.data).toMatchObject({ aktif: true, sumber: "basis-data", versiDb: 1 });
    expect(isi.isi.data.isi.judul).toBe("Cerai Gugat versi basis data");
    expect((await panggil("GET", { query: "kunci=tidak-ada" })).status).toBe(404);
    expect((await panggil("GET", { query: "bagian=daftar" })).isi.data).toMatchObject({ aktif: true });
  });

  it("katalog baru (tanpa bawaan) ikut disajikan; rute POST: periksa, pratinjau, simpan, aktifkan, bawaan", async () => {
    await nyalakan(db!);
    const baru = { ...sunting("cerai-gugat", "Katalog Uji Baru"), kunci: "uji-baru-c4" };
    const p = await panggil("POST", { badan: { aksi: "periksa", kunci: "uji-baru-c4", isi: baru } });
    expect(p.isi.data).toMatchObject({ ok: true, galat: [] });
    const pr = await panggil("POST", { badan: { aksi: "pratinjau", kunci: "uji-baru-c4", isi: JSON.stringify(baru) } });
    expect(pr.isi.data.pratinjau.saksi).toHaveLength(2);
    const s = await panggil("POST", { badan: { aksi: "simpan", kunci: "uji-baru-c4", isi: baru, aktifkan: false } });
    expect(s.isi.data).toMatchObject({ versi: 1, aktif: false });
    expect((await indeksEfektif(db!)).some((k) => k.kunci === "uji-baru-c4")).toBe(false);
    expect((await panggil("POST", { badan: { aksi: "aktifkan", kunci: "uji-baru-c4", versi: 1 } })).isi.data).toEqual({ kunci: "uji-baru-c4", versi: 1 });
    expect((await indeksEfektif(db!)).find((k) => k.kunci === "uji-baru-c4")).toMatchObject({ sumber: "basis-data", versiDb: 1 });
    expect((await panggil("GET", { query: "bagian=isi&kunci=uji-baru-c4&versi=1" })).isi.data.isi.judul).toBe("Katalog Uji Baru");
    expect((await panggil("GET", { query: "bagian=riwayat&kunci=uji-baru-c4" })).isi.data.riwayat).toHaveLength(1);
    expect((await panggil("GET", { query: "bagian=isi&kunci=cerai-gugat&versi=0" })).isi.data.isi).toEqual(bacaBawaan("cerai-gugat"));
    expect((await panggil("GET", { query: "bagian=isi&kunci=uji-baru-c4&versi=7" })).status).toBe(404);
    await panggil("POST", { badan: { aksi: "bawaan", kunci: "uji-baru-c4" } });
    expect(await isiEfektif(db!, "uji-baru-c4")).toBeNull();
    expect((await panggil("POST", { badan: { aksi: "tak-dikenal" } })).status).toBe(400);
  });
});

// ─── 7. Pemuat ekstensi ──────────────────────────────────────────────────────

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8");
const halaman: JSDOM[] = [];

type Portal = (alamat: string) => Promise<Response | null>;
function bukaDunia(portal: Portal) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/aps_badilag/index.php/abt/main/view", runScripts: "outside-only" });
  halaman.push(dom);
  const w = dom.window as any;
  const diminta: string[] = [];
  const portalDiminta: string[] = [];
  w.chrome = { runtime: { getURL: (p: string) => `chrome-extension://uji/${p}` } };
  w.fetch = async (alamat: string) => {
    if (String(alamat).includes("/aleta/api/")) {
      portalDiminta.push(String(alamat));
      return (await portal(String(alamat))) ?? new Response("", { status: 404 });
    }
    const berkas = String(alamat).replace("chrome-extension://uji/", "");
    diminta.push(berkas);
    const lokal = path.join(AKAR, berkas);
    return existsSync(lokal) ? new Response(readFileSync(lokal, "utf8"), { status: 200 }) : new Response("", { status: 404 });
  };
  w.eval([baca("saksi-katalog.js"), baca("saksi-katalog-indeks.js"), baca("saksi-katalog-muat.js")].join("\n;\n"));
  return { w, diminta, portalDiminta };
}
afterEach(async () => {
  await new Promise((s) => setTimeout(s, 20));
  while (halaman.length) halaman.pop()!.window.close();
});

/** Portal sungguhan: rute memakai basis data uji; jawaban dibungkus seperti respons HTTP. */
const portalSungguhan: Portal = async (alamat) => {
  const q = alamat.split("?")[1] ?? "";
  const j = await panggil("GET", { query: q });
  return new Response(JSON.stringify({ ok: j.isi.ok, data: j.isi.data }), { status: j.status });
};

const PERKARA = { jenisPerkaraId: "347", alurPerkaraId: "15", nama: "Cerai Gugat" };

describe("pemuat ekstensi dengan sumber portal", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("saklar mati: asal indeks 'bawaan', JSON tertanam dipakai, versiKatalog tetap angka lama", async () => {
    const d = bukaDunia(portalSungguhan);
    const M = d.w.AletaSaksiKatalogMuat;
    expect(await M.siapkan(PERKARA)).toBe(true);
    expect(M.asalIndeks()).toBe("bawaan");
    expect(d.portalDiminta).toHaveLength(1);
    expect(d.diminta.some((b: string) => b.endsWith("cerai-gugat.json"))).toBe(true);
    const kat = (d.w.ALETA_SAKSI_KATALOG_DATA as Array<Record<string, any>>).find((k) => k.kunci === "cerai-gugat")!;
    expect(kat.versiKatalog).toBeUndefined();
    expect(kat.judul).toBe(bacaBawaan("cerai-gugat")!.judul);
  });

  it("saklar menyala tanpa penimpa: indeks dari portal, isi tetap dari JSON tertanam (sumber bawaan)", async () => {
    await nyalakan(db!);
    const d = bukaDunia(portalSungguhan);
    const M = d.w.AletaSaksiKatalogMuat;
    expect(await M.siapkan(PERKARA)).toBe(true);
    expect(M.asalIndeks()).toBe("portal");
    expect(d.diminta.some((b: string) => b.endsWith("cerai-gugat.json"))).toBe(true);
    expect(d.portalDiminta.every((a: string) => a.includes("bagian=indeks"))).toBe(true);
  });

  it("saklar menyala + versi aktif: isi dari portal, versiKatalog 'db1', JSON tertanam kunci itu TIDAK dipakai", async () => {
    await nyalakan(db!);
    await simpanVersi(db!, SUPER, { kunci: "cerai-gugat", isi: sunting("cerai-gugat", "Cerai Gugat dari basis data") });
    const d = bukaDunia(portalSungguhan);
    const M = d.w.AletaSaksiKatalogMuat;
    expect(await M.siapkan(PERKARA)).toBe(true);
    expect(M.asalIndeks()).toBe("portal");
    const kat = (d.w.ALETA_SAKSI_KATALOG_DATA as Array<Record<string, any>>).find((k) => k.kunci === "cerai-gugat")!;
    expect(kat.judul).toBe("Cerai Gugat dari basis data");
    expect(kat.versiKatalog).toBe("db1");
    expect(d.diminta.some((b: string) => b.endsWith("saksi-katalog-jenis/cerai-gugat.json"))).toBe(false);
    // paket lain (tambahan) tetap tersedia dari tertanam
    for (const k of M.paketKunci("cerai-gugat") as string[]) expect(M.sudahDimuat(k), k).toBe(true);
  });

  it("isi portal gagal diambil: jatuh ke JSON tertanam kunci yang sama", async () => {
    await nyalakan(db!);
    await simpanVersi(db!, SUPER, { kunci: "cerai-gugat", isi: sunting("cerai-gugat", "Cerai Gugat dari basis data") });
    const d = bukaDunia(async (alamat) => (alamat.includes("kunci=") ? new Response("", { status: 500 }) : portalSungguhan(alamat)));
    const M = d.w.AletaSaksiKatalogMuat;
    expect(await M.siapkan(PERKARA)).toBe(true);
    const kat = (d.w.ALETA_SAKSI_KATALOG_DATA as Array<Record<string, any>>).find((k) => k.kunci === "cerai-gugat")!;
    expect(kat.judul).toBe(bacaBawaan("cerai-gugat")!.judul);
    expect(kat.versiKatalog).toBeUndefined();
  });

  it("portal mati / galat jaringan / jawaban aneh: indeks tertanam, tidak melempar", async () => {
    await nyalakan(db!);
    for (const portal of [
      async () => {
        throw new Error("jaringan putus");
      },
      async () => new Response("<html>login</html>", { status: 200 }),
      async () => new Response(JSON.stringify({ data: { aktif: true, indeks: [{ kunci: 1 }] } }), { status: 200 }),
      async () => new Response(JSON.stringify({ data: { aktif: true, indeks: [] } }), { status: 200 }),
    ] as Portal[]) {
      const d = bukaDunia(portal);
      const M = d.w.AletaSaksiKatalogMuat;
      expect(await M.siapkan(PERKARA)).toBe(true);
      expect(M.asalIndeks()).toBe("bawaan");
      expect(M.ada()).toBe(true);
      expect(M.sudahDimuat("cerai-gugat")).toBe(true);
    }
  });

  it("ingatan: portal hanya ditanya sekali dalam jangka segar; segarkanPortal(true) memaksa tanya ulang", async () => {
    await nyalakan(db!);
    const d = bukaDunia(portalSungguhan);
    const M = d.w.AletaSaksiKatalogMuat;
    await M.siapkan(PERKARA);
    await M.siapkan({ jenisPerkaraId: "999999", alurPerkaraId: "15", nama: "Rekaan" });
    expect(d.portalDiminta.filter((a: string) => a.includes("bagian=indeks"))).toHaveLength(1);
    await M.segarkanPortal(true);
    expect(d.portalDiminta.filter((a: string) => a.includes("bagian=indeks"))).toHaveLength(2);
  });
});
