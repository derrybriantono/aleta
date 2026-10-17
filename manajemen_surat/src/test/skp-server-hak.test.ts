// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AktorSkp, PeranAktorSkp } from "@/lib/skp-jabatan-tipe";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_SKP_JABATAN } from "@/server/db/schema";
import { bolehLihatSkp, bolehTinjauSkp, bolehUbahTargetSkp, peranAktorSkp } from "@/server/modules/skp/hak";
import { sarankanJabatanSkp } from "@/server/modules/skp/pemetaan";

/**
 * ============================================================================
 * SKP JABATAN - PENDAFTARAN MIGRASI 0070 (TIGA TEMPAT) DAN MATRIKS HAK
 * ============================================================================
 *
 *   1. migrasi 0070 (idx 67): berkas = DDL_SKP_JABATAN di schema.ts, jurnal
 *      tanpa lubang, tabelnya ikut IN_MEMORY_TABLE_PERSISTENCE_ORDER dan
 *      sungguh ada di basis data yang disiapkan ensureAletaSchema;
 *   2. bolehLihatSkp: sendiri -> atasan langsung -> Ketua/Wakil/Panitera ->
 *      Super Admin/Admin -> ditolak; ubah isian hanya pemilik; ubah target
 *      Panitera/Ketua/Super Admin/Admin;
 *   3. saran jabatan: Ketua vs Wakil dari peran ALETA, rangkap Panitera + PP.
 */

const pernyataan = (sql: string) =>
  sql
    .split("\n")
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const TABEL_SKP = ["aleta_skp_akun_pegawai", "aleta_skp_target", "aleta_skp_isian", "aleta_skp_penetapan"];

describe("migrasi 0070 - diklaim sekali, DDL berkas = schema.ts, terdaftar di tiga tempat", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0070_aleta_skp_jabatan.sql");

  it("jurnal: 0070 di idx 67 sekali, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0070_"))).toEqual([
      expect.objectContaining({ idx: 67, tag: "0070_aleta_skp_jabatan" }),
    ]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("(a)+(b) pernyataan berkas = DDL_SKP_JABATAN, dan berjalan di pg-mem", () => {
    const berkas = pernyataan(readFileSync(SQL, "utf8"));
    expect(berkas.length).toBe(DDL_SKP_JABATAN.tabel.length);
    expect(berkas).toEqual(DDL_SKP_JABATAN.tabel.map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    for (const t of TABEL_SKP) expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
  });

  it("(c) keempat tabel ikut cadangan mode ingatan", () => {
    for (const t of TABEL_SKP) expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    // Tidak ganda.
    for (const t of TABEL_SKP) expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER.filter((x) => x === t).length).toBe(1);
  });

  describe("basis data siap pakai", () => {
    let db: AletaDatabase | null = null;
    beforeEach(async () => {
      db = await createAletaDatabase({ useInMemory: true, seed: true });
    });
    afterEach(async () => {
      await db?.close();
      db = null;
    });

    it("keempat tabel ada dan indeks unik menolak baris kembar", async () => {
      for (const t of TABEL_SKP) {
        const hasil = await db!.queryAll(`SELECT * FROM ${t}`);
        expect(hasil).toEqual([]);
      }
      const masuk = () =>
        db!.run(
          `INSERT INTO aleta_skp_target (id, jabatan, tahun, kunci_rhk, kunci_indikator, target_nilai, target_teks, satuan, status, diubah_oleh_id, diubah_pada)
           VALUES (?, 'pp', 2026, 'r', 'i', 1, '1', 'x', 'usulan', 'u', '2026-01-01')`,
          [`t-${Math.random()}`]
        );
      await masuk();
      await expect(masuk()).rejects.toThrow();
    });
  });
});

const aktor = (userId: string, peran: PeranAktorSkp): AktorSkp => ({ userId, peran });
const PEGAWAI = { userId: "u-pp", atasanLangsungUserId: "u-atasan" };

describe("matriks hak lihat SKP", () => {
  it("sendiri: boleh, dan HANYA pemilik yang mengisi isian manual", () => {
    expect(bolehLihatSkp(aktor("u-pp", "lainnya"), PEGAWAI)).toEqual({
      boleh: true,
      alasan: "sendiri",
      bolehUbahIsian: true,
      bolehUbahTarget: false,
    });
  });

  it("atasan langsung: boleh lihat, tidak mengisi isian, tidak mengubah target", () => {
    expect(bolehLihatSkp(aktor("u-atasan", "lainnya"), PEGAWAI)).toEqual({
      boleh: true,
      alasan: "atasan-langsung",
      bolehUbahIsian: false,
      bolehUbahTarget: false,
    });
  });

  it("bukan atasan (rekan, atau atasan pegawai lain) ditolak", () => {
    for (const id of ["u-rekan", "u-atasan-lain"]) {
      expect(bolehLihatSkp(aktor(id, "lainnya"), PEGAWAI)).toEqual({
        boleh: false,
        alasan: "ditolak",
        bolehUbahIsian: false,
        bolehUbahTarget: false,
      });
    }
  });

  it("pegawai tanpa atasan tercatat: tidak seorang pun lolos sebagai atasan", () => {
    const hasil = bolehLihatSkp(aktor("", "lainnya"), { userId: "u-pp", atasanLangsungUserId: null });
    expect(hasil.boleh).toBe(false);
    expect(bolehLihatSkp(aktor("u-x", "lainnya"), { userId: "u-pp", atasanLangsungUserId: null }).boleh).toBe(false);
  });

  it("Ketua dan Panitera: lihat semua, ubah target, tanpa hak ubah isian orang lain", () => {
    for (const peran of ["ketua", "panitera"] as const) {
      expect(bolehLihatSkp(aktor("u-x", peran), PEGAWAI)).toEqual({
        boleh: true,
        alasan: peran,
        bolehUbahIsian: false,
        bolehUbahTarget: true,
      });
    }
  });

  it("Wakil Ketua: lihat semua tetapi LIHAT SAJA (tidak mengubah target)", () => {
    expect(bolehLihatSkp(aktor("u-x", "wakil-ketua"), PEGAWAI)).toEqual({
      boleh: true,
      alasan: "wakil-ketua",
      bolehUbahIsian: false,
      bolehUbahTarget: false,
    });
  });

  it("Super Admin dan Admin: lihat semua dan ubah target", () => {
    for (const peran of ["super-admin", "admin"] as const) {
      expect(bolehLihatSkp(aktor("u-x", peran), PEGAWAI)).toEqual({
        boleh: true,
        alasan: peran,
        bolehUbahIsian: false,
        bolehUbahTarget: true,
      });
    }
  });

  it("Ketua yang juga pemilik: sendiri menang dan ia dapat mengisi isiannya", () => {
    const hasil = bolehLihatSkp(aktor("u-k", "ketua"), { userId: "u-k", atasanLangsungUserId: null });
    expect(hasil).toMatchObject({ boleh: true, alasan: "sendiri", bolehUbahIsian: true, bolehUbahTarget: true });
  });

  it("peran ALETA -> peran SKP; peran lain 'lainnya'", () => {
    expect(["super-admin", "admin", "ketua", "wakil-ketua", "panitera", "hakim", "staf", "", null, undefined].map(peranAktorSkp)).toEqual([
      "super-admin",
      "admin",
      "ketua",
      "wakil-ketua",
      "panitera",
      "lainnya",
      "lainnya",
      "lainnya",
      "lainnya",
      "lainnya",
    ]);
    expect(bolehUbahTargetSkp("wakil-ketua")).toBe(false);
    expect(bolehUbahTargetSkp("lainnya")).toBe(false);
  });
});

describe("meninjau isian dan mengunci penetapan", () => {
  it("atasan langsung, Ketua, Panitera, Super Admin, Admin boleh - Wakil dan rekan tidak - pemilik tidak pernah", () => {
    expect(bolehTinjauSkp(aktor("u-atasan", "lainnya"), PEGAWAI)).toBe(true);
    for (const peran of ["ketua", "panitera", "super-admin", "admin"] as const) {
      expect(bolehTinjauSkp(aktor("u-x", peran), PEGAWAI)).toBe(true);
    }
    expect(bolehTinjauSkp(aktor("u-x", "wakil-ketua"), PEGAWAI)).toBe(false);
    expect(bolehTinjauSkp(aktor("u-rekan", "lainnya"), PEGAWAI)).toBe(false);
    expect(bolehTinjauSkp(aktor("u-pp", "lainnya"), PEGAWAI)).toBe(false);
    expect(bolehTinjauSkp(aktor("u-pp", "admin"), PEGAWAI)).toBe(false);
  });

  it("Wakil yang kebetulan atasan langsung boleh meninjau", () => {
    expect(bolehTinjauSkp(aktor("u-atasan", "wakil-ketua"), PEGAWAI)).toBe(true);
  });
});

describe("saran jabatan dari peran dan jabatan ALETA", () => {
  it("Ketua vs Wakil SELALU dari peran ALETA, bukan dari grup SIPP (keduanya grup 10)", () => {
    expect(sarankanJabatanSkp({ roleId: "ketua", positionId: "pos-ketua", grupSipp: [10] })).toEqual({ utama: "ketua", tambahan: [] });
    expect(sarankanJabatanSkp({ roleId: "wakil-ketua", positionId: "pos-wakil", grupSipp: [10] })).toEqual({
      utama: "wakil-ketua",
      tambahan: [],
    });
  });

  it("posisi ALETA menentukan Panmud dan PP; peran menentukan sisanya", () => {
    expect(sarankanJabatanSkp({ roleId: "pejabat-struktural", positionId: "pos-panitera-muda-gugatan" }).utama).toBe("panmud-gugatan");
    expect(sarankanJabatanSkp({ roleId: "staf", positionId: "pos-panitera-pengganti" }).utama).toBe("pp");
    expect(sarankanJabatanSkp({ roleId: "panitera", positionId: "pos-panitera" }).utama).toBe("panitera");
    expect(sarankanJabatanSkp({ roleId: "jurusita", positionId: "pos-lain" }).utama).toBe("jurusita");
  });

  it("tanpa petunjuk lain: null (Petugas Meja/Operator dipetakan manual); dugaan grup mengisi kekosongan", () => {
    expect(sarankanJabatanSkp({ roleId: "staf", positionId: "pos-staf-umum" })).toEqual({ utama: null, tambahan: [] });
    expect(sarankanJabatanSkp({ roleId: "staf", positionId: "pos-staf-umum", dugaanSipp: "kasir" }).utama).toBe("kasir");
    expect(sarankanJabatanSkp({ roleId: "staf", positionId: "pos-staf-umum", grupSipp: [702] }).utama).toBe("kasir");
  });

  it("rangkap: Panitera/Panmud yang juga grup PP -> blok tambahan PP; PP murni tanpa tambahan", () => {
    expect(sarankanJabatanSkp({ roleId: "panitera", positionId: "pos-panitera", grupSipp: [30, 500] })).toEqual({
      utama: "panitera",
      tambahan: ["pp"],
    });
    expect(sarankanJabatanSkp({ roleId: "pejabat-struktural", positionId: "pos-panitera-muda-hukum", grupSipp: [430, 500] })).toEqual({
      utama: "panmud-hukum",
      tambahan: ["pp"],
    });
    expect(sarankanJabatanSkp({ roleId: "staf", positionId: "pos-panitera-pengganti", grupSipp: [500] }).tambahan).toEqual([]);
  });
});
