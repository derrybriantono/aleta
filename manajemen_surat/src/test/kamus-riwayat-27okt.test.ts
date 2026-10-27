// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_KAMUS_RIWAYAT } from "@/server/db/schema";
import { bacaRiwayatKamus, kembalikanKeBenih, simpanPola, ubahStatusKamus } from "@/server/modules/aleta-ecourt/kamus-deteksi";

/**
 * 27 OKT 2026 - RIWAYAT PERUBAHAN KAMUS DETEKSI (migrasi 0116, idx 102): siapa, kapan, isi lama.
 * Pola baru dari layar Admin tercatat; mengubah, mengaktifkan, dan mengembalikan ke bawaan juga.
 */

const SQL = path.join(process.cwd(), "drizzle", "0116_aleta_kamus_riwayat.sql");
const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("migrasi 0116 - tiga tempat pendaftaran", () => {
  it("jurnal: 0116 di idx 102 tepat sekali, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(j.entries.filter((e) => e.tag.startsWith("0116_"))).toEqual([expect.objectContaining({ idx: 102, tag: "0116_aleta_kamus_riwayat" })]);
    expect(j.entries.filter((e) => e.idx === 102)).toHaveLength(1);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
  });

  it("pernyataan berkas = DDL_KAMUS_RIWAYAT, berjalan di pg-mem, tabel ikut cadangan, tanpa kunci asing", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual([...DDL_KAMUS_RIWAYAT.tabel, ...DDL_KAMUS_RIWAYAT.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT * FROM aleta_kamus_deteksi_riwayat")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_kamus_deteksi_riwayat");
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(readFileSync(SQL, "utf8").replace(/--.*$/gm, ""))).toBe(false);
  });
});

describe("riwayat tercatat saat kamus diubah dari layar Admin", () => {
  let db: AletaDatabase;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });
  afterEach(async () => {
    await db.close();
  });

  const pola = (regex: string, status = "draf") => ({
    kode: "uji-riwayat-damai",
    kelompok: "alasan",
    label: "uji riwayat",
    kunci: "F",
    regex,
    flags: "i",
    status,
    yakin: "ragu",
    contohBenar: ["Tergugat sering bertengkar"],
    contohSalah: ["Tergugat bermain bola"],
    ukur: { n: 0, tepat: 0, salahTangkap: 0 },
    catatan: "",
  });

  it("pola baru -> 'buat'; diubah -> 'ubah' dengan isi lama; diaktifkan -> 'status'; semuanya dengan siapa dan kapan", async () => {
    await simpanPola(db, "usr-super", pola("bertengkar"));
    await simpanPola(db, "usr-admin", pola("(?:bertengkar|cekcok)"));
    await ubahStatusKamus(db, "usr-super", { jenis: "pola", kode: "uji-riwayat-damai", status: "aktif" });
    const r = await bacaRiwayatKamus(db, { kode: "uji-riwayat-damai" });
    expect(r.map((x) => x.aksi).reverse()).toEqual(["buat", "ubah", "status"]);
    expect(r.map((x) => x.oleh).reverse()).toEqual(["usr-super", "usr-admin", "usr-super"]);
    const ubah = r.find((x) => x.aksi === "ubah")!;
    expect(ubah.isiLama?.regex).toBe("bertengkar");
    expect(ubah.isiBaru?.regex).toBe("(?:bertengkar|cekcok)");
    const status = r.find((x) => x.aksi === "status")!;
    expect(status.isiLama).toEqual({ status: "draf" });
    expect(status.isiBaru).toEqual({ status: "aktif" });
    for (const x of r) expect(Number.isNaN(Date.parse(x.pada))).toBe(false);
    // terbaru lebih dulu
    expect(r[0].aksi).toBe("status");
  });

  it("menyunting pola benih: isi lama = benih; mengembalikan ke bawaan tercatat dengan isi yang dibuang", async () => {
    const benih = JSON.parse(readFileSync(path.join(process.cwd(), "..", "aleta_bot", "kamus-deteksi", "awal", "alasan-rincian.json"), "utf8")) as { pola: Array<Record<string, unknown> & { kode: string }> };
    const dasar = benih.pola.find((p) => p.kode === "rincian-nafkah-tidak")!;
    await simpanPola(db, "usr-super", { ...dasar, kelompok: "alasan-rincian", bunyi: undefined, tambahan: { ...(dasar.bunyi ? { bunyi: ["bunyi baru {lawan}"] } : {}) } });
    let r = await bacaRiwayatKamus(db, { kode: "rincian-nafkah-tidak" });
    expect(r).toHaveLength(1);
    expect(r[0].aksi).toBe("ubah");
    expect(r[0].isiLama?.regex).toBe(dasar.regex);
    await kembalikanKeBenih(db, { jenis: "pola", kode: "rincian-nafkah-tidak", oleh: "usr-super" });
    r = await bacaRiwayatKamus(db, { kode: "rincian-nafkah-tidak" });
    expect(r.map((x) => x.aksi)).toEqual(["kembali-ke-benih", "ubah"]);
    expect(r[0].isiBaru).toBeNull();
    expect(r[0].isiLama?.kode).toBe("rincian-nafkah-tidak");
  });

  it("riwayat yang tidak dapat ditulis tidak menggagalkan simpan; kode lain tidak ikut terbaca", async () => {
    await db.run("DROP TABLE aleta_kamus_deteksi_riwayat");
    const baris = await simpanPola(db, "usr-super", pola("bertengkar"));
    expect(baris.kode).toBe("uji-riwayat-damai");
    expect(await bacaRiwayatKamus(db, { kode: "uji-riwayat-damai" })).toEqual([]);
  });
});
