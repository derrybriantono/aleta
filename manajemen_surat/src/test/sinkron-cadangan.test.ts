// @vitest-environment node
import { generateKeyPairSync, createVerify } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * SINKRON & CADANGAN (butir 29 dan 30, 30 September 2026)
 * ============================================================================
 *
 * Yang dijaga:
 *   1. Pohon folder Drive = isi ZIP "Unduh seluruh perkara" - dibandingkan
 *      dengan ZIP yang SUNGGUH dijawab rute berkas-zip, bukan dengan salinan.
 *   2. Bertambah: isi yang sama tidak diunggah dua kali; yang berubah
 *      memperbarui berkas yang sama; berkas yang hilang tidak dibuang.
 *   3. Sandi arsip bolak-balik, termasuk dibuka alat laptop.
 *   4. Alat laptop menolak basis data `sipp` dalam bentuk apa pun.
 *   5. Rahasia tidak pernah keluar dari jawaban API.
 *   6. Kewenangan: Admin melihat, hanya Super Admin menyimpan/menjalankan.
 *   7. Dump bot hanya mengirim pernyataan baca; dump tanpa penanda selesai ditolak.
 */

// ─── Tiruan bot (gateway) ────────────────────────────────────────────────────

let isiRelaas = "RELAAS-SATU";
const gateway = {
  getGatewayStatusPerkara: async (nomor: string) => ({
    ok: true,
    data: {
      ok: true,
      identitas: { nomorPerkara: nomor, perkaraId: "901" },
      pihak: [{ nama: "Penggugat Uji", pihakKe: 1, jenis: "Penggugat" }],
      tahapan: { terbaca: true, tahap: [{ kunci: "pmh", label: "PMH", tanggal: "2026-01-06", adaBerkas: true, dokumenId: 55 }] },
      ikrarTalak: { adaBerkas: false },
      arsipKeterangan: { terbaca: true, baris: [] },
    },
  }),
  getGatewayRincianSidang: async () => ({
    ok: true,
    data: {
      ok: true,
      perkaraId: "901",
      petitum: { ada: true, berkas: "g.docx" },
      relaas: [
        { id: 1, tanggalRelaas: "2026-01-10", peran: "Penggugat", namaPihak: "A", adaDokumen: true, adaResi: true, tanggalKirimPos: "2026-01-09" },
      ],
      jadwalPerkara: [{ sidangId: 7, urutanSidang: 1, tanggalSidang: "2026-01-20", agenda: "Sidang pertama", adaBas: true }],
      putusan: { adaBerkasPutusan: true, adaBerkasAnonim: false, tanggalPutusan: "2026-02-01" },
      dokumenSipp: [],
    },
  }),
  getGatewayArsipRincian: async () => ({
    ok: true,
    data: { dokumen: [{ documentKey: "k1", judulDokumen: "Jawaban Tergugat", adaPdf: true, adaWord: false }] },
  }),
  ambilBerkasSippGateway: async (jenis: string, id: string) =>
    new Response(jenis === "relaas" ? isiRelaas : `${jenis}-${id}`, {
      headers: { "content-disposition": `attachment; filename="${jenis}.pdf"` },
    }),
  ambilBerkasGateway: async (kunci: string) =>
    new Response(`ecourt-${kunci}`, { headers: { "content-disposition": 'attachment; filename="jawaban.pdf"' } }),
  cariGatewayPerkara: async () => ({ ok: true, data: { ok: true, perkara: [], adaLagi: false } }),
};

vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => gateway);

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
// Rute ZIP: kewenangan berkas ditiru supaya yang dibandingkan hanya isinya.
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Penguji" }) }));

let direktori = "";
beforeAll(async () => {
  direktori = await mkdtemp(path.join(os.tmpdir(), "aleta-sinkron-uji-"));
  process.env.ALETA_SINKRON_DIR = direktori;
});
afterAll(async () => {
  await rm(direktori, { recursive: true, force: true });
  delete process.env.ALETA_SINKRON_DIR;
});

/** Pembaca ZIP "store" (tanpa pemampatan) - bentuk yang disusun susunZip. */
function namaDiZip(zip: Buffer) {
  const nama: string[] = [];
  let i = 0;
  while (i + 30 <= zip.length && zip.readUInt32LE(i) === 0x04034b50) {
    const ukuran = zip.readUInt32LE(i + 18);
    const panjangNama = zip.readUInt16LE(i + 26);
    const tambahan = zip.readUInt16LE(i + 28);
    nama.push(zip.subarray(i + 30, i + 30 + panjangNama).toString("utf8"));
    i += 30 + panjangNama + tambahan + ukuran;
  }
  return nama;
}

/** Drive tiruan: id = jalur lengkapnya, supaya pohonnya dapat dibaca kembali. */
function driveTiruan() {
  const unggahan: Array<{ jalur: string; idLama: string }> = [];
  const dibuang: string[] = [];
  const klien = {
    ambil: async (id: string) => ({ id, name: id, trashed: false }),
    pastikanFolder: async (nama: string, induk: string) => `${induk}/${nama}`,
    buatFolder: async (nama: string, induk: string) => `${induk}/${nama}`,
    unggah: async (nama: string, induk: string, _isi: Buffer, idLama: string) => {
      unggahan.push({ jalur: `${induk}/${nama}`, idLama });
      return `f:${induk}/${nama}`;
    },
    buang: async (id: string) => {
      dibuang.push(id);
    },
    daftarAnak: async () => [],
  };
  return { klien, unggahan, dibuang };
}

const NOMOR = "273/Pdt.G/2026/PA.Dgl";

// ============================================================================
// 1-2. POHON DRIVE = ZIP, DAN BERTAMBAH
// ============================================================================

describe("berkas perkara ke Drive", () => {
  beforeEach(() => {
    isiRelaas = "RELAAS-SATU";
  });

  it("pohon folder Drive sama persis dengan isi ZIP tombol Unduh seluruh perkara", async () => {
    const rute = await import("@/app/api/aleta-ecourt/berkas-zip/route");
    const jawab = await rute.GET(
      new NextRequest(`http://localhost/api/aleta-ecourt/berkas-zip?nomor=${encodeURIComponent(NOMOR)}&isi=lengkap`)
    );
    expect(jawab.status).toBe(200);
    const namaZip = decodeURIComponent(/filename="([^"]+)"/.exec(jawab.headers.get("content-disposition") || "")![1]);
    const isiZip = namaDiZip(Buffer.from(await jawab.arrayBuffer()));
    expect(isiZip.length).toBeGreaterThan(10);

    const { sinkronBerkasPerkara } = await import("@/server/modules/sinkron/drive-berkas");
    const { normalkanPengaturan } = await import("@/server/modules/sinkron/pengaturan");
    const p = normalkanPengaturan({
      drive: {
        aktif: true,
        folderIndukId: "INDUK1234567",
        berkasPerkara: { aktif: true, tahunMulai: 2026, perkaraPerJalan: 10, ulangiSetelahHari: 0, jedaMs: 0, batasMbPerJalan: 100 },
      },
    });
    const d = driveTiruan();
    const hasil = await sinkronBerkasPerkara(d.klien as never, p, { daftarNomor: [NOMOR] });
    expect(hasil.galat).toEqual([]);

    const akar = `INDUK1234567/Berkas perkara/2026/${namaZip.replace(/\.zip$/, "")}/`;
    expect(namaZip).toBe("perkara-273-Pdt.G-2026-PA.Dgl.zip");
    const jalurDrive = d.unggahan.map((u) => {
      expect(u.jalur.startsWith(akar), u.jalur).toBe(true);
      return u.jalur.slice(akar.length);
    });
    expect([...jalurDrive].sort()).toEqual([...isiZip].sort());
    // Contoh bentuk yang dijanjikan kepada pengguna: subfolder bertingkat, bukan ZIP.
    expect(jalurDrive).toContain("00 Data SIPP/perkara.json");
    expect(jalurDrive.some((j) => j.startsWith("02 Relaas/Resi pos/"))).toBe(true);
    expect(jalurDrive.some((j) => j.startsWith("07 Penetapan/"))).toBe(true);
    expect(jalurDrive.some((j) => j.endsWith(".zip"))).toBe(false);
  });

  it("bertambah: yang sama tidak diunggah lagi, yang berubah memperbarui berkas yang sama", async () => {
    const { sinkronBerkasPerkara } = await import("@/server/modules/sinkron/drive-berkas");
    const { normalkanPengaturan } = await import("@/server/modules/sinkron/pengaturan");
    const p = normalkanPengaturan({
      drive: {
        aktif: true,
        folderIndukId: "INDUK7654321",
        berkasPerkara: { aktif: true, tahunMulai: 2026, perkaraPerJalan: 10, ulangiSetelahHari: 0, jedaMs: 0, batasMbPerJalan: 100 },
      },
    });
    const nomor = "88/Pdt.P/2026/PA.Dgl";
    const pertama = driveTiruan();
    const h1 = await sinkronBerkasPerkara(pertama.klien as never, p, { daftarNomor: [nomor] });
    expect(h1.berkasDiunggah).toBeGreaterThan(10);

    const kedua = driveTiruan();
    const h2 = await sinkronBerkasPerkara(kedua.klien as never, p, { daftarNomor: [nomor] });
    expect(h2.berkasDiunggah).toBe(0);
    expect(kedua.unggahan).toEqual([]);
    expect(h2.berkasSama).toBe(h1.berkasDiunggah);

    // Satu berkas berubah isinya (panjang sama, jadi DAFTAR ISI tidak ikut berubah).
    isiRelaas = "RELAAS-DUA!";
    const ketiga = driveTiruan();
    const h3 = await sinkronBerkasPerkara(ketiga.klien as never, p, { daftarNomor: [nomor] });
    expect(h3.berkasDiunggah).toBe(1);
    expect(ketiga.unggahan[0].jalur).toContain("/02 Relaas/01 - ");
    // Diperbarui di tempat, bukan berkas kedua bernama sama.
    expect(ketiga.unggahan[0].idLama).toContain("/02 Relaas/01 - ");
  });

  it("perkara yang baru diperiksa dilewati sampai jadwal ulangnya", async () => {
    const { pilihPerkara } = await import("@/server/modules/sinkron/drive-berkas");
    const kini = Date.parse("2026-09-30T00:00:00Z");
    const indeks = {
      daftarDiperbarui: "",
      perkara: {
        "1/Pdt.G/2026/PA.Dgl": { diperiksa: "2026-09-29T00:00:00Z", berkas: 1, byte: 1, galat: "" },
        "2/Pdt.G/2026/PA.Dgl": { diperiksa: "2026-09-01T00:00:00Z", berkas: 1, byte: 1, galat: "" },
      },
    };
    expect(pilihPerkara(["1/Pdt.G/2026/PA.Dgl", "2/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl"], indeks, 7, 10, kini)).toEqual([
      "3/Pdt.G/2026/PA.Dgl",
      "2/Pdt.G/2026/PA.Dgl",
    ]);
  });

  it("berkas bernama baru dengan isi lama: yang lama ke Sampah; berkas yang HILANG tidak dibuang", async () => {
    const { rencanakanUnggah } = await import("@/server/modules/sinkron/drive-berkas");
    const { createHash } = await import("node:crypto");
    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    const catatan = {
      nomor: "x",
      folderId: "F",
      folder: {},
      berkas: {
        "02 Relaas/01 - a.pdf": { sha256: sha("A"), byte: 1, id: "idA", diunggah: "" },
        "03 BAS/01 - bas.pdf": { sha256: sha("BAS"), byte: 3, id: "idBas", diunggah: "" },
      },
    };
    const r = rencanakanUnggah(
      [
        { nama: "02 Relaas/01 - b.pdf", isi: Buffer.from("B") },
        { nama: "02 Relaas/02 - a.pdf", isi: Buffer.from("A") },
      ],
      catatan
    );
    expect(r.unggah.map((u) => u.nama).sort()).toEqual(["02 Relaas/01 - b.pdf", "02 Relaas/02 - a.pdf"]);
    expect(r.buang).toEqual([{ nama: "02 Relaas/01 - a.pdf", id: "idA" }]);
    // BAS tidak ada di susunan (bot sedang tidak dapat membacanya) - TETAP di Drive.
    expect(r.buang.some((b) => b.id === "idBas")).toBe(false);
  });
});

// ============================================================================
// 3. SANDI ARSIP
// ============================================================================

const requireLokal = createRequire(import.meta.url);
const akarRepo = path.resolve(process.cwd(), "..");
async function alatLaptop() {
  // Alat laptop berupa .mjs mandiri tanpa berkas tipe; bentuknya dinyatakan di bawah.
  // @ts-expect-error TS7016
  return (await import("../../../tools/sinkron-laptop/sinkron-laptop.mjs")) as {
    bukaSandiBuffer: (b: Buffer, s: string) => Buffer;
    bukaSandiBerkas: (m: string, k: string, s: string) => Promise<void>;
    periksaKonfigurasi: (k: unknown) => { pulihkan: Record<string, { basisData: string }> };
    periksaTujuanMysql: (n: string, s?: string) => string;
    PenjagaSql: new () => NodeJS.ReadWriteStream;
  };
}

describe("sandi arsip AES-256-GCM", () => {
  it("bolak-balik buffer; sandi salah dan kepala yang diubah ditolak", async () => {
    const { sandikanBuffer, bukaSandiBuffer } = await import("@/server/modules/sinkron/sandi-arsip");
    const isi = Buffer.from("INSERT INTO perkara VALUES (1,'rahasia para pihak');");
    const tersandi = sandikanBuffer(isi, "kata-sandi-arsip-uji");
    expect(tersandi.subarray(0, 8).toString()).toBe("ALETASNK");
    expect(tersandi.includes(Buffer.from("rahasia"))).toBe(false);
    expect(bukaSandiBuffer(tersandi, "kata-sandi-arsip-uji").equals(isi)).toBe(true);
    expect(() => bukaSandiBuffer(tersandi, "sandi-yang-salah-sekali")).toThrow(/salah atau arsip rusak/);
    const diubah = Buffer.from(tersandi);
    diubah[12] = diubah[12] === 1 ? 2 : 1; // parameter p di kepala (ikut diautentikasi)
    expect(() => bukaSandiBuffer(diubah, "kata-sandi-arsip-uji")).toThrow();
  });

  it("aliran server -> berkas, dibuka server DAN alat laptop", async () => {
    const { AliranSandi, bukaSandiBerkas } = await import("@/server/modules/sinkron/sandi-arsip");
    const { pipeline } = await import("node:stream/promises");
    const { Readable } = await import("node:stream");
    const { createWriteStream } = await import("node:fs");
    const besar = Buffer.alloc(3 * 1024 * 1024 + 17, 7);
    const masuk = path.join(direktori, "uji.bin.aleta-enc");
    await pipeline(Readable.from([besar.subarray(0, 1000), besar.subarray(1000)]), new AliranSandi("sandi-aliran-12345"), createWriteStream(masuk));
    const keluar = path.join(direktori, "uji.bin");
    await bukaSandiBerkas(masuk, keluar, "sandi-aliran-12345");
    expect((await readFile(keluar)).equals(besar)).toBe(true);

    const laptop = await alatLaptop();
    expect(laptop.bukaSandiBuffer(await readFile(masuk), "sandi-aliran-12345").equals(besar)).toBe(true);
    const keluarLaptop = path.join(direktori, "uji-laptop.bin");
    await laptop.bukaSandiBerkas(masuk, keluarLaptop, "sandi-aliran-12345");
    expect((await readFile(keluarLaptop)).equals(besar)).toBe(true);
    await expect(laptop.bukaSandiBerkas(masuk, path.join(direktori, "x.bin"), "salah-salah-salah")).rejects.toThrow(/salah/);
  });
});

// ============================================================================
// 4. ALAT LAPTOP: `sipp` TIDAK PERNAH DISENTUH
// ============================================================================

describe("alat laptop menolak basis data sipp", () => {
  it("tujuan sipp dalam bentuk apa pun ditolak - juga pada sumber yang tidak aktif", async () => {
    const laptop = await alatLaptop();
    for (const nama of ["sipp", "SIPP", " Sipp ", "`sipp`", "``SiPp``"]) {
      expect(() => laptop.periksaTujuanMysql(nama, "sipp"), nama).toThrow(/DITOLAK/);
      expect(() => laptop.periksaKonfigurasi({ pulihkan: { sipp: { aktif: false, basisData: nama } } }), nama).toThrow(/DITOLAK/);
      expect(() => laptop.periksaKonfigurasi({ pulihkan: { abt: { aktif: true, basisData: nama } } }), nama).toThrow(/DITOLAK/);
    }
    const sah = laptop.periksaKonfigurasi({ pulihkan: { sipp: { aktif: true, basisData: "sipp_donggala" } } });
    expect(sah.pulihkan.sipp.basisData).toBe("sipp_donggala");
    expect(() => laptop.periksaTujuanMysql("sipp;drop", "x")).toThrow(/tidak sah/);
    expect(() => laptop.periksaKonfigurasi({ folderSimpan: "C:/Users/x/sinkron" })).toThrow(/drive C:/);
  });

  it("aliran SQL yang memuat USE/CREATE DATABASE dihentikan, juga bila terbelah potongan", async () => {
    const laptop = await alatLaptop();
    const { pipeline } = await import("node:stream/promises");
    const { Readable, Writable } = await import("node:stream");
    const buang = () => new Writable({ write: (_c, _e, s) => s() });
    await expect(
      pipeline(Readable.from([Buffer.from("SET NAMES utf8mb4;\nINSERT INTO t VALUES (1);\nUS"), Buffer.from("E sipp;\n")]), new laptop.PenjagaSql(), buang())
    ).rejects.toThrow(/DITOLAK/);
    await expect(pipeline(Readable.from([Buffer.from("x;\ncreate database sipp;\n")]), new laptop.PenjagaSql(), buang())).rejects.toThrow(/DITOLAK/);
    await expect(
      pipeline(Readable.from([Buffer.from("-- Tanpa CREATE DATABASE/USE: sebut tujuan\nINSERT INTO t VALUES ('USE sipp');\n")]), new laptop.PenjagaSql(), buang())
    ).resolves.toBeUndefined();
  });
});

// ============================================================================
// 5-6. RUTE ADMIN: RAHASIA DAN KEWENANGAN
// ============================================================================

async function panggil(cara: "GET" | "PUT" | "POST", jalur: "pengaturan" | "aksi", badan?: unknown) {
  const rute = jalur === "aksi" ? await import("@/app/api/admin/sinkron/aksi/route") : await import("@/app/api/admin/sinkron/route");
  const req = new NextRequest("http://localhost/api/admin/sinkron", {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const fungsi = (rute as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawab = await fungsi(req);
  const teks = await jawab.text();
  return { status: jawab.status, teks, isi: JSON.parse(teks) as { ok: boolean; data: any; error?: { message: string } } };
}

describe("rute admin sinkron", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    await rm(path.join(direktori, "pengaturan.json"), { force: true });
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("kewenangan: tanpa sesi 401, hakim 403, Admin melihat saja, Super Admin menyimpan", async () => {
    aktor = null;
    expect((await panggil("GET", "pengaturan")).status).toBe(401);
    aktor = "usr-hakim";
    expect((await panggil("GET", "pengaturan")).status).toBe(403);
    aktor = "usr-admin";
    const lihat = await panggil("GET", "pengaturan");
    expect(lihat.status).toBe(200);
    expect(lihat.isi.data.bolehUbah).toBe(false);
    expect((await panggil("PUT", "pengaturan", { cadangan: { aktif: true } })).status).toBe(403);
    expect((await panggil("POST", "aksi", { aksi: "jalankan", tugas: "cadangan" })).status).toBe(403);
    expect((await panggil("POST", "aksi", { aksi: "token-buat", label: "x" })).status).toBe(403);
    aktor = "usr-super";
    const simpan = await panggil("PUT", "pengaturan", { cadangan: { aktif: true, jadwal: { mode: "harian", jam: "01:30", hari: 0 } } });
    expect(simpan.status).toBe(200);
    expect(simpan.isi.data.bolehUbah).toBe(true);
    expect(simpan.isi.data.pengaturan.cadangan.jadwal.jam).toBe("01:30");
  });

  it("rahasia tidak pernah keluar lewat jawaban API, dan token laptop hanya sekali", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const SANDI = "Sandi-Arsip-Rahasia-2026";
    const SECRET = "GOCSPX-rahasiaKlienUji123";
    const simpan = await panggil("PUT", "pengaturan", {
      sandiBaru: SANDI,
      petunjukSandi: "di brankas",
      clientSecretBaru: SECRET,
      akunLayananJsonBaru: JSON.stringify({ type: "service_account", client_email: "alet@proyek.iam.gserviceaccount.com", private_key: pem }),
      drive: { aktif: true, metode: "akun-layanan", oauth: { clientId: "123-abc.apps.googleusercontent.com" } },
    });
    expect(simpan.status).toBe(200);
    const token = await panggil("POST", "aksi", { aksi: "token-buat", label: "Laptop uji" });
    expect(token.status).toBe(200);
    expect(token.isi.data.token).toMatch(/^aletasnk_/);
    const lihat = await panggil("GET", "pengaturan");

    for (const teks of [simpan.teks, lihat.teks]) {
      expect(teks).not.toContain(SANDI);
      expect(teks).not.toContain(SECRET);
      expect(teks).not.toContain("PRIVATE KEY");
      expect(teks).not.toContain("enc:v1");
      expect(teks).not.toContain(token.isi.data.token);
    }
    expect(lihat.isi.data.pengaturan.enkripsi).toMatchObject({ sandiAda: true, sandiTerbaca: true, petunjuk: "di brankas" });
    expect(lihat.isi.data.pengaturan.drive.akunLayanan).toEqual({ ada: true, email: "alet@proyek.iam.gserviceaccount.com" });
    expect(lihat.isi.data.pengaturan.drive.oauth.clientSecretAda).toBe(true);

    // Berkas di disk: tersandi, bukan nilai asli.
    const berkas = await readFile(path.join(direktori, "pengaturan.json"), "utf8");
    expect(berkas).not.toContain(SANDI);
    expect(berkas).not.toContain(SECRET);
    expect(berkas).not.toContain(token.isi.data.token);
    expect(berkas).not.toContain("PRIVATE KEY");

    // Mengirim ulang bentuk layar tanpa isian rahasia TIDAK menghapus rahasia.
    await panggil("PUT", "pengaturan", { cadangan: lihat.isi.data.pengaturan.cadangan });
    const lagi = await panggil("GET", "pengaturan");
    expect(lagi.isi.data.pengaturan.enkripsi.sandiAda).toBe(true);
    expect(lagi.isi.data.pengaturan.drive.akunLayanan.ada).toBe(true);
  });

  it("sandi arsip terlalu pendek ditolak 400", async () => {
    const h = await panggil("PUT", "pengaturan", { sandiBaru: "pendek" });
    expect(h.status).toBe(400);
    expect(h.isi.error?.message).toMatch(/12 aksara/);
  });
});

// ============================================================================
// TARIK LAPTOP
// ============================================================================

describe("rute tarik laptop", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await rm(path.join(direktori, "pengaturan.json"), { force: true });
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("token sah mengunduh (dengan Range); dicabut 401; nama di luar manifest 404", async () => {
    const pengaturan = await import("@/server/modules/sinkron/pengaturan");
    let p = pengaturan.normalkanPengaturan({ laptop: { aktif: true } });
    const dibuat = pengaturan.buatTokenLaptop(p, "Laptop", "uji");
    p = dibuat.pengaturan;
    await pengaturan.tulisPengaturan(p);

    const bundel = "20260930-020000";
    const dir = path.join(direktori, "arsip", bundel);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "sipp-x.sql.gz.aleta-enc"), "0123456789");
    await writeFile(
      path.join(dir, "MANIFEST.json"),
      JSON.stringify({ bundel, dibuat: "", selesai: "", versiAplikasi: "", tersandi: true, petunjukSandi: "", gagal: [], berkas: [{ nama: "sipp-x.sql.gz.aleta-enc", sumber: "sipp", byte: 10, sha256: "abc", tersandi: true, keterangan: "" }] })
    );
    await writeFile(path.join(dir, "rahasia.txt"), "tidak boleh terunduh");

    const daftar = await import("@/app/api/sinkron/laptop/daftar/route");
    const unduh = await import("@/app/api/sinkron/laptop/unduh/route");
    const minta = (url: string, token: string, rentang?: string) =>
      new NextRequest(url, { headers: { authorization: `Bearer ${token}`, ...(rentang ? { range: rentang } : {}) } });

    expect((await daftar.GET(minta("http://x/api/sinkron/laptop/daftar", "aletasnk_salah"))).status).toBe(401);
    const d = await daftar.GET(minta("http://x/api/sinkron/laptop/daftar", dibuat.token));
    expect(d.status).toBe(200);
    expect(JSON.stringify(await d.json())).toContain("sipp-x.sql.gz.aleta-enc");

    const utuh = await unduh.GET(minta(`http://x/api/sinkron/laptop/unduh?bundel=${bundel}&berkas=sipp-x.sql.gz.aleta-enc`, dibuat.token));
    expect(utuh.status).toBe(200);
    expect(await utuh.text()).toBe("0123456789");
    const sebagian = await unduh.GET(minta(`http://x/api/sinkron/laptop/unduh?bundel=${bundel}&berkas=sipp-x.sql.gz.aleta-enc`, dibuat.token, "bytes=4-"));
    expect(sebagian.status).toBe(206);
    expect(await sebagian.text()).toBe("456789");

    for (const nama of ["rahasia.txt", "../pengaturan.json", "MANIFEST.json"]) {
      const r = await unduh.GET(minta(`http://x/api/sinkron/laptop/unduh?bundel=${bundel}&berkas=${encodeURIComponent(nama)}`, dibuat.token));
      expect(r.status, nama).toBe(404);
    }
    expect((await unduh.GET(minta(`http://x/api/sinkron/laptop/unduh?bundel=..&berkas=x`, dibuat.token))).status).toBe(404);

    const id = p.laptop.token[0].id;
    await pengaturan.tulisPengaturan(pengaturan.cabutTokenLaptop(await pengaturan.bacaPengaturan(), id));
    expect((await daftar.GET(minta("http://x/api/sinkron/laptop/daftar", dibuat.token))).status).toBe(401);
  });
});

// ============================================================================
// 7. DUMP BOT, PENERIMA DUMP, DRIVE CADANGAN, JADWAL
// ============================================================================

describe("dump MySQL oleh bot - bagian murni", () => {
  const f = requireLokal(path.join(akarRepo, "aleta_bot/services/sinkronDumpFormat.js")) as {
    pastikanBacaSaja: (s: string) => string;
    nilaiSql: (v: unknown, angka: boolean) => string;
    bersihkanDefinisi: (s: string, db: string) => string;
    urutkanView: (v: Array<{ nama: string; sql: string }>) => Array<{ nama: string }>;
  };

  it("hanya pernyataan baca yang lolos ke server MySQL", () => {
    for (const sah of [
      "SELECT * FROM `perkara`",
      "SHOW FULL TABLES",
      "SHOW CREATE TABLE `perkara`",
      "SET NAMES utf8mb4",
      "SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ",
      "START TRANSACTION /*!40100 WITH CONSISTENT SNAPSHOT */",
      "ROLLBACK",
      "SELECT ';DROP TABLE x' AS a",
    ]) {
      expect(() => f.pastikanBacaSaja(sah), sah).not.toThrow();
    }
    for (const tolak of [
      "INSERT INTO perkara VALUES (1)",
      "UPDATE perkara SET x=1",
      "DELETE FROM perkara",
      "DROP TABLE perkara",
      "SET GLOBAL max_allowed_packet=1",
      "SELECT 1; DROP TABLE perkara",
      "SELECT * FROM perkara INTO OUTFILE '/tmp/x'",
      "SELECT * FROM perkara FOR UPDATE",
      "COMMIT",
      "  update perkara set a=1",
    ]) {
      expect(() => f.pastikanBacaSaja(tolak), tolak).toThrow(/ditolak/);
    }
  });

  it("literal nilai, DEFINER dan nama basis data sumber dibuang, urutan view", () => {
    expect(f.nilaiSql(null, false)).toBe("NULL");
    expect(f.nilaiSql("12.50", true)).toBe("12.50");
    expect(f.nilaiSql("12,5", true)).toBe("'12,5'");
    expect(f.nilaiSql("O'Brien\\\n", false)).toBe("'O\\'Brien\\\\\\n'");
    expect(f.nilaiSql(Buffer.from([0, 255]), false)).toBe("0x00ff");
    expect(f.nilaiSql("0000-00-00", false)).toBe("'0000-00-00'");
    const view = "CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_pihak` AS select `sipp`.`perkara`.`id` from `SIPP`.`perkara`";
    const bersih = f.bersihkanDefinisi(view, "sipp");
    expect(bersih).not.toContain("DEFINER=");
    expect(bersih).not.toMatch(/`sipp`\./i);
    expect(bersih).toContain("select `perkara`.`id` from `perkara`");
    const urut = f.urutkanView([
      { nama: "v_b", sql: "select * from `v_a`" },
      { nama: "v_a", sql: "select * from `perkara`" },
    ]);
    expect(urut.map((v) => v.nama)).toEqual(["v_a", "v_b"]);
  });
});

describe("penerima dump di portal", () => {
  const jawabGzip = (teks: string) => async () => new Response(new Uint8Array(gzipSync(Buffer.from(teks))), { status: 200 });

  it("dump utuh diterima dan disandikan; terpotong atau gagal ditolak dan berkasnya dibuang", async () => {
    const { tarikDumpBot } = await import("@/server/modules/sinkron/bot-dump");
    const { bukaSandiBuffer } = await import("@/server/modules/sinkron/sandi-arsip");
    const { existsSync } = await import("node:fs");
    const { gunzipSync } = await import("node:zlib");
    const jalur = path.join(direktori, "dump.sql.gz.aleta-enc");
    const utuh = "SET NAMES utf8mb4;\nINSERT INTO t VALUES (1);\n-- ALETA-DUMP-SELESAI tabel=1 baris=1 view=0 rutin=0 trigger=0\n";
    const h = await tarikDumpBot("sipp", jalur, "sandi-dump-12345", { fetchImpl: jawabGzip(utuh) as unknown as typeof fetch });
    expect(h.ringkasan).toContain("tabel=1");
    expect(gunzipSync(bukaSandiBuffer(await readFile(jalur), "sandi-dump-12345")).toString()).toBe(utuh);

    await expect(
      tarikDumpBot("sipp", jalur, "", { fetchImpl: jawabGzip("SET NAMES utf8;\nINSERT INTO t VALUES (1);\n") as unknown as typeof fetch })
    ).rejects.toThrow(/terpotong/);
    expect(existsSync(jalur)).toBe(false);
    await expect(
      tarikDumpBot("sipp", jalur, "", { fetchImpl: jawabGzip("SET NAMES utf8;\n-- ALETA-DUMP-GAGAL: Table 'x' crashed\n") as unknown as typeof fetch })
    ).rejects.toThrow(/crashed/);
    expect(existsSync(jalur)).toBe(false);
  });
});

describe("cadangan ke Drive dan jadwal", () => {
  it("arsip TIDAK tersandi ditolak untuk Drive", async () => {
    const { unggahCadanganKeDrive } = await import("@/server/modules/sinkron/drive-cadangan");
    const { normalkanPengaturan } = await import("@/server/modules/sinkron/pengaturan");
    const bundel = "20260929-020000";
    const dir = path.join(direktori, "arsip", bundel);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "MANIFEST.json"),
      JSON.stringify({ bundel, dibuat: "", selesai: "", versiAplikasi: "", tersandi: false, petunjukSandi: "", gagal: [], berkas: [{ nama: "sipp.sql.gz", sumber: "sipp", byte: 1, sha256: "a", tersandi: false, keterangan: "" }] })
    );
    // Bundel 20260930 dari uji laptop di atas lebih baru; sementara dipindah supaya yang ini terbaru.
    await rm(path.join(direktori, "arsip", "20260930-020000"), { recursive: true, force: true });
    const d = driveTiruan();
    await expect(unggahCadanganKeDrive(d.klien as never, normalkanPengaturan({ drive: { aktif: true } }))).rejects.toThrow(/TIDAK tersandi/);
    expect(d.unggahan).toEqual([]);
  });

  it("jatuh tempo harian dan mingguan menurut jam WITA", async () => {
    const { jatuhTempo } = await import("@/server/modules/sinkron/penjadwal");
    const harian = { mode: "harian" as const, jam: "02:00", hari: 0 };
    // 30 Sep 2026 02:05 WITA = 29 Sep 18:05 UTC.
    const kini = new Date("2026-09-29T18:05:00Z");
    expect(jatuhTempo(harian, undefined, kini)).toBe(true);
    expect(jatuhTempo(harian, "2026-09-29T18:00:30Z", kini)).toBe(false); // sudah jalan 02:00 hari ini
    expect(jatuhTempo(harian, "2026-09-28T18:00:00Z", kini)).toBe(true); // terakhir kemarin
    expect(jatuhTempo(harian, undefined, new Date("2026-09-29T17:55:00Z"))).toBe(false); // 01:55 belum
    expect(jatuhTempo({ mode: "manual", jam: "02:00", hari: 0 }, undefined, kini)).toBe(false);
    // 30 Sep 2026 = Rabu (3).
    expect(jatuhTempo({ mode: "mingguan", jam: "02:00", hari: 3 }, undefined, kini)).toBe(true);
    expect(jatuhTempo({ mode: "mingguan", jam: "02:00", hari: 1 }, undefined, kini)).toBe(false);
  });

  it("JWT akun layanan ditandatangani RS256 yang dapat diverifikasi; riwayat menyamarkan rahasia", async () => {
    const { susunJwtAkunLayanan } = await import("@/server/modules/sinkron/drive");
    const { saringRahasia } = await import("@/server/modules/sinkron/riwayat");
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = susunJwtAkunLayanan({ client_email: "a@b.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
    const [k, c, t] = jwt.split(".");
    expect(createVerify("RSA-SHA256").update(`${k}.${c}`).verify(publicKey, Buffer.from(t, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toMatchObject({ iss: "a@b.iam.gserviceaccount.com", aud: "https://oauth2.googleapis.com/token" });

    const pesan = saringRahasia(
      'gagal: refresh_token=1//0gAbCdEfGhIjKlMnOpQrStUv access_token: "ya29.a0AfH6SM" Bearer ya29.xyz aletasnk_ABCDEF sandi=Rahasia123'
    );
    for (const bocor of ["1//0gAbCd", "ya29.", "aletasnk_ABCDEF", "Rahasia123"]) expect(pesan).not.toContain(bocor);
  });
});
