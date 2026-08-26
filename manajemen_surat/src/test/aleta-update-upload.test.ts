import { promises as fs } from "fs";
import path from "path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { stageAletaUpdatePackage } from "@/server/modules/system-update/service";

/**
 * Unggah paket pembaruan = mengirim kode yang akan berjalan di server, jadi
 * pemeriksaannya harus ketat. Yang dijaga di sini:
 *   - nama berkas tidak bisa dipakai untuk keluar dari folder tujuan
 *   - berkas non-gzip yang diganti namanya jadi .tar.gz ditolak
 *   - checksum yang tidak cocok ditolak
 *   - berkas terlalu besar ditolak
 *
 * Pemeriksaan isi arsip (path traversal di dalam tar) dilakukan skrip host
 * sebelum mengekstrak, karena di situlah ekstraksi terjadi.
 */
const GZIP_HEADER = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
const paketSah = Buffer.concat([GZIP_HEADER, Buffer.alloc(64, 7)]);

// Folder tujuan dihitung dari process.cwd() saat modul dimuat, jadi tidak bisa
// dialihkan lewat chdir di dalam test. Berkas yang benar-benar ditulis karena
// itu dibersihkan sendiri setelah selesai agar repo tidak ikut kotor.
const INBOX_NYATA = path.join(process.cwd(), "reports", "updates", "inbox");
const berkasDibuat: string[] = [];

function catat(namaBerkas: string) {
  berkasDibuat.push(path.join(INBOX_NYATA, namaBerkas));
  berkasDibuat.push(path.join(INBOX_NYATA, `${namaBerkas}.sha256`));
}

beforeAll(async () => {
  await fs.mkdir(INBOX_NYATA, { recursive: true });
});

afterAll(async () => {
  for (const berkas of berkasDibuat) {
    await fs.rm(berkas, { force: true });
  }
  await fs.rm(path.join(INBOX_NYATA, "uploads.jsonl"), { force: true });
});

const dasar = { bytes: paketSah, actorLabel: "Super Admin Uji" };

describe("nama berkas paket pembaruan", () => {
  it("menerima nama paket resmi", async () => {
    catat("aleta-installer-1.5.13.tar.gz");
    const hasil = await stageAletaUpdatePackage({ ...dasar, fileName: "aleta-installer-1.5.13.tar.gz" });
    expect(hasil.fileName).toBe("aleta-installer-1.5.13.tar.gz");
    expect(hasil.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("menolak nama yang mencoba keluar folder", async () => {
    for (const nama of ["../../etc/jahat.tar.gz", "/etc/jahat.tar.gz", "..%2Fjahat.tar.gz"]) {
      await expect(stageAletaUpdatePackage({ ...dasar, fileName: nama })).rejects.toThrow(/tidak valid/i);
    }
  });

  it("menolak berkas selain .tar.gz", async () => {
    for (const nama of ["paket.zip", "skrip.sh", "paket.tar", "paket.tar.gz.exe"]) {
      await expect(stageAletaUpdatePackage({ ...dasar, fileName: nama })).rejects.toThrow(/tidak valid/i);
    }
  });

  it("menolak nama dengan spasi atau karakter aneh", async () => {
    await expect(stageAletaUpdatePackage({ ...dasar, fileName: "paket update.tar.gz" })).rejects.toThrow(/tidak valid/i);
    await expect(stageAletaUpdatePackage({ ...dasar, fileName: "paket;rm -rf.tar.gz" })).rejects.toThrow(/tidak valid/i);
  });
});

describe("isi berkas diperiksa, bukan hanya namanya", () => {
  it("menolak berkas yang bukan gzip walau bernama .tar.gz", async () => {
    const palsu = Buffer.from("#!/bin/bash\nrm -rf /\n", "utf8");
    await expect(
      stageAletaUpdatePackage({ ...dasar, bytes: palsu, fileName: "menyamar.tar.gz" })
    ).rejects.toThrow(/bukan arsip/i);
  });

  it("menolak berkas kosong", async () => {
    await expect(
      stageAletaUpdatePackage({ ...dasar, bytes: Buffer.alloc(0), fileName: "kosong.tar.gz" })
    ).rejects.toThrow(/kosong/i);
  });
});

describe("checksum", () => {
  it("menolak bila checksum yang diminta tidak cocok", async () => {
    await expect(
      stageAletaUpdatePackage({ ...dasar, fileName: "cek.tar.gz", expectedSha256: "a".repeat(64) })
    ).rejects.toThrow(/checksum/i);
  });

  it("menerima bila checksum cocok", async () => {
    const { createHash } = await import("crypto");
    const sha = createHash("sha256").update(paketSah).digest("hex");
    catat("cocok.tar.gz");
    const hasil = await stageAletaUpdatePackage({ ...dasar, fileName: "cocok.tar.gz", expectedSha256: sha });
    expect(hasil.sha256).toBe(sha);
  });
});

describe("batas ukuran", () => {
  it("menolak paket melebihi 300 MB", async () => {
    // Buffer besar dibuat tanpa mengisi data agar uji tetap ringan.
    const besar = Buffer.alloc(301 * 1024 * 1024);
    besar[0] = 0x1f;
    besar[1] = 0x8b;
    await expect(stageAletaUpdatePackage({ ...dasar, bytes: besar, fileName: "besar.tar.gz" })).rejects.toThrow(
      /melebihi batas/i
    );
  });
});
