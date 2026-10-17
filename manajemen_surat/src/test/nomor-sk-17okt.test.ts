// @vitest-environment node
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DAFTAR_NOMOR_SK,
  GalatNomorSk,
  NOMOR_SK_BAWAAN,
  bersihkanNilaiNomorSk,
  bersihkanPengaturanNomorSk,
  nilaiLiteral,
} from "@/lib/nomor-sk";
import { menyebutAleta } from "@/lib/tanda-aleta";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { susunRencanaNomorSk } from "@/server/modules/pengaturan-abt/nomor-sk";

/**
 * ============================================================================
 * NOMOR SK PENUNJUKAN (#9550#) - Integrasi e-Court (17 Okt 2026)
 * ============================================================================
 *
 * Variabel ABT #9550# berjenis data_sql dengan kueri baku `SELECT '<nomor>' AS data`
 * (paket blangko). Yang diuji:
 *   1. aturan murni: bawaan = SK yang berlaku, isian ditolak (termasuk tanda kutip ganda);
 *   2. bot: hanya #9550#, kueri disusun bot dari nomor (parameter + QUOTE), tidak pernah
 *      INSERT, prasyarat nilai lama, ada/tidak;
 *   3. penjaga tanda: kata ALETA tertahan di bot sebelum menyentuh ABT;
 *   4. rute portal: simpan/baca bawaan, penerapan memanggil jalur bot dengan nomor
 *      literal yang benar, tanpa kata ALETA, hanya Super Admin/Admin, variabel belum
 *      terpasang -> pesan awam, Kembalikan.
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const servisBot = require_(path.join(akar, "aleta_bot/services/abtPengaturanService.js")) as {
  buatLayanan: (d: Record<string, unknown>) => {
    bacaNomorSk: () => Promise<{ variabel: Array<{ noVar: string; ada: boolean; nomor: string | null; jenis: string }> }>;
    simpanNomorSk: (b: unknown) => Promise<Record<string, unknown>>;
  };
};
const penjagaBot = require_(path.join(akar, "aleta_bot/services/penjagaTandaSipp.js")) as {
  periksaPengaturanAbt: (jalur: string, badan: unknown) => { ok: boolean; pesan?: string };
};

const SK_SEKARANG = "254/KPA.W19-A5/SK.HK2.6/VIII/2026";
const KUERI_SEKARANG = `SELECT '${SK_SEKARANG}' AS data`;
const SK_BARU = "300/KPA.W19-A5/SK.HK2.6/XI/2026";

// ─── 1. Aturan murni ─────────────────────────────────────────────────────────

describe("aturan nomor SK (murni)", () => {
  const butir = DAFTAR_NOMOR_SK[0];

  it("bawaan = SK yang berlaku sekarang; teks literal = nomornya saja (tanggal tetap di kalimat blangko)", () => {
    expect(butir).toMatchObject({ kunci: "majelis", noVar: "9550", sertakanTanggal: false });
    expect(NOMOR_SK_BAWAAN.majelis).toEqual({ nomor: SK_SEKARANG, tanggal: "" });
    expect(nilaiLiteral(butir, NOMOR_SK_BAWAAN.majelis)).toBe(SK_SEKARANG);
    expect(nilaiLiteral(butir, { nomor: SK_BARU, tanggal: "2026-11-03" })).toBe(SK_BARU);
    expect(nilaiLiteral({ ...butir, sertakanTanggal: true }, { nomor: SK_BARU, tanggal: "2026-11-03" })).toBe(`${SK_BARU} tanggal 3 November 2026`);
  });

  it("isian ditolak (bukan dibersihkan diam-diam): kosong, #, kutip ganda/tunggal, garis miring terbalik, huruf di luar latin1, kunci asing", () => {
    expect(() => bersihkanNilaiNomorSk(butir, { nomor: "  ", tanggal: "" })).toThrow(GalatNomorSk);
    expect(() => bersihkanNilaiNomorSk(butir, { nomor: "12/#0046#", tanggal: "" })).toThrow(/tanda #/);
    expect(() => bersihkanNilaiNomorSk(butir, { nomor: '12/"SK"', tanggal: "" })).toThrow(/kutip/);
    expect(() => bersihkanNilaiNomorSk(butir, { nomor: "12/'SK'", tanggal: "" })).toThrow(/kutip/);
    expect(() => bersihkanNilaiNomorSk(butir, { nomor: "12\\34", tanggal: "" })).toThrow(/garis miring/);
    expect(() => bersihkanNilaiNomorSk(butir, { nomor: "12/中", tanggal: "" })).toThrow(/huruf/);
    expect(() => bersihkanNilaiNomorSk(butir, { nomor: "x".repeat(121), tanggal: "" })).toThrow(/terlalu panjang/);
    expect(() => bersihkanNilaiNomorSk(butir, { nomor: "12/2026", tanggal: "2026-13-45" })).toThrow(/Tanggal/);
    expect(() => bersihkanPengaturanNomorSk({ lain: { nomor: "1", tanggal: "" } }, NOMOR_SK_BAWAAN)).toThrow(GalatNomorSk);
    expect(bersihkanNilaiNomorSk(butir, { nomor: " 12/\n SK  ", tanggal: "" })).toEqual({ nomor: "12/ SK", tanggal: "" });
  });
});

// ─── 2. Bot ──────────────────────────────────────────────────────────────────

describe("bot: bacaNomorSk / simpanNomorSk (ABT tiruan bertransaksi)", () => {
  type Baris = { data_type: string; sql_query: string | null; locked: number };
  let isi: Record<string, Baris>;
  const tulisan: Array<{ no: string; nilai: string }> = [];
  const kueriTulis: string[] = [];
  const jalankan = async (sql: string, p: unknown[] = []) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (/^SELECT no_var, nama, data_type, sql_query, locked FROM aps_badilag\.abt_variabel WHERE no_var IN/.test(s)) {
      return (p as Array<string | number>).filter((n) => isi[String(n)]).map((n) => ({ no_var: String(n), nama: "NOMOR SK", ...isi[String(n)] }));
    }
    if (/^SELECT no_var, data_type, sql_query, locked FROM aps_badilag\.abt_variabel WHERE no_var = \? FOR UPDATE$/.test(s)) {
      const v = isi[String(p[0])];
      return v ? [{ no_var: p[0], ...v }] : [];
    }
    if (/^UPDATE aps_badilag\.abt_variabel SET sql_query = CONCAT\('SELECT ', QUOTE\(\?\), ' AS data'\) WHERE no_var = \?$/.test(s)) {
      kueriTulis.push(s);
      tulisan.push({ no: String(p[1]), nilai: String(p[0]) });
      isi[String(p[1])].sql_query = `SELECT '${String(p[0])}' AS data`; // QUOTE tanpa tanda kutip/garis miring = apa adanya
      return [];
    }
    if (/^SELECT sql_query FROM aps_badilag\.abt_variabel WHERE no_var = \?$/.test(s)) return [{ sql_query: isi[String(p[0])].sql_query }];
    throw new Error(`SQL tiruan tidak dikenal: ${s}`);
  };
  const layanan = servisBot.buatLayanan({
    kueri: async (sql: string, p: unknown[]) => {
      if (/^\s*(UPDATE|INSERT)/i.test(sql)) throw new Error("jalur baca dipakai menulis");
      return jalankan(sql, p);
    },
    transaksi: async (kerja: (q: typeof jalankan) => Promise<unknown>) => kerja(jalankan),
    skemaAbt: "aps_badilag",
    akarBlangko: os.tmpdir(),
    buatMesin: () => ({ nilaiPenanda: async () => new Map() }),
  });
  beforeEach(() => {
    isi = { "9550": { data_type: "data_sql", sql_query: KUERI_SEKARANG, locked: 0 } };
    tulisan.length = 0;
    kueriTulis.length = 0;
  });

  it("baca: variabel ada dengan nomor sekarang; kueri berbentuk lain -> nomor null; belum ada -> ada:false", async () => {
    expect((await layanan.bacaNomorSk()).variabel).toEqual([expect.objectContaining({ noVar: "9550", ada: true, jenis: "data_sql", nomor: SK_SEKARANG })]);
    isi["9550"].sql_query = "SELECT value FROM sys_config LIMIT 1";
    expect((await layanan.bacaNomorSk()).variabel[0].nomor).toBeNull();
    delete isi["9550"];
    expect((await layanan.bacaNomorSk()).variabel).toEqual([expect.objectContaining({ noVar: "9550", ada: false, nomor: null })]);
  });

  it("menulis nomor lewat parameter + QUOTE; nomor lain, kosong, kutip, #, bukan data_sql, bentuk lain, dikunci, dan prasyarat basi ditolak tanpa menulis", async () => {
    await expect(layanan.simpanNomorSk({ noVar: "0046", lama: { nomor: "x" }, baru: { nomor: SK_BARU } })).rejects.toMatchObject({ kode: "bukan_nomor_sk" });
    for (const buruk of [" ", "12/#0046#", '12/"SK"', "12/'SK'", "a\\b"]) {
      await expect(layanan.simpanNomorSk({ noVar: "9550", lama: { nomor: SK_SEKARANG }, baru: { nomor: buruk } })).rejects.toMatchObject({ ditolak: true });
    }
    await expect(layanan.simpanNomorSk({ noVar: "9550", lama: { nomor: SK_SEKARANG }, baru: { sql_query: "select 1" } })).rejects.toMatchObject({ ditolak: true });
    isi["9550"].data_type = "data_teks";
    await expect(layanan.simpanNomorSk({ noVar: "9550", lama: { nomor: SK_SEKARANG }, baru: { nomor: SK_BARU } })).rejects.toMatchObject({ kode: "bukan_nomor_sk" });
    isi["9550"].data_type = "data_sql";
    isi["9550"].sql_query = "SELECT value FROM sys_config LIMIT 1";
    await expect(layanan.simpanNomorSk({ noVar: "9550", lama: { nomor: SK_SEKARANG }, baru: { nomor: SK_BARU } })).rejects.toMatchObject({ kode: "bukan_nomor_sk" });
    isi["9550"].sql_query = KUERI_SEKARANG;
    isi["9550"].locked = 1;
    await expect(layanan.simpanNomorSk({ noVar: "9550", lama: { nomor: SK_SEKARANG }, baru: { nomor: SK_BARU } })).rejects.toMatchObject({ kode: "dikunci" });
    isi["9550"].locked = 0;
    await expect(layanan.simpanNomorSk({ noVar: "9550", lama: { nomor: "nomor basi" }, baru: { nomor: SK_BARU } })).rejects.toMatchObject({ kode: "berubah" });
    expect(tulisan).toEqual([]);
    const h = await layanan.simpanNomorSk({ noVar: "9550", lama: { nomor: SK_SEKARANG }, baru: { nomor: SK_BARU } });
    expect(h).toMatchObject({ sebelum: { nomor: SK_SEKARANG }, sesudah: { nomor: SK_BARU } });
    expect(tulisan).toEqual([{ no: "9550", nilai: SK_BARU }]);
    expect(isi["9550"].sql_query).toBe(`SELECT '${SK_BARU}' AS data`);
    expect(kueriTulis[0]).not.toContain(SK_BARU); // nilai lewat parameter, bukan disambung ke SQL
  });

  it("variabel belum ada di ABT: kode tidak_ada (paket belum terpasang), tidak menulis dan tidak INSERT", async () => {
    delete isi["9550"];
    await expect(layanan.simpanNomorSk({ noVar: "9550", lama: { nomor: "" }, baru: { nomor: SK_SEKARANG } })).rejects.toMatchObject({ kode: "tidak_ada" });
    expect(tulisan).toEqual([]);
    expect(isi["9550"]).toBeUndefined();
  });
});

describe("penjaga tanda di bot untuk /nomor-sk/simpan", () => {
  it("kata ALETA tertahan sebelum menyentuh ABT; nomor biasa lolos", () => {
    const tahan = penjagaBot.periksaPengaturanAbt("/nomor-sk/simpan", { noVar: "9550", lama: { nomor: "a" }, baru: { nomor: "12/SK ALETA/2026" } });
    expect(tahan.ok).toBe(false);
    expect(tahan.pesan).toMatch(/ALETA/);
    expect(penjagaBot.periksaPengaturanAbt("/nomor-sk/simpan", { noVar: "9550", lama: { nomor: "a" }, baru: { nomor: SK_SEKARANG } }).ok).toBe(true);
  });
});

// ─── 3. Rencana (murni) ──────────────────────────────────────────────────────

describe("rencana penerapan (murni)", () => {
  const abt = (v: Partial<{ ada: boolean; nomor: string | null; jenis: string; dikunci: boolean }>) => ({
    variabel: [{ noVar: "9550", ada: true, nama: "", jenis: "data_sql", nomor: "", dikunci: false, ...v }],
  });
  it("sama -> tidak perlu; beda -> perlu; belum ada -> pesan awam; dikunci / bentuk lain / memuat ALETA -> tidak bisa", () => {
    expect(susunRencanaNomorSk(NOMOR_SK_BAWAAN, abt({ nomor: SK_SEKARANG }))[0]).toMatchObject({ perlu: false, bisa: true, literal: SK_SEKARANG });
    expect(susunRencanaNomorSk(NOMOR_SK_BAWAAN, abt({ nomor: "lama" }))[0]).toMatchObject({ perlu: true, bisa: true, nilaiAbt: "lama" });
    expect(susunRencanaNomorSk(NOMOR_SK_BAWAAN, abt({ ada: false }))[0]).toMatchObject({
      ada: false,
      bisa: false,
      sebab: "Variabel nomor SK belum terpasang di ABT - pasang paket blangko terbaru dulu.",
    });
    expect(susunRencanaNomorSk(NOMOR_SK_BAWAAN, abt({ dikunci: true }))[0].bisa).toBe(false);
    expect(susunRencanaNomorSk(NOMOR_SK_BAWAAN, abt({ nomor: null }))[0].bisa).toBe(false);
    expect(susunRencanaNomorSk(NOMOR_SK_BAWAAN, abt({ jenis: "data_teks" }))[0].bisa).toBe(false);
    const aleta = susunRencanaNomorSk({ majelis: { nomor: "1/ALETA/2026", tanggal: "" } }, abt({}))[0];
    expect(aleta).toMatchObject({ bisa: false, perlu: false });
    expect(aleta.sebab).toMatch(/ALETA/);
  });
});

// ─── 4. Rute portal ──────────────────────────────────────────────────────────

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
const panggilanBot: Array<{ jalur: string; method: string; body: Record<string, unknown> }> = [];
let abtNomorSk: { ada: boolean; nomor: string; jenis: string; dikunci: boolean };

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/pengaturan-abt/gateway", () => ({
  ambilGambarBotPengaturanAbt: async () => ({ ok: false, error: "tidak dipakai", status: 404 }),
  panggilBotPengaturanAbt: async (jalur: string, pilihan: { method?: string; body?: Record<string, unknown> } = {}) => {
    panggilanBot.push({ jalur, method: pilihan.method ?? "GET", body: pilihan.body ?? {} });
    if (jalur === "/nomor-sk")
      return {
        ok: true,
        data: { ok: true, variabel: [{ noVar: "9550", ada: abtNomorSk.ada, nama: "", jenis: abtNomorSk.jenis, nomor: abtNomorSk.ada ? abtNomorSk.nomor : null, dikunci: abtNomorSk.dikunci }] },
      };
    if (jalur === "/nomor-sk/simpan") {
      const b = pilihan.body as { noVar: string; lama: { nomor: string }; baru: { nomor: string } };
      if (!abtNomorSk.ada) return { ok: false, kode: "tidak_ada", error: "Variabel #9550# tidak ada di katalog ABT.", status: 404 };
      if (abtNomorSk.nomor !== b.lama.nomor) return { ok: false, kode: "berubah", error: "sudah diubah orang lain", status: 409 };
      abtNomorSk.nomor = b.baru.nomor;
      return { ok: true, data: { ok: true, sebelum: b.lama, sesudah: b.baru } };
    }
    return { ok: false, error: "jalur tidak dikenal", status: 404 };
  },
}));

async function rute(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}) {
  const modul = (await import("@/app/api/pengaturan-sipp-abt/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/pengaturan-sipp-abt" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  return modul[cara](req);
}
const json = async (r: Response) => (await r.json()) as { ok: boolean; data: Record<string, unknown>; error?: string };
const tulisKeBot = () => panggilanBot.filter((p) => p.method === "POST");

describe("rute nomor SK (pg-mem berbenih, bot tiruan)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-admin";
    panggilanBot.length = 0;
    abtNomorSk = { ada: true, nomor: "nomor lama sebelum paket", jenis: "data_sql", dikunci: false };
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("belum pernah disimpan: nilai bawaan = SK sekarang, rencana menunjuk beda; peran lain ditolak", async () => {
    const r = await json(await rute("GET", { query: "bagian=nomor-sk" }));
    expect(r.data).toMatchObject({
      tersimpan: false,
      nilai: { majelis: { nomor: SK_SEKARANG } },
      rencana: [{ kunci: "majelis", literal: SK_SEKARANG, ada: true, perlu: true, bisa: true }],
      hak: { ubahBawaan: true },
    });
    aktor = "usr-ppg";
    expect((await rute("GET", { query: "bagian=nomor-sk" })).status).toBe(403);
    expect((await rute("POST", { badan: { tindakan: "simpan-nomor-sk", nilai: {} } })).status).toBe(403);
    expect((await rute("POST", { badan: { tindakan: "terapkan-nomor-sk" } })).status).toBe(403);
    expect(tulisKeBot()).toEqual([]);
  });

  it("simpan dan baca kembali; ABT tidak disentuh; isian ngawur ditolak; Super Admin dan Admin boleh", async () => {
    const baru = { majelis: { nomor: SK_BARU, tanggal: "" } };
    const s = await rute("POST", { badan: { tindakan: "simpan-nomor-sk", nilai: baru } });
    expect(s.status).toBe(200);
    expect((await json(s)).data).toMatchObject({ tersimpan: true, nilai: baru, diubahOleh: expect.any(String) });
    expect(tulisKeBot()).toEqual([]);
    const g = await json(await rute("GET", { query: "bagian=nomor-sk" }));
    expect(g.data).toMatchObject({ tersimpan: true, nilai: baru, rencana: [{ literal: SK_BARU }] });
    for (const buruk of ["#0046#", "", '12/"SK"']) {
      expect((await rute("POST", { badan: { tindakan: "simpan-nomor-sk", nilai: { majelis: { nomor: buruk, tanggal: "" } } } })).status).toBe(400);
    }
    aktor = "usr-super";
    expect((await rute("POST", { badan: { tindakan: "simpan-nomor-sk", nilai: { majelis: { nomor: "301/KPA.W19-A5/SK.HK2.6/XI/2026", tanggal: "" } } } })).status).toBe(200);
    const audit = await db!.queryAll<Record<string, string>>("SELECT action FROM audit_logs WHERE action = 'UPDATE_NOMOR_SK'");
    expect(audit.length).toBe(2);
  });

  it("terapkan memanggil jalur bot dengan nomor literal yang benar, tercatat jenis 'nomor_sk' dengan nilai lama, tanpa kata ALETA", async () => {
    await rute("POST", { badan: { tindakan: "simpan-nomor-sk", nilai: { majelis: { nomor: SK_BARU, tanggal: "" } } } });
    const t = await json(await rute("POST", { badan: { tindakan: "terapkan-nomor-sk" } }));
    expect((t.data.hasil as Array<{ kunci: string; ok: boolean }>).map((x) => [x.kunci, x.ok])).toEqual([["majelis", true]]);
    const kiriman = tulisKeBot();
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].jalur).toBe("/nomor-sk/simpan");
    expect(kiriman[0].body).toEqual({ noVar: "9550", lama: { nomor: "nomor lama sebelum paket" }, baru: { nomor: SK_BARU }, pulihkan: false });
    expect(menyebutAleta(JSON.stringify(kiriman[0].body))).toBe(false);
    expect(abtNomorSk.nomor).toBe(SK_BARU);
    const [c] = await db!.queryAll<Record<string, string>>("SELECT * FROM aleta_abt_suntingan WHERE jenis = 'nomor_sk'");
    expect(c).toMatchObject({ kunci: "9550", status: "tersimpan", oleh_id: "usr-admin" });
    expect(JSON.parse(c.nilai_lama)).toEqual({ nomor: "nomor lama sebelum paket" });
    expect(menyebutAleta(c.ringkas)).toBe(false);
    // diterapkan lagi tanpa perubahan: dilewati, tidak ada tulisan baru
    const lagi = await json(await rute("POST", { badan: { tindakan: "terapkan-nomor-sk" } }));
    expect((lagi.data.hasil as Array<{ dilewati?: boolean }>)[0].dilewati).toBe(true);
    expect(tulisKeBot()).toHaveLength(1);
    // Kembalikan menulis nomor lama
    const k = await rute("POST", { badan: { tindakan: "kembalikan", id: c.id } });
    expect(k.status).toBe(200);
    expect(abtNomorSk.nomor).toBe("nomor lama sebelum paket");
    expect(tulisKeBot().at(-1)!.body).toMatchObject({ pulihkan: true, baru: { nomor: "nomor lama sebelum paket" } });
    const riwayat = await json(await rute("GET", { query: "bagian=riwayat&jenis=nomor_sk" }));
    expect((riwayat.data.riwayat as unknown[]).length).toBe(2);
  });

  it("bawaan yang belum disimpan pun dapat diterapkan (sumbernya nilai bawaan ALETA)", async () => {
    await rute("POST", { badan: { tindakan: "terapkan-nomor-sk" } });
    expect(tulisKeBot()[0].body).toMatchObject({ baru: { nomor: SK_SEKARANG } });
  });

  it("variabel belum terpasang di ABT: simpan di ALETA tetap jalan, terapkan memberi pesan awam dan tidak menulis", async () => {
    abtNomorSk.ada = false;
    const r = await json(await rute("GET", { query: "bagian=nomor-sk" }));
    expect((r.data.rencana as Array<{ ada: boolean; sebab: string }>)[0]).toMatchObject({
      ada: false,
      sebab: "Variabel nomor SK belum terpasang di ABT - pasang paket blangko terbaru dulu.",
    });
    expect((await rute("POST", { badan: { tindakan: "simpan-nomor-sk", nilai: { majelis: { nomor: "302/SK/2026", tanggal: "" } } } })).status).toBe(200);
    const t = await json(await rute("POST", { badan: { tindakan: "terapkan-nomor-sk" } }));
    expect((t.data.hasil as Array<{ ok: boolean; pesan: string }>)[0]).toMatchObject({ ok: false, pesan: "Variabel nomor SK belum terpasang di ABT - pasang paket blangko terbaru dulu." });
    expect(tulisKeBot()).toEqual([]);
  });

  it("nomor yang memuat kata ALETA boleh tersimpan di ALETA tetapi tidak dikirim ke ABT", async () => {
    expect((await rute("POST", { badan: { tindakan: "simpan-nomor-sk", nilai: { majelis: { nomor: "9/ALETA/2026", tanggal: "" } } } })).status).toBe(200);
    const t = await json(await rute("POST", { badan: { tindakan: "terapkan-nomor-sk" } }));
    expect((t.data.hasil as Array<{ ok: boolean; pesan: string }>)[0]).toMatchObject({ ok: false });
    expect((t.data.hasil as Array<{ pesan: string }>)[0].pesan).toMatch(/ALETA/);
    expect(tulisKeBot()).toEqual([]);
  });

  it("Kembalikan atas isi ABT yang sudah diubah orang lain ditolak 409 dan tidak menimpa", async () => {
    await rute("POST", { badan: { tindakan: "terapkan-nomor-sk" } });
    abtNomorSk.nomor = "diubah orang lain";
    const [c] = await db!.queryAll<Record<string, string>>("SELECT * FROM aleta_abt_suntingan WHERE jenis = 'nomor_sk'");
    const k = await rute("POST", { badan: { tindakan: "kembalikan", id: c.id } });
    expect(k.status).toBe(409);
    expect(abtNomorSk.nomor).toBe("diubah orang lain");
  });
});
