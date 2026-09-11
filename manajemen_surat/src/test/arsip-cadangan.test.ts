// @vitest-environment node

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  ISI_PAKET_PEMBARUAN,
  akarAplikasi,
  bersihkanArsip,
  buatArsipBasisData,
  buatArsipPembaruan,
  mimeUntukFormat,
  pilihFormat,
  susunTar,
} from "@/server/modules/backups/arsip";

/**
 * Arsip unduhan dari Update Manager.
 *
 * Yang dijaga: format dipilih dari alat yang ADA (bukan dijanjikan), daftar
 * isi paket pembaruan sama persis dengan skrip host, tar yang disusun sendiri
 * dapat dibaca kembali, dan arsip basis data selalu jadi walau pg_dump tidak
 * ada - dengan sumbernya disebut, bukan disamarkan.
 */
let db: AletaDatabase | null = null;

/** Nama seluruh entri pada tar ustar - dibaca dari kepalanya, blok demi blok. */
function namaEntriTar(tar: Buffer) {
  const nama: string[] = [];
  let posisi = 0;
  while (posisi + 512 <= tar.length) {
    const kepala = tar.subarray(posisi, posisi + 512);
    if (kepala.every((b) => b === 0)) break;
    // [\s\S] alih-alih penanda /s: penanda itu menuntut sasaran es2018,
    // dan tsconfig proyek ini lebih rendah - kelasnya sama persis.
    const bersih = (b: Buffer) => b.toString("utf8").replace(/\0[\s\S]*$/, "");
    const awalan = bersih(kepala.subarray(345, 500));
    const berkas = bersih(kepala.subarray(0, 100));
    nama.push(awalan ? `${awalan}/${berkas}` : berkas);
    const ukuran = parseInt(bersih(kepala.subarray(124, 136)).trim() || "0", 8);
    posisi += 512 + Math.ceil(ukuran / 512) * 512;
  }
  return nama;
}

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

describe("format dipilih dari alat yang ada", () => {
  it("rar bila ada, lalu 7z, lalu xz, lalu gzip", () => {
    expect(pilihFormat({ rar: true, "7z": true, xz: true })).toBe("rar");
    expect(pilihFormat({ rar: false, "7z": true, xz: true })).toBe("7z");
    expect(pilihFormat({ rar: false, "7z": false, xz: true })).toBe("tar.xz");
    expect(pilihFormat({})).toBe("tar.gz");
  });

  it("tiap format punya jenis MIME-nya sendiri", () => {
    expect(mimeUntukFormat("rar")).toContain("rar");
    expect(mimeUntukFormat("7z")).toContain("7z");
    expect(mimeUntukFormat("tar.xz")).toContain("xz");
    expect(mimeUntukFormat("tar.gz")).toContain("gzip");
  });
});

describe("daftar isi paket pembaruan sama dengan skrip host", () => {
  it("setiap butir di scripts/aleta-make-update.sh ada di ISI_PAKET_PEMBARUAN, dan sebaliknya", async () => {
    // Dua daftar yang sama di dua tempat akan menyimpang; uji ini yang
    // menahannya sampai keduanya dijadikan satu.
    const skrip = await readFile(path.resolve(akarAplikasi(), "scripts/aleta-make-update.sh"), "utf8");
    const blok = skrip.slice(skrip.indexOf("for item in"), skrip.indexOf("\ndo"));
    const dariSkrip = blok
      .split("\n")
      .slice(1)
      .map((b) => b.replace(/\\\s*$/, "").trim())
      .filter((b) => b && !b.startsWith("#"));
    expect(dariSkrip.length).toBeGreaterThan(20);
    expect([...dariSkrip].sort()).toEqual([...ISI_PAKET_PEMBARUAN].sort());
  });
});

describe("tar yang disusun sendiri", () => {
  let akar = "";

  beforeEach(async () => {
    akar = await mkdtemp(path.join(os.tmpdir(), "aleta-uji-tar-"));
    await mkdir(path.join(akar, "sub/dalam"), { recursive: true });
    await writeFile(path.join(akar, "a.txt"), "isi a");
    await writeFile(path.join(akar, "sub/dalam/b.txt"), "isi b yang sedikit lebih panjang");
  });

  afterEach(async () => {
    await rm(akar, { recursive: true, force: true });
  });

  it("memuat nama berkas dan isinya, dengan kepala ustar", async () => {
    const { tar, jumlah } = await susunTar(akar, ["a.txt", "sub/dalam/b.txt"]);
    expect(jumlah).toBe(2);
    expect(tar.length % 512).toBe(0);
    const teks = tar.toString("latin1");
    expect(teks).toContain("a.txt");
    expect(teks).toContain("sub/dalam/b.txt");
    expect(teks).toContain("isi b yang sedikit lebih panjang");
    expect(tar.subarray(257, 262).toString()).toBe("ustar");
  });
});

describe("arsip basis data dan pembaruan tanpa alat luar", () => {
  it("basis data selalu jadi: tanpa pg_dump, SQL polos susunan ALETA dan sumbernya disebut", async () => {
    const hasil = await buatArsipBasisData(db!, { rar: false, "7z": false, xz: false, pg_dump: false });
    try {
      expect(hasil.format).toBe("tar.gz");
      expect(hasil.namaBerkas).toMatch(/^aleta-database-\d{8}-\d{6}\.tar\.gz$/);
      expect(hasil.byteLength).toBeGreaterThan(200);
      expect(hasil.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(hasil.catatan.join(" ")).toMatch(/SQL polos susunan ALETA/);

      const tar = gunzipSync(await readFile(hasil.jalur)).toString("latin1");
      expect(tar).toContain("BACA-SAYA-DATABASE.txt");
      expect(tar).toMatch(/aleta-portable-\d{8}-\d{6}\.sql/);
      expect(tar).toContain("mysqldump --single-transaction aleta_bot");
    } finally {
      await bersihkanArsip(hasil);
    }
  });

  it("paket pembaruan disusun portal bila belum ada paket dari host, dan namanya menyebut asalnya", async () => {
    const laporanKosong = await mkdtemp(path.join(os.tmpdir(), "aleta-uji-laporan-"));
    try {
      const hasil = await buatArsipPembaruan(laporanKosong);
      try {
        expect(hasil.namaBerkas).toMatch(/^aleta-update-.*-dari-portal\.tar\.gz$/);
        expect(hasil.format).toBe("tar.gz");
        expect(hasil.byteLength).toBeGreaterThan(1000);
        // Yang diperiksa NAMA ENTRI tar, bukan teks arsipnya: isi berkas
        // sumber sendiri banyak menyebut "node_modules/", dan pemeriksaan
        // teks akan gagal karena skrip pembaruan menuliskan jalur itu.
        const nama = namaEntriTar(gunzipSync(await readFile(hasil.jalur)));
        expect(nama.length).toBeGreaterThan(100);
        expect(nama.some((n) => n.endsWith("manajemen_surat/package.json"))).toBe(true);
        expect(nama.filter((n) => /(^|\/)(node_modules|\.next|\.git)\//.test(n))).toEqual([]);
      } finally {
        await bersihkanArsip(hasil);
      }
    } finally {
      await rm(laporanKosong, { recursive: true, force: true });
    }
  }, 300_000);

  it("paket dari host dipakai lebih dulu bila ada", async () => {
    const laporan = await mkdtemp(path.join(os.tmpdir(), "aleta-uji-laporan-"));
    try {
      await mkdir(path.join(laporan, "updates"), { recursive: true });
      const palsu = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03, 0x00]);
      await writeFile(path.join(laporan, "updates", "aleta-update-9.9.9.tar.gz"), palsu);
      const hasil = await buatArsipPembaruan(laporan);
      expect(hasil.namaBerkas).toBe("aleta-update-9.9.9.tar.gz");
      expect(hasil.direktoriSementara).toBe("");
      expect(hasil.catatan.join(" ")).toContain("host");
      await bersihkanArsip(hasil);
    } finally {
      await rm(laporan, { recursive: true, force: true });
    }
  });
});
