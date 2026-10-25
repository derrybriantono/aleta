// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BATAS_MUATAN_BITA, bersihkanMasukanAntrean, GalatAntrean } from "@/lib/antrean-peramban";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ANTREAN_PERAMBAN } from "@/server/db/schema";
import { sapuAntreanBasi } from "@/server/modules/aleta-ecourt/antrean-peramban";

/**
 * ============================================================================
 * K15 - ANTREAN KERJA PERAMBAN DI BASIS DATA, SISI SERVER (rantai B, 25 Okt 2026)
 * ============================================================================
 *   1. migrasi 0098 = DDL schema.ts, jurnal idx 81 tanpa lubang, tabel ikut cadangan;
 *   2. saklar kinerja.antreanDiServer mati (bawaan): tulisan ditolak halus, bacaan kosong, tidak ada baris;
 *   3. menyala: upsert, hanya milik pemanggil (pengguna dari sesi), akhiri idempoten, sapu antrean basi;
 *   4. masukan tidak sah ditolak 400; muatan dibatasi.
 */

const AKAR = path.resolve(__dirname, "../..");
const SQL = path.join(AKAR, "drizzle", "0098_aleta_antrean_peramban.sql");
const JURNAL = path.join(AKAR, "drizzle", "meta", "_journal.json");

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";
vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => db }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

async function antrean(cara: "GET" | "PUT" | "POST", badan?: unknown, query = "") {
  const modul = await import("@/app/api/aleta-ecourt/ekstensi/antrean/route");
  const req = new NextRequest(`http://localhost/api/x${query}`, {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const j = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: j.status, isi: (await j.json()) as any };
}
async function kinerja(badan: unknown) {
  const modul = await import("@/app/api/aleta-ecourt/ekstensi/kinerja/route");
  const j = await modul.PUT(new NextRequest("http://localhost/api/x", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) }));
  return j.status;
}
const nyalakan = async () => {
  const lama = aktor;
  aktor = "usr-super";
  expect(await kinerja({ antreanDiServer: true })).toBe(200);
  aktor = lama;
};
const MASUKAN = (ubah: Record<string, unknown> = {}) => ({
  jenis: "cetak-massal",
  kunci: "bas|2026-10-25",
  perangkat: "pc1",
  ringkas: "Cetak massal BAS 2026-10-25: 1 dari 2",
  selesai: 1,
  total: 2,
  muatan: { butir: [{ nomor: "581/Pdt.G/2026/PA.Dgl", status: "selesai" }, { nomor: "582/Pdt.G/2026/PA.Dgl", status: "menunggu" }] },
  ...ubah,
});

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-hakim";
});
afterEach(async () => {
  await db?.close();
  db = null;
});

describe("migrasi 0098", () => {
  it("jurnal idx 81 bertag 0098 sekali, tanpa lubang; berkas SQL ada", () => {
    const jurnal = JSON.parse(readFileSync(JURNAL, "utf8")) as { entries: { idx: number; tag: string }[] };
    jurnal.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(jurnal.entries.filter((e) => e.tag.startsWith("0098_"))).toEqual([expect.objectContaining({ idx: 81, tag: "0098_aleta_antrean_peramban" })]);
    expect(existsSync(SQL)).toBe(true);
  });

  it("DDL berkas SQL = DDL schema.ts pernyataan demi pernyataan; tabel ikut cadangan JSON dan benar-benar terbentuk", async () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual([...DDL_ANTREAN_PERAMBAN.tabel, ...DDL_ANTREAN_PERAMBAN.indeks].map((s) => pernyataan(s)[0]));
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_antrean_peramban");
    const kol = await db!.queryAll<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'aleta_antrean_peramban'");
    expect(kol.map((k) => k.column_name).sort()).toEqual(["diubah_pada", "dibuat_pada", "jenis", "kunci", "muatan_json", "pengguna_id", "perangkat", "ringkas", "selesai", "status", "total"].sort());
  });
});

describe("pembersih masukan (lib)", () => {
  it("menolak jenis/kunci/status/muatan yang tidak sah dan membatasi angka serta ukuran", () => {
    expect(() => bersihkanMasukanAntrean(null)).toThrow(GalatAntrean);
    expect(() => bersihkanMasukanAntrean({ ...MASUKAN(), jenis: "x" })).toThrow(/Jenis antrean/);
    expect(() => bersihkanMasukanAntrean({ ...MASUKAN(), kunci: "  " })).toThrow(/Kunci/);
    expect(() => bersihkanMasukanAntrean({ ...MASUKAN(), status: "hilang" })).toThrow(/Status/);
    expect(() => bersihkanMasukanAntrean({ ...MASUKAN(), muatan: "teks" })).toThrow(/Muatan/);
    expect(() => bersihkanMasukanAntrean({ ...MASUKAN(), muatan: { x: "a".repeat(BATAS_MUATAN_BITA) } })).toThrow(/terlalu besar/);
    const b = bersihkanMasukanAntrean({ ...MASUKAN(), selesai: 99999, total: -4, ringkas: `a\u0000\n${"b".repeat(400)}` });
    expect(b.total).toBe(0);
    expect(b.selesai).toBeLessThanOrEqual(1000);
    expect(b.ringkas.length).toBeLessThanOrEqual(240);
    expect(b.ringkas).not.toMatch(/[\u0000\n]/);
  });
});

describe("saklar mati (bawaan)", () => {
  it("tulisan ditolak halus, bacaan kosong dan aktif:false, tidak ada baris tersimpan", async () => {
    const put = await antrean("PUT", MASUKAN());
    expect(put.status).toBe(200);
    expect(put.isi.data).toEqual({ disimpan: false, alasan: "saklar-mati" });
    const get = await antrean("GET");
    expect(get.isi.data).toEqual({ aktif: false, antrean: [] });
    const n = await db!.queryAll<{ n: string }>("SELECT COUNT(*) AS n FROM aleta_antrean_peramban");
    expect(Number(n[0].n)).toBe(0);
  });

  it("tanpa sesi 401", async () => {
    aktor = null;
    expect((await antrean("GET")).status).toBe(401);
    expect((await antrean("PUT", MASUKAN())).status).toBe(401);
  });
});

describe("saklar menyala", () => {
  beforeEach(async () => {
    await nyalakan();
  });

  it("upsert: kunci yang sama diperbarui (satu baris), dibuat_pada tetap, diubah_pada bergeser", async () => {
    expect((await antrean("PUT", MASUKAN())).isi.data.disimpan).toBe(true);
    const a = await db!.queryAll<any>("SELECT * FROM aleta_antrean_peramban");
    expect(a).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 5));
    expect((await antrean("PUT", MASUKAN({ selesai: 2, ringkas: "dua" }))).isi.data.disimpan).toBe(true);
    const b = await db!.queryAll<any>("SELECT * FROM aleta_antrean_peramban");
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ selesai: 2, ringkas: "dua", dibuat_pada: a[0].dibuat_pada, pengguna_id: "usr-hakim" });
    expect(b[0].diubah_pada >= a[0].diubah_pada).toBe(true);
  });

  it("GET hanya antrean milik pemanggil yang berstatus jalan, terbaru dulu, dengan muatan terurai; saringan jenis", async () => {
    await antrean("PUT", MASUKAN());
    await new Promise((r) => setTimeout(r, 5));
    await antrean("PUT", MASUKAN({ jenis: "relaas-massal", kunci: "relaas-1", muatan: { pekerjaan: { id: "relaas-1" } } }));
    aktor = "usr-admin";
    await antrean("PUT", MASUKAN({ kunci: "milik-admin" }));
    aktor = "usr-hakim";
    const semua = (await antrean("GET")).isi.data;
    expect(semua.aktif).toBe(true);
    expect(semua.antrean.map((x: any) => x.jenis)).toEqual(["relaas-massal", "cetak-massal"]);
    expect(semua.antrean[1].muatan.butir).toHaveLength(2);
    expect(JSON.stringify(semua)).not.toContain("milik-admin");
    const satu = (await antrean("GET", undefined, "?jenis=cetak-massal")).isi.data;
    expect(satu.antrean.map((x: any) => x.kunci)).toEqual(["bas|2026-10-25"]);
    expect((await antrean("GET", undefined, "?jenis=ngawur")).status).toBe(400);
  });

  it("pengguna diambil dari sesi, bukan dari badan: ruas penggunaId di badan diabaikan", async () => {
    await antrean("PUT", { ...MASUKAN(), penggunaId: "usr-admin", pengguna_id: "usr-admin" });
    const baris = await db!.queryAll<any>("SELECT pengguna_id FROM aleta_antrean_peramban");
    expect(baris.map((b) => b.pengguna_id)).toEqual(["usr-hakim"]);
  });

  it("akhiri: selesai/dibuang menghilangkan dari GET; idempoten; orang lain tidak dapat mengakhiri milik kita", async () => {
    await antrean("PUT", MASUKAN());
    aktor = "usr-admin";
    expect((await antrean("POST", { jenis: "cetak-massal", kunci: "bas|2026-10-25", status: "selesai" })).isi.data.diakhiri).toBe(false);
    aktor = "usr-hakim";
    expect((await antrean("GET")).isi.data.antrean).toHaveLength(1);
    expect((await antrean("POST", { jenis: "cetak-massal", kunci: "bas|2026-10-25", status: "selesai" })).isi.data.diakhiri).toBe(true);
    expect((await antrean("GET")).isi.data.antrean).toHaveLength(0);
    expect((await antrean("POST", { jenis: "cetak-massal", kunci: "bas|2026-10-25", status: "selesai" })).isi.data.diakhiri).toBe(false);
    expect((await antrean("POST", { jenis: "cetak-massal", kunci: "k", status: "jalan" })).status).toBe(400);
    expect((await antrean("POST", { jenis: "x", kunci: "k" })).status).toBe(400);
    expect((await antrean("POST", { jenis: "cetak-massal", kunci: " " })).status).toBe(400);
  });

  it("masukan tidak sah ditolak 400 dan tidak menyimpan apa pun", async () => {
    for (const badan of [MASUKAN({ jenis: "ngawur" }), MASUKAN({ kunci: "" }), MASUKAN({ muatan: { x: "a".repeat(BATAS_MUATAN_BITA + 10) } })]) {
      expect((await antrean("PUT", badan)).status).toBe(400);
    }
    const n = await db!.queryAll<{ n: string }>("SELECT COUNT(*) AS n FROM aleta_antrean_peramban");
    expect(Number(n[0].n)).toBe(0);
  });

  it("sapu: antrean jalan yang ditinggalkan > 14 hari dan yang selesai/dibuang > 2 hari dibuang; yang baru tetap", async () => {
    await antrean("PUT", MASUKAN({ kunci: "baru" }));
    await antrean("PUT", MASUKAN({ kunci: "lama-jalan" }));
    await antrean("PUT", MASUKAN({ kunci: "lama-selesai" }));
    await antrean("PUT", MASUKAN({ kunci: "baru-selesai" }));
    await antrean("POST", { jenis: "cetak-massal", kunci: "lama-selesai", status: "selesai" });
    await antrean("POST", { jenis: "cetak-massal", kunci: "baru-selesai", status: "selesai" });
    const hari = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    await db!.prepare("UPDATE aleta_antrean_peramban SET diubah_pada = ? WHERE kunci = ?").run(hari(15), "lama-jalan");
    await db!.prepare("UPDATE aleta_antrean_peramban SET diubah_pada = ? WHERE kunci = ?").run(hari(3), "lama-selesai");
    await sapuAntreanBasi(db!);
    const sisa = await db!.queryAll<{ kunci: string }>("SELECT kunci FROM aleta_antrean_peramban ORDER BY kunci");
    expect(sisa.map((s) => s.kunci)).toEqual(["baru", "baru-selesai"]);
  });

  it("saklar dimatikan lagi: bacaan kosong kembali (data tersimpan tidak bocor)", async () => {
    await antrean("PUT", MASUKAN());
    aktor = "usr-super";
    await kinerja({ antreanDiServer: false });
    aktor = "usr-hakim";
    expect((await antrean("GET")).isi.data).toEqual({ aktif: false, antrean: [] });
    expect((await antrean("PUT", MASUKAN({ kunci: "lain" }))).isi.data.disimpan).toBe(false);
  });
});
