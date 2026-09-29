// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_KOMENTAR_TEMPLAT_WAJIB } from "@/server/db/schema";

/**
 * ============================================================================
 * MIGRASI 0053 - TIGA TEMPAT PENDAFTARAN, SATU BUNYI
 * ============================================================================
 *
 * Sama dengan tampilan-ekstensi-skema.test.ts untuk 0052:
 *   (a) drizzle/0053_aleta_bas_komentar_templat_abt_wajib.sql + entri _journal.json;
 *   (b) DDL_KOMENTAR_TEMPLAT_WAJIB di schema.ts (pg-mem dan mode cadangan);
 *   (c) ketiga tabel di IN_MEMORY_TABLE_PERSISTENCE_ORDER.
 * Yang terlewat gagal diam-diam; di sini ketiganya dituntut, dan batasan
 * tabelnya sungguh menolak yang harus ditolak.
 */

const AKAR = path.resolve(__dirname, "../..");
const TAG = "0053_aleta_bas_komentar_templat_abt_wajib";
const BERKAS_SQL = path.join(AKAR, "drizzle", TAG + ".sql");
const JURNAL = path.join(AKAR, "drizzle", "meta", "_journal.json");
const TABEL = ["aleta_bas_komentar", "aleta_templat_hukum", "aleta_abt_variabel_wajib"];

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
  WHERE table_name IN ('aleta_bas_komentar', 'aleta_templat_hukum', 'aleta_abt_variabel_wajib')
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

describe("jurnal migrasi - nomor 0053 diklaim sekali", () => {
  const jurnal = JSON.parse(readFileSync(JURNAL, "utf8")) as { entries: { idx: number; tag: string }[] };

  it("idx 53 bertag 0053_aleta_bas_komentar_templat_abt_wajib tepat sekali, jurnal tanpa lubang, berkasnya ada", () => {
    jurnal.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(jurnal.entries.filter((e) => e.idx === 53)).toEqual([expect.objectContaining({ idx: 53, tag: TAG })]);
    expect(jurnal.entries.filter((e) => e.tag.startsWith("0053_"))).toHaveLength(1);
    expect(existsSync(BERKAS_SQL)).toBe(true);
  });
});

describe("DDL berkas 0053 = DDL yang dijalankan ensureAletaSchema", () => {
  it("teks yang dinormalkan sama, pernyataan demi pernyataan", () => {
    const dariBerkas = pernyataan(readFileSync(BERKAS_SQL, "utf8"));
    const dariSkema = [...DDL_KOMENTAR_TEMPLAT_WAJIB.tabel, ...DDL_KOMENTAR_TEMPLAT_WAJIB.indeks].map((s) => pernyataan(s)[0]);
    expect(dariBerkas).toEqual(dariSkema);
    expect(dariBerkas).toHaveLength(5);
  });

  it("struktur yang terbentuk sama: berkas di pg-mem kosong, skema lewat createAletaDatabase", async () => {
    const kosong = newDb();
    kosong.public.none(readFileSync(BERKAS_SQL, "utf8"));
    const dariBerkas = kosong.public.many(KUERI_KOLOM) as Kolom[];
    const dariSkema = await d().queryAll<Kolom>(KUERI_KOLOM);
    expect(dariSkema).toEqual(dariBerkas);
    expect(dariSkema.filter((k) => k.table_name === "aleta_bas_komentar").map((k) => k.column_name)).toEqual([
      "id", "nomor_perkara", "perkara_id", "sidang_ke", "bagian", "kutipan", "isi", "penulis_id", "dibuat_pada",
      "selesai", "diselesaikan_oleh", "diselesaikan_pada",
    ]);
    expect(dariSkema.filter((k) => k.table_name === "aleta_templat_hukum").map((k) => k.column_name)).toEqual([
      "id", "jenis", "kunci", "judul", "isi", "benih", "disahkan_oleh", "disahkan_pada", "dihapus_pada",
      "dibuat_oleh", "dibuat_pada", "diubah_oleh", "diubah_pada",
    ]);
    expect(dariSkema.filter((k) => k.table_name === "aleta_abt_variabel_wajib").map((k) => k.column_name)).toEqual([
      "jenis", "kode", "jenis_nama", "nama", "sumber", "jumlah_perkara", "jumlah_terisi", "aktif",
      "ditetapkan_admin", "diukur_pada", "diubah_oleh", "diubah_pada",
    ]);
  });

  it("ketiga tabel ikut cadangan JSON mode Postgres-mati", () => {
    for (const t of TABEL) expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
  });
});

describe("batasan ditegakkan (tabel dari schema.ts, di pg-mem)", () => {
  const PADA = "2026-09-29T00:00:00.000Z";

  it("komentar: selesai hanya 0/1, isi dan bagian wajib", async () => {
    const S =
      "INSERT INTO aleta_bas_komentar (id, nomor_perkara, bagian, isi, penulis_id, dibuat_pada, selesai) VALUES (?,?,?,?,?,?,?)";
    await d().run(S, ["k1", "1/Pdt.G/2026/PA.Dgl", "umum", "isi", "usr-hakim", PADA, 0]);
    await expect(d().run(S, ["k2", "1/Pdt.G/2026/PA.Dgl", "umum", "isi", "usr-hakim", PADA, 2])).rejects.toThrow();
    await expect(d().run(S, ["k1", "1/Pdt.G/2026/PA.Dgl", "umum", "isi", "usr-hakim", PADA, 0])).rejects.toThrow();
  });

  it("templat: jenis hanya pertimbangan/pasal", async () => {
    const S =
      "INSERT INTO aleta_templat_hukum (id, jenis, kunci, judul, isi, dibuat_oleh, dibuat_pada, diubah_oleh, diubah_pada) VALUES (?,?,?,?,?,?,?,?,?)";
    await d().run(S, ["t1", "pasal", "f", "j", "i", "u", PADA, "u", PADA]);
    await expect(d().run(S, ["t2", "putusan", "f", "j", "i", "u", PADA, "u", PADA])).rejects.toThrow();
  });

  it("variabel wajib: satu baris per (jenis, kode), sumber ukur/admin, aktif 0/1", async () => {
    const S = "INSERT INTO aleta_abt_variabel_wajib (jenis, kode, sumber, aktif, diubah_pada) VALUES (?,?,?,?,?)";
    await d().run(S, ["cerai gugat", "1214", "ukur", 1, PADA]);
    await expect(d().run(S, ["cerai gugat", "1214", "admin", 1, PADA])).rejects.toThrow();
    await d().run(S, ["cerai talak", "1214", "ukur", 1, PADA]);
    await expect(d().run(S, ["cerai gugat", "5105", "tebak", 1, PADA])).rejects.toThrow();
    await expect(d().run(S, ["cerai gugat", "5106", "admin", 3, PADA])).rejects.toThrow();
  });
});
