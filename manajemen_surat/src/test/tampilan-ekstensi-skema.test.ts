// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_EKSTENSI_TAMPILAN } from "@/server/db/schema";

/**
 * ============================================================================
 * MIGRASI 0052 - TIGA TEMPAT PENDAFTARAN, SATU BUNYI
 * ============================================================================
 *
 * Sama dengan tipe-keluaran-skema.test.ts untuk 0050:
 *   (a) drizzle/0052_aleta_ekstensi_tampilan.sql + entri _journal.json;
 *   (b) DDL_EKSTENSI_TAMPILAN di schema.ts (pg-mem dan mode cadangan);
 *   (c) kedua tabel di IN_MEMORY_TABLE_PERSISTENCE_ORDER.
 * Yang terlewat gagal diam-diam; di sini ketiganya dituntut, dan batasan
 * tabelnya sungguh menolak yang harus ditolak.
 */

const AKAR = path.resolve(__dirname, "../..");
const BERKAS_SQL = path.join(AKAR, "drizzle", "0052_aleta_ekstensi_tampilan.sql");
const JURNAL = path.join(AKAR, "drizzle", "meta", "_journal.json");

function pernyataan(sql: string): string[] {
  return sql
    .split("\n")
    .map((baris) => baris.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

type Kolom = { table_name: string; column_name: string; data_type: string; is_nullable: string };
const KUERI_KOLOM = `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
  WHERE table_name IN ('aleta_ekstensi_tampilan', 'aleta_ekstensi_setelan')
  ORDER BY table_name, ordinal_position`;

let db: AletaDatabase | null = null;
const d = () => db as AletaDatabase;

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: false });
});

afterAll(async () => {
  await db?.close();
  db = null;
});

describe("jurnal migrasi - nomor 0052 diklaim sekali", () => {
  const jurnal = JSON.parse(readFileSync(JURNAL, "utf8")) as { entries: { idx: number; tag: string }[] };

  it("idx 52 bertag 0052_aleta_ekstensi_tampilan tepat sekali, jurnal tanpa lubang, berkasnya ada", () => {
    jurnal.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(jurnal.entries.filter((e) => e.idx === 52)).toEqual([
      expect.objectContaining({ idx: 52, tag: "0052_aleta_ekstensi_tampilan" }),
    ]);
    expect(jurnal.entries.filter((e) => e.tag.startsWith("0052_"))).toHaveLength(1);
    expect(existsSync(BERKAS_SQL)).toBe(true);
  });
});

describe("DDL berkas 0052 = DDL yang dijalankan ensureAletaSchema", () => {
  it("teks yang dinormalkan sama, pernyataan demi pernyataan", () => {
    const dariBerkas = pernyataan(readFileSync(BERKAS_SQL, "utf8"));
    const dariSkema = [...DDL_EKSTENSI_TAMPILAN.tabel, ...DDL_EKSTENSI_TAMPILAN.indeks].map((s) => pernyataan(s)[0]);
    expect(dariBerkas).toEqual(dariSkema);
    expect(dariBerkas).toHaveLength(2);
  });

  it("struktur yang terbentuk sama: berkas di pg-mem kosong, skema lewat createAletaDatabase", async () => {
    // Sekali saja: pg-mem menolak CREATE TABLE IF NOT EXISTS yang DILEWATI bila
    // tabelnya punya CHECK tingkat tabel (pemeriksa cakupan AST-nya mengira
    // batasan itu terlupa). Postgres melewatinya dengan benar, dan
    // ensureAletaSchema hanya berjalan sekali per basis data (WeakSet).
    const kosong = newDb();
    kosong.public.none(readFileSync(BERKAS_SQL, "utf8"));
    const dariBerkas = kosong.public.many(KUERI_KOLOM) as Kolom[];
    const dariSkema = await d().queryAll<Kolom>(KUERI_KOLOM);
    expect(dariSkema).toEqual(dariBerkas);
    expect(dariSkema.filter((k) => k.table_name === "aleta_ekstensi_tampilan").map((k) => k.column_name)).toEqual([
      "lingkup", "sasaran", "mode", "fitur", "catatan", "diubah_oleh", "diubah_pada",
    ]);
    expect(dariSkema.filter((k) => k.table_name === "aleta_ekstensi_setelan").map((k) => k.column_name)).toEqual([
      "pengguna_id", "kunci", "nilai", "diubah_pada",
    ]);
  });

  it("kedua tabel ikut cadangan JSON mode Postgres-mati", () => {
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_ekstensi_tampilan");
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_ekstensi_setelan");
  });
});

describe("batasan ditegakkan (tabel dari schema.ts, di pg-mem)", () => {
  const SISIP =
    "INSERT INTO aleta_ekstensi_tampilan (lingkup, sasaran, mode, fitur, diubah_oleh, diubah_pada) VALUES (?,?,?,?,?,?)";
  const PADA = "2026-09-29T00:00:00.000Z";

  it("satu baris per (lingkup, sasaran)", async () => {
    await d().run(SISIP, ["peran", "hakim", "baru", "{}", "uji", PADA]);
    await expect(d().run(SISIP, ["peran", "hakim", "ui", "{}", "uji", PADA])).rejects.toThrow();
    // Sasaran sama pada lingkup berbeda bukan kembar.
    await d().run(SISIP, ["pengguna", "hakim", "ui", "{}", "uji", PADA]);
  });

  it("CHECK lingkup dan mode menolak nilai asing", async () => {
    await expect(d().run(SISIP, ["jabatan", "x", "baru", "{}", "uji", PADA])).rejects.toThrow();
    await expect(d().run(SISIP, ["peran", "staf", "modern", "{}", "uji", PADA])).rejects.toThrow();
  });

  it("CHECK sasaran: 'semua' harus bersasaran kosong, lingkup lain tidak boleh kosong", async () => {
    await expect(d().run(SISIP, ["semua", "hakim", "baru", "{}", "uji", PADA])).rejects.toThrow();
    await expect(d().run(SISIP, ["peran", "", "baru", "{}", "uji", PADA])).rejects.toThrow();
    await expect(d().run(SISIP, ["pengguna", "", "baru", "{}", "uji", PADA])).rejects.toThrow();
    await d().run(SISIP, ["semua", "", "baru", "{}", "uji", PADA]);
  });

  it("setelan: satu baris per (pengguna_id, kunci)", async () => {
    const S = "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?,?,?,?)";
    await d().run(S, ["usr-a", "pintasan.portal", "{}", PADA]);
    await expect(d().run(S, ["usr-a", "pintasan.portal", "{}", PADA])).rejects.toThrow();
    await d().run(S, ["usr-b", "pintasan.portal", "{}", PADA]);
  });
});
