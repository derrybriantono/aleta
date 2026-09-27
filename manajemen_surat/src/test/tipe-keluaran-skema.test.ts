// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_TIPE_KELUARAN } from "@/server/db/schema";

/**
 * ============================================================================
 * MIGRASI 0050 - TIGA TEMPAT PENDAFTARAN, SATU BUNYI
 * ============================================================================
 *
 * Tabel tipe keluaran harus terdaftar di tiga tempat, dan yang terlewat gagal
 * DIAM-DIAM:
 *   (a) drizzle/0050_aleta_tipe_keluaran.sql dan entrinya di _journal.json -
 *       dijalankan Postgres saat boot;
 *   (b) DDL_TIPE_KELUARAN di schema.ts - dijalankan ensureAletaSchema, satu-
 *       satunya jalan tabel itu ada di pg-mem dan mode cadangan;
 *   (c) daftar cadangan JSON (dijaga tabel-cadangan-terdaftar.test.ts).
 *
 * Yang dijaga di sini: (a) dan (b) berbunyi SAMA - dibandingkan sebagai teks
 * yang dinormalkan DAN sebagai struktur yang sungguh terbentuk ketika keduanya
 * dijalankan - dan batasannya sungguh menolak yang harus ditolak.
 */

const AKAR = path.resolve(__dirname, "../..");
const BERKAS_SQL = path.join(AKAR, "drizzle", "0050_aleta_tipe_keluaran.sql");
const JURNAL = path.join(AKAR, "drizzle", "meta", "_journal.json");

/** Buang komentar baris, rapatkan spasi, pisah per pernyataan. */
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

async function kolomTipeKeluaran(kueri: (sql: string) => Promise<Kolom[]>) {
  return kueri(
    `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name IN ('aleta_tipe_keluaran', 'aleta_tipe_keluaran_riwayat')
      ORDER BY table_name, ordinal_position`
  );
}

const SISIP =
  "INSERT INTO aleta_tipe_keluaran (id, golongan, daftar, kunci, nilai, data, asal, sidik, aktif, keadaan, urutan, versi, dibuat_oleh, dibuat_at, diubah_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
const PADA = "2026-09-25T00:00:00.000Z";
function baris(ubah: Partial<Record<"id" | "golongan" | "asal" | "keadaan" | "sidik", string>> = {}) {
  return [
    ubah.id ?? "uji-1",
    ubah.golongan ?? "bas",
    "bas.kehadiran.bunyi",
    "",
    "hadir secara pribadi",
    "{}",
    ubah.asal ?? "bawaan",
    ubah.sidik ?? "sidik-uji",
    1,
    ubah.keadaan ?? "disahkan",
    0,
    1,
    "benih",
    PADA,
    PADA,
  ];
}

let db: AletaDatabase | null = null;

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: false });
});

afterAll(async () => {
  await db?.close();
  db = null;
});

describe("jurnal migrasi - nomor 0050 diklaim sekali, berkasnya ada", () => {
  const jurnal = JSON.parse(readFileSync(JURNAL, "utf8")) as { entries: { idx: number; tag: string }[] };

  it("entri berurutan tanpa lubang, dan idx 50 bertag 0050_aleta_tipe_keluaran tepat sekali", () => {
    // Sejak 0051 (rekam antrian berdetik, 27 September 2026) 0050 bukan lagi
    // entri TERAKHIR - dan memang tidak akan pernah lagi. Yang dijaga tetap
    // yang dulu dimaksud: nomornya diklaim sekali, pada idx yang benar, dan
    // jurnalnya tidak berlubang. Panjang jurnal tidak dipaku: ia bertambah
    // tiap migrasi baru, dan penjaga yang memakunya patah tanpa ada yang salah.
    expect(jurnal.entries.length).toBeGreaterThanOrEqual(51);
    jurnal.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(jurnal.entries.find((e) => e.idx === 50)).toMatchObject({ idx: 50, tag: "0050_aleta_tipe_keluaran" });
    expect(jurnal.entries.filter((e) => e.tag.startsWith("0050_"))).toHaveLength(1);
  });

  it("setiap entri jurnal punya berkas .sql dan setiap berkas punya entri - jurnal tanpa berkas mematahkan boot", () => {
    const tag = new Set(jurnal.entries.map((e) => e.tag));
    const berkas = readdirSync(path.join(AKAR, "drizzle"))
      .filter((n) => n.endsWith(".sql"))
      .map((n) => n.replace(/\.sql$/, ""));
    expect([...tag].filter((t) => !berkas.includes(t))).toEqual([]);
    expect(berkas.filter((b) => !tag.has(b))).toEqual([]);
  });
});

describe("DDL berkas 0050 = DDL yang dijalankan ensureAletaSchema", () => {
  it("teks yang dinormalkan sama, pernyataan demi pernyataan", () => {
    const dariBerkas = pernyataan(readFileSync(BERKAS_SQL, "utf8"));
    const dariSkema = [...DDL_TIPE_KELUARAN.tabel, ...DDL_TIPE_KELUARAN.indeks].map((s) => pernyataan(s)[0]);
    expect(dariBerkas).toEqual(dariSkema);
    expect(dariBerkas).toHaveLength(4);
  });

  it("struktur yang terbentuk sama: berkas dijalankan di pg-mem kosong, skema lewat createAletaDatabase", async () => {
    const kosong = newDb();
    kosong.public.none(readFileSync(BERKAS_SQL, "utf8"));
    const dariBerkas = kosong.public.many(
      `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name IN ('aleta_tipe_keluaran', 'aleta_tipe_keluaran_riwayat')
        ORDER BY table_name, ordinal_position`
    ) as Kolom[];
    const dariSkema = await kolomTipeKeluaran((sql) => (db as AletaDatabase).queryAll<Kolom>(sql));
    expect(dariSkema).toEqual(dariBerkas);
    expect(dariSkema.filter((k) => k.table_name === "aleta_tipe_keluaran").map((k) => k.column_name)).toEqual([
      "id", "golongan", "daftar", "kunci", "nilai", "data", "asal", "sidik", "aktif", "keadaan", "urutan",
      "versi", "menggantikan_id", "alasan", "hasil_ukur", "dibuat_oleh", "dibuat_at", "disahkan_oleh",
      "atas_perintah", "disahkan_at", "diubah_at",
    ]);
    expect(dariSkema.filter((k) => k.table_name === "aleta_tipe_keluaran_riwayat").map((k) => k.column_name)).toEqual([
      "id", "butir_id", "tindakan", "dari", "ke", "alasan", "oleh", "pada",
    ]);
  });
});

describe("batasan ditegakkan (tabel dari schema.ts, di pg-mem)", () => {
  it("INSERT kembar (daftar, sidik) ditolak; ON CONFLICT (daftar, sidik) DO NOTHING tidak menggandakan", async () => {
    const d = db as AletaDatabase;
    await d.run(SISIP, baris({ id: "uk-1", sidik: "kembar" }));
    await expect(d.run(SISIP, baris({ id: "uk-2", sidik: "kembar" }))).rejects.toThrow();
    await d.run(`${SISIP} ON CONFLICT (daftar, sidik) DO NOTHING`, baris({ id: "uk-3", sidik: "kembar" }));
    const n = await d.queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran WHERE sidik = 'kembar'");
    expect(Number(n?.n)).toBe(1);
  });

  it("CHECK golongan menolak nilai di luar bas/putusan/bersama", async () => {
    const d = db as AletaDatabase;
    for (const golongan of ["bas", "putusan", "bersama"]) {
      await d.run(SISIP, baris({ id: `gol-${golongan}`, golongan, sidik: `gol-${golongan}` }));
    }
    for (const golongan of ["relaas", "BAS", ""]) {
      await expect(d.run(SISIP, baris({ id: `gol-x-${golongan}`, golongan, sidik: `gol-x-${golongan}` }))).rejects.toThrow();
    }
  });

  it("CHECK asal dan keadaan menolak nilai asing", async () => {
    const d = db as AletaDatabase;
    await expect(d.run(SISIP, baris({ id: "as-1", asal: "cermin", sidik: "as-1" }))).rejects.toThrow();
    await expect(d.run(SISIP, baris({ id: "kd-1", keadaan: "dihapus", sidik: "kd-1" }))).rejects.toThrow();
  });

  it("CHECK tindakan riwayat menolak 'hapus' - tidak ada tindakan hapus", async () => {
    const d = db as AletaDatabase;
    const SISIP_RIWAYAT =
      "INSERT INTO aleta_tipe_keluaran_riwayat (id, butir_id, tindakan, oleh, pada) VALUES (?,?,?,?,?)";
    for (const tindakan of ["benih", "usul", "sahkan", "tolak", "matikan", "nyalakan", "ganti", "ukur", "yatim"]) {
      await d.run(SISIP_RIWAYAT, [`r-${tindakan}`, "uk-1", tindakan, "uji", PADA]);
    }
    await expect(d.run(SISIP_RIWAYAT, ["r-hapus", "uk-1", "hapus", "uji", PADA])).rejects.toThrow();
  });
});
