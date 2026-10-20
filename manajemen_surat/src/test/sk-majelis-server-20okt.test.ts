// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  bacaBerlakuMulai,
  bacaHariSidang,
  bacaJejakSk,
  hapusMajelis,
  simpanBerlakuMulai,
  simpanHariSidang,
  susunPeringatanSk,
  type HariSidangMajelis,
} from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";

/**
 * ============================================================================
 * HALAMAN ADMIN SK MAJELIS - SISI SERVER (20 Okt 2026, agen B1)
 * ============================================================================
 *
 * Tambah/ubah/hapus majelis, "berlaku mulai", jejak siapa-kapan, validasi kode,
 * dan peringatan pegawai SK yang tidak aktif/bermutasi/berganti jabatan.
 * Bentuk data lama tidak berubah: majelis bawaan tetap terbaca, penyimpanan
 * tanpa kolom baru tetap berjalan.
 */

let db: AletaDatabase | null = null;
const ADMIN = "usr-admin";

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});
afterEach(async () => {
  await db?.close();
  db = null;
});

const kode = async () => (await bacaHariSidang(db!)).map((m) => m.majelisKode);

describe("menambah, mengubah, menghapus majelis", () => {
  it("majelis bawaan terbaca; menambah majelis baru menyimpan hakim berurutan dan pendamping berpasangan", async () => {
    expect(await kode()).toEqual(["A", "B", "C1"]);
    await simpanHariSidang(db!, {
      actorUserId: ADMIN,
      majelisKode: "C2",
      hari: 4,
      hakimKode: "C2,C1,C3",
      paniteraKode: "D6,D7",
      paniteraId: "D6=30,D7=0",
    });
    const baru = (await bacaHariSidang(db!)).find((m) => m.majelisKode === "C2")!;
    expect(baru.hakimKode).toEqual(["C2", "C1", "C3"]);
    expect(baru.panitera).toEqual([
      { kode: "D6", id: 30 },
      { kode: "D7", id: 0 },
    ]);
    expect(baru.hari).toBe(4);
  });

  it("menghapus majelis bawaan: tidak muncul lagi dari nilai awal di kode, data lain utuh", async () => {
    await hapusMajelis(db!, { actorUserId: ADMIN, majelisKode: "C1" });
    expect(await kode()).toEqual(["A", "B"]);
    // Tetap hilang pada pembacaan berikutnya, dan majelis lain tidak tersentuh.
    expect(await kode()).toEqual(["A", "B"]);
    expect((await bacaHariSidang(db!)).find((m) => m.majelisKode === "A")!.hakimKode).toEqual(["A", "C1", "C3"]);
  });

  it("menghapus majelis yang sudah disunting, lalu menyimpannya lagi menghidupkannya kembali", async () => {
    await simpanHariSidang(db!, { actorUserId: ADMIN, majelisKode: "X1", hari: 2, hakimKode: "A,B", paniteraKode: "D", paniteraId: "D=1" });
    expect(await kode()).toContain("X1");
    await hapusMajelis(db!, { actorUserId: ADMIN, majelisKode: "X1" });
    expect(await kode()).not.toContain("X1");
    await simpanHariSidang(db!, { actorUserId: ADMIN, majelisKode: "X1", hari: 2, hakimKode: "A,B,C1" });
    expect((await bacaHariSidang(db!)).find((m) => m.majelisKode === "X1")!.hakimKode).toEqual(["A", "B", "C1"]);
  });

  it("menghapus majelis yang tidak ada ditolak; hanya Super Admin/Admin", async () => {
    await expect(hapusMajelis(db!, { actorUserId: ADMIN, majelisKode: "ZZ" })).rejects.toThrow(/tidak ada di SK/);
    await expect(hapusMajelis(db!, { actorUserId: "usr-hakim", majelisKode: "A" })).rejects.toThrow(/Super Admin dan Admin/);
    await expect(simpanHariSidang(db!, { actorUserId: "usr-hakim", majelisKode: "A", hari: 2 })).rejects.toThrow(/Super Admin dan Admin/);
  });

  it("kode yang tidak sah atau kembar ditolak sebelum tersimpan", async () => {
    await expect(simpanHariSidang(db!, { actorUserId: ADMIN, majelisKode: "A B", hari: 2 })).rejects.toThrow(/Kode majelis/);
    await expect(simpanHariSidang(db!, { actorUserId: ADMIN, majelisKode: "Q", hari: 2, hakimKode: "A,A,C1" })).rejects.toThrow(/tidak boleh kembar/);
    await expect(simpanHariSidang(db!, { actorUserId: ADMIN, majelisKode: "Q", hari: 2, hakimKode: "A,C1", paniteraKode: "D,D" })).rejects.toThrow(/tidak boleh kembar/);
    expect(await kode()).not.toContain("Q");
  });
});

describe("jejak perubahan (siapa, kapan, apa)", () => {
  it("tambah, ubah, hapus, dan berlaku mulai tercatat dengan pelakunya", async () => {
    await simpanHariSidang(db!, { actorUserId: ADMIN, majelisKode: "N1", hari: 3, hakimKode: "A,C1,C3" });
    await simpanHariSidang(db!, { actorUserId: ADMIN, majelisKode: "N1", hari: 4, hakimKode: "A,C3,C1" });
    await hapusMajelis(db!, { actorUserId: ADMIN, majelisKode: "N1" });
    await simpanBerlakuMulai(db!, { actorUserId: ADMIN, tanggal: "2026-09-01" });

    const jejak = await bacaJejakSk(db!, 20);
    expect(jejak.map((j) => j.aksi)).toEqual(
      expect.arrayContaining(["TAMBAH_SK_MAJELIS", "SIMPAN_SK_MAJELIS", "HAPUS_SK_MAJELIS", "UBAH_SK_BERLAKU_MULAI"])
    );
    const ubah = jejak.find((j) => j.aksi === "SIMPAN_SK_MAJELIS")!;
    expect(ubah.majelisKode).toBe("N1");
    expect(ubah.oleh.length).toBeGreaterThan(1);
    expect(ubah.pada).toMatch(/^20\d\d-/);
    expect(ubah.sebelum).toMatchObject({ hakim: "A,C1,C3" });
    expect(ubah.sesudah).toMatchObject({ hakim: "A,C3,C1" });
  });
});

describe("berlaku mulai", () => {
  it("belum diisi = tanggal SK; diisi tersimpan; dikosongkan kembali ke tanggal SK; tanggal tidak sah ditolak", async () => {
    expect(await bacaBerlakuMulai(db!)).toEqual({ tanggal: "2026-08-27", diisi: false });
    expect(await simpanBerlakuMulai(db!, { actorUserId: ADMIN, tanggal: "2026-09-01" })).toEqual({ tanggal: "2026-09-01", diisi: true });
    expect(await bacaBerlakuMulai(db!)).toEqual({ tanggal: "2026-09-01", diisi: true });
    expect(await simpanBerlakuMulai(db!, { actorUserId: ADMIN, tanggal: "" })).toEqual({ tanggal: "2026-08-27", diisi: false });
    await expect(simpanBerlakuMulai(db!, { actorUserId: ADMIN, tanggal: "31-09-2026" })).rejects.toThrow(/tidak sah/);
    await expect(simpanBerlakuMulai(db!, { actorUserId: "usr-hakim", tanggal: "2026-09-01" })).rejects.toThrow(/Super Admin dan Admin/);
  });
});

function majelisContoh(): HariSidangMajelis[] {
  return [
    {
      majelisKode: "A",
      hari: 3,
      namaHari: "Rabu",
      paniteraKode: ["D", "D4"],
      panitera: [
        { kode: "D", id: 26 },
        { kode: "D4", id: 18 },
      ],
      hakimKode: ["A", "C1", "ZZ"],
      akun: [],
      skNomor: "",
      skTanggal: "",
      skIkutBawaan: true,
      keterangan: "",
      bawaan: false,
    },
    {
      majelisKode: "B",
      hari: 2,
      namaHari: "Selasa",
      paniteraKode: ["D1", "D5"],
      panitera: [
        { kode: "D1", id: 29 },
        { kode: "D5", id: 99 },
      ],
      hakimKode: ["B", "C2", "C3"],
      akun: [],
      skNomor: "",
      skTanggal: "",
      skIkutBawaan: true,
      keterangan: "",
      bawaan: false,
    },
  ];
}

describe("peringatan pegawai SK", () => {
  const hakimAktif = [
    { id: 32, kode: "A", nama: "Fahri" },
    { id: 26, kode: "C1", nama: "Himawan" },
    { id: 33, kode: "B", nama: "Sudarmin" },
    { id: 28, kode: "C2", nama: "Idris" },
    { id: 31, kode: "C3", nama: "Derry" },
  ];
  const paniteraAktif = [
    { id: 26, kode: "D", nama: "Sri Susilowati" },
    { id: 18, kode: "D", nama: "Munifa" },
    { id: 29, kode: "", nama: "Sitti Nurhidayah" },
  ];

  it("hakim di SK yang tidak aktif, panitera tidak aktif, akun nonaktif (mutasi), dan jabatan berganti ditandai", () => {
    const hasil = susunPeringatanSk({
      majelis: majelisContoh(),
      hakimAktif,
      paniteraAktif,
      pegawaiTerbaca: true,
      akun: [
        // Munifa kini Panitera Muda Hukum: akunnya aktif tetapi bukan lagi panitera pengganti.
        { id: "u1", nama: "Munifa, S.H.", roleId: "panitera-muda", tambahan: [], aktif: true },
        // Sri Susilowati masih panitera pengganti: tidak ditandai.
        { id: "u2", nama: "Sri Susilowati", roleId: "panitera-pengganti", tambahan: [], aktif: true },
        // Sitti Nurhidayah akunnya nonaktif.
        { id: "u3", nama: "Sitti Nurhidayah, S.H.I., M.H", roleId: "panitera-pengganti", tambahan: [], aktif: false },
      ],
    });
    const teks = hasil.map((h) => `${h.majelisKode}:${h.kode}:${h.alasan}`);
    expect(teks).toContain("A:ZZ:hakim dengan kode ini sudah tidak aktif di SIPP");
    expect(teks).toContain("A:D4:jabatannya sekarang bukan lagi panitera pengganti");
    expect(teks).toContain("B:D1:akun portalnya sudah tidak aktif (mutasi)");
    expect(teks).toContain("B:D5:panitera yang diikat sudah tidak aktif di SIPP");
    expect(hasil.some((h) => h.kode === "D" && h.majelisKode === "A")).toBe(false);
  });

  it("daftar SIPP tidak terbaca: tidak menuduh hakim/panitera tidak aktif", () => {
    const hasil = susunPeringatanSk({ majelis: majelisContoh(), hakimAktif: [], paniteraAktif: [], pegawaiTerbaca: false, akun: [] });
    expect(hasil).toEqual([]);
  });
});

describe("migrasi 0079 (kolom aktif)", () => {
  const baca = (p: string) => readFileSync(path.join(path.resolve(process.cwd()), p), "utf8").replace(/\r\n/g, "\n");

  it("terdaftar di jurnal dengan idx unik, DDL schema.ts dan migrasi sama, data lama aktif bawaan", () => {
    const jurnal = JSON.parse(baca("drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string }> };
    const nomor = jurnal.entries.map((e) => e.idx);
    expect(new Set(nomor).size).toBe(nomor.length);
    expect(jurnal.entries.find((e) => e.tag === "0079_aleta_sk_majelis_aktif")?.idx).toBe(72);
    expect(baca("drizzle/0079_aleta_sk_majelis_aktif.sql")).toContain("ADD COLUMN IF NOT EXISTS aktif SMALLINT NOT NULL DEFAULT 1");
    expect(baca("src/server/db/schema.ts")).toContain("aktif SMALLINT NOT NULL DEFAULT 1,\n    updated_at TEXT NOT NULL");
    expect(baca("src/server/db/drizzle-schema.ts")).toContain('aktif: integer("aktif").notNull().default(1)');
  });
});
